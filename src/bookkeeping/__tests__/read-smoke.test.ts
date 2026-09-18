import { afterEach, describe, expect, it, vi } from "vitest";

import { withXeroClient } from "../../clients/xero-client.js";
import { listAccounts } from "../accounts.js";
import { listBankStatementLines } from "../reconciliation.js";

describe("bookkeeping read smoke paths", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads chart-of-accounts data through the shared Xero adapter", async () => {
    const getAccounts = vi.fn().mockResolvedValue({
      body: { accounts: [{ accountID: "account-1", code: "6090", name: "Contract Labor", status: "ACTIVE" }] },
    });
    const client = {
      tenantId: "tenant-smoke",
      authenticate: vi.fn().mockResolvedValue(undefined),
      accountingApi: { getAccounts },
    } as never;

    await expect(withXeroClient(client, () => listAccounts())).resolves.toEqual([
      { accountID: "account-1", code: "6090", name: "Contract Labor", status: "ACTIVE" },
    ]);
  });

  it("reads statement lines through the Finance API adapter", async () => {
    const getBankStatementAccounting = vi.fn().mockResolvedValue({
      body: {
        statements: [{ statementId: "statement-1", statementLines: [{ statementLineId: "line-1", amount: 280, payee: "RedDoor" }] }],
      },
    });
    const client = {
      tenantId: "tenant-smoke",
      authenticate: vi.fn().mockResolvedValue(undefined),
      financeApi: { getBankStatementAccounting },
    } as never;

    await expect(withXeroClient(client, () => listBankStatementLines({
      bankAccountId: "00000000-0000-0000-0000-000000000001",
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
    }))).resolves.toMatchObject({ items: [{ statementLineId: "line-1", amount: 280, statementId: "statement-1" }] });
  });
});
