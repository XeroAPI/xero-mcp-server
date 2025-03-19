import { spawn } from "child_process";

async function testMcpServer() {
  const server = spawn("node", ["dist/index.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Log stderr for debugging
  server.stderr.on("data", (data) => {
    console.error("Server log:", data.toString().trim());
  });

  // Handle stdout for responses
  let buffer = "";
  server.stdout.on("data", (data) => {
    const output = data.toString();
    console.error("Raw stdout:", output);
    buffer += output;

    // Try to extract and parse JSON messages
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        // Only try to parse lines that look like JSON
        if (line.trim().startsWith("{")) {
          const response = JSON.parse(line);
          console.error("Server response:", JSON.stringify(response, null, 2));
        }
      } catch {
        console.error("Failed to parse line as JSON:", line);
      }
    }
  });

  // Handle server exit
  server.on("exit", (code) => {
    console.error(`Server exited with code ${code}`);
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test listing contacts
  const listContactsRequest = {
    type: "list",
    uri: "xero://contacts",
    parameters: {},
  };
  console.error(
    "\nSending contacts list request:",
    JSON.stringify(listContactsRequest),
  );
  server.stdin.write(JSON.stringify(listContactsRequest) + "\n");

  // Wait for list response
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test reading contacts
  const readContactsRequest = {
    type: "read",
    uri: "xero://contacts",
    parameters: {},
  };
  console.error(
    "\nSending contacts read request:",
    JSON.stringify(readContactsRequest),
  );
  server.stdin.write(JSON.stringify(readContactsRequest) + "\n");

  // Wait for read response
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test listing invoices
  const listInvoicesRequest = {
    type: "list",
    uri: "xero://invoices",
    parameters: {},
  };
  console.error(
    "\nSending invoices list request:",
    JSON.stringify(listInvoicesRequest),
  );
  server.stdin.write(JSON.stringify(listInvoicesRequest) + "\n");

  // Wait for list response
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test reading invoices
  const readInvoicesRequest = {
    type: "read",
    uri: "xero://invoices",
    parameters: {},
  };
  console.error(
    "\nSending invoices read request:",
    JSON.stringify(readInvoicesRequest),
  );
  server.stdin.write(JSON.stringify(readInvoicesRequest) + "\n");

  // Wait for read response
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.error("\nTests completed, shutting down server...");
  server.kill();
}

testMcpServer().catch(console.error);
