import ApprovePayrollTimesheetTool from "./approve-payroll-timesheet.tool.js";
import ApproveAndEmailInvoiceTool from "./approve-and-email-invoice.tool.js";
import ApproveInvoiceTool from "./approve-invoice.tool.js";
import EmailInvoiceTool from "./email-invoice.tool.js";
import RevertPayrollTimesheetTool from "./revert-payroll-timesheet.tool.js";
import UpdateBankTransactionTool from "./update-bank-transaction.tool.js";
import UpdateContactTool from "./update-contact.tool.js";
import UpdateCreditNoteTool from "./update-credit-note.tool.js";
import UpdateInvoiceTool from "./update-invoice.tool.js";
import UpdateItemTool from "./update-item.tool.js";
import AddTimesheetLineTool from "./update-payroll-timesheet-add-line.tool.js";
import UpdatePayrollTimesheetLineTool
  from "./update-payroll-timesheet-update-line.tool.js";
import UpdateManualJournalTool from "./update-manual-journal-tool.js";
import UpdateQuoteTool from "./update-quote.tool.js";
import UpdateFileFolderTool from "./update-file-folder.tool.js";
import UpdateFileTool from "./update-file.tool.js";
import UpdateInvoiceFieldsTool from "./update-invoice-fields.tool.js";
import UpdateTrackingCategoryTool from "./update-tracking-category.tool.js";
import UpdateTrackingOptionsTool from "./update-tracking-options.tool.js";

export const UpdateTools = [
  ApproveAndEmailInvoiceTool,
  ApproveInvoiceTool,
  UpdateContactTool,
  UpdateCreditNoteTool,
  EmailInvoiceTool,
  UpdateFileTool,
  UpdateFileFolderTool,
  UpdateInvoiceFieldsTool,
  UpdateInvoiceTool,
  UpdateManualJournalTool,
  UpdateQuoteTool,
  UpdateItemTool,
  UpdateBankTransactionTool,
  ApprovePayrollTimesheetTool,
  AddTimesheetLineTool,
  UpdatePayrollTimesheetLineTool,
  RevertPayrollTimesheetTool,
  UpdateTrackingCategoryTool,
  UpdateTrackingOptionsTool
];
