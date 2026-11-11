import { describe, it, expect } from "vitest";
import {
  runWithTenant,
  tenantContext,
  xeroApiTenantId,
} from "../tenant-context.js";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("tenant context", () => {
  it("throws when no tenant context is active", () => {
    expect(() => tenantContext()).toThrowError(/No tenant context/);
    expect(() => xeroApiTenantId()).toThrowError(/No tenant context/);
  });

  it("exposes the active tenant inside the callback", async () => {
    const seen = await runWithTenant(
      { tenantId: TENANT_A, apiTenantId: TENANT_A },
      async () => tenantContext(),
    );
    expect(seen).toEqual({ tenantId: TENANT_A, apiTenantId: TENANT_A });
  });

  it("returns the empty API tenant ID used by Custom Connections", async () => {
    const seen = await runWithTenant(
      { tenantId: TENANT_A, apiTenantId: "" },
      async () => xeroApiTenantId(),
    );
    expect(seen).toBe("");
  });

  it("isolates nested contexts", async () => {
    await runWithTenant(
      { tenantId: TENANT_A, apiTenantId: TENANT_A },
      async () => {
        await runWithTenant(
          { tenantId: TENANT_B, apiTenantId: TENANT_B },
          async () => {
            expect(tenantContext().tenantId).toBe(TENANT_B);
          },
        );
        expect(tenantContext().tenantId).toBe(TENANT_A);
      },
    );
  });

  it("isolates interleaved concurrent contexts", async () => {
    const aStarted = deferred();
    const bFinished = deferred();
    const seen: string[] = [];

    const a = runWithTenant(
      { tenantId: TENANT_A, apiTenantId: TENANT_A },
      async () => {
        aStarted.resolve();
        await bFinished.promise;
        seen.push(`a:${tenantContext().tenantId}`);
        return tenantContext().tenantId;
      },
    );

    const b = runWithTenant(
      { tenantId: TENANT_B, apiTenantId: TENANT_B },
      async () => {
        await aStarted.promise;
        seen.push(`b:${tenantContext().tenantId}`);
        bFinished.resolve();
        return tenantContext().tenantId;
      },
    );

    expect(await Promise.all([a, b])).toEqual([TENANT_A, TENANT_B]);
    expect(seen).toEqual([`b:${TENANT_B}`, `a:${TENANT_A}`]);
    expect(() => tenantContext()).toThrowError(/No tenant context/);
  });
});
