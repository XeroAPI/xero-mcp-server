import { createHash, randomBytes } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

export interface MutationTarget {
  organisationId: string;
  tenantId?: string;
}

export interface PreparedMutation extends MutationTarget {
  token: string;
  expiresAt: Date;
}

interface PendingMutation {
  action: string;
  expiresAt: number;
  organisationId: string;
  payloadHash: string;
  tenantId?: string;
}

type MutationTargetResolver = () => Promise<MutationTarget>;

export interface MutationConfirmation {
  prepare(action: string, payload: unknown): Promise<PreparedMutation>;
  authorise(
    action: string,
    payload: unknown,
    token: string,
  ): Promise<MutationTarget>;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_PENDING = 1_000;
const authorisedMutationTarget = new AsyncLocalStorage<MutationTarget>();

export function runWithAuthorisedMutationTarget<T>(
  target: MutationTarget,
  callback: () => T,
): T {
  return authorisedMutationTarget.run(target, callback);
}

export function resolveAuthorisedMutationTenantId(
  currentTenantId: string,
): string {
  const target = authorisedMutationTarget.getStore();
  if (target?.tenantId === undefined) return currentTenantId;
  if (target.tenantId !== currentTenantId) {
    throw new Error(
      "The selected Xero organisation changed after confirmation. Prepare the mutation again.",
    );
  }
  return target.tenantId;
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new Error("Mutation payload contains an unsupported value.");
    }
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalise(child)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Mutation payload contains a non-finite number.");
  }
  if (
    value === undefined ||
    typeof value === "bigint" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    throw new Error("Mutation payload contains an unsupported value.");
  }
  return value;
}

function hashPayload(action: string, payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify({ action, payload: canonicalise(payload) }))
    .digest("hex");
}

export class MutationConfirmationStore implements MutationConfirmation {
  private readonly pending = new Map<string, PendingMutation>();

  constructor(
    private readonly resolveTarget: MutationTargetResolver,
    private readonly now: () => number = Date.now,
    private readonly createToken: () => string = () =>
      randomBytes(32).toString("base64url"),
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly maxPending = DEFAULT_MAX_PENDING,
  ) {}

  async prepare(action: string, payload: unknown): Promise<PreparedMutation> {
    const target = await this.resolveTarget();
    if (!target.organisationId) {
      throw new Error("No Xero organisation is selected.");
    }

    const now = this.now();
    this.prune(now);
    while (this.pending.size >= this.maxPending) {
      const oldest = this.pending.keys().next().value as string | undefined;
      if (!oldest) break;
      this.pending.delete(oldest);
    }

    const token = this.createUniqueToken();
    const expiresAt = now + this.ttlMs;
    this.pending.set(token, {
      action,
      expiresAt,
      organisationId: target.organisationId,
      payloadHash: hashPayload(action, payload),
      tenantId: target.tenantId,
    });

    return {
      token,
      expiresAt: new Date(expiresAt),
      organisationId: target.organisationId,
    };
  }

  async authorise(
    action: string,
    payload: unknown,
    token: string,
  ): Promise<MutationTarget> {
    const pending = this.pending.get(token);
    this.pending.delete(token);

    if (!pending || pending.expiresAt <= this.now()) {
      throw new Error(
        "Confirmation token is invalid, expired, or already used. Prepare the mutation again.",
      );
    }

    const target = await this.resolveTarget();
    if (pending.expiresAt <= this.now()) {
      throw new Error(
        "Confirmation token is invalid, expired, or already used. Prepare the mutation again.",
      );
    }
    if (
      pending.action !== action ||
      pending.organisationId !== target.organisationId ||
      pending.tenantId !== target.tenantId ||
      pending.payloadHash !== hashPayload(action, payload)
    ) {
      throw new Error(
        "The action, payload, or selected Xero organisation changed. Prepare the mutation again.",
      );
    }

    return target;
  }

  private createUniqueToken(): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const token = this.createToken();
      if (token && !this.pending.has(token)) return token;
    }
    throw new Error("Could not create a unique confirmation token.");
  }

  private prune(now: number): void {
    for (const [token, pending] of this.pending) {
      if (pending.expiresAt <= now) this.pending.delete(token);
    }
  }
}

export const mutationConfirmation = new MutationConfirmationStore(
  async () => {
    const { xeroClient } = await import("../clients/xero-client.js");
    await xeroClient.authenticate();
    const tenantId = xeroClient.tenantId;
    return {
      organisationId: tenantId || "Custom Connection organisation",
      tenantId,
    };
  },
);
