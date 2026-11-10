import { describe, expect, it, vi } from "vitest";

import { BearerTokenXeroClient, requestXeroClient, xeroClient } from "../xero-client.js";

describe("xeroClient request scoping", () => {
  it("uses the request's client inside requestXeroClient.run", () => {
    const client = new BearerTokenXeroClient({ bearerToken: "request-token", perRequest: true });
    client.tenantId = "tenant-from-request";

    const seen = requestXeroClient.run(client, () => xeroClient.tenantId);

    expect(seen).toBe("tenant-from-request");
  });

  it("binds methods to the request's client", async () => {
    const client = new BearerTokenXeroClient({ bearerToken: "request-token", perRequest: true });
    const spy = vi.spyOn(client, "authenticate").mockResolvedValue(undefined);

    await requestXeroClient.run(client, () => xeroClient.authenticate());

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.contexts[0]).toBe(client);
  });

  it("keeps concurrent requests apart", async () => {
    const a = new BearerTokenXeroClient({ bearerToken: "a", perRequest: true });
    const b = new BearerTokenXeroClient({ bearerToken: "b", perRequest: true });
    a.tenantId = "tenant-a";
    b.tenantId = "tenant-b";

    const read = (client: BearerTokenXeroClient) =>
      requestXeroClient.run(client, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return xeroClient.tenantId;
      });

    await expect(Promise.all([read(a), read(b)])).resolves.toEqual(["tenant-a", "tenant-b"]);
  });
});
