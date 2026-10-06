import { describe, expect, it } from "vitest";
import { joinTextContent } from "../join-text-content.js";

describe("joinTextContent", () => {
  it("joins a header block and record blocks into one text block", () => {
    const result = joinTextContent({
      content: [
        { type: "text", text: "Found 1 contacts:" },
        { type: "text", text: "Contact: Northwind Dental Group\nID: 01c88221" },
      ],
    });
    expect(result.content).toEqual([
      {
        type: "text",
        text: "Found 1 contacts:\nContact: Northwind Dental Group\nID: 01c88221",
      },
    ]);
  });

  it("leaves a single block unchanged", () => {
    const single = { content: [{ type: "text" as const, text: "Invoice created" }] };
    expect(joinTextContent(single)).toBe(single);
  });

  it("leaves results with non-text blocks unchanged", () => {
    const mixed = {
      content: [
        { type: "text" as const, text: "Chart:" },
        { type: "image" as const, data: "AAAA", mimeType: "image/png" },
      ],
    };
    expect(joinTextContent(mixed)).toBe(mixed);
  });

  it("keeps isError", () => {
    const result = joinTextContent({
      isError: true,
      content: [
        { type: "text", text: "Error listing contacts:" },
        { type: "text", text: "401 Unauthorized" },
      ],
    });
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
  });
});
