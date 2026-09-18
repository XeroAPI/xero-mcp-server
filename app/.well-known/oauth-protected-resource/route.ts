import {
  generateProtectedResourceMetadata,
  metadataCorsOptionsRequestHandler,
} from "mcp-handler";
import { XERO_OAUTH_SCOPES } from "../../../src/xero-oauth-scopes";

const corsHandler = metadataCorsOptionsRequestHandler();

export function GET(request: Request): Response {
  const resourceUrl = new URL(request.url).origin;
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: ["https://identity.xero.com"],
    resourceUrl,
    additionalMetadata: { scopes_supported: [...XERO_OAUTH_SCOPES] },
  });

  return Response.json(metadata, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export const OPTIONS = corsHandler;
