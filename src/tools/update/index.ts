import ApprovePayrollTimesheetTool from "./approve-payroll-timesheet.tool.js";
import RevertPayrollTimesheetTool from "./revert-payroll-timesheet.tool.js";
import UpdateBankTransactionTool from "./update-bank-transaction.tool.js";
import UpdateContactTool from "./update-contact.tool.js";
import UpdateCreditNoteTool from "./update-credit-note.tool.js";
import UpdateInvoiceTool from "./update-invoice.tool.js";
import UpdateItemTool from "./update-item.tool.js";
import AddTimesheetLineTool from "./update-payroll-timesheet-add-line.tool.js";
import UpdatePayrollTimesheetLineTool
  from "./update-payroll-timesheet-update-line.tool.js";
import UpdateQuoteTool from "./update-quote.tool.js";

export const UpdateTools = [
  UpdateContactTool,
  UpdateCreditNoteTool,
  UpdateInvoiceTool,
  UpdateQuoteTool,
  UpdateItemTool,
  UpdateBankTransactionTool,
  ApprovePayrollTimesheetTool,
  AddTimesheetLineTool,
  UpdatePayrollTimesheetLineTool,
  RevertPayrollTimesheetTool,
];
