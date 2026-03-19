export interface FormattedBinaryContent {
  contentBase64: string;
  contentText?: string;
}

function isTextLikeContentType(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType === "application/xml" ||
    contentType === "text/xml" ||
    contentType === "application/csv" ||
    contentType === "text/csv"
  );
}

export function formatBinaryContent(
  buffer: Buffer,
  contentType: string,
): FormattedBinaryContent {
  return {
    contentBase64: buffer.toString("base64"),
    contentText: isTextLikeContentType(contentType)
      ? buffer.toString("utf8")
      : undefined,
  };
}
