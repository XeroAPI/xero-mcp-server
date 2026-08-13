import {
  CustomConnectionsXeroClient,
  xeroClient,
} from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface XeroTenantSummary {
  tenantId: string;
  tenantName: string;
  tenantType: string;
}

export interface XeroTenantList {
  authMode: "bearer" | "custom-connection";
  tenants: XeroTenantSummary[];
}

const listBearerTenants = (): XeroTenantSummary[] =>
  // Only the fields a caller needs to target an organisation: no tokens, no
  // connection or authorisation event metadata.
  (xeroClient.tenants ?? []).map((tenant) => ({
    tenantId: String(tenant?.tenantId ?? ""),
    tenantName: String(tenant?.tenantName ?? ""),
    tenantType: String(tenant?.tenantType ?? ""),
  }));

const listCustomConnectionTenant = async (
  client: CustomConnectionsXeroClient,
): Promise<XeroTenantSummary[]> => {
  const organisation = await client.getBoundOrganisation();

  return [
    {
      tenantId: client.boundTenantId || (organisation.organisationID ?? ""),
      tenantName: organisation.name ?? "",
      tenantType: "ORGANISATION",
    },
  ];
};

/**
 * List the Xero organisations this server's credentials are authorised for.
 */
export async function listXeroTenants(): Promise<
  XeroClientResponse<XeroTenantList>
> {
  try {
    await xeroClient.authenticate();

    const customConnectionClient =
      xeroClient instanceof CustomConnectionsXeroClient ? xeroClient : null;

    return {
      result: {
        authMode: customConnectionClient ? "custom-connection" : "bearer",
        tenants: customConnectionClient
          ? await listCustomConnectionTenant(customConnectionClient)
          : listBearerTenants(),
      },
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
