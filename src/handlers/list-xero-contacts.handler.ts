import { xeroClient } from "../clients/xero-client.js";
import { Contacts } from "xero-node";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

/**
 * List all contacts from Xero
 */
export async function listXeroContacts(): Promise<ToolResponse<Contacts>> {
  try {
    await xeroClient.authenticate();

    const contacts = await xeroClient.accountingApi.getContacts("");

    return {
      result: contacts.body,
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
