#!/usr/bin/env node
// Smoke-tests the new configurable pageSize on list-invoices, list-contacts,
// list-credit-notes, list-payments. Speaks real MCP JSON-RPC over stdio
// against the built server using XERO_* creds resolved by the launcher.
//
// Checks (read-only; the only Xero writes here are auth/token):
//   1. tools/list — pageSize present in inputSchema for all four list tools,
//      with min=1, max=100, integer, optional.
//   2. list-invoices with pageSize=3 — count <= 3.
//   3. list-invoices with no pageSize — count <= 10 (default unchanged).
//   4. list-invoices with pageSize=50 — count > 10 if the tenant has enough
//      invoices (skipped with a soft note if not).
//   5. list-contacts with pageSize=2 — count <= 2.
//   6. Schema rejection: list-invoices with pageSize=200 — error response.
//   7. Schema rejection: list-invoices with pageSize=0 — error response.
//
// Run: node scripts/verify-page-size.mjs

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const LAUNCHER = resolve(REPO_ROOT, "bin", "launch-claude-desktop.sh");

const child = spawn(LAUNCHER, [], {
  cwd: REPO_ROOT,
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve: r } = pending.get(msg.id);
      pending.delete(msg.id);
      r(msg);
    }
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function callTool(name, args) {
  return rpc("tools/call", { name, arguments: args });
}

function textOf(resp) {
  return (resp?.result?.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  child.kill();
  process.exit(1);
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function note(msg) {
  console.log(`NOTE: ${msg}`);
}

function countFromText(text) {
  // Tools emit "Found N <thing>:" as the first text content.
  const m = text.match(/Found\s+(\d+)\s+/i);
  return m ? Number(m[1]) : null;
}

function isErrorResponse(resp) {
  if (resp?.error) return true;
  const t = textOf(resp);
  if (/^Error\b/i.test(t)) return true;
  if (resp?.result?.isError === true) return true;
  return false;
}

(async () => {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verify-page-size", version: "0.0.0" },
  });
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
  );

  // 1. tools/list — confirm pageSize on all four targets.
  const list = await rpc("tools/list", {});
  const targets = [
    "list-invoices",
    "list-contacts",
    "list-credit-notes",
    "list-payments",
  ];
  for (const name of targets) {
    const tool = list.result.tools.find((t) => t.name === name);
    if (!tool) fail(`${name} tool not found`);
    const ps = tool.inputSchema?.properties?.pageSize;
    if (!ps) fail(`${name}: pageSize missing from inputSchema`);
    if (ps.type !== "integer" && ps.type !== "number") {
      fail(`${name}: pageSize type expected integer/number, got ${ps.type}`);
    }
    if (ps.minimum !== 1) fail(`${name}: pageSize minimum expected 1, got ${ps.minimum}`);
    if (ps.maximum !== 100) fail(`${name}: pageSize maximum expected 100, got ${ps.maximum}`);
    const required = tool.inputSchema?.required ?? [];
    if (required.includes("pageSize")) fail(`${name}: pageSize should be optional`);
    pass(`${name}: pageSize schema (1–100, optional) ✓`);
  }

  // 2. list-invoices pageSize=3 — count <= 3.
  const small = await callTool("list-invoices", {
    page: 1,
    pageSize: 3,
    reason: "verify pageSize cap returns at most pageSize results",
  });
  if (isErrorResponse(small)) fail(`list-invoices pageSize=3 errored: ${textOf(small).slice(0, 300)}`);
  const smallCount = countFromText(textOf(small));
  if (smallCount === null) fail(`list-invoices pageSize=3: could not parse count`);
  if (smallCount > 3) fail(`list-invoices pageSize=3 returned ${smallCount} (expected <= 3)`);
  pass(`list-invoices pageSize=3 returned ${smallCount} ≤ 3`);

  // 3. list-invoices default — count <= 10.
  const def = await callTool("list-invoices", {
    page: 1,
    reason: "verify default pageSize remains 10",
  });
  if (isErrorResponse(def)) fail(`list-invoices default errored: ${textOf(def).slice(0, 300)}`);
  const defCount = countFromText(textOf(def));
  if (defCount === null) fail(`list-invoices default: could not parse count`);
  if (defCount > 10) fail(`list-invoices default returned ${defCount} (expected <= 10)`);
  pass(`list-invoices default returned ${defCount} ≤ 10`);

  // 4. list-invoices pageSize=50 — count > 10 if tenant has the data.
  const big = await callTool("list-invoices", {
    page: 1,
    pageSize: 50,
    reason: "verify pageSize raises ceiling above the previous hard-coded 10",
  });
  if (isErrorResponse(big)) fail(`list-invoices pageSize=50 errored: ${textOf(big).slice(0, 300)}`);
  const bigCount = countFromText(textOf(big));
  if (bigCount === null) fail(`list-invoices pageSize=50: could not parse count`);
  if (bigCount > 50) fail(`list-invoices pageSize=50 returned ${bigCount} (expected <= 50)`);
  if (bigCount > 10) {
    pass(`list-invoices pageSize=50 returned ${bigCount} > 10 (cap raised) ✓`);
  } else {
    note(`list-invoices pageSize=50 returned ${bigCount} ≤ 10 — tenant may not have >10 invoices on page 1; cap-raise unverified end-to-end but signature is correct`);
  }

  // 5. list-contacts pageSize=2.
  const contacts = await callTool("list-contacts", {
    page: 1,
    pageSize: 2,
    reason: "verify pageSize cap on list-contacts",
  });
  if (isErrorResponse(contacts)) fail(`list-contacts pageSize=2 errored: ${textOf(contacts).slice(0, 300)}`);
  const contactsCount = countFromText(textOf(contacts));
  if (contactsCount === null) fail(`list-contacts pageSize=2: could not parse count`);
  if (contactsCount > 2) fail(`list-contacts pageSize=2 returned ${contactsCount} (expected <= 2)`);
  pass(`list-contacts pageSize=2 returned ${contactsCount} ≤ 2`);

  // 6. Schema rejection: pageSize=200.
  const tooBig = await callTool("list-invoices", { page: 1, pageSize: 200 });
  if (!isErrorResponse(tooBig)) {
    fail(`list-invoices pageSize=200 should have been rejected by schema, got: ${textOf(tooBig).slice(0, 300)}`);
  }
  pass(`list-invoices pageSize=200 rejected by schema ✓`);

  // 7. Schema rejection: pageSize=0.
  const zero = await callTool("list-invoices", { page: 1, pageSize: 0 });
  if (!isErrorResponse(zero)) {
    fail(`list-invoices pageSize=0 should have been rejected by schema, got: ${textOf(zero).slice(0, 300)}`);
  }
  pass(`list-invoices pageSize=0 rejected by schema ✓`);

  console.log("\nALL CHECKS PASSED");
  child.kill();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  child.kill();
  process.exit(1);
});
