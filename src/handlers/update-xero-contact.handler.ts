import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Contact, ContactPerson, Phone, Address, Contacts } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { postAuditNote } from "../helpers/post-audit-note.js";
import {
  applyContactExtras,
  ContactExtras,
} from "./create-xero-contact.handler.js";

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
  postalAddress: Address | undefined,
  contactPersons: ContactPerson[] | undefined,
  extras: ContactExtras | undefined,
  contactId: string,
): Promise<Contact | undefined> {
  await xeroClient.authenticate();

  const existingContact =
    phone || address || postalAddress || contactPersons
      ? await getContact(contactId)
      : undefined;

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

  const mergedAddresses =
    address || postalAddress
      ? (() => {
          const replacedTypes = new Set<Address.AddressTypeEnum>();
          if (address) replacedTypes.add(Address.AddressTypeEnum.STREET);
          if (postalAddress) replacedTypes.add(Address.AddressTypeEnum.POBOX);

          const kept = (existingContact?.addresses ?? []).filter(
            (a) => !a.addressType || !replacedTypes.has(a.addressType),
          );

          const incoming: Address[] = [];
          if (address) {
            incoming.push({
              addressType: Address.AddressTypeEnum.STREET,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2,
              city: address.city,
              country: address.country,
              postalCode: address.postalCode,
              region: address.region,
              attentionTo: address.attentionTo,
            });
          }
          if (postalAddress) {
            incoming.push({
              addressType: Address.AddressTypeEnum.POBOX,
              addressLine1: postalAddress.addressLine1,
              addressLine2: postalAddress.addressLine2,
              city: postalAddress.city,
              country: postalAddress.country,
              postalCode: postalAddress.postalCode,
              region: postalAddress.region,
              attentionTo: postalAddress.attentionTo,
            });
          }

          return [...kept, ...incoming];
        })()
      : undefined;

  const mergedContactPersons = contactPersons
    ? (() => {
        const incomingEmails = new Set(
          contactPersons
            .map((p) => p.emailAddress?.toLowerCase())
            .filter((e): e is string => Boolean(e)),
        );
        const kept = (existingContact?.contactPersons ?? []).filter(
          (p) =>
            !p.emailAddress || !incomingEmails.has(p.emailAddress.toLowerCase()),
        );
        return [...kept, ...contactPersons];
      })()
    : undefined;

  const contact: Contact = {
    name,
    firstName,
    lastName,
    emailAddress: email,
    phones: mergedPhones,
    addresses: mergedAddresses,
    contactPersons: mergedContactPersons,
  };

  if (extras) applyContactExtras(contact, extras);

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
  postalAddress?: Address,
  contactPersons?: ContactPerson[],
  extras?: ContactExtras,
): Promise<XeroClientResponse<Contact>> {
  try {
    const updatedContact = await updateContact(
      name,
      firstName,
      lastName,
      email,
      phone,
      address,
      postalAddress,
      contactPersons,
      extras,
      contactId,
    );

    if (!updatedContact) {
      throw new Error("Contact update failed.");
    }

    await postAuditNote("Contact", updatedContact.contactID, "Updated");


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
