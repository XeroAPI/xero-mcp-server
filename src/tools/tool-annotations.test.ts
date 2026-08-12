import { describe, expect, it } from "vitest";

import { annotationsForOperation } from "./tool-annotations.js";

describe("annotationsForOperation", () => {
  it.each(["get", "list"] as const)(
    "marks %s tools as read-only",
    (operation) => {
      expect(annotationsForOperation(operation)).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    },
  );

  it("marks create tools as non-read-only but non-destructive", () => {
    expect(annotationsForOperation("create")).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
  });

  it.each(["delete", "update"] as const)(
    "marks %s tools as destructive",
    (operation) => {
      expect(annotationsForOperation(operation)).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      });
    },
  );
});
