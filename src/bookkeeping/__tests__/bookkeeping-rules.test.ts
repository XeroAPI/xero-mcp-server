import { describe, expect, it, vi } from "vitest";

import { withXeroClient } from "../../clients/xero-client.js";
import { trackingSchema } from "../schemas.js";
import { createBankTransaction } from "../transactions.js";
import { validateBalancedJournal } from "../service.js";
import {
  recordContractorPayment,
  recordFounderRunwayFunding,
  recordShareholderPaidExpense,
  recordWaivedCommissionAsCapital,
} from "../workflows.js";

describe("bookkeeping safety rules", () => {
  it("accepts tracking by category and option names or IDs", () => {
    expect(trackingSchema.safeParse({ name: "Event", option: "Agents Alliance Palm Desert 2026" }).success).toBe(true);
    expect(trackingSchema.safeParse({ trackingCategoryID: "not-a-uuid", option: "Event" }).success).toBe(false);
  });

  it("rejects an unbalanced manual journal", () => {
    expect(() => validateBalancedJournal([{ lineAmount: 100 }, { lineAmount: -99 }])).toThrow(
      "Manual journal is not balanced",
    );
  });

  it("allows a balanced manual journal", () => {
    expect(() => validateBalancedJournal([{ lineAmount: 100 }, { lineAmount: -100 }])).not.toThrow();
  });

  it("does not post a shareholder-paid expense when capital treatment was not approved", async () => {
    await expect(
      recordShareholderPaidExpense({
        shareholder: "Jess",
        amount: 250,
        expenseAccountCode: "6000",
        date: "2026-10-01",
        description: "Unapproved expense",
        countsTowardCommitment: false,
      }),
    ).resolves.toMatchObject({ mutated: false, reviewRequired: true });
  });

  it("keeps founder runway out of APIC", async () => {
    await expect(
      recordFounderRunwayFunding({
        shareholder: "Jess",
        amount: 3000,
        date: "2026-10-01",
        mercuryBankAccountId: "00000000-0000-0000-0000-000000000001",
        month: "2026-10",
        classificationAccountCode: "3201",
      }),
    ).resolves.toMatchObject({ mutated: false, reviewRequired: true });
  });

  it("does not invent a commission liability", async () => {
    await expect(
      recordWaivedCommissionAsCapital({
        shareholder: "Jess",
        amount: 112.5,
        date: "2026-10-01",
        saleReference: "SALE-001",
      }),
    ).resolves.toMatchObject({ mutated: false, reviewRequired: true });
  });

  it("requires an existing vendor contact before contractor payment", async () => {
    await expect(
      recordContractorPayment({
        vendor: "RedDoor / Jimbo",
        amount: 280,
        date: "2026-10-04",
        bankAccountId: "00000000-0000-0000-0000-000000000001",
        hours: 40,
        rate: 7,
      }),
    ).resolves.toMatchObject({ mutated: false, reviewRequired: true });
  });

  it("blocks a duplicate bank transaction before the write call", async () => {
    const create = vi.fn();
    const client = {
      tenantId: "tenant-test",
      authenticate: vi.fn().mockResolvedValue(undefined),
      accountingApi: {
        getOrganisations: vi.fn().mockResolvedValue({ body: { organisations: [{}] } }),
        getAccounts: vi.fn().mockResolvedValue({ body: { accounts: [{ accountID: "account-6090", code: "6090", status: "ACTIVE" }] } }),
        getBankTransactions: vi.fn().mockResolvedValue({
          body: { bankTransactions: [{ bankTransactionID: "existing-1", reference: "REDOOR-2026-10-04", date: "2026-10-04", total: 280 }] },
        }),
        createBankTransactions: create,
      },
    } as never;

    await expect(withXeroClient(client, () => createBankTransaction({
      type: "SPEND",
      bankAccountId: "00000000-0000-0000-0000-000000000001",
      date: "2026-10-04",
      reference: "REDOOR-2026-10-04",
      lineItems: [{ description: "Jimbo", lineAmount: 280, accountCode: "6090", taxType: "NONE" }],
    }))).rejects.toMatchObject({ status: 409 });
    expect(create).not.toHaveBeenCalled();
  });

  it("blocks a write on or before a Xero lock date", async () => {
    const create = vi.fn();
    const client = {
      tenantId: "tenant-test",
      authenticate: vi.fn().mockResolvedValue(undefined),
      accountingApi: {
        getOrganisations: vi.fn().mockResolvedValue({ body: { organisations: [{ periodLockDate: "2026-10-31" }] } }),
        createBankTransactions: create,
      },
    } as never;

    await expect(withXeroClient(client, () => createBankTransaction({
      type: "SPEND",
      bankAccountId: "00000000-0000-0000-0000-000000000001",
      date: "2026-10-31",
      lineItems: [{ description: "Locked period", lineAmount: 1, accountCode: "6090", taxType: "NONE" }],
    }))).rejects.toMatchObject({ status: 409 });
    expect(create).not.toHaveBeenCalled();
  });
});
