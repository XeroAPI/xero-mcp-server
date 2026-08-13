import { describe, it, expect, beforeEach, vi } from "vitest";

vi.hoisted(() => {
  process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";
  delete process.env.XERO_CLIENT_ID;
  delete process.env.XERO_CLIENT_SECRET;
});

const { xeroClient } = await import("../../clients/xero-client.js");
const { CreateXeroTool } = await import("../create-xero-tool.js");
const { xeroApiTenantId } = await import("../../clients/tenant-context.js");
const { z } = await import("zod");
const ListAccountsTool = (
  await import("../../tools/list/list-accounts.tool.js")
).default;
const UpdateInvoiceTool = (
  await import("../../tools/update/update-invoice.tool.js")
).default;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const UNKNOWN_TENANT = "33333333-3333-3333-3333-333333333333";
const INVOICE_ID = "44444444-4444-4444-4444-444444444444";

type Deferred = { promise: Promise<void>; resolve: () => void };

const deferred = (): Deferred => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const getAccounts = vi.fn();
const getOrganisations = vi.fn();
const getInvoice = vi.fn();
const updateInvoice = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callTool = (tool: { handler: any }, args: Record<string, unknown>) =>
  tool.handler(args, {} as never);

beforeEach(() => {
  getAccounts.mockReset();
  getOrganisations.mockReset();
  getInvoice.mockReset();
  updateInvoice.mockReset();

  getAccounts.mockResolvedValue({ body: { accounts: [] } });
  getOrganisations.mockResolvedValue({
    body: { organisations: [{ shortCode: "!shortcode" }] },
  });
  getInvoice.mockResolvedValue({
    body: { invoices: [{ invoiceID: INVOICE_ID, status: "DRAFT" }] },
  });
  updateInvoice.mockResolvedValue({
    body: { invoices: [{ invoiceID: INVOICE_ID, status: "DRAFT" }] },
  });

  vi.spyOn(xeroClient, "authenticate").mockResolvedValue();
  vi.spyOn(xeroClient, "tenants", "get").mockReturnValue([
    { tenantId: TENANT_A, tenantName: "Org A", tenantType: "ORGANISATION" },
    { tenantId: TENANT_B, tenantName: "Org B", tenantType: "ORGANISATION" },
  ]);
  vi.spyOn(xeroClient, "accountingApi", "get").mockReturnValue({
    getAccounts,
    getOrganisations,
    getInvoice,
    updateInvoice,
  } as never);
});

describe("CreateXeroTool tenant enforcement", () => {
  it("passes the requested tenant through to the Xero SDK", async () => {
    await callTool(ListAccountsTool(), { tenantId: TENANT_B });

    expect(getAccounts).toHaveBeenCalledTimes(1);
    expect(getAccounts.mock.calls[0][0]).toBe(TENANT_B);
  });

  it("rejects a blank tenantId before calling Xero", async () => {
    const result = await callTool(ListAccountsTool(), { tenantId: "  " });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/requires a tenantId/);
    expect(getAccounts).not.toHaveBeenCalled();
  });

  it("rejects an unknown tenantId before calling Xero", async () => {
    const result = await callTool(ListAccountsTool(), {
      tenantId: UNKNOWN_TENANT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(
      /does not match any authorised Xero connection/,
    );
    expect(result.content[0].text).not.toContain(TENANT_A);
    expect(result.content[0].text).not.toContain(TENANT_B);
    expect(getAccounts).not.toHaveBeenCalled();
  });

  it("never falls back to an authorised tenant when none is supplied", async () => {
    const result = await callTool(ListAccountsTool(), {});

    expect(result.isError).toBe(true);
    expect(getAccounts).not.toHaveBeenCalled();
  });

  it("keeps concurrent, interleaved tool calls on their own tenant", async () => {
    const aReachedXero = deferred();
    const aMayContinue = deferred();
    const order: string[] = [];

    // The first call blocks inside the Xero SDK until the second call has run
    // to completion, so the two invocations genuinely overlap.
    getAccounts.mockImplementation(async (tenantId: string) => {
      order.push(`start:${tenantId}`);

      if (tenantId === TENANT_A) {
        aReachedXero.resolve();
        await aMayContinue.promise;
      }

      // Re-read the ambient tenant after the other call has run to completion:
      // a globally stored tenant would have been overwritten by now.
      order.push(`resumed:${xeroApiTenantId()}`);
      order.push(`end:${tenantId}`);
      return { body: { accounts: [] } };
    });

    const callA = callTool(ListAccountsTool(), { tenantId: TENANT_A });
    await aReachedXero.promise;

    await callTool(ListAccountsTool(), { tenantId: TENANT_B });
    aMayContinue.resolve();
    await callA;

    expect(order).toEqual([
      `start:${TENANT_A}`,
      `start:${TENANT_B}`,
      `resumed:${TENANT_B}`,
      `end:${TENANT_B}`,
      `resumed:${TENANT_A}`,
      `end:${TENANT_A}`,
    ]);
    expect(getAccounts.mock.calls.map(([tenantId]) => tenantId)).toEqual([
      TENANT_A,
      TENANT_B,
    ]);
  });

  it("surfaces an authentication failure without leaking credentials", async () => {
    vi.spyOn(xeroClient, "authenticate").mockRejectedValue({
      response: {
        statusCode: 401,
        request: { headers: { authorization: "Bearer super-secret-token" } },
      },
    } as never);

    const result = await callTool(ListAccountsTool(), { tenantId: TENANT_A });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("super-secret-token");
    expect(result.content[0].text).toBe(
      "Authentication failed. Please check your Xero credentials.",
    );
    expect(getAccounts).not.toHaveBeenCalled();
  });

  it("refuses to define a tenanted tool that declares its own tenantId", () => {
    expect(() =>
      CreateXeroTool(
        "bad-tool",
        "A tool",
        { tenantId: z.string() },
        async () => ({
          content: [],
        }),
      )(),
    ).toThrowError(/must not declare its own tenantId/);
  });

  it("keeps a read-then-write handler on its tenant across an interleaved call", async () => {
    const readDone = deferred();
    const mayWrite = deferred();

    getInvoice.mockImplementation(async () => {
      readDone.resolve();
      await mayWrite.promise;
      return {
        body: { invoices: [{ invoiceID: INVOICE_ID, status: "DRAFT" }] },
      };
    });

    const update = callTool(UpdateInvoiceTool(), {
      tenantId: TENANT_A,
      invoiceId: INVOICE_ID,
      reference: "REF-1",
    });

    await readDone.promise;
    await callTool(ListAccountsTool(), { tenantId: TENANT_B });
    mayWrite.resolve();
    await update;

    expect(getInvoice.mock.calls[0][0]).toBe(TENANT_A);
    expect(updateInvoice.mock.calls[0][0]).toBe(TENANT_A);
    expect(getAccounts.mock.calls[0][0]).toBe(TENANT_B);
  });
});
