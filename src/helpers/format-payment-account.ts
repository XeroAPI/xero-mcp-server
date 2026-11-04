import { Account } from "xero-node";

/**
 * Format the account a payment was made from or to.
 *
 * The Payments endpoint returns the account as `{ AccountID, Code }` with no
 * `Name`, so a check on `name` alone hides the account entirely. Show whatever
 * identifiers are present; `list-accounts` maps an ID or code to its name.
 */
export function formatPaymentAccount(account?: Account): string | null {
  if (!account) return null;

  const { name, code, accountID } = account;
  if (!name && !code && !accountID) return null;

  const label = name || (code ? `Code ${code}` : null);
  if (!label) return `Account ID: ${accountID}`;

  return `Account: ${label} (${accountID || "Unknown ID"})`;
}
