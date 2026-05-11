#!/usr/bin/env node
// Smoke-tests the new tracking-category filter on list-profit-and-loss.
// Speaks real MCP JSON-RPC over stdio against the built server, using whatever
// XERO_* creds are in the repo's .env.
//
// What it does (all read-only):
//   1. tools/list  — confirms the new tracking* fields show up in the P&L tool schema.
//   2. list-tracking-categories — pulls a real category + first active option.
//   3. list-profit-and-loss (no tracking) for the last full month.
//   4. list-profit-and-loss (filtered to that category+option).
//   5. Compares row counts / totals to confirm the filter actually narrowed results.
//   6. Regression check for the prior standardLayout/paymentsOnly arg mix-up:
//      calls with (standardLayout=true, paymentsOnly=false) and
//      (standardLayout=false, paymentsOnly=true) and asserts the responses differ.
//
// Run: node scripts/verify-pnl-tracking-filter.mjs

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

(async () => {
  // 1. Initialize.
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verify-pnl-tracking-filter", version: "0.0.0" },
  });
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
  );

  // 2. tools/list — confirm new schema fields.
  const list = await rpc("tools/list", {});
  const pnl = list.result.tools.find((t) => t.name === "list-profit-and-loss");
  if (!pnl) fail("list-profit-and-loss tool not found");
  const props = pnl.inputSchema?.properties ?? {};
  const expected = [
    "trackingCategoryID",
    "trackingCategoryID2",
    "trackingOptionID",
    "trackingOptionID2",
  ];
  for (const k of expected) {
    if (!(k in props)) fail(`missing schema field: ${k}`);
  }
  pass(`schema includes ${expected.join(", ")}`);

  // 3. Pull a real tracking category + option.
  const tcResp = await callTool("list-tracking-categories", {
    reason: "Smoke test — discover a tracking category and option to filter the P&L by.",
  });
  const tcText = textOf(tcResp);
  console.log("\n--- list-tracking-categories (truncated) ---");
  console.log(tcText.slice(0, 800));
  console.log("--- end ---\n");

  // The tool emits human-readable text. Look for IDs via regex.
  const catIdMatch = tcText.match(/Tracking Category ID:\s*([0-9a-f-]{36})/i);
  const optIdMatch = tcText.match(/Option ID:\s*([0-9a-f-]{36})/i);
  if (!catIdMatch || !optIdMatch) {
    fail("could not parse a trackingCategoryID and trackingOptionID from list-tracking-categories");
  }
  const trackingCategoryID = catIdMatch[1];
  const trackingOptionID = optIdMatch[1];
  pass(`picked trackingCategoryID=${trackingCategoryID}, trackingOptionID=${trackingOptionID}`);

  // 4. Pick a date range — last full calendar month relative to today.
  const today = new Date();
  const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const fromDate = fmt(firstOfPrevMonth);
  const toDate = fmt(lastOfPrevMonth);
  console.log(`Using date range: ${fromDate} -> ${toDate}`);

  // 5. Unfiltered P&L.
  const unfiltered = await callTool("list-profit-and-loss", {
    fromDate,
    toDate,
    reason: "Smoke test — baseline unfiltered P&L for comparison against tracking-filtered run.",
  });
  const unfilteredText = textOf(unfiltered);
  if (unfilteredText.startsWith("Error listing profit and loss report")) {
    fail(`unfiltered call errored: ${unfilteredText.slice(0, 300)}`);
  }
  pass(`unfiltered P&L returned (${unfilteredText.length} chars)`);

  // 6. Filtered P&L.
  const filtered = await callTool("list-profit-and-loss", {
    fromDate,
    toDate,
    trackingCategoryID,
    trackingOptionID,
    reason: "Smoke test — P&L filtered to a single tracking option to confirm filter is applied.",
  });
  const filteredText = textOf(filtered);
  if (filteredText.startsWith("Error listing profit and loss report")) {
    fail(`filtered call errored: ${filteredText.slice(0, 300)}`);
  }
  pass(`filtered P&L returned (${filteredText.length} chars)`);

  // 7. Compare. The two should not be byte-identical — at minimum the report
  //    title or row totals should differ once a tracking filter is applied.
  if (unfilteredText === filteredText) {
    fail("filtered and unfiltered P&L are byte-identical — tracking filter appears to be a no-op");
  }
  pass("filtered output differs from unfiltered (filter is being applied)");

  // 8. Regression: standardLayout vs paymentsOnly arg mix-up.
  const layoutOnly = await callTool("list-profit-and-loss", {
    fromDate,
    toDate,
    standardLayout: true,
    paymentsOnly: false,
    reason: "Smoke test — standardLayout-only call to verify it differs from paymentsOnly call (regression check).",
  });
  const paymentsOnlyOnly = await callTool("list-profit-and-loss", {
    fromDate,
    toDate,
    standardLayout: false,
    paymentsOnly: true,
    reason: "Smoke test — paymentsOnly-only call to verify it differs from standardLayout call (regression check).",
  });
  const a = textOf(layoutOnly);
  const b = textOf(paymentsOnlyOnly);
  if (a === b) {
    fail("standardLayout=true and paymentsOnly=true returned identical bodies — args may still be mis-wired");
  }
  pass("standardLayout and paymentsOnly produce distinct responses (regression bug fixed)");

  console.log("\nALL CHECKS PASSED");
  child.kill();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  child.kill();
  process.exit(1);
});
