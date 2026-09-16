import { describe, it, expect } from "vitest";
import { QuoteStatusCodes } from "xero-node";
import {
  settableQuoteStatusNames,
  toQuoteStatus,
  describeRejectedQuoteTransition,
} from "../to-quote-status.js";

describe("toQuoteStatus", () => {
  it("maps every settable name to its Xero enum value", () => {
    expect(toQuoteStatus("DRAFT")).toBe(QuoteStatusCodes.DRAFT);
    expect(toQuoteStatus("SENT")).toBe(QuoteStatusCodes.SENT);
    expect(toQuoteStatus("DECLINED")).toBe(QuoteStatusCodes.DECLINED);
    expect(toQuoteStatus("ACCEPTED")).toBe(QuoteStatusCodes.ACCEPTED);
  });

  it("returns undefined when no status was supplied", () => {
    expect(toQuoteStatus(undefined)).toBeUndefined();
  });

  it("does not expose INVOICED or DELETED as settable", () => {
    expect(settableQuoteStatusNames).not.toContain("INVOICED");
    expect(settableQuoteStatusNames).not.toContain("DELETED");
  });

  it("maps every advertised name, so the enum and the tool stay in step", () => {
    for (const name of settableQuoteStatusNames) {
      expect(toQuoteStatus(name)).toBeDefined();
    }
  });
});

describe("describeRejectedQuoteTransition", () => {
  it("rejects DRAFT to DECLINED and names the working route", () => {
    expect(
      describeRejectedQuoteTransition(
        QuoteStatusCodes.DRAFT,
        QuoteStatusCodes.DECLINED,
      ),
    ).toBe(
      "Xero does not allow a quote to move directly from DRAFT to DECLINED. Set it to SENT first, then to DECLINED.",
    );
  });

  it("rejects ACCEPTED to DECLINED and names the working route", () => {
    expect(
      describeRejectedQuoteTransition(
        QuoteStatusCodes.ACCEPTED,
        QuoteStatusCodes.DECLINED,
      ),
    ).toBe(
      "Xero does not allow a quote to move directly from ACCEPTED to DECLINED. Set it to SENT first, then to DECLINED.",
    );
  });

  it.each([
    [QuoteStatusCodes.DRAFT, QuoteStatusCodes.SENT],
    [QuoteStatusCodes.SENT, QuoteStatusCodes.ACCEPTED],
    [QuoteStatusCodes.SENT, QuoteStatusCodes.DECLINED],
    [QuoteStatusCodes.ACCEPTED, QuoteStatusCodes.SENT],
  ])("allows %s to %s, which is verified to work", (from, to) => {
    expect(describeRejectedQuoteTransition(from, to)).toBeNull();
  });

  it("does not block a transition it has no evidence about", () => {
    expect(
      describeRejectedQuoteTransition(
        QuoteStatusCodes.DECLINED,
        QuoteStatusCodes.SENT,
      ),
    ).toBeNull();
  });

  it("stays out of the way when either status is missing", () => {
    expect(
      describeRejectedQuoteTransition(undefined, QuoteStatusCodes.DECLINED),
    ).toBeNull();
    expect(
      describeRejectedQuoteTransition(QuoteStatusCodes.DRAFT, undefined),
    ).toBeNull();
    expect(describeRejectedQuoteTransition(undefined, undefined)).toBeNull();
  });
});
