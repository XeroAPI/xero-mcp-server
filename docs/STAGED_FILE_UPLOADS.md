# Staged File Uploads

This document defines the approved file upload pattern for hosted MCP connectors
that need to upload user-selected local files to an upstream API such as Xero.

## Goal

Hosted MCP servers cannot read files from a user's local machine. Sending file
bytes through MCP tool arguments as base64 is expensive, error-prone, and makes
tool calls unnecessarily large. File bytes should move through a normal HTTP
multipart upload path, while MCP tool calls carry only small metadata and a
server-issued staged file handle.

## Approved Flow

1. Claude decides a file is needed and calls `prepare-file-upload`.
2. The MCP server creates a short-lived upload session and returns an
   `uploadUrl` plus a signed `stagedFileId`.
3. Cowork uploads the user-selected local file to `uploadUrl` using multipart
   form data.
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

By default, `uploadUrl` uses the same MCP connector endpoint with a
`stagedUploadId` query parameter. This keeps the multipart upload inside host
application sandboxes that only allow calls to the configured connector path.
The server also accepts the cleaner path form
`POST /mcp/uploads/<stagedFileId>` for hosts that allow connector subpaths.
These staged upload endpoints intentionally do not require OAuth bearer auth;
the signed, high-entropy, short-lived `stagedFileId` acts as a capability token.
Normal MCP tool calls, including the final Xero upload call, still require MCP
authentication.

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

For this MVP, when a `stagedFileId` exists but the local file is missing, the
server should return a retryable error:

```json
{
  "code": "STAGED_UPLOAD_NOT_FOUND_ON_THIS_INSTANCE",
  "retryable": true,
  "message": "The staged file was not found on this MCP server instance. It may have been uploaded to another Cloud Run instance or removed after expiry. Retry the same Xero upload tool call up to 3 times. If it still fails, prepare a new upload session and re-upload the file."
}
```

Claude-facing instructions should say to retry the same Xero upload tool call up
to 3 times for this error. If all retries fail, Claude should prepare a new
upload session and Cowork should re-upload the selected file.

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
