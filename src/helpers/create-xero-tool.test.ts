import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  CreateXeroTool,
  MutationXeroTool,
  REVIEWED_MUTATION_INPUT_KEYS,
} from "./create-xero-tool.js";
import {
  MutationConfirmationStore,
  resolveAuthorisedMutationTenantId,
} from "./mutation-confirmation.js";

function tokenFrom(text: string): string {
  const match = text.match(/^Confirmation token: (.+)$/m);
  if (!match) throw new Error("Prepared response did not contain a token");
  return match[1];
}

describe("MutationXeroTool confirmation", () => {
  it("prepares a bounded preview without invoking the mutation handler", async () => {
    const handler = vi.fn();
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => "synthetic-token",
    );
    const tool = MutationXeroTool(
      "create-example",
      "Create an example",
      { amount: z.number() },
      handler,
      { supportsIdempotency: true, confirmation },
    )();

    const result = await tool.handler(
      { amount: 42, confirmationAction: "prepare" },
      {} as never,
    );
    const text = result.content[0].type === "text" ? result.content[0].text : "";

    expect(handler).not.toHaveBeenCalled();
    expect(text).toContain("Prepared only: create-example was not sent to Xero.");
    expect(text).toContain("Selected Xero organisation: synthetic-organisation");
    expect(text).toContain("Confirmation token: synthetic-token");
    expect(text).toContain('"amount": 42');
  });

  it.each([
    "create-invoice",
    "update-invoice",
    "delete-timesheet",
    "approve-timesheet",
  ])("requires prepare then execute for %s", async (name) => {
    let tokenCounter = 0;
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => `token-${tokenCounter += 1}`,
    );
    const tool = MutationXeroTool(
      name,
      "Mutate an example",
      { amount: z.number() },
      handler,
      { supportsIdempotency: true, confirmation },
    )();

    await expect(
      tool.handler(
        { amount: 42, confirmationAction: "execute" },
        {} as never,
      ),
    ).rejects.toThrow("Prepare the mutation first");

    const prepared = await tool.handler(
      { amount: 42, confirmationAction: "prepare" },
      {} as never,
    );
    const text =
      prepared.content[0].type === "text" ? prepared.content[0].text : "";
    await tool.handler(
      {
        amount: 42,
        confirmationAction: "execute",
        confirmationToken: tokenFrom(text),
      },
      {} as never,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ amount: 42 }, {});
  });

  it("redacts sensitive fields and bounds the prepared preview", async () => {
    const handler = vi.fn();
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => "synthetic-token",
    );
    const tool = MutationXeroTool(
      "create-contact",
      "Create a contact",
      {
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        bankAccountId: z.string(),
        description: z.string(),
        narration: z.string(),
        reference: z.string(),
        summary: z.string(),
        title: z.string(),
        terms: z.string(),
        purchaseDescription: z.string(),
        optionNames: z.array(z.string()),
        date: z.string(),
        status: z.string(),
        type: z.string(),
        notes: z.string(),
      },
      handler,
      { supportsIdempotency: true, confirmation },
    )();

    const result = await tool.handler(
      {
        name: "Synthetic Person",
        email: "person@example.test",
        phone: "0400000000",
        bankAccountId: "synthetic-bank-id",
        description: "private-description-marker",
        narration: "private-narration-marker",
        reference: "private-reference-marker",
        summary: "private-summary-marker",
        title: "private-title-marker",
        terms: "private-terms-marker",
        purchaseDescription: "private-purchase-marker",
        optionNames: ["private-option-marker"],
        date: "2026-08-13",
        status: "DRAFT",
        type: "ACCREC",
        notes: "x".repeat(20_000),
        confirmationAction: "prepare",
      },
      {} as never,
    );
    const text = result.content[0].type === "text" ? result.content[0].text : "";

    expect(handler).not.toHaveBeenCalled();
    expect(text).toContain("[redacted]");
    expect(text).not.toContain("person@example.test");
    expect(text).not.toContain("0400000000");
    expect(text).not.toContain("synthetic-bank-id");
    expect(text).not.toContain("Synthetic Person");
    expect(text).not.toContain("private-description-marker");
    expect(text).not.toContain("private-narration-marker");
    expect(text).not.toContain("private-reference-marker");
    expect(text).not.toContain("private-summary-marker");
    expect(text).not.toContain("private-title-marker");
    expect(text).not.toContain("private-terms-marker");
    expect(text).not.toContain("private-purchase-marker");
    expect(text).not.toContain("private-option-marker");
    expect(text).not.toContain("x".repeat(100));
    expect(text).toContain('"date": "2026-08-13"');
    expect(text).toContain('"status": "DRAFT"');
    expect(text).toContain('"type": "ACCREC"');
    expect(text.length).toBeLessThan(9_000);
  });

  it("redacts adversarial strings under decision-field names", async () => {
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => "synthetic-token",
    );
    const tool = MutationXeroTool(
      "update-example",
      "Update an example",
      {
        date: z.string(),
        status: z.string(),
        type: z.string(),
        taxType: z.string(),
      },
      vi.fn(),
      confirmation,
    )();
    const markers = {
      date: "2026-99-99",
      status: "DRAFT private-status-marker",
      type: "private-type-marker",
      taxType: "OUTPUT secret-marker",
    };

    const prepared = await tool.handler(
      { ...markers, confirmationAction: "prepare" },
      {} as never,
    );
    const text =
      prepared.content[0].type === "text" ? prepared.content[0].text : "";

    for (const marker of Object.values(markers)) {
      expect(text).not.toContain(marker);
    }
  });

  it.each(["", "synthetic-token", "x".repeat(129)])(
    "rejects any supplied confirmation token while preparing: %s",
    async (confirmationToken) => {
      const tool = MutationXeroTool(
        "create-example",
        "Create an example",
        { amount: z.number() },
        vi.fn(),
        new MutationConfirmationStore(async () => ({
          organisationId: "synthetic-organisation",
        })),
      )();

      await expect(
        tool.handler(
          { amount: 42, confirmationAction: "prepare", confirmationToken },
          {} as never,
        ),
      ).rejects.toThrow();
    },
  );

  it("keeps the token opaque and rejects changed payloads and replay", async () => {
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => "opaque-random-token",
    );
    const prepared = await confirmation.prepare("create-invoice", {
      amount: 42,
      reference: "private-reference",
    });

    expect(prepared.token).toBe("opaque-random-token");
    expect(prepared.token).not.toContain("private-reference");
    await expect(
      confirmation.authorise(
        "create-invoice",
        { amount: 43, reference: "private-reference" },
        prepared.token,
      ),
    ).rejects.toThrow("payload");
    await expect(
      confirmation.authorise(
        "create-invoice",
        { amount: 42, reference: "private-reference" },
        prepared.token,
      ),
    ).rejects.toThrow("already used");
  });

  it("binds a token to the selected organisation and consumes a mismatch", async () => {
    let organisationId = "organisation-a";
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId }),
      () => 1_000,
      () => "organisation-bound-token",
    );
    const prepared = await confirmation.prepare("delete-timesheet", {
      timesheetID: "synthetic-timesheet",
    });
    organisationId = "organisation-b";

    await expect(
      confirmation.authorise(
        "delete-timesheet",
        { timesheetID: "synthetic-timesheet" },
        prepared.token,
      ),
    ).rejects.toThrow("organisation changed");
    organisationId = "organisation-a";
    await expect(
      confirmation.authorise(
        "delete-timesheet",
        { timesheetID: "synthetic-timesheet" },
        prepared.token,
      ),
    ).rejects.toThrow("already used");
  });

  it("stops execution when the tenant changes inside the handler", async () => {
    let tenantId = "tenant-a";
    const apiCall = vi.fn();
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: tenantId, tenantId }),
      () => 1_000,
      () => "tenant-bound-token",
    );
    const tool = MutationXeroTool(
      "create-example",
      "Create an example",
      { amount: z.number() },
      async () => {
        tenantId = "tenant-b";
        apiCall(resolveAuthorisedMutationTenantId(tenantId));
        return { content: [] };
      },
      { supportsIdempotency: true, confirmation },
    )();
    const prepared = await tool.handler(
      { amount: 42, confirmationAction: "prepare" },
      {} as never,
    );
    const text =
      prepared.content[0].type === "text" ? prepared.content[0].text : "";

    await expect(
      tool.handler(
        {
          amount: 42,
          confirmationAction: "execute",
          confirmationToken: tokenFrom(text),
        },
        {} as never,
      ),
    ).rejects.toThrow("changed after confirmation");
    expect(apiCall).not.toHaveBeenCalled();
  });

  it("rejects expired tokens", async () => {
    let now = 1_000;
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => now,
      () => "expiring-token",
      100,
    );
    const prepared = await confirmation.prepare("approve-timesheet", {
      timesheetID: "synthetic-timesheet",
    });
    now = 1_101;

    await expect(
      confirmation.authorise(
        "approve-timesheet",
        { timesheetID: "synthetic-timesheet" },
        prepared.token,
      ),
    ).rejects.toThrow("expired");
  });

  it("rechecks expiry after resolving the execution target", async () => {
    let now = 1_000;
    let resolutionCount = 0;
    const confirmation = new MutationConfirmationStore(
      async () => {
        resolutionCount += 1;
        if (resolutionCount === 2) now = 1_101;
        return { organisationId: "synthetic-organisation" };
      },
      () => now,
      () => "slow-resolution-token",
      100,
    );
    const prepared = await confirmation.prepare("create-invoice", {
      amount: 42,
    });

    await expect(
      confirmation.authorise(
        "create-invoice",
        { amount: 42 },
        prepared.token,
      ),
    ).rejects.toThrow("expired");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, undefined, 1n, new Date()])(
    "rejects payload values that JSON would not bind safely: %s",
    async (unsupported) => {
      const confirmation = new MutationConfirmationStore(
        async () => ({ organisationId: "synthetic-organisation" }),
      );

      await expect(
        confirmation.prepare("create-invoice", { unsupported }),
      ).rejects.toThrow(/non-finite|unsupported/);
    },
  );

  it("pins the reviewed mutation-input inventory", () => {
    expect(REVIEWED_MUTATION_INPUT_KEYS).toEqual([
      "accountId",
      "address",
      "amount",
      "bankAccountId",
      "bankTransactionId",
      "code",
      "contactId",
      "creditNoteId",
      "date",
      "description",
      "dueDate",
      "email",
      "employeeID",
      "endDate",
      "expiryDate",
      "firstName",
      "inventoryAssetAccountCode",
      "invoiceId",
      "isTrackedAsInventory",
      "itemId",
      "lastName",
      "lineAmountTypes",
      "lineItems",
      "manualJournalID",
      "manualJournalLines",
      "name",
      "narration",
      "optionNames",
      "options",
      "payrollCalendarID",
      "phone",
      "purchaseDescription",
      "purchaseDetails",
      "quoteId",
      "quoteNumber",
      "reference",
      "salesDetails",
      "showOnCashBasisReports",
      "startDate",
      "status",
      "summary",
      "terms",
      "timesheetID",
      "timesheetLine",
      "timesheetLineID",
      "timesheetLines",
      "title",
      "trackingCategoryId",
      "type",
      "url",
    ]);
  });

  it("keeps every registered mutation tool behind the shared gate", () => {
    const toolsRoot = fileURLToPath(new URL("../tools/", import.meta.url));
    const mutationToolFiles = ["create", "update", "delete"].flatMap(
      (directory) =>
        readdirSync(`${toolsRoot}/${directory}`)
          .filter((file) => file.endsWith("tool.ts"))
          .map((file) => `${toolsRoot}/${directory}/${file}`),
    );

    expect(mutationToolFiles).toHaveLength(25);
    for (const file of mutationToolFiles) {
      expect(readFileSync(file, "utf8"), file).toContain("MutationXeroTool(");
    }
  });

  it("strips unknown and confirmation fields before the handler", async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    let tokenCounter = 0;
    const confirmation = new MutationConfirmationStore(
      async () => ({ organisationId: "synthetic-organisation" }),
      () => 1_000,
      () => `token-${tokenCounter += 1}`,
    );
    const tool = MutationXeroTool(
      "create-example",
      "Create an example",
      { amount: z.number() },
      handler,
      { supportsIdempotency: true, confirmation },
    )();
    const prepared = await tool.handler(
      {
        amount: 42,
        unknownControl: "must-not-leak",
        confirmationAction: "prepare",
      } as never,
      {} as never,
    );
    const text =
      prepared.content[0].type === "text" ? prepared.content[0].text : "";

    await tool.handler(
      {
        amount: 42,
        unknownControl: "must-not-leak",
        confirmationAction: "execute",
        confirmationToken: tokenFrom(text),
      } as never,
      {} as never,
    );

    expect(handler).toHaveBeenCalledWith({ amount: 42 }, {});
  });

  it("keeps read-only tool schemas and handlers unchanged", async () => {
    const handler = vi.fn().mockResolvedValue({ content: [] });
    const schema = { accountId: z.string() };
    const tool = CreateXeroTool(
      "list-example",
      "List an example",
      schema,
      handler,
    )();

    expect(tool.schema).toBe(schema);
    expect(tool.schema).not.toHaveProperty("confirmationAction");
    expect(tool.schema).not.toHaveProperty("confirmationToken");
    await tool.handler({ accountId: "synthetic-id" }, {} as never);
    expect(handler).toHaveBeenCalledWith({ accountId: "synthetic-id" }, {});
  });
});
