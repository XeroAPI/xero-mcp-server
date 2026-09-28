import { describe, expect, it } from "vitest";
import { CreateTools } from "./create/index.js";
import { GetTools } from "./get/index.js";
import { ListTools } from "./list/index.js";
import { UpdateTools } from "./update/index.js";

describe("purchase order tools are registered", () => {
  it("includes create, list, get, and update purchase order tools", () => {
    const names = [
      ...CreateTools,
      ...ListTools,
      ...GetTools,
      ...UpdateTools,
    ].map((tool) => tool().name);

    expect(names).toEqual(
      expect.arrayContaining([
        "create-purchase-order",
        "list-purchase-orders",
        "get-purchase-order",
        "update-purchase-order",
      ]),
    );
  });
});
