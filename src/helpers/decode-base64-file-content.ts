export function decodeBase64FileContent(fileContent: string): Buffer {
  const trimmed = fileContent.trim();
  const withoutPrefix = trimmed.replace(/^data:[^;]+;base64,/, "");
  const normalized = withoutPrefix
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  if (!normalized) {
    throw new Error("File content must not be empty.");
  }

  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) ||
    normalized.length % 4 === 1
  ) {
    throw new Error("File content must be valid base64.");
  }

  const padded = normalized.padEnd(
    Math.ceil(normalized.length / 4) * 4,
    "=",
  );
  const decoded = Buffer.from(padded, "base64");

  if (decoded.byteLength === 0) {
    throw new Error("Decoded file content was empty.");
  }

  return decoded;
}
