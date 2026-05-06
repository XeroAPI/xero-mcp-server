import { z } from "zod";

import { formatError } from "../../helpers/format-error.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { createStagedUploadSession } from "../../helpers/staged-file-upload.js";
import { loadConfig } from "../../lib/config.js";

const PrepareFileUploadTool = CreateXeroTool(
  "prepare-file-upload",
  "Create a short-lived staged upload session for a user-selected file. Cowork must upload the file bytes to the returned uploadUrl using multipart form data before any Xero upload tool is called. Use this tool before `add-attachment` or `upload-file`; never send base64 file bytes or arbitrary local file paths.",
  {
    fileName: z
      .string()
      .describe("The user-selected filename, for example invoice-2026-03.pdf."),
    contentType: z
      .string()
      .optional()
      .describe(
        "Optional MIME type of the file, for example application/pdf or image/png. If omitted, the server attempts to infer it from fileName.",
      ),
    purpose: z
      .enum(["xero-attachment", "xero-file"])
      .describe(
        "Use xero-attachment when the file will be attached to a Xero object, or xero-file when it will be uploaded to Xero Files.",
      ),
  },
  async ({ fileName, contentType, purpose }) => {
    try {
      const config = loadConfig();
      const uploadSession = await createStagedUploadSession(config.uploads, {
        fileName,
        contentType,
        purpose,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(uploadSession, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error preparing file upload:\n${formatError(error)}`,
          },
        ],
      };
    }
  },
);

export default PrepareFileUploadTool;
