# Xero MCP Server

This is a Model Context Protocol (MCP) server implementation for Xero. It provides a bridge between the MCP protocol and Xero's API, allowing for standardized access to Xero's accounting and business features.

## Features

- Xero OAuth2 authentication with custom connections
- Contact management
- Chart of Accounts management
- Invoice creation and management
- MCP protocol compliance

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- A Xero developer account with API credentials

### Configuring your Xero Developer account

Set up a Custom Connection following these instructions: https://developer.xero.com/documentation/guides/oauth2/custom-connections/

Currently the following scopes are required:
`accounting.transactions accounting.contacts accounting.settings.read accounting.reports.read payroll.employees.read`

### Integrating the MCP server with Claude Desktop

To add the MCP server to Claude go to Settings > Developer > Edit config and add the following to your claude_desktop_config.json file:

```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "@xeroapi/xero-mcp-server@latest"],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

### Available MCP Commands

- `list-contacts`: Retrieve a list of contacts from Xero
- `list-invoices`: Retrieve a list of invoices
- `list-accounts`: Retrieve a list of accounts
- `list-tax-rates` : Retrieve a list of tax rates
- `list-quotes` : Retrieve a list of quotes
- `list-credit-notes`: Retrieve a list of credit notes
- `list-trial-balance`: Retrieve a trial balance report
- `list-profit-and-loss`: Retrieve a profit and loss report
- `list-items`: Retrieve a list of items
- `list-bank-transactions`: Retrieve a list of bank account transactions
- `create-contact`: Create a new contact
- `create-invoice`: Create a new invoice
- `create-quote`: Create a new quote
- `create-credit-note`: Create a new credit note
- `update-contact`: Update an existing contact
- `update-invoice`: Update an existing draft invoice
- `update-quote`: Update an existing draft quote
- `update-credit-note`: Update an existing draft credit note

For detailed API documentation, please refer to the [MCP Protocol Specification](https://modelcontextprotocol.io/).

## For Developers

### Installation

```bash
# Using npm
npm install

# Using pnpm
pnpm install
```

### Run a build

```bash
# Using npm
npm run build

# Using pnpm
pnpm build
```

### Integrating with Claude Desktop

To add the MCP server to Claude go to Settings > Developer > Edit config and add the following to your claude_desktop_config.json file:

```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["insert-your-file-path-here/xero-mcp-server/dist/index.js"],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

## License

MIT

## Security

Please do not commit your `.env` file or any sensitive credentials to version control.
