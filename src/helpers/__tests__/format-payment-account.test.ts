import { describe, expect, it } from "vitest";
import { formatPaymentAccount } from "../format-payment-account.js";

describe("formatPaymentAccount", () => {
  it("shows the account ID when the API returns only an ID (bank accounts)", () => {
    expect(formatPaymentAccount({ accountID: "abc-123" })).toBe(
      "Account ID: abc-123",
    );
  });

  it("shows the code when the API returns an ID and code", () => {
    expect(formatPaymentAccount({ accountID: "abc-123", code: "090" })).toBe(
      "Account: Code 090 (abc-123)",
    );
  });

  it("prefers the name when present", () => {
    expect(
      formatPaymentAccount({ accountID: "abc-123", code: "090", name: "Checking" }),
    ).toBe("Account: Checking (abc-123)");
  });

  it("returns null when there is no account", () => {
    expect(formatPaymentAccount(undefined)).toBeNull();
    expect(formatPaymentAccount({})).toBeNull();
  });
});
