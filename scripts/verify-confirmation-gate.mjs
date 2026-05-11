#!/usr/bin/env node
// Verifies the write-confirmation gate end-to-end by speaking real MCP
// JSON-RPC over stdio against the built server. Run after `npm run build`.
//
// Pass criteria:
//   1. tools/list — write tools (create/update/delete) include `confirm` in schema;
//      read tools (list/get) do NOT.
//   2. tools/call on a write tool WITHOUT confirm — returns `[CONFIRMATION REQUIRED]`
//      preview text. (Proves no Xero call happened.)
//   3. tools/call on a write tool WITH confirm:true — gate passes; the call reaches
//      the underlying handler. We assert via the response shape (preview text is
//      gone). With bogus Xero creds this surfaces as an auth error from Xero, which
//      is fine — what matters is that we got past the gate.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = resolve(__dirname, "..", "dist", "index.js");

// Force bogus creds so the post-gate path fails fast at auth without touching
// real Xero. We are not testing Xero — we are testing the gate.
const env = {
  ...process.env,
  XERO_CLIENT_ID: "test-client-id",
  XERO_CLIENT_SECRET: "test-client-secret",
  XERO_CLIENT_BEARER_TOKEN: "",
};

const child = spawn("node", [SERVER_ENTRY], {
  env,
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolveRpc, rejectRpc) => {
    pending.set(id, (msg) => {
      if (msg.error) rejectRpc(new Error(JSON.stringify(msg.error)));
      else resolveRpc(msg.result);
    });
    child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
    );
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        rejectRpc(new Error(`timeout: ${method}`));
      }
    }, 10000);
  });
}

const checks = [];
const fail = (label, detail) => {
  checks.push({ label, pass: false, detail });
};
const pass = (label, detail = "") => {
  checks.push({ label, pass: true, detail });
};

async function main() {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verify-script", version: "0.0.0" },
  });
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) +
      "\n",
  );

  const { tools } = await rpc("tools/list", {});
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

  // Check 1: write tools have `confirm`
  for (const writeName of [
    "create-invoice",
    "update-invoice",
    "delete-timesheet",
    "approve-timesheet",
    "revert-timesheet",
  ]) {
    const tool = byName[writeName];
    if (!tool) {
      fail(`${writeName} present`, "tool not registered");
      continue;
    }
    const props = tool.inputSchema?.properties ?? {};
    if (props.confirm) pass(`${writeName} schema has confirm`);
    else fail(`${writeName} schema has confirm`, `props: ${Object.keys(props).join(",")}`);
  }

  // Check 2: read tools do NOT have `confirm`
  for (const readName of ["list-invoices", "list-bank-transactions", "list-accounts"]) {
    const tool = byName[readName];
    if (!tool) {
      fail(`${readName} present`, "tool not registered");
      continue;
    }
    const props = tool.inputSchema?.properties ?? {};
    if (!props.confirm) pass(`${readName} schema lacks confirm`);
    else fail(`${readName} schema lacks confirm`, "confirm leaked into read tool");
  }

  // Check 3: calling a write tool WITHOUT confirm returns the preview
  const previewResult = await rpc("tools/call", {
    name: "create-invoice",
    arguments: {
      type: "ACCREC",
      contactId: "00000000-0000-0000-0000-000000000000",
      lineItems: [{ description: "Gate test", quantity: 1, unitAmount: 1, accountCode: "200", taxType: "NONE" }],
      reference: "gate-test",
    },
  });
  const previewText = previewResult?.content?.[0]?.text ?? "";
  if (previewText.startsWith("[CONFIRMATION REQUIRED")) {
    pass("create-invoice without confirm returns preview");
  } else {
    fail(
      "create-invoice without confirm returns preview",
      `got: ${previewText.slice(0, 120)}…`,
    );
  }

  // Check 4: calling WITH confirm:true passes the gate. We expect the underlying
  // handler to run and fail at Xero auth (bogus creds). The response text must
  // NOT be the preview, and should contain an error from formatError.
  const passThroughResult = await rpc("tools/call", {
    name: "create-invoice",
    arguments: {
      type: "ACCREC",
      contactId: "00000000-0000-0000-0000-000000000000",
      lineItems: [{ description: "Gate test", quantity: 1, unitAmount: 1, accountCode: "200", taxType: "NONE" }],
      reference: "gate-test",
      confirm: true,
    },
  });
  const passText = passThroughResult?.content?.[0]?.text ?? "";
  if (passText.startsWith("[CONFIRMATION REQUIRED")) {
    fail(
      "create-invoice with confirm:true passes gate",
      "still returned preview — gate did not pass through",
    );
  } else if (/error|fail|invalid|unauthor/i.test(passText)) {
    pass(
      "create-invoice with confirm:true passes gate",
      "reached underlying handler (auth/api error as expected)",
    );
  } else {
    // Could also be a real success if creds are good — also acceptable
    pass(
      "create-invoice with confirm:true passes gate",
      `non-preview response: ${passText.slice(0, 120)}…`,
    );
  }

  child.stdin.end();
}

main()
  .catch((err) => {
    fail("script ran to completion", err?.message ?? String(err));
  })
  .finally(() => {
    setTimeout(() => {
      console.log("\n=== Confirmation Gate Verification ===\n");
      let okCount = 0;
      for (const c of checks) {
        const mark = c.pass ? "PASS" : "FAIL";
        console.log(`[${mark}] ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
        if (c.pass) okCount++;
      }
      console.log(`\n${okCount}/${checks.length} checks passed.`);
      child.kill();
      process.exit(okCount === checks.length ? 0 : 1);
    }, 500);
  });
