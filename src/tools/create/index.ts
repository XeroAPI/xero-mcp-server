import AddAttachmentTool from "./add-attachment.tool.js";
import AssociateFileTool from "./associate-file.tool.js";
import CreateBankTransactionTool from "./create-bank-transaction.tool.js";
import CreateContactTool from "./create-contact.tool.js";
import CreateCreditNoteTool from "./create-credit-note.tool.js";
import CreateFileFolderTool from "./create-file-folder.tool.js";
import CreateInvoiceTool from "./create-invoice.tool.js";
import CreateItemTool from "./create-item.tool.js";
import CreateManualJournalTool from "./create-manual-journal.tool.js";
import CreatePaymentTool from "./create-payment.tool.js";
import CreatePayrollTimesheetTool from "./create-payroll-timesheet.tool.js";
import CreateQuoteTool from "./create-quote.tool.js";
import CreateTrackingCategoryTool from "./create-tracking-category.tool.js";
import CreateTrackingOptionsTool from "./create-tracking-options.tool.js";
import PrepareFileUploadTool from "./prepare-file-upload.tool.js";
import UploadFileTool from "./upload-file.tool.js";

export const CreateTools = [
  PrepareFileUploadTool,
  AddAttachmentTool,
  AssociateFileTool,
  CreateContactTool,
  CreateCreditNoteTool,
  CreateFileFolderTool,
  CreateManualJournalTool,
  CreateInvoiceTool,
  CreateQuoteTool,
  CreatePaymentTool,
  CreateItemTool,
  CreateBankTransactionTool,
  UploadFileTool,
  CreatePayrollTimesheetTool,
  CreateTrackingCategoryTool,
  CreateTrackingOptionsTool,
];
