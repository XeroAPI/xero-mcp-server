import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getPackageVersion } from "../helpers/get-package-version.js";
import { Contact, Phone } from "xero-node";

async function createContact(
  name: string,
  email?: string,
  phone?: string,
): Promise<Contact | undefined> {
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
    xeroClient.tenantId,
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

  return response.body.contacts?.[0];
}

/**
 * Create a new invoice in Xero
 */
export async function createXeroContact(
  name: string,
  email?: string,
  phone?: string,
): Promise<ToolResponse<Contact>> {
  try {
    const createdContact = await createContact(name, email, phone);

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
