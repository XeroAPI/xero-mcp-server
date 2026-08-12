import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.XERO_CLIENT_ID = "test-client-id";
  process.env.XERO_CLIENT_SECRET = "test-client-secret";
  delete process.env.XERO_CLIENT_BEARER_TOKEN;
  delete process.env.XERO_SCOPES;

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

describe("CustomConnectionsXeroClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({
      data: {
        access_token: "custom-connection-token",
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

    const tokenSet = await client.getClientCredentialsToken();

    expect(tokenSet.access_token).toBe("custom-connection-token");
    expect(client.tenantId).toBe("");
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
