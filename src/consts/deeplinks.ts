export const invoiceDeepLink = (orgShortCode: string, invoiceId: string) => {
  return ` https://go.xero.com/app/${orgShortCode}/invoicing/view/${invoiceId}`;
};

export const contactDeepLink = (orgShortCode: string, contactId: string) => {
  return ` https://go.xero.com/app/${orgShortCode}/contacts/contact/${contactId}`;
};

export const creditNoteDeepLink = (
  orgShortCode: string,
  creditNoteId: string,
) => {
  return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${orgShortCode}&redirecturl=/AccountsPayable/ViewCreditNote.aspx?creditNoteID=${creditNoteId}`;
};

export const quoteDeepLink = (orgShortCode: string, quoteId: string) => {
  return `https://go.xero.com/app/${orgShortCode}/quotes/view/${quoteId}`;
};

export const paymentDeepLink = (orgShortCode: string, paymentId: string) => {
  return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${orgShortCode}&redirecturl=/Bank/ViewTransaction.aspx?bankTransactionID=${paymentId}`;
};

export const bankTransactionDeepLink = (accountId: string, bankTransactionId: string) => {
  return `https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=${bankTransactionId}&accountID=${accountId}`
};

export const manualJournalDeepLink = (journalId: string) => {
  return `https://go.xero.com/Journal/View.aspx?invoiceID=${journalId}`;
};

export const billDeepLink = (orgShortCode: string, billId: string) => {
  return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${orgShortCode}&redirecturl=/AccountsPayable/Edit.aspx?InvoiceID=${billId}`;
};
