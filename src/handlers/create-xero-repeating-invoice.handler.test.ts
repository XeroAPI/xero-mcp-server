import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAccountingApi,
  mockXeroClient,
  resetXeroClientMocks,
} from "./__tests__/mock-xero-client.js";

vi.mock("../clients/xero-client.js", () => ({
  xeroClient: mockXeroClient,
}));

import { createXeroRepeatingInvoice } from "./create-xero-repeating-invoice.handler.js";

const lineItems = [
  {
    description: "Monthly retainer",
    quantity: 1,
    unitAmount: 500,
    accountCode: "200",
    taxType: "OUTPUT2",
  },
];

const schedule = {
  period: 1,
  unit: "MONTHLY" as const,
  dueDate: 10,
  dueDateType: "OFFOLLOWINGMONTH" as const,
  startDate: "2026-09-01",
};

const createdRepeatingInvoice = {
  repeatingInvoiceID: "ri-1",
  status: "DRAFT",
  total: 500,
  contact: { contactID: "contact-1", name: "Northwind" },
};

describe("createXeroRepeatingInvoice", () => {
  beforeEach(() => {
    resetXeroClientMocks();
  });

  it("creates a draft repeating invoice and returns it", async () => {
    mockAccountingApi.createRepeatingInvoices.mockResolvedValue({
      body: { repeatingInvoices: [createdRepeatingInvoice] },
    });

    const result = await createXeroRepeatingInvoice({
      contactId: "contact-1",
      lineItems,
      schedule,
    });

    expect(result.isError).toBe(false);
    if (result.isError) return;
    expect(result.result.repeatingInvoiceID).toBe("ri-1");
    expect(mockXeroClient.authenticate).toHaveBeenCalledOnce();
    expect(mockAccountingApi.createRepeatingInvoices).toHaveBeenCalledWith(
      "tenant-1",
      {
        repeatingInvoices: [
          expect.objectContaining({
            contact: { contactID: "contact-1" },
            lineItems,
            type: "ACCREC",
            status: "DRAFT",
            lineAmountTypes: "Exclusive",
            schedule: expect.objectContaining({
              period: 1,
              unit: "MONTHLY",
              dueDate: 10,
              dueDateType: "OFFOLLOWINGMONTH",
              startDate: "2026-09-01",
            }),
          }),
        ],
      },
      true,
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("xero-mcp-server"),
        }),
      }),
    );
  });

  it("passes optional bill type, authorised status, and reference through to Xero", async () => {
    mockAccountingApi.createRepeatingInvoices.mockResolvedValue({
      body: { repeatingInvoices: [createdRepeatingInvoice] },
    });

    await createXeroRepeatingInvoice({
      contactId: "contact-1",
      lineItems,
      schedule: { ...schedule, endDate: "2026-12-01", unit: "WEEKLY" },
      type: "ACCPAY",
      status: "AUTHORISED",
      reference: "RETAINER",
      lineAmountTypes: "Inclusive",
    });

    const payload = mockAccountingApi.createRepeatingInvoices.mock.calls[0][1];
    expect(payload.repeatingInvoices[0]).toMatchObject({
      type: "ACCPAY",
      status: "AUTHORISED",
      reference: "RETAINER",
      lineAmountTypes: "Inclusive",
      schedule: expect.objectContaining({
        unit: "WEEKLY",
        endDate: "2026-12-01",
      }),
    });
  });

  it("returns a formatted error when Xero rejects the create", async () => {
    mockAccountingApi.createRepeatingInvoices.mockRejectedValue(
      new Error("Contact is required"),
    );

    const result = await createXeroRepeatingInvoice({
      contactId: "missing",
      lineItems,
      schedule,
    });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Contact is required",
    });
  });

  it("returns an error when Xero returns no repeating invoice", async () => {
    mockAccountingApi.createRepeatingInvoices.mockResolvedValue({
      body: { repeatingInvoices: [] },
    });

    const result = await createXeroRepeatingInvoice({
      contactId: "contact-1",
      lineItems,
      schedule,
    });

    expect(result.isError).toBe(true);
    if (!result.isError) return;
    expect(result.error).toBe("Repeating invoice creation failed.");
  });
});
