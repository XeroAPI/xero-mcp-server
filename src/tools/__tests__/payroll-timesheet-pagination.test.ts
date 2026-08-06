import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listTimesheets: vi.fn(),
}));

vi.mock("../../handlers/list-xero-timesheets.handler.js", () => ({
  listXeroPayrollTimesheets: mocks.listTimesheets,
}));

import ListPayrollTimesheetsTool from "../list/list-payroll-timesheets.tool.js";

describe("list-timesheets tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTimesheets.mockResolvedValue({ isError: false, result: [] });
  });

  it("passes through the requested page and identifies it in the output", async () => {
    const result = await ListPayrollTimesheetsTool().handler({ page: 2 }, {} as never);

    expect(mocks.listTimesheets).toHaveBeenCalledWith(2);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Found 0 timesheets (page 2):",
    });
  });
});
