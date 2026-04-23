export type LogLevelName = "debug" | "info" | "warn" | "error";

export interface Logger {
  child(bindings: Record<string, unknown>): Logger;
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

const LOG_LEVELS: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class JsonLogger implements Logger {
  constructor(
    private readonly minLevel: LogLevelName,
    private readonly bindings: Record<string, unknown> = {},
  ) {}

  child(bindings: Record<string, unknown>): Logger {
    return new JsonLogger(this.minLevel, {
      ...this.bindings,
      ...bindings,
    });
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.write("error", message, fields);
  }

  private write(
    level: LogLevelName,
    message: string,
    fields?: Record<string, unknown>,
  ): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }

    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...this.bindings,
      ...fields,
    });

    process.stderr.write(`${line}\n`);
  }
}

export function createLogger(minLevel: LogLevelName = "info"): Logger {
  return new JsonLogger(minLevel);
}
