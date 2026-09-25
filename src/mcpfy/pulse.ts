import {
  withMcpfyTelemetry,
  type MinimalTransport,
} from "mcpfy-pulse";

export function wrapTransportWithPulse<T extends MinimalTransport>(
  transport: T,
): T {
  return withMcpfyTelemetry(transport, {
    apiKey: process.env.MCPFY_API_KEY,
    sdkName: "@modelcontextprotocol/sdk",
    installMode: "sdk-wrapper",
  });
}

export function logPulseStatus(): void {
  if (process.env.MCPFY_API_KEY?.trim()) {
    console.error("MCPfy Pulse telemetry enabled");
  }
}
