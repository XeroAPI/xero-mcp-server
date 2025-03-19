# Xero MCP Server

This is a Model Context Protocol (MCP) server implementation for Xero. It provides a bridge between the MCP protocol and Xero's API, allowing for standardized access to Xero's accounting and business features.

## Features

- Xero OAuth2 authentication with custom connections
- Contact management
- Invoice creation and management
- MCP protocol compliance

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- A Xero developer account with API credentials

## Installation

```bash
# Using npm
npm install

# Using pnpm
pnpm install
```

Set up a Custom Connection following these instructions: https://developer.xero.com/documentation/guides/oauth2/custom-connections/

To add the MCP server to Claude go to Settings > Developer > Edit config and add the following to your claude_desktop_config.json file:

```json
{
  "mcpServers": {
    "xero": {
      "command": "insert-your-file-path-here/xero-mcp-server/start-server.sh",
      "args": [],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

### Available MCP Commands

- `list_contacts`: Retrieve a list of contacts from Xero
- `list_invoices`: Retrieve a list of invoices
- `create_contact`: Create a new contact
- `create_invoice`: Create a new invoice

For detailed API documentation, please refer to the [MCP Protocol Specification](https://modelcontextprotocol.io/).

## License

MIT

## Security

Please do not commit your `.env` file or any sensitive credentials to version control.
