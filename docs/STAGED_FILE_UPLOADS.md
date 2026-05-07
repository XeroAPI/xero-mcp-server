# Staged File Uploads

This document defines the approved Xero file upload pattern for hosted MCP
deployments. The same pattern is also useful for other hosted connectors that
need to upload user-selected local files to an upstream API.

The reusable version of this guidance lives in the sibling connector monorepo:
`../mcp-connectors/docs/STAGED_FILE_UPLOAD_PATTERN.md`.

## Goal

Hosted MCP servers cannot read files from a user's local machine. Sending file
bytes through MCP tool arguments as base64 is expensive, error-prone, and makes
tool calls unnecessarily large. File bytes should move through a normal HTTP
multipart upload path, while MCP tool calls carry only small metadata and a
server-issued staged file handle.

The intended split is:

- Claude uses MCP tools to request and consume a staged upload.
- Cowork uploads the selected local file bytes to the returned URL.
- The Xero MCP server reads the staged file and uploads it to Xero.

## Approved Flow

1. Claude decides a file is needed and calls `prepare-file-upload`.
2. The MCP server creates a short-lived upload session and returns an
   `uploadUrl` plus a signed `stagedFileId`.
3. Cowork uploads the user-selected local file to the exact `uploadUrl` using
   multipart form data. This upload is host application work; it should not be a
   Claude shell `curl` call and should not pass file bytes through MCP tool
   arguments.
4. Claude calls the final Xero tool, such as `add-attachment` or `upload-file`,
   with `stagedFileId` and the Xero-specific arguments.
5. The MCP server validates the staged file, reads it from its temp directory,
   uploads it to Xero, and deletes the local staged file in a `finally` cleanup.
6. A TTL cleanup job removes abandoned upload sessions and files.

## Tool Contract

`prepare-file-upload` accepts metadata only:

```json
{
  "fileName": "invoice.pdf",
  "contentType": "application/pdf",
  "purpose": "xero-attachment"
}
```

It returns upload instructions for Cowork:

```json
{
  "stagedFileId": "upl_eyJ2IjoxLCJub25jZSI6Ii4uLiJ9.signature",
  "uploadUrl": "https://xero-mcp.example.com/mcp?stagedUploadId=upl_eyJ2IjoxLCJub25jZSI6Ii4uLiJ9.signature",
  "uploadMethod": "POST",
  "formFieldName": "file",
  "expiresAt": "2026-05-07T04:15:00.000Z",
  "maxBytes": 10485760
}
```

The final Xero upload tools accept `stagedFileId`, not raw file bytes:

```json
{
  "objectType": "Invoices",
  "objectId": "00000000-0000-0000-0000-000000000000",
  "fileName": "invoice.pdf",
  "stagedFileId": "upl_eyJ2IjoxLCJub25jZSI6Ii4uLiJ9.signature"
}
```

`uploadUrl` is the answer to "where should the file be posted?". Claude should
not invent this URL. It comes from `prepare-file-upload` and should be handed to
Cowork's file upload path exactly as returned.

By default, `uploadUrl` uses the same MCP connector endpoint with a
`stagedUploadId` query parameter. This keeps the multipart upload inside host
application sandboxes that only allow calls to the configured connector path.
The server also accepts the cleaner path form
`POST /mcp/uploads/<stagedFileId>` for hosts that allow connector subpaths.

The staged upload endpoint intentionally does not require OAuth bearer auth when
a valid signed staged upload ID is present. The signed, high-entropy,
short-lived `stagedFileId` acts as a capability token for exactly one upload
slot. Normal MCP tool calls, including the final Xero upload call, still require
MCP authentication.

## Claude And Cowork Instructions

MCP server instructions and upload tool descriptions should say:

- Use `prepare-file-upload` before `add-attachment` or `upload-file`.
- Cowork must upload the selected file bytes to the returned `uploadUrl` using
  `multipart/form-data` with the returned `formFieldName`.
- Do not send base64 file content, local `filePath` values, or arbitrary upload
  URLs.
- If the staged upload itself returns `401 Missing Authorization`, verify the
  caller used the returned `uploadUrl`. A valid staged upload URL should include
  `stagedUploadId` or `/mcp/uploads/<stagedFileId>` and should not need a bearer
  token.
- If the final Xero upload tool returns
  `STAGED_UPLOAD_NOT_FOUND_ON_THIS_INSTANCE` with `retryable=true`, retry the
  same Xero upload tool call up to 3 times. If retries fail, prepare a new
  upload session and have Cowork re-upload the selected file.

## Enforcement

The hosted MCP connector should not expose base64 upload arguments or arbitrary
local `filePath` arguments. The public tool schema should make `stagedFileId`
the only supported file input for upload operations. Server instructions and
tool descriptions should reinforce this, but the schema and server validation
are the enforcement boundary.

## Local Temp Storage MVP

The first implementation intentionally uses local temporary storage instead of
shared object storage. This is acceptable for low usage but has two important
failure modes:

- Cloud Run instance files are in-memory and do not persist after the instance
  stops.
- If Cloud Run has more than one instance, the multipart upload can land on one
  instance while the later MCP tool call lands on another.

`prepare-file-upload` tells Cowork where to upload, but local temp storage does
not provide hard instance pinning on its own. Cloud Run routing can still send
the final MCP tool call to a different instance unless the deployment layer
provides stickiness or the service is constrained to one instance.

For this MVP, when a `stagedFileId` exists but the local file is missing, the
server should return a retryable error:

```json
{
  "code": "STAGED_UPLOAD_NOT_FOUND_ON_THIS_INSTANCE",
  "retryable": true,
  "message": "The staged file was not found on this MCP server instance. It may have been uploaded to another Cloud Run instance or removed after expiry. Retry the same Xero upload tool call up to 3 times. If it still fails, prepare a new upload session and re-upload the file."
}
```

For the lowest-risk local-storage deployment, configure the service with
`max instances = 1`. The retryable error still needs to exist for instance
restarts, expiry, and future scaling.

## Security Requirements

- Generate high-entropy, unguessable `stagedFileId` values.
- Sign `stagedFileId` metadata so any service instance can validate the upload
  session without shared storage.
- Configure a stable `MCP_STAGED_UPLOAD_SIGNING_SECRET` across all instances.
  If it is omitted, the server falls back to a process-local secret and staged
  upload sessions are only valid on the process that created them.
- Treat `uploadUrl` as sensitive until it expires; anyone with the URL can
  upload one file into that staged slot.
- Keep the unauthenticated surface limited to signed staged upload POSTs. Do
  not expose unauthenticated listing, download, overwrite, delete, or final
  upstream upload operations.
- Store files under a dedicated temp root such as
  `/tmp/cowork-xero-uploads/<derived-session-dir>/`.
- Never allow callers to pass arbitrary paths for uploads.
- Sanitize uploaded file names before writing to disk.
- Enforce a maximum byte size before and during upload.
- Validate the uploaded file belongs to the expected upload session.
- Reject expired, already-consumed, missing, or empty staged files.
- Delete staged files after successful or failed Xero upload attempts.
- Avoid logging file contents, signed URLs, or sensitive local paths.

## Future Shared Storage Upgrade

If usage grows or multi-instance reliability becomes important, keep the same
MCP tool contract and replace local temp storage with shared object storage. In
that version, `prepare-file-upload` can return a signed upload URL and
`stagedFileId` can resolve to an object key instead of a local file path.
