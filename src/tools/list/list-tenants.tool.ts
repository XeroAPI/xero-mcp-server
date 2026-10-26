import { listXeroTenants } from "../../handlers/list-xero-tenants.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListTenantsTool = CreateXeroTool(
  "list-tenants",
  "Read-only discovery tool that lists the Xero organisations (tenants) these credentials are authorised for. \
Use it to obtain the tenantId values required by every other Xero tool. \
If the server uses a Xero Custom Connection it is bound to a single organisation, and tenantId may be omitted on other tools.",
  {},
  async () => {
    const response = await listXeroTenants();

    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing tenants: ${response.error}`,
          },
        ],
      };
    }

    const { authMode, tenants } = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text:
            authMode === "custom-connection"
              ? `Found ${tenants.length} organisation. This server uses a Xero Custom Connection, which is bound to a single organisation: tenantId may be omitted on other tools, and when supplied must be this organisation's ID.`
              : `Found ${tenants.length} authorised organisations. Supply one of these tenantId values when calling other Xero tools.`,
        },
        ...tenants.map((tenant) => ({
          type: "text" as const,
          text: [
            `Organisation: ${tenant.tenantName || "Unnamed"}`,
            `tenantId: ${tenant.tenantId || "Unknown"}`,
            `Type: ${tenant.tenantType || "Unknown"}`,
          ].join("\n"),
        })),
      ],
    };
  },
  { tenanted: false },
);

export default ListTenantsTool;
