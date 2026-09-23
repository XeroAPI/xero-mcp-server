import { describe, it, expect, vi } from "vitest";

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: { tenantId: "tenant-1", authenticate: vi.fn(), accountingApi: {} },
}));

import { CreateTools } from "../create/index.js";
import { UpdateTools } from "../update/index.js";
import { DeleteTools } from "../delete/index.js";

const names = (tools: Array<() => { name: string }>) =>
  tools.map((t) => t().name);

describe("account tool registration", () => {
  it("registers create-account", () => {
    expect(names(CreateTools)).toContain("create-account");
  });

  it("registers update-account", () => {
    expect(names(UpdateTools)).toContain("update-account");
  });

  it("registers delete-account", () => {
    expect(names(DeleteTools)).toContain("delete-account");
  });
});
