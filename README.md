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

## Docs and Links
* [Xero Public API Documentation](https://developer.xero.com/documentation/api/)
* [Xero API Explorer](https://api-explorer.xero.com/)
* [Xero OpenAPI Specs](https://github.com/XeroAPI/Xero-OpenAPI)
* [Xero-Node Public API SDK Docs](https://xeroapi.github.io/xero-node/accounting)
* [Developer Documentation](https://developer.xero.com/)

## Setup

### Create a Xero Account
If you don't already have a Xero account and organisation already, can create one by signing up [here](https://www.xero.com/au/signup/) using the free trial.

We recommend using a Demo Company to start with because it comes with some pre-loaded sample data. Once you are logged in, switch to it by using the top left-hand dropdown and selecting "Demo Company". You can reset the data on a Demo Company, or change the country, at any time by using the top left-hand dropdown and navigating to [My Xero](https://my.xero.com).

NOTE: To use Payroll-specific queries, the region should be either NZ or UK.

### Authentication
There are 2 modes of authentication supported in the Xero MCP server:

#### 1. Custom Connections
This is a better choice for testing and development which allows you to specify client id and secrets for a specific organisation.
It is also the recommended approach if you are integrating this into 3rd party MCP clients such as Claude Desktop.

##### Configuring your Xero Developer account

Set up a Custom Connection following these instructions: https://developer.xero.com/documentation/guides/oauth2/custom-connections/

Currently the following scopes are required for all sessions: [scopes](src/clients/xero-client.ts#L91-L92)

##### Integrating the MCP server with Claude Desktop

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

NOTE: If you are using [Node Version Manager](https://github.com/nvm-sh/nvm) `"command": "npx"` section change it to be the full path to the executable, ie: `your_home_directory/.nvm/versions/node/v22.14.0/bin/npx` on Mac / Linux or `"your_home_directory\\.nvm\\versions\\node\\v22.14.0\\bin\\npx"` on Windows

#### 2. Bearer Token
This is a better choice if you are to support multiple Xero accounts at runtime and allow the MCP client to execute an auth flow (such as PKCE) as required.
In this case, use the following configuration:

```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "@xeroapi/xero-mcp-server@latest"],
      "env": {
        "XERO_CLIENT_BEARER_TOKEN": "your_bearer_token"
      }
    }
  }
}
```

NOTE: The `XERO_CLIENT_BEARER_TOKEN` will take precedence over the `XERO_CLIENT_ID` if defined.

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
- `list-payroll-employees`: Retrieve a list of Payroll Employees
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

To link your Xero MCP server in development to Claude Desktop go to Settings > Developer > Edit config and add the following to your `claude_desktop_config.json` file:

NOTE: For Windows ensure the `args` path escapes the `\` between folders ie. `"C:\\projects\xero-mcp-server\\dist\\index.js"`

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

Please do not commit your `.env` file or any sensitive credentials to version control (it is included in `.gitignore` as a safe default.)
