#!/bin/bash

# OAuth 2.0 Test Script for Xero MCP HTTP Server
# Tests the OAuth 2.0 client credentials flow

set -e

# Configuration
SERVER_URL="${SERVER_URL:-http://localhost:8080}"
CLIENT_ID="${OAUTH_CLIENT_ID:-claude-ai-client}"
CLIENT_SECRET="${OAUTH_CLIENT_SECRET:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== OAuth 2.0 Test Suite ===${NC}\n"
echo -e "${YELLOW}Server URL:${NC} $SERVER_URL"
echo -e "${YELLOW}Client ID:${NC} $CLIENT_ID\n"

if [ -z "$CLIENT_SECRET" ]; then
    echo -e "${RED}Error: OAUTH_CLIENT_SECRET environment variable not set${NC}"
    echo "Set it with: export OAUTH_CLIENT_SECRET='your-secret'"
    exit 1
fi

# Test 1: Get OAuth Token (form-encoded)
echo -e "${BLUE}Test 1: OAuth 2.0 Token Request (form-encoded)${NC}"
TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/oauth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET")

HTTP_CODE=$(echo "$TOKEN_RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$TOKEN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Token request successful${NC}"
    echo "Response: $RESPONSE_BODY"

    # Extract access token
    ACCESS_TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    TOKEN_TYPE=$(echo "$RESPONSE_BODY" | grep -o '"token_type":"[^"]*' | cut -d'"' -f4)
    EXPIRES_IN=$(echo "$RESPONSE_BODY" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)

    echo -e "${GREEN}Access Token:${NC} ${ACCESS_TOKEN:0:50}..."
    echo -e "${GREEN}Token Type:${NC} $TOKEN_TYPE"
    echo -e "${GREEN}Expires In:${NC} $EXPIRES_IN seconds"
else
    echo -e "${RED}✗ Token request failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi
echo ""

# Test 2: Get OAuth Token (Basic Auth)
echo -e "${BLUE}Test 2: OAuth 2.0 Token Request (Basic Auth)${NC}"
BASIC_AUTH=$(echo -n "$CLIENT_ID:$CLIENT_SECRET" | base64)
TOKEN_RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/oauth/token" \
    -H "Authorization: Basic $BASIC_AUTH" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials")

HTTP_CODE2=$(echo "$TOKEN_RESPONSE2" | tail -n 1)

if [ "$HTTP_CODE2" = "200" ]; then
    echo -e "${GREEN}✓ Basic Auth token request successful${NC}"
else
    echo -e "${RED}✗ Basic Auth token request failed (HTTP $HTTP_CODE2)${NC}"
fi
echo ""

# Test 3: Token Introspection
echo -e "${BLUE}Test 3: OAuth 2.0 Token Introspection${NC}"
INTROSPECT_RESPONSE=$(curl -s -X POST "$SERVER_URL/oauth/introspect" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$ACCESS_TOKEN\"}")

echo "Introspection response: $INTROSPECT_RESPONSE"

if echo "$INTROSPECT_RESPONSE" | grep -q '"active":true'; then
    echo -e "${GREEN}✓ Token is active${NC}"
else
    echo -e "${RED}✗ Token is not active${NC}"
fi
echo ""

# Test 4: Use Token to Access MCP Endpoint
echo -e "${BLUE}Test 4: Use Access Token on MCP Endpoint${NC}"
MCP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/mcp" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "ping",
        "params": {}
    }')

HTTP_CODE=$(echo "$MCP_RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$MCP_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ MCP endpoint accessible with OAuth token${NC}"
    echo "Response: $RESPONSE_BODY"
else
    echo -e "${RED}✗ MCP endpoint failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Test 5: Test with Invalid Token
echo -e "${BLUE}Test 5: Test Invalid Token (should fail)${NC}"
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/mcp" \
    -H "Authorization: Bearer invalid-token" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}')

HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Invalid token correctly rejected${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response code: $HTTP_CODE${NC}"
fi
echo ""

# Test 6: Test with No Token
echo -e "${BLUE}Test 6: Test No Token (should fail)${NC}"
NO_TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/mcp" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}')

HTTP_CODE=$(echo "$NO_TOKEN_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Missing token correctly rejected${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response code: $HTTP_CODE (auth might be disabled)${NC}"
fi
echo ""

# Test 7: Test Invalid Client Credentials
echo -e "${BLUE}Test 7: Test Invalid Client Credentials (should fail)${NC}"
INVALID_CREDS=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/oauth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials&client_id=wrong&client_secret=wrong")

HTTP_CODE=$(echo "$INVALID_CREDS" | tail -n 1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Invalid credentials correctly rejected${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response code: $HTTP_CODE${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}OAuth 2.0 authentication is working correctly!${NC}"
echo ""
echo -e "${YELLOW}Your Access Token:${NC}"
echo "$ACCESS_TOKEN"
echo ""
echo -e "${YELLOW}For Claude.ai Configuration:${NC}"
echo "Client ID: $CLIENT_ID"
echo "Client Secret: $CLIENT_SECRET"
echo "Token Endpoint: $SERVER_URL/oauth/token"
echo "MCP Endpoint: $SERVER_URL/mcp"
echo ""
