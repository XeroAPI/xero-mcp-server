import axios from "axios";
import { XeroClient } from "xero-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({ default: { post: vi.fn(), get: vi.fn() } }));

const ORG_A = "0b8f1c2e-aaaa-4bbb-8ccc-111111111111";
const ORG_B = "5d2e9f40-bbbb-4ccc-8ddd-222222222222";

// xero-client.ts builds its client from the environment at import time.
async function loadClient(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return (await import("../xero-client.js")).xeroClient;
}

beforeEach(() => {
  vi.stubEnv("XERO_CLIENT_BEARER_TOKEN", "");
  vi.stubEnv("XERO_TENANT_ID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("bearer token: XERO_TENANT_ID", () => {
  beforeEach(() => {
    // Stands in for xero-node's GET /connections (`tenants` is a getter over `_tenants`).
    vi.spyOn(XeroClient.prototype, "updateTenants").mockImplementation(
      async function (this: XeroClient) {
        Object.assign(this, {
          _tenants: [{ tenantId: ORG_A }, { tenantId: ORG_B }],
        });
        return this.tenants;
      },
    );
  });

  it("targets the configured organisation, not the first", async () => {
    const client = await loadClient({
      XERO_CLIENT_BEARER_TOKEN: "token",
      XERO_TENANT_ID: ORG_B,
    });
    await client.authenticate();
    expect(client.tenantId).toBe(ORG_B);
  });

  it("keeps the first organisation when unset", async () => {
    const client = await loadClient({ XERO_CLIENT_BEARER_TOKEN: "token" });
    await client.authenticate();
    expect(client.tenantId).toBe(ORG_A);
  });

  it("fails instead of falling back when it doesn't match", async () => {
    const client = await loadClient({
      XERO_CLIENT_BEARER_TOKEN: "token",
      XERO_TENANT_ID: "not-a-tenant",
    });
    await expect(client.authenticate()).rejects.toThrow(
      /XERO_TENANT_ID "not-a-tenant" does not match/,
    );
  });
});

describe("custom connection: XERO_TENANT_ID", () => {
  beforeEach(() => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: "t", expires_in: 1800, token_type: "Bearer" },
    });
    vi.mocked(axios.get).mockResolvedValue({ data: [{ tenantId: ORG_A }] });
  });

  const credentials = { XERO_CLIENT_ID: "id", XERO_CLIENT_SECRET: "secret" };

  it("accepts the connection's organisation", async () => {
    const client = await loadClient({
      ...credentials,
      XERO_TENANT_ID: ORG_A.toUpperCase(),
    });
    await client.authenticate();
    expect(client.tenantId).toBe(ORG_A);
  });

  it("reports a mismatch as a configuration error, not a token failure", async () => {
    const client = await loadClient({ ...credentials, XERO_TENANT_ID: ORG_B });
    const error = await client.authenticate().catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(
      /^XERO_TENANT_ID ".+" does not match/,
    );
    expect((error as Error).message).not.toContain(ORG_A);
  });
});
