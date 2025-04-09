import { externalLinkDeepLink } from "../consts/externallink.js";

export const getExternalLink = (itemId: string) => {
  return externalLinkDeepLink(itemId);
};