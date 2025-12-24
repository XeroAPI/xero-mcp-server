const isHttpMode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase() === "http";

export const logInfo = (...args: unknown[]) => {
  if (isHttpMode) {
    console.log(...args);
  }
};

export const logWarn = (...args: unknown[]) => {
  if (isHttpMode) {
    console.warn(...args);
  }
};

export const logError = (...args: unknown[]) => {
  if (isHttpMode) {
    console.error(...args);
  }
};
