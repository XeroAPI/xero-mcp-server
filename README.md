# Xero MCP Server (OAuth Fork)

This is a fork of the [official Xero MCP Server](https://github.com/XeroAPI/xero-mcp-server) with added **browser-based OAuth authentication** that works in all regions.

## Why This Fork?

The official Xero MCP server only supports:
1. **Custom Connections** - Requires a paid subscription ($5/month) and is **only available in AU, NZ, UK, and US**
2. **Bearer Token** - Tokens expire after 30 minutes with no automatic refresh

This fork adds:
3. **Browser OAuth with PKCE** - Works in **all regions**, handles token refresh automatically, one-time browser login

## Features

- **Browser-based OAuth2** - First run opens browser for login, subsequent runs use saved tokens
- **Automatic token refresh** - Tokens refresh automatically before expiry
- **Works in all regions** - No Custom Connections subscription needed
- Contact management
- Chart of Accounts management
- Invoice creation and management
- MCP protocol compliance

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- A Xero developer account with API credentials

## Docs and Links

- [Xero Public API Documentation](https://developer.xero.com/documentation/api/)
- [Xero API Explorer](https://api-explorer.xero.com/)
- [Xero OpenAPI Specs](https://github.com/XeroAPI/Xero-OpenAPI)
- [Xero-Node Public API SDK Docs](https://xeroapi.github.io/xero-node/accounting)
- [Developer Documentation](https://developer.xero.com/)

## Setup

### Create a Xero Account

If you don't already have a Xero account and organisation already, can create one by signing up [here](https://www.xero.com/au/signup/) using the free trial.

We recommend using a Demo Company to start with because it comes with some pre-loaded sample data. Once you are logged in, switch to it by using the top left-hand dropdown and selecting "Demo Company". You can reset the data on a Demo Company, or change the country, at any time by using the top left-hand dropdown and navigating to [My Xero](https://my.xero.com).

NOTE: To use Payroll-specific queries, the region should be either NZ or UK.

### Authentication

There are 3 modes of authentication supported:

#### 1. Browser OAuth (RECOMMENDED)

This is the recommended approach for most users. It works in all regions and handles token refresh automatically.

##### Setup

1. Create a Web App at https://developer.xero.com/app/manage
2. Set the redirect URI to: `http://localhost:8749/callback`
3. Note your Client ID and Client Secret
4. Select the scopes you need (see below)

##### Configuration

```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["/path/to/xero-mcp-server-fork/dist/index.js"],
      "env": {
        "XERO_USE_BROWSER_AUTH": "true",
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here",
        "XERO_SCOPES": "accounting.transactions accounting.contacts accounting.settings.read accounting.reports.read"
      }
    }
  }
}
```

##### How it works

1. First run: Opens browser for Xero login
2. You authorize the app
3. Tokens are saved to `~/.xero-mcp-tokens.json`
4. Subsequent runs: Uses saved tokens, auto-refreshes when needed

##### Recommended Scopes

For read-only access:
```
accounting.transactions.read accounting.contacts.read accounting.settings.read accounting.reports.read
```

For read/write access:
```
accounting.transactions accounting.contacts accounting.settings.read accounting.reports.read
```

#### 2. Custom Connections (AU/NZ/UK/US only)

This requires a Custom Connections subscription ($5/month) and is only available in Australia, New Zealand, UK, and USA.

Set up following: https://developer.xero.com/documentation/guides/oauth2/custom-connections/

```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["/path/to/xero-mcp-server-fork/dist/index.js"],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

#### 3. Bearer Token

Manual token management. Token expires after 30 minutes with no automatic refresh.

```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["/path/to/xero-mcp-server-fork/dist/index.js"],
      "env": {
        "XERO_CLIENT_BEARER_TOKEN": "your_bearer_token"
      }
    }
  }
}
```

NOTE: The `XERO_CLIENT_BEARER_TOKEN` will take precedence over other auth methods if defined.

### Available MCP Commands

- `list-accounts`: Retrieve a list of accounts
- `list-contacts`: Retrieve a list of contacts from Xero
- `list-credit-notes`: Retrieve a list of credit notes
- `list-invoices`: Retrieve a list of invoices
- `list-items`: Retrieve a list of items
- `list-organisation-details`: Retrieve details about an organisation
- `list-profit-and-loss`: Retrieve a profit and loss report
- `list-quotes`: Retrieve a list of quotes
- `list-tax-rates`: Retrieve a list of tax rates
- `list-payments`: Retrieve a list of payments
- `list-trial-balance`: Retrieve a trial balance report
- `list-profit-and-loss`: Retrieve a profit and loss report
- `list-bank-transactions`: Retrieve a list of bank account transactions
- `list-payroll-employees`: Retrieve a list of Payroll Employees
- `list-report-balance-sheet`: Retrieve a balance sheet report
- `list-payroll-employee-leave`: Retrieve a Payroll Employee's leave records
- `list-payroll-employee-leave-balances`: Retrieve a Payroll Employee's leave balances
- `list-payroll-employee-leave-types`: Retrieve a list of Payroll leave types
- `list-payroll-leave-periods`: Retrieve a list of a Payroll Employee's leave periods
- `list-payroll-leave-types`: Retrieve a list of all avaliable leave types in Xero Payroll
- `list-aged-receivables-by-contact`: Retrieves aged receivables for a contact
- `list-aged-payables-by-contact`: Retrieves aged payables for a contact
- `list-contact-groups`: Retrieve a list of contact groups
- `create-contact`: Create a new contact
- `create-credit-note`: Create a new credit note
- `create-invoice`: Create a new invoice
- `create-payment`: Create a new payment
- `create-quote`: Create a new quote
- `create-credit-note`: Create a new credit note
- `create-payroll-timesheet`: Create a new Payroll Timesheet
- `update-contact`: Update an existing contact
- `update-invoice`: Update an existing draft invoice
- `update-quote`: Update an existing draft quote
- `update-credit-note`: Update an existing draft credit note
- `update-payroll-timesheet-line`: Update a line on an existing Payroll Timesheet
- `approve-payroll-timesheet`: Approve a Payroll Timesheet
- `revert-payroll-timesheet`: Revert an approved Payroll Timesheet
- `add-payroll-timesheet-line`: Add new line on an existing Payroll Timesheet
- `delete-payroll-timesheet`: Delete an existing Payroll Timesheet
- `get-payroll-timesheet`: Retrieve an existing Payroll Timesheet

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
