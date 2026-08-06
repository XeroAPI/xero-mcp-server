import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("item validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats Xero create validation errors as failures", async () => {
    mocks.createItems.mockResolvedValue({
      body: { items: [{ validationErrors: [{ message: "Item code already exists" }] }] },
    });

    const result = await createXeroItem({ code: "SKU-001", name: "Example item" });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Item code already exists",
    });
  });

  it("treats Xero update validation errors as failures", async () => {
    mocks.updateItem.mockResolvedValue({
      body: { items: [{ validationErrors: [{ message: "Item is archived" }] }] },
    });

    const result = await updateXeroItem("item-id", { code: "SKU-001", name: "Example item" });

    expect(result).toEqual({
      result: null,
      isError: true,
      error: "Item is archived",
    });
  });
});
