#!/usr/bin/env node
// Schema-only check: confirms the new tracking* fields are exposed on
// list-profit-and-loss. Uses bogus creds so the server boots but we never
// reach Xero. Does not exercise the SDK forwarding.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SERVER_ENTRY = resolve(REPO_ROOT, "dist", "index.js");

const env = {
  ...process.env,
  XERO_CLIENT_ID: "test-client-id",
  XERO_CLIENT_SECRET: "test-client-secret",
  XERO_CLIENT_BEARER_TOKEN: "",
};

const child = spawn("node", [SERVER_ENTRY], {
  cwd: REPO_ROOT,
  env,
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
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve: r } = pending.get(msg.id);
      pending.delete(msg.id);
      r(msg);
    }
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, { resolve });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

(async () => {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verify-pnl-schema", version: "0.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const list = await rpc("tools/list", {});
  const pnl = list.result.tools.find((t) => t.name === "list-profit-and-loss");
  if (!pnl) {
    console.error("FAIL: list-profit-and-loss tool not found");
    child.kill();
    process.exit(1);
  }

  const props = pnl.inputSchema?.properties ?? {};
  const expected = ["trackingCategoryID", "trackingCategoryID2", "trackingOptionID", "trackingOptionID2"];
  const missing = expected.filter((k) => !(k in props));

  if (missing.length) {
    console.error(`FAIL: missing schema fields: ${missing.join(", ")}`);
    child.kill();
    process.exit(1);
  }

  console.log("PASS: schema includes all four tracking fields");
  console.log("\n--- new field descriptions ---");
  for (const k of expected) {
    console.log(`  ${k}: ${props[k].description ?? "(no description)"}`);
  }

  child.kill();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  child.kill();
  process.exit(1);
});
