import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.XERO_CLIENT_ID = "synthetic-client-id";
  process.env.XERO_CLIENT_SECRET = "synthetic-client-secret";
});

import { getPackageVersion } from "../helpers/get-package-version.js";
import { XeroMcpServer } from "../server/xero-mcp-server.js";
import { CreateTools } from "./create/index.js";
import { DeleteTools } from "./delete/index.js";
import { GetTools } from "./get/index.js";
import { ListTools } from "./list/index.js";
import { ToolFactory } from "./tool-factory.js";
import { UpdateTools } from "./update/index.js";

const EXPECTED_NAMES = {
  delete: ["delete-timesheet"],
  get: ["get-timesheet"],
  create: [
    "create-contact",
    "create-credit-note",
    "create-manual-journal",
    "create-invoice",
    "create-quote",
    "create-payment",
    "create-item",
    "create-bank-transaction",
    "create-timesheet",
    "create-tracking-category",
    "create-tracking-options",
  ],
  list: [
    "list-accounts",
    "list-contacts",
    "list-credit-notes",
    "list-invoices",
    "list-items",
    "list-manual-journals",
    "list-quotes",
    "list-tax-rates",
    "list-trial-balance",
    "list-payments",
    "list-profit-and-loss",
    "list-bank-transactions",
    "list-payroll-employees",
    "list-report-balance-sheet",
    "list-organisation-details",
    "list-payroll-employee-leave",
    "list-payroll-leave-periods",
    "list-payroll-employee-leave-types",
    "list-payroll-employee-leave-balances",
    "list-payroll-leave-types",
    "list-aged-receivables-by-contact",
    "list-aged-payables-by-contact",
    "list-timesheets",
    "list-contact-groups",
    "list-tracking-categories",
  ],
  update: [
    "update-contact",
    "update-credit-note",
    "update-invoice",
    "update-manual-journal",
    "update-quote",
    "update-item",
    "update-bank-transaction",
    "approve-timesheet",
    "add-timesheet-line",
    "update-timesheet-line",
    "revert-timesheet",
    "update-tracking-category",
    "update-tracking-options",
  ],
} as const;

const SOURCES = {
  delete: DeleteTools,
  get: GetTools,
  create: CreateTools,
  list: ListTools,
  update: UpdateTools,
} as const;

describe("ToolFactory registration inventory", () => {
  it("registers the complete golden inventory exactly once without changing definitions", () => {
    const tool = vi.fn();
    ToolFactory({ tool } as unknown as McpServer);

    const expectedNames = Object.values(EXPECTED_NAMES).flat();
    const registeredNames = tool.mock.calls.map(([name]) => name as string);
    expect(registeredNames).toEqual(expectedNames);
    expect(new Set(registeredNames).size).toBe(registeredNames.length);
    expect(registeredNames).toHaveLength(51);

    const sourceDefinitions = Object.values(SOURCES)
      .flat()
      .map((factory) => factory());
    for (const definition of sourceDefinitions) {
      const registration = tool.mock.calls.find(
        ([name]) => name === definition.name,
      );
      expect(registration, definition.name).toBeDefined();
      expect(registration![1]).toBe(definition.description);
      expect(registration![2]).toBe(definition.schema);
      expect(registration![4]).toBe(definition.handler);
    }
  });

  it("publishes conservative annotations for every actual category", () => {
    const tool = vi.fn();
    ToolFactory({ tool } as unknown as McpServer);
    const annotations = new Map(
      tool.mock.calls.map(([name, , , value]) => [name as string, value]),
    );

    for (const name of [...EXPECTED_NAMES.get, ...EXPECTED_NAMES.list]) {
      expect(annotations.get(name), name).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
      });
    }
    for (const name of [...EXPECTED_NAMES.update, ...EXPECTED_NAMES.delete]) {
      expect(annotations.get(name), name).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
      });
    }
    for (const name of EXPECTED_NAMES.create) {
      expect(annotations.get(name), name).toMatchObject({
        readOnlyHint: false,
        idempotentHint: false,
      });
    }
  });

  it("uses the package.json version in the actual server", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    const server = XeroMcpServer.GetServer() as unknown as {
      server: { _serverInfo: { version: string } };
    };

    expect(getPackageVersion()).toBe(packageJson.version);
    expect(server.server._serverInfo.version).toBe(packageJson.version);
  });
});
