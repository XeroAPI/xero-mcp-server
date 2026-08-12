import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { CustomConnectionsXeroClient } from "./xero-client.js";

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
