import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const client = vi.hoisted(() => ({
  tenantId: "test-tenant",
  authenticate: vi.fn(),
  accountingApi: { getBudgets: vi.fn(), getBudget: vi.fn() },
}));
vi.mock("../../clients/xero-client.js", () => ({ xeroClient: client }));

import {
  getXeroBudget,
  listXeroBudgets,
} from "../list-xero-budgets.handler.js";
import GetBudgetTool from "../../tools/list/get-budget.tool.js";
import ListBudgetsTool from "../../tools/list/list-budgets.tool.js";
import { ListTools } from "../../tools/list/index.js";

const budgetId = "847da917-9565-466c-a9cd-3ecf7eb9d094";
const budgets = [
  {
    budgetID: budgetId,
    type: "TRACKING",
    tracking: [{ name: "Activity", option: "Community events" }],
    budgetLines: [
      {
        accountCode: "090",
        budgetBalances: [
          { period: "2026-07", amount: 0, unitAmount: 0 },
          { period: "2026-08", amount: -125.75, unitAmount: -125.75 },
        ],
      },
    ],
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  client.authenticate.mockResolvedValue(undefined);
  client.accountingApi.getBudgets.mockResolvedValue({ body: { budgets } });
  client.accountingApi.getBudget.mockResolvedValue({ body: { budgets } });
});

describe("budget reads", () => {
  it("authenticates before listing and passes tenant and client headers", async () => {
    client.accountingApi.getBudgets.mockImplementation(() => {
      expect(client.authenticate).toHaveBeenCalledOnce();
      return Promise.resolve({ body: { budgets } });
    });
    expect(await listXeroBudgets()).toEqual({
      result: budgets,
      isError: false,
      error: null,
    });
    expect(client.accountingApi.getBudgets).toHaveBeenCalledWith(
      "test-tenant",
      undefined,
      undefined,
      undefined,
      {
        headers: { "user-agent": expect.stringContaining("xero-mcp-server-") },
      },
    );
    expect(client.accountingApi.getBudget).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, undefined],
    ["2026-07-01", undefined],
    [undefined, "2027-06-30"],
    ["2026-07-01", "2027-06-30"],
    ["2026-07-01", "2026-07-01"],
  ])("passes dateFrom %s and dateTo %s in SDK order", async (from, to) => {
    expect((await getXeroBudget(budgetId, from, to)).result).toEqual(budgets);
    expect(client.authenticate).toHaveBeenCalledOnce();
    expect(client.accountingApi.getBudget).toHaveBeenCalledWith(
      "test-tenant",
      budgetId,
      to,
      from,
      expect.any(Object),
    );
    expect(client.accountingApi.getBudgets).not.toHaveBeenCalled();
  });

  it("rejects reversed ranges before authenticating", async () => {
    expect(
      await getXeroBudget(budgetId, "2027-06-30", "2026-07-01"),
    ).toMatchObject({ result: null, isError: true });
    expect(client.authenticate).not.toHaveBeenCalled();
    expect(client.accountingApi.getBudget).not.toHaveBeenCalled();
  });

  it("returns empty arrays for omitted budget collections", async () => {
    client.accountingApi.getBudgets.mockResolvedValue({ body: {} });
    client.accountingApi.getBudget.mockResolvedValue({ body: {} });
    expect((await listXeroBudgets()).result).toEqual([]);
    expect((await getXeroBudget(budgetId)).result).toEqual([]);
  });

  it("does not call the API after authentication fails", async () => {
    client.authenticate.mockRejectedValue(new Error("Authentication failed"));
    expect((await listXeroBudgets()).isError).toBe(true);
    expect((await getXeroBudget(budgetId)).isError).toBe(true);
    expect(client.accountingApi.getBudgets).not.toHaveBeenCalled();
    expect(client.accountingApi.getBudget).not.toHaveBeenCalled();
  });

  it.each(["list", "detail"])(
    "marks %s SDK rejection as an MCP error without serialising the request",
    async (kind) => {
      const rejection = JSON.stringify({
        request: { headers: { authorization: "test-sentinel" } },
      });
      client.accountingApi.getBudgets.mockRejectedValue(rejection);
      client.accountingApi.getBudget.mockRejectedValue(rejection);
      const tool = kind === "list" ? ListBudgetsTool() : GetBudgetTool();
      const response = await tool.handler({ budgetId } as never, {} as never);
      expect(response.isError).toBe(true);
      expect(JSON.stringify(response)).not.toContain("test-sentinel");
    },
  );
});

describe("budget tools", () => {
  it("registers both tools", () => {
    const names = ListTools.map((tool) => tool().name);
    expect(names.filter((name) => name === "list-budgets")).toHaveLength(1);
    expect(names.filter((name) => name === "get-budget")).toHaveLength(1);
  });

  it.each(["list", "detail"])(
    "preserves budget amounts and metadata in %s output",
    async (kind) => {
      const tool = kind === "list" ? ListBudgetsTool() : GetBudgetTool();
      const result = await tool.handler({ budgetId } as never, {} as never);
      expect(result.isError).toBe(false);
      const block = result.content[0];
      if (block.type !== "text") throw new Error("Expected text content");
      expect(JSON.parse(block.text)).toEqual(budgets);
    },
  );

  it.each([
    { budgetId: "invalid" },
    { budgetId, dateFrom: "2026-02-30" },
    { budgetId, dateTo: "30/06/2027" },
  ])("rejects invalid ID or dates: %j", (params) => {
    expect(
      z.object(GetBudgetTool().schema as z.ZodRawShape).safeParse(params)
        .success,
    ).toBe(false);
  });
});
