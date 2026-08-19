import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.XERO_CLIENT_ID = "test-client-id";
  process.env.XERO_CLIENT_SECRET = "test-client-secret";
  delete process.env.XERO_CLIENT_BEARER_TOKEN;
  delete process.env.XERO_SCOPES;
  delete process.env.XERO_TENANT_ID;

  return {
    post: vi.fn(),
    get: vi.fn(),
  };
});

vi.mock("axios", () => ({
  default: {
    post: mocks.post,
    get: mocks.get,
  },
}));

import { XeroClient } from "xero-node";

import {
  BearerTokenXeroClient,
  CustomConnectionsXeroClient,
} from "./xero-client.js";

describe("CustomConnectionsXeroClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({
      data: {
        access_token: "synthetic-custom-connection-token",
        expires_in: 1800,
        token_type: "Bearer",
      },
    });
  });

  it("does not call the non-tenanted connections endpoint", async () => {
    const client = new CustomConnectionsXeroClient({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      grantType: "client_credentials",
    });

    await client.authenticate();

    expect(client.tenantId).toBe("");
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});

describe("MCPXeroClient.updateTenants", () => {
  const tenants = [
    { tenantId: "tenant-a", updatedDateUtc: "2024-01-01T00:00:00Z" },
    { tenantId: "tenant-b", updatedDateUtc: "2024-01-02T00:00:00Z" },
  ];

  beforeEach(() => {
    delete process.env.XERO_TENANT_ID;

    vi.spyOn(XeroClient.prototype, "updateTenants").mockImplementation(
      async function (this: XeroClient) {
        (this as unknown as { _tenants: unknown[] })._tenants = tenants;
        return tenants;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.XERO_TENANT_ID;
  });

  it("refuses to guess when the credential can reach several organisations", async () => {
    const client = new BearerTokenXeroClient({ bearerToken: "test-token" });

    await expect(client.authenticate()).rejects.toThrow(
      "Multiple Xero tenant connections are available. Set XERO_TENANT_ID to the intended organisation's tenant ID.",
    );
    expect(client.tenantId).toBe("");
  });

  it("selects the configured tenant rather than the first connection", async () => {
    process.env.XERO_TENANT_ID = "tenant-b";

    const client = new BearerTokenXeroClient({ bearerToken: "test-token" });

    await client.authenticate();

    expect(client.tenantId).toBe("tenant-b");
  });
});
