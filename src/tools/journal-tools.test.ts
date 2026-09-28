import { describe, expect, it } from "vitest";
import { GetTools } from "./get/index.js";
import { ListTools } from "./list/index.js";

describe("journal tools are registered", () => {
  it("includes list-journals and get-journal", () => {
    const names = [...ListTools, ...GetTools].map((tool) => tool().name);

    expect(names).toEqual(
      expect.arrayContaining(["list-journals", "get-journal"]),
    );
  });
});
