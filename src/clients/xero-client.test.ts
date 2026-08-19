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
    interceptorUse: vi.fn(),
  };
});

vi.mock("axios", () => ({
  default: {
    post: mocks.post,
    get: mocks.get,
    interceptors: {
      response: { use: mocks.interceptorUse },
    },
  },
}));

import { XeroClient } from "xero-node";

import {
  BearerTokenXeroClient,
  CustomConnectionsXeroClient,
  isXeroApiAuthFailure,
  xeroClient,
} from "./xero-client.js";

// Captured before any beforeEach clears the mock's call history: the module
// registers its interceptor once, at import.
const interceptorOnRejected = mocks.interceptorUse.mock.calls[0]?.[1] as (
  error: unknown,
) => Promise<never>;

function makeUnauthorizedError(url: string) {
  return { response: { status: 401, config: { url } } };
}

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

  afterEach(() => {
    vi.useRealTimers();
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

  it("shares an in-flight token request and caches it until near expiry", async () => {
    const client = new CustomConnectionsXeroClient({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      grantType: "client_credentials",
    });

    await Promise.all([client.authenticate(), client.authenticate()]);
    await client.authenticate();

    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it.each([
    { lifetime: 30, cachedFor: 15 },
    { lifetime: 60, cachedFor: 30 },
    { lifetime: 61, cachedFor: 30.5 },
    { lifetime: 1_800, cachedFor: 1_740 },
  ])(
    "uses a bounded proportional skew for a $lifetime-second token",
    async ({ lifetime, cachedFor }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      mocks.post.mockResolvedValue({
        data: {
          access_token: "synthetic-custom-connection-token",
          expires_in: lifetime,
          token_type: "Bearer",
        },
      });
      const client = new CustomConnectionsXeroClient({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        grantType: "client_credentials",
      });

      await client.authenticate();
      vi.advanceTimersByTime(cachedFor * 1_000 - 1);
      await client.authenticate();
      expect(mocks.post).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      await client.authenticate();
      expect(mocks.post).toHaveBeenCalledTimes(2);
    },
  );

  it.each([-1, 0, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not cache an invalid or expired lifetime (%s)",
    async (expiresIn) => {
      mocks.post.mockResolvedValue({
        data: {
          access_token: "synthetic-custom-connection-token",
          expires_in: expiresIn,
          token_type: "Bearer",
        },
      });
      const client = new CustomConnectionsXeroClient({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        grantType: "client_credentials",
      });

      await client.authenticate();
      await client.authenticate();

      expect(mocks.post).toHaveBeenCalledTimes(2);
    },
  );

  it("clears a failed single-flight request so authentication can retry", async () => {
    mocks.post
      .mockRejectedValueOnce(new Error("synthetic token failure"))
      .mockResolvedValueOnce({
        data: {
          access_token: "synthetic-custom-connection-token",
          expires_in: 1_800,
          token_type: "Bearer",
        },
      });
    const client = new CustomConnectionsXeroClient({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      grantType: "client_credentials",
    });

    const attempts = [client.authenticate(), client.authenticate()];
    await expect(Promise.all(attempts)).rejects.toThrow(
      "Failed to get Xero token",
    );
    expect(mocks.post).toHaveBeenCalledTimes(1);

    await client.authenticate();
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it("reports only status and an allow-listed OAuth token error", async () => {
    const secret = "SYNTHETIC-TOKEN-ENDPOINT-SECRET";
    process.env.XERO_SCOPES = "accounting.settings";
    mocks.post.mockRejectedValue({
      message: `Authorization: Basic ${secret}`,
      config: { url: `https://identity.invalid/?client_secret=${secret}` },
      response: {
        status: 401,
        data: {
          error: "invalid_client",
          error_description: `Cookie: session=${secret}`,
          nested: { access_token: secret },
        },
      },
    });
    const client = new CustomConnectionsXeroClient({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      grantType: "client_credentials",
    });

    try {
      await expect(client.authenticate()).rejects.toThrow(
        "Failed to get Xero token with XERO_SCOPES " +
          "(HTTP 401; OAuth error: invalid_client)",
      );
      await expect(client.authenticate()).rejects.not.toThrow(secret);
    } finally {
      delete process.env.XERO_SCOPES;
    }
  });

  it("does not reflect an unrecognised OAuth code or arbitrary error", async () => {
    const secret = "SYNTHETIC-TOKEN-ENDPOINT-SECRET";
    process.env.XERO_SCOPES = "accounting.settings";
    mocks.post.mockRejectedValue({
      message: secret,
      response: {
        status: 502,
        data: { error: secret, error_description: secret },
      },
    });
    const client = new CustomConnectionsXeroClient({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      grantType: "client_credentials",
    });

    try {
      await expect(client.authenticate()).rejects.toThrow(
        "Failed to get Xero token with XERO_SCOPES (HTTP 502)",
      );
      await expect(client.authenticate()).rejects.not.toThrow(secret);
    } finally {
      delete process.env.XERO_SCOPES;
    }
  });

  it("does not hydrate organisation details for bearer-token authentication", async () => {
    const client = new BearerTokenXeroClient({ bearerToken: "bearer-token" });
    const updateTenants = vi.spyOn(client, "updateTenants").mockResolvedValue([]);

    await client.authenticate();

    expect(updateTenants).toHaveBeenCalledWith(false);
  });

  it("hydrates bearer-token tenants only once", async () => {
    const client = new BearerTokenXeroClient({ bearerToken: "bearer-token" });
    const updateTenants = vi.spyOn(client, "updateTenants").mockResolvedValue([]);

    await Promise.all([client.authenticate(), client.authenticate()]);
    await client.authenticate();

    expect(updateTenants).toHaveBeenCalledTimes(1);
  });
});

describe("cached authentication invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The shared client is module state: start each case with an empty cache.
    xeroClient.invalidateAuthentication();
    mocks.post.mockResolvedValue({
      data: {
        access_token: "synthetic-custom-connection-token",
        expires_in: 1800,
        token_type: "Bearer",
      },
    });
  });

  it("recognises a rejected Xero API call and nothing else", () => {
    expect(
      isXeroApiAuthFailure(
        makeUnauthorizedError("https://api.xero.com/api.xro/2.0/Invoices"),
      ),
    ).toBe(true);
    expect(
      isXeroApiAuthFailure(
        makeUnauthorizedError("https://identity.xero.com/connect/token"),
      ),
    ).toBe(false);
    expect(
      isXeroApiAuthFailure({
        response: { status: 403, config: { url: "https://api.xero.com/x" } },
      }),
    ).toBe(false);
    expect(isXeroApiAuthFailure(new Error("network down"))).toBe(false);
  });

  it("re-requests a token after a revoked one is rejected", async () => {
    const client = new CustomConnectionsXeroClient({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      grantType: "client_credentials",
    });

    await client.authenticate();
    await client.authenticate();
    expect(mocks.post).toHaveBeenCalledTimes(1);

    client.invalidateAuthentication();
    await client.authenticate();

    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it("re-hydrates bearer tenants after a revoked token is rejected", async () => {
    const client = new BearerTokenXeroClient({ bearerToken: "bearer-token" });
    const updateTenants = vi
      .spyOn(client, "updateTenants")
      .mockResolvedValue([]);

    await client.authenticate();
    await client.authenticate();
    expect(updateTenants).toHaveBeenCalledTimes(1);

    client.invalidateAuthentication();
    await client.authenticate();

    expect(updateTenants).toHaveBeenCalledTimes(2);
  });

  it("evicts the shared client's cached token from the axios interceptor", async () => {
    expect(interceptorOnRejected).toBeTypeOf("function");

    await xeroClient.authenticate();
    await xeroClient.authenticate();
    expect(mocks.post).toHaveBeenCalledTimes(1);

    await expect(
      interceptorOnRejected(
        makeUnauthorizedError("https://api.xero.com/api.xro/2.0/Invoices"),
      ),
    ).rejects.toBeDefined();

    await xeroClient.authenticate();
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it("leaves the cached token alone for a token-endpoint rejection", async () => {
    await xeroClient.authenticate();
    expect(mocks.post).toHaveBeenCalledTimes(1);

    await expect(
      interceptorOnRejected(
        makeUnauthorizedError("https://identity.xero.com/connect/token"),
      ),
    ).rejects.toBeDefined();

    await xeroClient.authenticate();
    expect(mocks.post).toHaveBeenCalledTimes(1);
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
    const client = new BearerTokenXeroClient({ bearerToken: "bearer-token" });

    await expect(client.authenticate()).rejects.toThrow(
      "Multiple Xero tenant connections are available. Set XERO_TENANT_ID to the intended organisation's tenant ID.",
    );
    expect(client.tenantId).toBe("");
  });

  it("selects the configured tenant rather than the first connection", async () => {
    process.env.XERO_TENANT_ID = "tenant-b";

    const client = new BearerTokenXeroClient({ bearerToken: "bearer-token" });

    await client.authenticate();

    expect(client.tenantId).toBe("tenant-b");
  });
});
