import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Address, Contact, ContactPerson, CurrencyCode, Phone } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

type AddressInput = {
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  attentionTo?: string;
};

export type ContactExtras = {
  accountNumber?: string;
  taxNumber?: string;
  taxNumberType?: "SSN" | "EIN" | "ITIN" | "ATIN";
  bankAccountDetails?: string;
  contactStatus?: "ACTIVE" | "ARCHIVED" | "GDPRREQUEST";
  defaultCurrency?: string;
  accountsReceivableTaxType?: string;
  accountsPayableTaxType?: string;
  salesDefaultLineAmountType?: "INCLUSIVE" | "EXCLUSIVE" | "NONE";
  purchasesDefaultLineAmountType?: "INCLUSIVE" | "EXCLUSIVE" | "NONE";
  salesDefaultAccountCode?: string;
  purchasesDefaultAccountCode?: string;
};

export function applyContactExtras(contact: Contact, extras: ContactExtras): void {
  if (extras.accountNumber !== undefined) contact.accountNumber = extras.accountNumber;
  if (extras.taxNumber !== undefined) contact.taxNumber = extras.taxNumber;
  if (extras.taxNumberType !== undefined) {
    contact.taxNumberType = Contact.TaxNumberTypeEnum[extras.taxNumberType];
  }
  if (extras.bankAccountDetails !== undefined) {
    contact.bankAccountDetails = extras.bankAccountDetails;
  }
  if (extras.contactStatus !== undefined) {
    contact.contactStatus = Contact.ContactStatusEnum[extras.contactStatus];
  }
  if (extras.defaultCurrency !== undefined) {
    const code = extras.defaultCurrency.toUpperCase() as keyof typeof CurrencyCode;
    if (CurrencyCode[code] !== undefined) {
      contact.defaultCurrency = CurrencyCode[code];
    }
  }
  if (extras.accountsReceivableTaxType !== undefined) {
    contact.accountsReceivableTaxType = extras.accountsReceivableTaxType;
  }
  if (extras.accountsPayableTaxType !== undefined) {
    contact.accountsPayableTaxType = extras.accountsPayableTaxType;
  }
  if (extras.salesDefaultLineAmountType !== undefined) {
    contact.salesDefaultLineAmountType =
      Contact.SalesDefaultLineAmountTypeEnum[extras.salesDefaultLineAmountType];
  }
  if (extras.purchasesDefaultLineAmountType !== undefined) {
    contact.purchasesDefaultLineAmountType =
      Contact.PurchasesDefaultLineAmountTypeEnum[extras.purchasesDefaultLineAmountType];
  }
  if (extras.salesDefaultAccountCode !== undefined) {
    contact.salesDefaultAccountCode = extras.salesDefaultAccountCode;
  }
  if (extras.purchasesDefaultAccountCode !== undefined) {
    contact.purchasesDefaultAccountCode = extras.purchasesDefaultAccountCode;
  }
}

function buildAddress(
  type: Address.AddressTypeEnum,
  input: AddressInput,
): Address {
  return {
    addressType: type,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    country: input.country,
    attentionTo: input.attentionTo,
  };
}

async function createContact(
  name: string,
  firstName?: string,
  lastName?: string,
  email?: string,
  phone?: string,
  postalAddress?: AddressInput,
  streetAddress?: AddressInput,
  contactPersons?: ContactPerson[],
  extras?: ContactExtras,
): Promise<Contact | undefined> {
  await xeroClient.authenticate();

  const addresses: Address[] = [];
  if (postalAddress) {
    addresses.push(buildAddress(Address.AddressTypeEnum.POBOX, postalAddress));
  }
  if (streetAddress) {
    addresses.push(buildAddress(Address.AddressTypeEnum.STREET, streetAddress));
  }

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
    addresses: addresses.length ? addresses : undefined,
    contactPersons,
  };

  if (extras) applyContactExtras(contact, extras);

  const response = await xeroClient.accountingApi.createContacts(
    xeroClient.tenantId,
    {
      contacts: [contact],
    }, //contacts
    true, //summarizeErrors
    undefined, //idempotencyKey
    getClientHeaders(), // options
  );

  return response.body.contacts?.[0];
}

/**
 * Create a new invoice in Xero
 */
export async function createXeroContact(
  name: string,
  firstName?: string,
  lastName?: string,
  email?: string,
  phone?: string,
  postalAddress?: AddressInput,
  streetAddress?: AddressInput,
  contactPersons?: ContactPerson[],
  extras?: ContactExtras,
): Promise<XeroClientResponse<Contact>> {
  try {
    const createdContact = await createContact(
      name,
      firstName,
      lastName,
      email,
      phone,
      postalAddress,
      streetAddress,
      contactPersons,
      extras,
    );

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
