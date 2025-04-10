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

export const bankTransactionDeepLink = (accountId: string, bankTransactionId: string) => {
  return `https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=${bankTransactionId}&accountID=${accountId}`
}