import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { Contact, Phone } from "xero-node";

/**
 * Create a new invoice in Xero
 */
export async function createXeroContact(
  name: string,
  email?: string,
  phone?: string,
): Promise<ToolResponse<Contact>> {
  try {
    await xeroClient.authenticate();

    const contact: Contact = {
      name,
      emailAddress: email,
      phones: phone
        ? [
            {
              phoneNumber: phone,
              phoneType: Phone.PhoneTypeEnum.MOBILE,
            },
          ]
        : undefined,
    };

    const response = await xeroClient.accountingApi.createContacts(
      "", // tenantId (empty string for default)
      {
        contacts: [contact],
      }, //contacts
      true, //summarizeErrors
      undefined, //idempotencyKey
      {
        headers: {
          "user-agent": `xero-mcp-server-${getPackageVersion()}`,
        },
      }, // options
    );

    const createdContact = response.body.contacts?.[0];

    if (!createdContact) {
      throw new Error("Contact creation failed.");
    }

    return {
      result: createdContact,
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
