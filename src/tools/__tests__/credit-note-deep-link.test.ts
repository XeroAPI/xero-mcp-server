import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditNote } from "xero-node";

const getShortCode = vi.fn();
const createXeroCreditNote = vi.fn();
const updateXeroCreditNote = vi.fn();

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    getShortCode: () => getShortCode(),
  },
}));

vi.mock("../../handlers/create-xero-credit-note.handler.js", () => ({
  createXeroCreditNote: (...args: unknown[]) => createXeroCreditNote(...args),
}));

vi.mock("../../handlers/update-xero-credit-note.handler.js", () => ({
  updateXeroCreditNote: (...args: unknown[]) => updateXeroCreditNote(...args),
}));

const CreateCreditNoteTool = (await import("../create/create-credit-note.tool.js"))
  .default;
const UpdateCreditNoteTool = (await import("../update/update-credit-note.tool.js"))
  .default;

const supplierCreditNote = {
  creditNoteID: "credit-note",
  type: CreditNote.TypeEnum.ACCPAYCREDIT,
  contact: { name: "Contact" },
  total: 10,
  status: CreditNote.StatusEnum.DRAFT,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callTool = async (tool: any, args: any): Promise<string> => {
  const response = await tool().handler(args, {} as never);
  return response.content[0].text as string;
};

describe("credit note deep links", () => {
  beforeEach(() => {
    getShortCode.mockReset();
    getShortCode.mockResolvedValue("org");
    createXeroCreditNote.mockReset();
    updateXeroCreditNote.mockReset();
  });

  it("links a created supplier credit note to the payable area", async () => {
    createXeroCreditNote.mockResolvedValue({
      result: supplierCreditNote,
      isError: false,
      error: null,
    });

    const text = await callTool(CreateCreditNoteTool, {
      contactId: "contact",
      lineItems: [],
    });

    expect(text).toContain(
      "Link to view: https://go.xero.com/organisationlogin/default.aspx?shortcode=org&redirecturl=/AccountsPayable/ViewCreditNote.aspx?creditNoteID=credit-note",
    );
  });

  it("links an updated supplier credit note to the payable area", async () => {
    updateXeroCreditNote.mockResolvedValue({
      result: supplierCreditNote,
      isError: false,
      error: null,
    });

    const text = await callTool(UpdateCreditNoteTool, {
      creditNoteId: "credit-note",
    });

    expect(text).toContain(
      "Link to view: https://go.xero.com/organisationlogin/default.aspx?shortcode=org&redirecturl=/AccountsPayable/ViewCreditNote.aspx?creditNoteID=credit-note",
    );
  });
});
