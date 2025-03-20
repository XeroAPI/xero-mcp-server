import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createXeroContact } from "../handlers/create-xero-contact.handler.js";
import { z } from "zod";

export const CreateContactTool = (server: McpServer) => {
  server.tool(
    "create-contact",
    {
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    },
    async (
      { name, email, phone }: { name: string; email?: string; phone?: string },
      //_extra: { signal: AbortSignal },
    ) => {
      try {
        const response = await createXeroContact(name, email, phone);
        if (response.isError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error listing contacts: ${response.error}`,
              },
            ],
          };
        }

        const contact = response.result;

        return {
          content: [
            {
              type: "text" as const,
              text: `Contact created: ${contact.name} (ID: ${contact.contactID})`,
            },
          ],
        };
      } catch (error: unknown) {
        let errorMessage = "Unknown error";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "object" && error !== null) {
          errorMessage = JSON.stringify(error);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating contact: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
};
