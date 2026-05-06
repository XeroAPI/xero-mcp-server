import Busboy from "busboy";
import type { Express, Request, Response } from "express";

import {
  createInvalidMultipartUploadError,
  createUploadTooLargeError,
  failReservedStagedUpload,
  formatStagedUploadError,
  reserveStagedUpload,
  StagedUploadError,
  storeReservedStagedUpload,
} from "../helpers/staged-file-upload.js";
import type { AppConfig } from "../lib/config.js";
import type { Logger } from "../lib/logger.js";

const FORM_FIELD_NAME = "file";

function sendStagedUploadError(response: Response, error: unknown): void {
  if (error instanceof StagedUploadError) {
    response
      .status(error.httpStatus)
      .type("application/json")
      .send(formatStagedUploadError(error));
    return;
  }

  response.status(500).json({
    code: "STAGED_UPLOAD_FAILED",
    retryable: false,
    message: "The staged file upload failed.",
  });
}

function readMultipartFile(
  request: Request,
  maxBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!request.is("multipart/form-data")) {
      reject(
        createInvalidMultipartUploadError(
          "Upload requests must use multipart/form-data.",
        ),
      );
      return;
    }

    const chunks: Buffer[] = [];
    let fileSeen = false;
    let violation: StagedUploadError | null = null;

    const setViolation = (error: StagedUploadError) => {
      violation ??= error;
    };

    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fileSize: maxBytes,
        files: 1,
        fields: 0,
      },
    });

    busboy.on("file", (fieldName, file) => {
      if (fieldName !== FORM_FIELD_NAME) {
        setViolation(
          createInvalidMultipartUploadError(
            `Expected multipart file field "${FORM_FIELD_NAME}".`,
          ),
        );
        file.resume();
        return;
      }

      if (fileSeen) {
        setViolation(
          createInvalidMultipartUploadError(
            "Only one file may be uploaded for a staged upload session.",
          ),
        );
        file.resume();
        return;
      }

      fileSeen = true;

      file.on("data", (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
      });

      file.on("limit", () => {
        chunks.length = 0;
        setViolation(createUploadTooLargeError(maxBytes));
        file.resume();
      });

      file.on("error", reject);
    });

    busboy.on("field", () => {
      setViolation(
        createInvalidMultipartUploadError(
          "Unexpected multipart field. Upload exactly one file part.",
        ),
      );
    });

    busboy.on("filesLimit", () => {
      setViolation(
        createInvalidMultipartUploadError(
          "Only one file may be uploaded for a staged upload session.",
        ),
      );
    });

    busboy.on("fieldsLimit", () => {
      setViolation(
        createInvalidMultipartUploadError(
          "Unexpected multipart field. Upload exactly one file part.",
        ),
      );
    });

    busboy.on("error", reject);

    busboy.on("finish", () => {
      if (violation) {
        reject(violation);
        return;
      }

      if (!fileSeen) {
        reject(
          createInvalidMultipartUploadError(
            `Missing multipart file field "${FORM_FIELD_NAME}".`,
          ),
        );
        return;
      }

      const body = Buffer.concat(chunks);

      if (body.byteLength === 0) {
        reject(
          createInvalidMultipartUploadError("The uploaded file was empty."),
        );
        return;
      }

      resolve(body);
    });

    request.pipe(busboy);
  });
}

export function registerStagedUploadRoutes(
  app: Express,
  config: AppConfig,
  logger: Logger,
): void {
  const uploadRoute = `${config.uploads.path}/:stagedFileId`;

  app.post(uploadRoute, async (request: Request, response: Response) => {
    const stagedFileIdParam = request.params.stagedFileId;
    const stagedFileId = Array.isArray(stagedFileIdParam)
      ? stagedFileIdParam[0]
      : stagedFileIdParam;

    try {
      response.setHeader("Cache-Control", "no-store");

      await reserveStagedUpload(config.uploads, stagedFileId);
      const body = await readMultipartFile(request, config.uploads.maxBytes);
      const storedFile = await storeReservedStagedUpload(
        config.uploads,
        stagedFileId,
        body,
      );

      response.status(201).json(storedFile);
    } catch (error) {
      await failReservedStagedUpload(config.uploads, stagedFileId);

      logger.warn("staged_upload_failed", {
        stagedFileId,
        error: error instanceof Error ? error.message : String(error),
      });

      sendStagedUploadError(response, error);
    }
  });
}
