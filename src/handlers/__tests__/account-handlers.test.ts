import { describe, it, expect, vi, beforeEach } from "vitest";
import { Account, AccountType } from "xero-node";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createAccount: vi.fn(),
  getAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-1",
    authenticate: mocks.authenticate,
    accountingApi: {
      createAccount: mocks.createAccount,
      getAccount: mocks.getAccount,
      updateAccount: mocks.updateAccount,
      deleteAccount: mocks.deleteAccount,
    },
  },
}));

import { createXeroAccount } from "../create-xero-account.handler.js";
import { updateXeroAccount } from "../update-xero-account.handler.js";
import { deleteXeroAccount } from "../delete-xero-account.handler.js";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createXeroAccount", () => {
  it("creates an account with the supplied fields and returns it", async () => {
    const created: Account = {
      accountID: "acc-1",
      code: "4100",
      name: "Consulting Revenue",
      type: AccountType.REVENUE,
    };
    mocks.createAccount.mockResolvedValue({ body: { accounts: [created] } });

    const response = await createXeroAccount({
      code: "4100",
      name: "Consulting Revenue",
      type: "REVENUE",
      description: "Fees for consulting",
      taxType: "OUTPUT",
      enablePaymentsToAccount: true,
      showInExpenseClaims: false,
    });

    expect(response.isError).toBe(false);
    expect(response.result).toEqual(created);

    expect(mocks.authenticate).toHaveBeenCalledOnce();
    const [tenantId, payload] = mocks.createAccount.mock.calls[0];
    expect(tenantId).toBe("tenant-1");
    expect(payload).toMatchObject({
      code: "4100",
      name: "Consulting Revenue",
      type: AccountType.REVENUE,
      description: "Fees for consulting",
      taxType: "OUTPUT",
      enablePaymentsToAccount: true,
      showInExpenseClaims: false,
    });
  });

  it("requires a bank account number for BANK accounts", async () => {
    const response = await createXeroAccount({
      name: "Cheque Account",
      type: "BANK",
    });

    expect(response.isError).toBe(true);
    expect(response.error).toMatch(/bank account number/i);
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("sends bank account number and type for BANK accounts", async () => {
    mocks.createAccount.mockResolvedValue({
      body: { accounts: [{ accountID: "acc-2" }] },
    });

    await createXeroAccount({
      name: "Cheque Account",
      type: "BANK",
      bankAccountNumber: "123456",
      bankAccountType: "BANK",
      currencyCode: "AUD",
    });

    const [, payload] = mocks.createAccount.mock.calls[0];
    expect(payload).toMatchObject({
      type: AccountType.BANK,
      bankAccountNumber: "123456",
      bankAccountType: Account.BankAccountTypeEnum.BANK,
      currencyCode: "AUD",
    });
  });

  it("returns an error when the API returns no account", async () => {
    mocks.createAccount.mockResolvedValue({ body: { accounts: [] } });

    const response = await createXeroAccount({ name: "X", type: "EXPENSE" });

    expect(response.isError).toBe(true);
    expect(response.result).toBeNull();
    expect(response.error).toMatch(/creation failed/i);
  });

  it("wraps API failures in an error response", async () => {
    mocks.createAccount.mockRejectedValue(new Error("boom"));

    const response = await createXeroAccount({ name: "X", type: "EXPENSE" });

    expect(response.isError).toBe(true);
    expect(response.error).toContain("boom");
  });
});

describe("updateXeroAccount", () => {
  const existing: Account = {
    accountID: "acc-1",
    code: "4100",
    name: "Consulting Revenue",
    type: AccountType.REVENUE,
    status: Account.StatusEnum.ACTIVE,
    description: "Old description",
    taxType: "OUTPUT",
  };

  it("sends only the supplied fields, not the existing account merged in", async () => {
    mocks.getAccount.mockResolvedValue({ body: { accounts: [existing] } });
    const updated: Account = { ...existing, name: "Advisory Revenue" };
    mocks.updateAccount.mockResolvedValue({ body: { accounts: [updated] } });

    const response = await updateXeroAccount("acc-1", {
      name: "Advisory Revenue",
    });

    expect(response.isError).toBe(false);
    expect(response.result).toEqual(updated);

    const [tenantId, accountId, body] = mocks.updateAccount.mock.calls[0];
    expect(tenantId).toBe("tenant-1");
    expect(accountId).toBe("acc-1");
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]).toEqual({
      accountID: "acc-1",
      name: "Advisory Revenue",
    });
  });

  it("adds a code to a bank account without echoing fields Xero rejects for BANK", async () => {
    const bank: Account = {
      accountID: "bank-1",
      name: "Ramp Card",
      type: AccountType.BANK,
      bankAccountType: Account.BankAccountTypeEnum.CREDITCARD,
      status: Account.StatusEnum.ACTIVE,
      enablePaymentsToAccount: false,
      showInExpenseClaims: false,
      taxType: "NONE",
    };
    mocks.getAccount.mockResolvedValue({ body: { accounts: [bank] } });
    mocks.updateAccount.mockResolvedValue({
      body: { accounts: [{ ...bank, code: "2110" }] },
    });

    const response = await updateXeroAccount("bank-1", { code: "2110" });

    expect(response.isError).toBe(false);
    const [, , body] = mocks.updateAccount.mock.calls[0];
    expect(body.accounts[0]).toEqual({ accountID: "bank-1", code: "2110" });
  });

  it("converts enum-style inputs to SDK enums", async () => {
    mocks.getAccount.mockResolvedValue({ body: { accounts: [existing] } });
    mocks.updateAccount.mockResolvedValue({ body: { accounts: [existing] } });

    await updateXeroAccount("acc-1", {
      type: "SALES",
      bankAccountType: "CREDITCARD",
      currencyCode: "USD",
    });

    const [, , body] = mocks.updateAccount.mock.calls[0];
    expect(body.accounts[0]).toEqual({
      accountID: "acc-1",
      type: AccountType.SALES,
      bankAccountType: Account.BankAccountTypeEnum.CREDITCARD,
      currencyCode: "USD",
    });
  });

  it("archives an account when status is ARCHIVED", async () => {
    mocks.getAccount.mockResolvedValue({ body: { accounts: [existing] } });
    mocks.updateAccount.mockResolvedValue({
      body: {
        accounts: [{ ...existing, status: Account.StatusEnum.ARCHIVED }],
      },
    });

    const response = await updateXeroAccount("acc-1", { status: "ARCHIVED" });

    expect(response.isError).toBe(false);
    expect(mocks.updateAccount).toHaveBeenCalledOnce();
    const [, , body] = mocks.updateAccount.mock.calls[0];
    expect(body.accounts[0]).toEqual({
      accountID: "acc-1",
      status: Account.StatusEnum.ARCHIVED,
    });
  });

  it("sends details and status as separate requests when both are supplied", async () => {
    mocks.getAccount.mockResolvedValue({ body: { accounts: [existing] } });
    const renamed: Account = { ...existing, name: "Advisory Revenue" };
    const archived: Account = { ...renamed, status: Account.StatusEnum.ARCHIVED };
    mocks.updateAccount
      .mockResolvedValueOnce({ body: { accounts: [renamed] } })
      .mockResolvedValueOnce({ body: { accounts: [archived] } });

    const response = await updateXeroAccount("acc-1", {
      name: "Advisory Revenue",
      status: "ARCHIVED",
    });

    expect(response.isError).toBe(false);
    expect(response.result).toEqual(archived);
    expect(mocks.updateAccount).toHaveBeenCalledTimes(2);

    const [, , detailsBody] = mocks.updateAccount.mock.calls[0];
    expect(detailsBody.accounts[0].name).toBe("Advisory Revenue");
    expect(detailsBody.accounts[0]).not.toHaveProperty("status");

    const [, , statusBody] = mocks.updateAccount.mock.calls[1];
    expect(statusBody.accounts[0]).toEqual({
      accountID: "acc-1",
      status: Account.StatusEnum.ARCHIVED,
    });
  });

  it("returns an error when the account does not exist", async () => {
    mocks.getAccount.mockResolvedValue({ body: { accounts: [] } });

    const response = await updateXeroAccount("missing", { name: "X" });

    expect(response.isError).toBe(true);
    expect(response.error).toMatch(/could not find account/i);
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("wraps API failures in an error response", async () => {
    mocks.getAccount.mockResolvedValue({ body: { accounts: [existing] } });
    mocks.updateAccount.mockRejectedValue(new Error("nope"));

    const response = await updateXeroAccount("acc-1", { name: "X" });

    expect(response.isError).toBe(true);
    expect(response.error).toContain("nope");
  });
});

describe("deleteXeroAccount", () => {
  it("deletes the account and reports the returned status", async () => {
    mocks.deleteAccount.mockResolvedValue({
      body: {
        accounts: [{ accountID: "acc-1", status: Account.StatusEnum.DELETED }],
      },
    });

    const response = await deleteXeroAccount("acc-1");

    expect(response.isError).toBe(false);
    expect(response.result).toMatchObject({
      accountID: "acc-1",
      status: Account.StatusEnum.DELETED,
    });
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    const [tenantId, accountId] = mocks.deleteAccount.mock.calls[0];
    expect(tenantId).toBe("tenant-1");
    expect(accountId).toBe("acc-1");
  });

  it("wraps API failures in an error response", async () => {
    mocks.deleteAccount.mockRejectedValue(new Error("in use"));

    const response = await deleteXeroAccount("acc-1");

    expect(response.isError).toBe(true);
    expect(response.error).toContain("in use");
  });
});
