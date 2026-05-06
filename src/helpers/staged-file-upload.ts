import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";

export const STAGED_UPLOAD_NOT_FOUND_CODE =
  "STAGED_UPLOAD_NOT_FOUND_ON_THIS_INSTANCE";

const DEFAULT_FORM_FIELD_NAME = "file";
const stagedFileIdPattern = /^upl_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const processLocalSigningSecret = randomBytes(32).toString("base64url");

const mimeTypeByExtension: Record<string, string> = {
  ".7z": "application/x-7z-compressed",
  ".bmp": "image/bmp",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".eml": "message/rfc822",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".key": "application/vnd.apple.keynote",
  ".keynote": "application/vnd.apple.keynote",
  ".msg": "application/vnd.ms-outlook",
  ".numbers": "application/vnd.apple.numbers",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".pages": "application/vnd.apple.pages",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".rar": "application/vnd.rar",
  ".rtf": "application/rtf",
  ".text": "text/plain",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".txt": "text/plain",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

export type StagedUploadPurpose = "xero-attachment" | "xero-file";

export interface StagedUploadSettings {
  publicBaseUrl?: string;
  path: string;
  tempDir: string;
  maxBytes: number;
  ttlSeconds: number;
  signingSecret?: string;
}

export interface CreateStagedUploadSessionInput {
  fileName: string;
  contentType?: string;
  purpose: StagedUploadPurpose;
}

export interface StagedUploadSessionResponse {
  stagedFileId: string;
  uploadUrl: string;
  uploadMethod: "POST";
  formFieldName: string;
  expiresAt: string;
  maxBytes: number;
}

export interface StoredStagedUploadResponse {
  stagedFileId: string;
  fileName: string;
  contentType: string;
  size: number;
  expiresAt: string;
}

export interface ResolvedStagedFileInput {
  body: Buffer;
  contentType: string;
  size: number;
  cleanup: () => Promise<void>;
}

type StagedUploadStatus = "prepared" | "uploading" | "uploaded" | "consumed";

interface StagedUploadSession {
  stagedFileId: string;
  fileName: string;
  safeFileName: string;
  contentType: string;
  purpose: StagedUploadPurpose;
  createdAtMs: number;
  expiresAtMs: number;
  status: StagedUploadStatus;
  filePath?: string;
  size?: number;
}

interface StagedUploadTokenPayload {
  v: 1;
  nonce: string;
  fileName: string;
  safeFileName: string;
  contentType: string;
  purpose: StagedUploadPurpose;
  iat: number;
  exp: number;
}

export class StagedUploadError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly httpStatus: number;

  constructor(
    code: string,
    message: string,
    retryable: boolean,
    httpStatus: number,
  ) {
    super(message);
    this.name = "StagedUploadError";
    this.code = code;
    this.retryable = retryable;
    this.httpStatus = httpStatus;
  }
}

const sessions = new Map<string, StagedUploadSession>();

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSigningSecret(settings: StagedUploadSettings): string {
  return settings.signingSecret ?? processLocalSigningSecret;
}

function signPayload(settings: StagedUploadSettings, payload: string): string {
  return createHmac("sha256", getSigningSecret(settings))
    .update(payload)
    .digest("base64url");
}

function createStagedFileId(
  settings: StagedUploadSettings,
  payload: StagedUploadTokenPayload,
): string {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(settings, encodedPayload);
  return `upl_${encodedPayload}.${signature}`;
}

function verifyStagedFileId(
  settings: StagedUploadSettings,
  stagedFileId: string,
): StagedUploadTokenPayload {
  if (!stagedFileIdPattern.test(stagedFileId)) {
    throw createInvalidUploadError(
      "stagedFileId is not a valid staged upload ID.",
    );
  }

  const [encodedPayload, signature] = stagedFileId.slice(4).split(".");

  if (!encodedPayload || !signature) {
    throw createInvalidUploadError(
      "stagedFileId is not a valid staged upload ID.",
    );
  }

  const expectedSignature = signPayload(settings, encodedPayload);
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw createInvalidUploadError("stagedFileId signature is invalid.");
  }

  let payload: StagedUploadTokenPayload;

  try {
    payload = JSON.parse(
      decodeBase64Url(encodedPayload),
    ) as StagedUploadTokenPayload;
  } catch {
    throw createInvalidUploadError("stagedFileId payload is invalid.");
  }

  if (
    payload.v !== 1 ||
    typeof payload.nonce !== "string" ||
    typeof payload.fileName !== "string" ||
    typeof payload.safeFileName !== "string" ||
    typeof payload.contentType !== "string" ||
    (payload.purpose !== "xero-attachment" &&
      payload.purpose !== "xero-file") ||
    !Number.isFinite(payload.iat) ||
    !Number.isFinite(payload.exp)
  ) {
    throw createInvalidUploadError("stagedFileId payload is invalid.");
  }

  if (Date.now() > payload.exp) {
    throw createExpiredUploadError();
  }

  return payload;
}

export function formatStagedUploadError(error: StagedUploadError): string {
  return JSON.stringify(
    {
      code: error.code,
      retryable: error.retryable,
      message: error.message,
    },
    null,
    2,
  );
}

function createNotFoundOnThisInstanceError(): StagedUploadError {
  return new StagedUploadError(
    STAGED_UPLOAD_NOT_FOUND_CODE,
    "The staged file was not found on this MCP server instance. It may have been uploaded to another Cloud Run instance or removed after expiry. Retry the same Xero upload tool call up to 3 times. If it still fails, prepare a new upload session and re-upload the file.",
    true,
    404,
  );
}

function createInvalidUploadError(message: string): StagedUploadError {
  return new StagedUploadError("STAGED_UPLOAD_INVALID", message, false, 400);
}

function createExpiredUploadError(): StagedUploadError {
  return new StagedUploadError(
    "STAGED_UPLOAD_EXPIRED",
    "The staged upload session has expired. Prepare a new upload session and re-upload the file.",
    false,
    410,
  );
}

export function createUploadTooLargeError(maxBytes: number): StagedUploadError {
  return new StagedUploadError(
    "STAGED_UPLOAD_TOO_LARGE",
    `The uploaded file exceeds the maximum allowed size of ${maxBytes} bytes.`,
    false,
    413,
  );
}

export function createInvalidMultipartUploadError(
  message: string,
): StagedUploadError {
  return new StagedUploadError(
    "STAGED_UPLOAD_INVALID_MULTIPART",
    message,
    false,
    400,
  );
}

function assertValidStagedFileId(stagedFileId: string): void {
  if (!stagedFileIdPattern.test(stagedFileId)) {
    throw createInvalidUploadError(
      "stagedFileId is not a valid staged upload ID.",
    );
  }
}

function detectMimeTypeFromFileName(fileName: string): string | null {
  return mimeTypeByExtension[extname(fileName).toLowerCase()] ?? null;
}

function sanitizeFileName(fileName: string): string {
  const baseName = basename(fileName)
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .trim();

  if (!baseName || baseName === "." || baseName === "..") {
    throw createInvalidUploadError("fileName must include a usable filename.");
  }

  return baseName.slice(0, 180);
}

function validateContentType(contentType: string): string {
  const trimmed = contentType.trim();

  if (!trimmed) {
    throw createInvalidUploadError("contentType must not be empty.");
  }

  if (/[\r\n]/.test(trimmed)) {
    throw createInvalidUploadError("contentType must not contain line breaks.");
  }

  return trimmed;
}

function resolveContentType(
  fileName: string,
  contentType: string | undefined,
): string {
  if (contentType) {
    return validateContentType(contentType);
  }

  const inferredContentType = detectMimeTypeFromFileName(fileName);

  if (!inferredContentType) {
    throw createInvalidUploadError(
      "contentType is required when it cannot be inferred from fileName.",
    );
  }

  return inferredContentType;
}

function getUploadRoot(settings: StagedUploadSettings): string {
  return resolve(settings.tempDir);
}

function assertPathInsideRoot(root: string, targetPath: string): void {
  const relativePath = relative(root, targetPath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw createInvalidUploadError(
      "Resolved upload path escaped the temp root.",
    );
  }
}

function getUploadDirectory(
  settings: StagedUploadSettings,
  stagedFileId: string,
): string {
  assertValidStagedFileId(stagedFileId);

  const root = getUploadRoot(settings);
  const directoryName = `upl_${createHash("sha256")
    .update(stagedFileId)
    .digest("base64url")}`;
  const directory = resolve(root, directoryName);
  assertPathInsideRoot(root, directory);
  return directory;
}

function getUploadPath(
  settings: StagedUploadSettings,
  session: StagedUploadSession,
): string {
  const directory = getUploadDirectory(settings, session.stagedFileId);
  const filePath = resolve(directory, session.safeFileName);
  assertPathInsideRoot(directory, filePath);
  return filePath;
}

function getUploadUrl(
  settings: StagedUploadSettings,
  stagedFileId: string,
): string {
  if (!settings.publicBaseUrl) {
    throw new StagedUploadError(
      "STAGED_UPLOAD_PUBLIC_BASE_URL_REQUIRED",
      "MCP_PUBLIC_BASE_URL is required to prepare hosted file uploads.",
      false,
      500,
    );
  }

  const uploadPath = `${settings.path.replace(/\/+$/, "")}/${encodeURIComponent(
    stagedFileId,
  )}`;
  return new URL(uploadPath, `${settings.publicBaseUrl}/`).toString();
}

function getExpiresAt(session: StagedUploadSession): string {
  return new Date(session.expiresAtMs).toISOString();
}

function createSessionFromToken(
  settings: StagedUploadSettings,
  stagedFileId: string,
): StagedUploadSession {
  const payload = verifyStagedFileId(settings, stagedFileId);

  return {
    stagedFileId,
    fileName: payload.fileName,
    safeFileName: payload.safeFileName,
    contentType: payload.contentType,
    purpose: payload.purpose,
    createdAtMs: payload.iat,
    expiresAtMs: payload.exp,
    status: "prepared",
  };
}

function getSession(
  settings: StagedUploadSettings,
  stagedFileId: string,
): StagedUploadSession {
  const session = sessions.get(stagedFileId);

  if (session) {
    verifyStagedFileId(settings, stagedFileId);
    return session;
  }

  const reconstructedSession = createSessionFromToken(settings, stagedFileId);
  sessions.set(stagedFileId, reconstructedSession);
  return reconstructedSession;
}

function assertSessionIsCurrent(session: StagedUploadSession): void {
  if (Date.now() > session.expiresAtMs) {
    throw createExpiredUploadError();
  }
}

async function deleteSessionFiles(
  settings: StagedUploadSettings,
  stagedFileId: string,
): Promise<void> {
  await rm(getUploadDirectory(settings, stagedFileId), {
    recursive: true,
    force: true,
  });
}

export async function cleanupStagedUpload(
  settings: StagedUploadSettings,
  stagedFileId: string,
): Promise<void> {
  if (stagedFileIdPattern.test(stagedFileId)) {
    sessions.delete(stagedFileId);
    await deleteSessionFiles(settings, stagedFileId);
  }
}

export async function cleanupExpiredStagedUploads(
  settings: StagedUploadSettings,
): Promise<number> {
  const now = Date.now();
  const expiredIds = [...sessions.values()]
    .filter((session) => now > session.expiresAtMs)
    .map((session) => session.stagedFileId);

  await Promise.all(
    expiredIds.map((stagedFileId) =>
      cleanupStagedUpload(settings, stagedFileId),
    ),
  );

  return expiredIds.length;
}

export async function createStagedUploadSession(
  settings: StagedUploadSettings,
  input: CreateStagedUploadSessionInput,
): Promise<StagedUploadSessionResponse> {
  await cleanupExpiredStagedUploads(settings);

  const fileName = input.fileName.trim();
  const safeFileName = sanitizeFileName(fileName);
  const contentType = resolveContentType(fileName, input.contentType);
  const createdAtMs = Date.now();
  const expiresAtMs = createdAtMs + settings.ttlSeconds * 1000;
  const stagedFileId = createStagedFileId(settings, {
    v: 1,
    nonce: randomBytes(24).toString("base64url"),
    fileName,
    safeFileName,
    contentType,
    purpose: input.purpose,
    iat: createdAtMs,
    exp: expiresAtMs,
  });
  const session: StagedUploadSession = {
    stagedFileId,
    fileName,
    safeFileName,
    contentType,
    purpose: input.purpose,
    createdAtMs,
    expiresAtMs,
    status: "prepared",
  };

  sessions.set(stagedFileId, session);
  await mkdir(getUploadDirectory(settings, stagedFileId), { recursive: true });

  return {
    stagedFileId,
    uploadUrl: getUploadUrl(settings, stagedFileId),
    uploadMethod: "POST",
    formFieldName: DEFAULT_FORM_FIELD_NAME,
    expiresAt: getExpiresAt(session),
    maxBytes: settings.maxBytes,
  };
}

export async function reserveStagedUpload(
  settings: StagedUploadSettings,
  stagedFileId: string,
): Promise<void> {
  await cleanupExpiredStagedUploads(settings);

  const session = getSession(settings, stagedFileId);
  assertSessionIsCurrent(session);

  if (session.status === "uploaded" || session.status === "consumed") {
    throw new StagedUploadError(
      "STAGED_UPLOAD_ALREADY_UPLOADED",
      "This staged upload session already has a file. Prepare a new upload session for another file.",
      false,
      409,
    );
  }

  session.status = "uploading";
  await rm(getUploadDirectory(settings, stagedFileId), {
    recursive: true,
    force: true,
  });
  await mkdir(getUploadDirectory(settings, stagedFileId), { recursive: true });
}

export async function failReservedStagedUpload(
  settings: StagedUploadSettings,
  stagedFileId: string,
): Promise<void> {
  const session = sessions.get(stagedFileId);

  if (session?.status === "uploading") {
    session.status = "prepared";
    session.filePath = undefined;
    session.size = undefined;
    await deleteSessionFiles(settings, stagedFileId);
    await mkdir(getUploadDirectory(settings, stagedFileId), {
      recursive: true,
    });
  }
}

export async function storeReservedStagedUpload(
  settings: StagedUploadSettings,
  stagedFileId: string,
  body: Buffer,
): Promise<StoredStagedUploadResponse> {
  const session = getSession(settings, stagedFileId);
  assertSessionIsCurrent(session);

  if (session.status !== "uploading") {
    throw createInvalidUploadError(
      "The staged upload session is not ready to receive a file.",
    );
  }

  if (body.byteLength === 0) {
    throw createInvalidMultipartUploadError("The uploaded file was empty.");
  }

  if (body.byteLength > settings.maxBytes) {
    throw createUploadTooLargeError(settings.maxBytes);
  }

  const filePath = getUploadPath(settings, session);
  await writeFile(filePath, body, { flag: "wx" });

  session.filePath = filePath;
  session.size = body.byteLength;
  session.status = "uploaded";

  return {
    stagedFileId,
    fileName: session.fileName,
    contentType: session.contentType,
    size: body.byteLength,
    expiresAt: getExpiresAt(session),
  };
}

export async function resolveStagedFileInput(
  settings: StagedUploadSettings,
  stagedFileId: string,
): Promise<ResolvedStagedFileInput> {
  await cleanupExpiredStagedUploads(settings);

  const session = getSession(settings, stagedFileId);
  assertSessionIsCurrent(session);

  if (session.status === "consumed") {
    throw createNotFoundOnThisInstanceError();
  }

  const filePath = session.filePath ?? getUploadPath(settings, session);
  session.filePath = filePath;

  try {
    const fileStats = await stat(filePath);

    if (!fileStats.isFile() || fileStats.size <= 0) {
      throw createNotFoundOnThisInstanceError();
    }

    const body = await readFile(filePath);

    if (body.byteLength === 0) {
      throw createNotFoundOnThisInstanceError();
    }

    session.status = "consumed";

    return {
      body,
      contentType: session.contentType,
      size: body.byteLength,
      cleanup: () => cleanupStagedUpload(settings, stagedFileId),
    };
  } catch (error) {
    if (error instanceof StagedUploadError) {
      throw error;
    }

    throw createNotFoundOnThisInstanceError();
  }
}
