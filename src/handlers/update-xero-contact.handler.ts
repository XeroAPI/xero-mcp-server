import { xeroClient } from "../clients/xero-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Contact, Phone, Address, Contacts } from "xero-node";

/**
 * Create a new invoice in Xero
 */
export async function updateXeroContact(
  contactId: string,
  name: string,
  firstName?: string,
  lastName?: string,
  email?: string,
  phone?: string,
  address?: Address,
): Promise<ToolResponse<Contact>> {
  try {
    await xeroClient.authenticate();

    const contact: Contact = {
      name,
      firstName,
      lastName,
      emailAddress: email,
      phones: phone
        ? [
            {
              phoneNumber: phone,
              phoneType: Phone.PhoneTypeEnum.MOBILE,
            },
          ]
        : undefined,
      addresses: address 
        ? [
            {
              addressType: Address.AddressTypeEnum.STREET,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2,
              city: address.city,
              country: address.country,
              postalCode: address.postalCode,
              region: address.region,
            },
          ]
        : undefined,
    };

    const contacts: Contacts = {
      contacts: [contact]
    };

    const response = await xeroClient.accountingApi.updateContact(
      "",
      contactId,
      contacts,
    );

    const updatedContact = response.body.contacts?.[0];

    if (!updatedContact) {
      throw new Error("Contact update failed.");
    }

    return {
      result: updatedContact,
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
