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

import {
  BearerTokenXeroClient,
  CustomConnectionsXeroClient,
} from "./xero-client.js";
import { runWithAuthorisedMutationTarget } from "../helpers/mutation-confirmation.js";

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

  it("refuses a tenant change in an authorised mutation context", () => {
    const client = new BearerTokenXeroClient({ bearerToken: "bearer-token" });
    client.tenantId = "tenant-a";

    runWithAuthorisedMutationTarget(
      { organisationId: "tenant-a", tenantId: "tenant-a" },
      () => {
        expect(client.tenantId).toBe("tenant-a");
        client.tenantId = "tenant-b";
        expect(() => client.tenantId).toThrow("changed after confirmation");
      },
    );
  });
});
