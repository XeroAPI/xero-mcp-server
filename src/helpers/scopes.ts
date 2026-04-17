/**
 * OAuth scopes for custom connections and tool gating.
 * @see https://developer.xero.com/documentation/guides/oauth2/scopes/
 */

/** Space-separated scopes requested for custom connections when `XERO_SCOPES` is unset. */
export const DEFAULT_SCOPE_STRING =
  "accounting.transactions accounting.contacts accounting.settings accounting.reports.read payroll.settings payroll.employees payroll.timesheets";

/**
 * Known Xero OAuth2 scope strings (custom-connection style + common granular bearer scopes).
 * Unknown scopes from `XERO_SCOPES` are still passed through to the token request after a warning.
 */
export const VALID_SCOPES: ReadonlySet<string> = new Set([
  // Accounting — custom connection / legacy
  "accounting.transactions",
  "accounting.transactions.read",
  "accounting.contacts",
  "accounting.settings",
  "accounting.reports.read",
  // Granular accounting (bearer / newer apps)
  "accounting.invoices",
  "accounting.invoices.read",
  "accounting.payments",
  "accounting.payments.read",
  "accounting.banktransactions",
  "accounting.banktransactions.read",
  "accounting.manualjournals",
  "accounting.manualjournals.read",
  "accounting.reports.aged.read",
  "accounting.reports.balancesheet.read",
  "accounting.reports.profitandloss.read",
  "accounting.reports.trialbalance.read",
  // Payroll
  "payroll.settings",
  "payroll.employees",
  "payroll.timesheets",
  "payroll.payruns",
  "payroll.payslip",
]);

const ENV_KEY = "XERO_SCOPES";

function splitScopeString(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when using client id/secret (custom connections); false when bearer token overrides. */
export function isCustomConnectionsAuthMode(): boolean {
  return !process.env.XERO_CLIENT_BEARER_TOKEN?.trim();
}

let cachedScopes: Set<string> | undefined;
let cachedScopeString: string | undefined;

function parseAndValidateScopeString(scopeString: string): Set<string> {
  const parts = splitScopeString(scopeString);
  if (parts.length === 0) {
    throw new Error(
      `No OAuth scopes after parsing (whitespace-only or invalid ${ENV_KEY}?). Provide a space-separated list or unset ${ENV_KEY} to use defaults.`,
    );
  }
  const result = new Set<string>();
  for (const scope of parts) {
    if (!VALID_SCOPES.has(scope)) {
      console.warn(
        `[xero-mcp-server] Unknown OAuth scope "${scope}" (not in built-in allowlist). It will still be sent to Xero. Check for typos.`,
      );
    }
    result.add(scope);
  }
  return result;
}

/**
 * Parsed scopes for the current process. Used for custom-connection token requests and tool registration.
 * Cached after first call.
 */
export function getConfiguredScopes(): Set<string> {
  if (cachedScopes) {
    return cachedScopes;
  }
  const raw = process.env[ENV_KEY]?.trim();
  const scopeString = raw && raw.length > 0 ? raw : DEFAULT_SCOPE_STRING;
  cachedScopes = parseAndValidateScopeString(scopeString);
  cachedScopeString = [...cachedScopes].join(" ");
  return cachedScopes;
}

/** Space-separated scopes for the identity server token request (custom connections). */
export function getConfiguredScopeString(): string {
  if (cachedScopeString) {
    return cachedScopeString;
  }
  getConfiguredScopes();
  return cachedScopeString!;
}

/** Whether a tool's required scopes are all present in the configured set. */
export function scopesSatisfyTool(
  configured: Set<string>,
  requiredScopes: string[] | undefined,
): boolean {
  if (!requiredScopes?.length) {
    return true;
  }
  return requiredScopes.every((s) => configured.has(s));
}

/** Declarative scope groups for MCP tools (custom-connection scope names). */
export const ToolScopes = {
  accountingTransactions: ["accounting.transactions"],
  accountingContacts: ["accounting.contacts"],
  accountingSettings: ["accounting.settings"],
  accountingReportsRead: ["accounting.reports.read"],
  payrollEmployees: ["payroll.settings", "payroll.employees"],
  payrollTimesheets: ["payroll.settings", "payroll.timesheets"],
} as const satisfies Record<string, string[]>;
