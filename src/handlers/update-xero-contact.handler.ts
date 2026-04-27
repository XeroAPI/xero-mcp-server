import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Contact, Phone, Address, Contacts } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getContact(contactId: string): Promise<Contact | undefined> {
  const response = await xeroClient.accountingApi.getContact(
    xeroClient.tenantId,
    contactId,
    getClientHeaders(),
  );

  return response.body.contacts?.[0];
}

async function updateContact(
  name: string,
  firstName: string | undefined,
  lastName: string | undefined,
  email: string | undefined,
  phone: string | undefined,
  address: Address | undefined,
  contactId: string,
): Promise<Contact | undefined> {
  await xeroClient.authenticate();

  const existingContact = phone || address ? await getContact(contactId) : undefined;

  const mergedPhones = phone
    ? [
        ...(existingContact?.phones ?? []).filter(
          (p) => p.phoneType !== Phone.PhoneTypeEnum.MOBILE,
        ),
        {
          phoneNumber: phone,
          phoneType: Phone.PhoneTypeEnum.MOBILE,
        },
      ]
    : undefined;

  const mergedAddresses = address
    ? [
        ...(existingContact?.addresses ?? []).filter(
          (a) => a.addressType !== Address.AddressTypeEnum.STREET,
        ),
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
    : undefined;

  const contact: Contact = {
    name,
    firstName,
    lastName,
    emailAddress: email,
    phones: mergedPhones,
    addresses: mergedAddresses,
  };

  const contacts: Contacts = {
    contacts: [contact],
  };

  const response = await xeroClient.accountingApi.updateContact(
    xeroClient.tenantId,
    contactId, // contactId
    contacts, // contacts
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  const updatedContact = response.body.contacts?.[0];
  return updatedContact;
}

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
): Promise<XeroClientResponse<Contact>> {
  try {
    const updatedContact = await updateContact(
      name,
      firstName,
      lastName,
      email,
      phone,
      address,
      contactId,
    );

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
