import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { updateXeroRepeatingInvoice } from "./update-xero-repeating-invoice.handler.js";

const existingDraft = {
  repeatingInvoiceID: "ri-1",
  status: "DRAFT",
  contact: { contactID: "contact-1", name: "Northwind" },
};

const updatedRepeatingInvoice = {
  ...existingDraft,
  reference: "RETAINER-2",
  total: 600,
};

describe("updateXeroRepeatingInvoice", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("updates a draft repeating invoice", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [existingDraft] },
    });
    mockAccountingApi.updateRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [updatedRepeatingInvoice] },
    });

    const result = await updateXeroRepeatingInvoice({
      repeatingInvoiceId: "ri-1",
      reference: "RETAINER-2",
      lineItems: [
        {
          description: "Retainer",
          quantity: 1,
          unitAmount: 600,
          accountCode: "200",
          taxType: "OUTPUT2",
        },
      ],
    });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.reference).toBe("RETAINER-2");
    expect(mockAccountingApi.updateRepeatingInvoice).toHaveBeenCalledWith(
      "tenant-1",
      "ri-1",
      {
        repeatingInvoices: [
          expect.objectContaining({
            reference: "RETAINER-2",
            lineItems: [
              expect.objectContaining({
                description: "Retainer",
                unitAmount: 600,
              }),
            ],
          }),
        ],
      },
      undefined,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("leaves lineAmountTypes unset when the caller omits it", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [existingDraft] },
    });
    mockAccountingApi.updateRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [updatedRepeatingInvoice] },
    });

    const result = await updateXeroRepeatingInvoice({
      repeatingInvoiceId: "ri-1",
      reference: "RETAINER-2",
    });

    expect(result.isError).toBe(false);
    const payload = mockAccountingApi.updateRepeatingInvoice.mock.calls[0][2];
    expect(payload.repeatingInvoices[0].lineAmountTypes).toBeUndefined();
  });

  it("maps a supplied lineAmountTypes to the Xero enum", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [existingDraft] },
    });
    mockAccountingApi.updateRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [updatedRepeatingInvoice] },
    });

    const result = await updateXeroRepeatingInvoice({
      repeatingInvoiceId: "ri-1",
      lineAmountTypes: "NoTax",
    });

    expect(result.isError).toBe(false);
    const payload = mockAccountingApi.updateRepeatingInvoice.mock.calls[0][2];
    expect(payload.repeatingInvoices[0].lineAmountTypes).toBe("NoTax");
  });

  it("allows updates to authorised repeating invoices", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [{ ...existingDraft, status: "AUTHORISED" }] },
    });
    mockAccountingApi.updateRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [updatedRepeatingInvoice] },
    });

    const result = await updateXeroRepeatingInvoice({
      repeatingInvoiceId: "ri-1",
      schedule: { period: 2, unit: "MONTHLY" },
    });

    expect(result.isError).toBe(false);
    const payload = mockAccountingApi.updateRepeatingInvoice.mock.calls[0][2];
    expect(payload.repeatingInvoices[0].schedule).toMatchObject({
      period: 2,
      unit: "MONTHLY",
    });
  });

  it("keeps unspecified schedule fields from the existing template", async () => {
    const schedule = {
      period: 1,
      unit: "MONTHLY",
      dueDate: 20,
      dueDateType: "OFFOLLOWINGMONTH",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
    };
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [{ ...existingDraft, schedule }] },
    });
    mockAccountingApi.updateRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [updatedRepeatingInvoice] },
    });

    const result = await updateXeroRepeatingInvoice({
      repeatingInvoiceId: "ri-1",
      schedule: { period: 3 },
    });

    expect(result.isError).toBe(false);
    const payload = mockAccountingApi.updateRepeatingInvoice.mock.calls[0][2];
    expect(payload.repeatingInvoices[0].schedule).toEqual({
      ...schedule,
      period: 3,
    });
  });

  it("rejects deleted repeating invoices", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [{ ...existingDraft, status: "DELETED" }] },
    });

    const result = await updateXeroRepeatingInvoice({
      repeatingInvoiceId: "ri-1",
      reference: "nope",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error:
        "Cannot update repeating invoice because it is DELETED. Only DRAFT and AUTHORISED repeating invoices can be updated.",
    });
    expect(mockAccountingApi.updateRepeatingInvoice).not.toHaveBeenCalled();
  });

  it("can authorise a draft repeating invoice", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [existingDraft] },
    });
    mockAccountingApi.updateRepeatingInvoice.mockResolvedValue({
      body: {
        repeatingInvoices: [{ ...existingDraft, status: "AUTHORISED" }],
      },
    });

    const result = await updateXeroRepeatingInvoice({
      repeatingInvoiceId: "ri-1",
      status: "AUTHORISED",
    });

    expect(result.isError).toBe(false);
    const payload = mockAccountingApi.updateRepeatingInvoice.mock.calls[0][2];
    expect(payload.repeatingInvoices[0].status).toBe("AUTHORISED");
  });

  it("returns an error when the existing repeating invoice cannot be loaded", async () => {
    mockAccountingApi.getRepeatingInvoice.mockResolvedValue({
      body: { repeatingInvoices: [] },
    });

    const result = await updateXeroRepeatingInvoice({
      repeatingInvoiceId: "missing",
      reference: "x",
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Repeating invoice not found.",
    });
  });
});
