import { Journal, JournalLine } from "xero-node";

const formatJournalLine = (line: JournalLine): string => {
  const net = line.netAmount ?? 0;
  const debitCredit =
    net >= 0 ? `Debit: ${net}` : `Credit: ${Math.abs(net)}`;
  const account = [line.accountCode, line.accountName]
    .filter(Boolean)
    .join(" ");

  return [
    account ? `Account: ${account}` : null,
    debitCredit,
    line.taxAmount != null ? `Tax Amount: ${line.taxAmount}` : null,
    line.description ? `Description: ${line.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

export const formatJournal = (journal: Journal): string => {
  return [
    `Journal ID: ${journal.journalID}`,
    journal.journalNumber != null
      ? `Journal Number: ${journal.journalNumber}`
      : null,
    journal.journalDate ? `Date: ${journal.journalDate}` : null,
    journal.createdDateUTC
      ? `Created: ${journal.createdDateUTC}`
      : null,
    journal.reference ? `Reference: ${journal.reference}` : null,
    journal.sourceType ? `Source Type: ${journal.sourceType}` : null,
    journal.sourceID ? `Source ID: ${journal.sourceID}` : null,
    journal.journalLines?.length
      ? `Lines:\n${journal.journalLines.map(formatJournalLine).join("\n---\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
};
