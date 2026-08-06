import { z } from "zod";
import { describe, expect, it } from "vitest";

describe("list-items tool", () => {
  it("defaults an omitted page to the first page", async () => {
    const originalBearerToken = process.env.XERO_CLIENT_BEARER_TOKEN;
    process.env.XERO_CLIENT_BEARER_TOKEN = "test-bearer-token";

    const { listItemsSchema } = await import("../list-items.tool.js");
    const schema = z.object(listItemsSchema);

    if (originalBearerToken === undefined) {
      delete process.env.XERO_CLIENT_BEARER_TOKEN;
    } else {
      process.env.XERO_CLIENT_BEARER_TOKEN = originalBearerToken;
    }

    expect(schema.parse({})).toEqual({ page: 1 });
    expect(schema.parse({ page: 2 })).toEqual({ page: 2 });
  });
});
