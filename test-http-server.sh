#!/bin/bash

# Test script for Xero MCP HTTP Server
# This script tests the HTTP endpoints locally or on Cloud Run

set -e

# Configuration
SERVER_URL="${SERVER_URL:-http://localhost:8080}"
API_KEY="${API_KEY:-}"
USERNAME="${USERNAME:-admin}"
PASSWORD="${PASSWORD:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Xero MCP Server Test Suite ===${NC}\n"
echo -e "${YELLOW}Server URL:${NC} $SERVER_URL\n"

# Test 1: Health Check
echo -e "${BLUE}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$SERVER_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $RESPONSE_BODY"
else
    echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi
echo ""

# Test 2: Readiness Check
echo -e "${BLUE}Test 2: Readiness Check${NC}"
READY_RESPONSE=$(curl -s -w "\n%{http_code}" "$SERVER_URL/ready")
HTTP_CODE=$(echo "$READY_RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$READY_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Readiness check passed${NC}"
    echo "Response: $RESPONSE_BODY"
else
    echo -e "${YELLOW}⚠ Readiness check warning (HTTP $HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
    echo "Note: This is expected if Xero credentials are not configured"
fi
echo ""

# Test 3: Authentication Token
if [ -n "$PASSWORD" ]; then
    echo -e "${BLUE}Test 3: Get Authentication Token${NC}"
    TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/auth/token" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

    HTTP_CODE=$(echo "$TOKEN_RESPONSE" | tail -n 1)
    RESPONSE_BODY=$(echo "$TOKEN_RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Token generation successful${NC}"
        JWT_TOKEN=$(echo "$RESPONSE_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        echo "Token: ${JWT_TOKEN:0:50}..."
    else
        echo -e "${RED}✗ Token generation failed (HTTP $HTTP_CODE)${NC}"
        echo "Response: $RESPONSE_BODY"
    fi
    echo ""
else
    echo -e "${YELLOW}Test 3: Skipped (no password provided)${NC}"
    echo "Set PASSWORD environment variable to test authentication"
    echo ""
fi

# Test 4: MCP Endpoint (with authentication)
echo -e "${BLUE}Test 4: MCP Endpoint${NC}"

if [ -n "$JWT_TOKEN" ]; then
    AUTH_HEADER="Authorization: Bearer $JWT_TOKEN"
elif [ -n "$API_KEY" ]; then
    AUTH_HEADER="x-api-key: $API_KEY"
else
    AUTH_HEADER=""
    echo -e "${YELLOW}⚠ No authentication provided, request may fail${NC}"
fi

MCP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/mcp" \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "ping",
        "params": {}
    }')

HTTP_CODE=$(echo "$MCP_RESPONSE" | tail -n 1)
RESPONSE_BODY=$(echo "$MCP_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ MCP endpoint accessible${NC}"
    else
        echo -e "${YELLOW}⚠ MCP endpoint requires authentication (HTTP $HTTP_CODE)${NC}"
    fi
    echo "Response: $RESPONSE_BODY"
else
    echo -e "${RED}✗ MCP endpoint failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $RESPONSE_BODY"
fi
echo ""

# Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}All basic tests completed${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Ensure Xero credentials are configured (XERO_CLIENT_ID, XERO_CLIENT_SECRET)"
echo "2. Test MCP protocol integration with a real MCP client"
echo "3. Deploy to Cloud Run using ./deploy.sh"
echo ""

# Usage examples
echo -e "${YELLOW}Usage Examples:${NC}"
echo ""
echo "Test local server:"
echo "  ./test-http-server.sh"
echo ""
echo "Test with authentication:"
echo "  PASSWORD='your-password' ./test-http-server.sh"
echo ""
echo "Test Cloud Run deployment:"
echo "  SERVER_URL='https://your-service.run.app' API_KEY='your-key' ./test-http-server.sh"
echo ""
