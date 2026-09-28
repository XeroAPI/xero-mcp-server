import { describe, expect, it } from "vitest";
import { GetTools } from "./get/index.js";
import { ListTools } from "./list/index.js";

describe("quote tools are registered", () => {
  it("includes list-quotes and get-quote", () => {
    const names = [...ListTools, ...GetTools].map((tool) => tool().name);

    expect(names).toEqual(
      expect.arrayContaining(["list-quotes", "get-quote"]),
    );
  });
});
