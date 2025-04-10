import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Organisation } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getOrganisationDetails(): Promise<Organisation> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getOrganisations(
    xeroClient.tenantId,
    getClientHeaders(),
  );

  const organisation = response.body.organisations?.[0];

  if (!organisation) {
    throw new Error("Failed to retrieve organisation details");
  }

  return organisation;
}

/**
 * List organisation details from Xero
 */
export async function listXeroOrganisationDetails(): Promise<
  XeroClientResponse<Organisation>
> {
  try {
    const organisation = await getOrganisationDetails();

    return {
      result: organisation,
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
