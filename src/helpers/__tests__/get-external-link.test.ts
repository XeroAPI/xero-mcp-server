import { describe, expect, it } from "vitest";
import { getExternalLink } from "../get-external-link.js";

describe("getExternalLink", () => {
  it("preserves a usable external URL", () => {
    const url = "https://example.com/invoices/123?source=xero&preview=true";

    expect(getExternalLink(url)).toBe(url);
  });
});
