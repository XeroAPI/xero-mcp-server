import { describe, expect, it, beforeEach, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createItems: vi.fn(),
  updateItem: vi.fn(),
}));

vi.mock("../../clients/xero-client.js", () => ({
  xeroClient: {
    tenantId: "tenant-id",
    authenticate: mocks.authenticate,
    accountingApi: {
      createItems: mocks.createItems,
      updateItem: mocks.updateItem,
    },
  },
}));

import { createXeroItem } from "../create-xero-item.handler.js";
import { updateXeroItem } from "../update-xero-item.handler.js";
import CreateItemTool from "../../tools/create/create-item.tool.js";
import UpdateItemTool from "../../tools/update/update-item.tool.js";

describe("tracked item purchase details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createItems.mockResolvedValue({body: {items: [{itemID: "item-id"}]}});
    mocks.updateItem.mockResolvedValue({body: {items: [{itemID: "item-id"}]}});
  });

  it("accepts Xero's minimum tracked-item create payload", () => {
    const schema = z.object(CreateItemTool().schema as z.ZodRawShape);
    const result = schema.safeParse({
      code: "TrackedItem",
      name: "Tracked Item",
      inventoryAssetAccountCode: "630",
      purchaseDetails: {cogsAccountCode: "300"},
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.purchaseDetails).toEqual({cogsAccountCode: "300"});
    }
  });

  it("retains cogsAccountCode in update tool input", () => {
    const schema = z.object(UpdateItemTool().schema as z.ZodRawShape);
    const result = schema.safeParse({
      itemId: "item-id",
      code: "TrackedItem",
      name: "Tracked Item",
      purchaseDetails: {cogsAccountCode: "300"},
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.purchaseDetails).toEqual({cogsAccountCode: "300"});
    }
  });

  it("maps the create tool field to Xero's cOGSAccountCode", async () => {
    await createXeroItem({
      code: "TrackedItem",
      name: "Tracked Item",
      inventoryAssetAccountCode: "630",
      purchaseDetails: {cogsAccountCode: "300"},
    });

    expect(mocks.createItems).toHaveBeenCalledWith(
      "tenant-id",
      {
        items: [expect.objectContaining({
          purchaseDetails: expect.objectContaining({cOGSAccountCode: "300"}),
        })],
      },
      true,
      undefined,
      undefined,
      expect.any(Object),
    );
  });

  it("maps the update tool field to Xero's cOGSAccountCode", async () => {
    await updateXeroItem("item-id", {
      code: "TrackedItem",
      name: "Tracked Item",
      purchaseDetails: {cogsAccountCode: "300"},
    });

    expect(mocks.updateItem).toHaveBeenCalledWith(
      "tenant-id",
      "item-id",
      {
        items: [expect.objectContaining({
          purchaseDetails: expect.objectContaining({cOGSAccountCode: "300"}),
        })],
      },
      undefined,
      undefined,
      expect.any(Object),
    );
  });
});
