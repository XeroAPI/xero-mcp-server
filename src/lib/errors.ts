export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class HttpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpAuthError";
  }
}
