/**
 * Helper function to encode a URL for external links
 * @param url The URL to encode for external linking
 * @returns The encoded URL string
 */
export const getExternalLink = (url: string) => {
  return encodeURIComponent(url);
};