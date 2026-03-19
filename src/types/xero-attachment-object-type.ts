export const xeroAttachmentObjectTypes = [
  "Invoices",
  "BankTransactions",
  "Contacts",
  "CreditNotes",
  "ManualJournals",
] as const;

export type XeroAttachmentObjectType =
  (typeof xeroAttachmentObjectTypes)[number];
