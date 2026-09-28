import { describe, expect, it } from "vitest";
import { CreateTools } from "./create/index.js";
import { DeleteTools } from "./delete/index.js";
import { UpdateTools } from "./update/index.js";

describe("payroll employee leave write tools are registered", () => {
  it("includes create, update, and delete leave tools", () => {
    const names = [...CreateTools, ...UpdateTools, ...DeleteTools].map(
      (tool) => tool().name,
    );

    expect(names).toEqual(
      expect.arrayContaining([
        "create-payroll-employee-leave",
        "update-payroll-employee-leave",
        "delete-payroll-employee-leave",
      ]),
    );
  });
});
