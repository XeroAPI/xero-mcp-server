import { readFile } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";

import { decodeBase64FileContent } from "./decode-base64-file-content.js";

const mimeTypeByExtension: Record<string, string> = {
  ".7z": "application/x-7z-compressed",
  ".bmp": "image/bmp",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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

export interface ResolvedFileInput {
  body: Buffer;
  contentType: string;
}

function detectMimeTypeFromFilePath(filePath: string): string | null {
  return mimeTypeByExtension[extname(filePath).toLowerCase()] ?? null;
}

export async function resolveFileInput(
  filePath?: string,
  fileContent?: string,
  contentType?: string,
): Promise<ResolvedFileInput> {
  if (filePath) {
    if (!isAbsolute(filePath)) {
      throw new Error("filePath must be an absolute path.");
    }

    let body: Buffer;

    try {
      body = await readFile(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to read filePath ${filePath}: ${message}`);
    }

    if (body.byteLength === 0) {
      throw new Error(`The file at ${filePath} was empty.`);
    }

    const resolvedContentType =
      contentType ?? detectMimeTypeFromFilePath(filePath);

    if (!resolvedContentType) {
      throw new Error(
        "contentType is required when it cannot be inferred from filePath.",
      );
    }

    return {
      body,
      contentType: resolvedContentType,
    };
  }

  if (!fileContent) {
    throw new Error("Either filePath or fileContent is required.");
  }

  if (!contentType) {
    throw new Error(
      "contentType is required when fileContent is provided without filePath.",
    );
  }

  return {
    body: decodeBase64FileContent(fileContent),
    contentType,
  };
}
