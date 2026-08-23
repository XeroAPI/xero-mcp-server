# Xero MCP Server

This is a Model Context Protocol (MCP) server implementation for Xero. It provides a bridge between the MCP protocol and Xero's API, allowing for standardized access to Xero's accounting and business features.

## Features

- Xero OAuth2 authentication — three modes supported (see below)
- Contact management
- Chart of Accounts management
- Invoice creation and management
- Bank transactions and payments
- Financial reports (P&L, Balance Sheet, Trial Balance, Aged Receivables/Payables)
- Payroll management (employees, timesheets, leave)
- MCP protocol compliance

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- A Xero developer account with API credentials

## Docs and Links

- [Xero Public API Documentation](https://developer.xero.com/documentation/)
- [Xero API Explorer](https://api-explorer.xero.com/)
- [Xero Developer Portal](https://developer.xero.com/app/manage)

---

## Setup

### Create a Xero Account

If you don't already have a Xero account and organisation, you can create one by signing up at xero.com. We recommend using a **Demo Company** to start with — it comes with pre-loaded sample data.

---

## Authentication

Three authentication modes are supported. Choose **one**.

---

### Mode 1: OAuth2 Web App (Free — recommended)

This uses the standard OAuth2 Authorization Code flow with PKCE. It works with a **free** Xero Web App integration — no paid Custom Connection subscription required.

On first use, a browser window opens for you to authorize access to your Xero organisation. Tokens are persisted to `~/.xero-mcp-tokens.json` and automatically refreshed.

#### Step 1: Create a Web App in Xero

1. Go to [developer.xero.com/app/manage](https://developer.xero.com/app/manage) → **New App**
2. Enter a name (e.g. "My MCP Server")
3. Select **Web app** as the integration type
4. Company URL: any valid URL (e.g. `https://example.com`)
5. Redirect URI: `http://localhost:5000/callback`
6. Accept terms → **Create app**
7. Go to **Configuration** → **Generate a secret**
8. Note the **Client ID** and **Client Secret**

#### Step 2: Configure your MCP client

Add the following to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "github:jsamuel1/xero-mcp-server#feature/oauth2-web-app"],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here",
        "XERO_REDIRECT_URI": "http://localhost:5000/callback"
      }
    }
  }
}
```

> **Note:** If you use Node Version Manager (nvm), replace `"npx"` with the full path, e.g. `~/.nvm/versions/node/v22.14.0/bin/npx`

#### Step 3: Authorize

On first use, a browser window will open asking you to log in to Xero and authorize access to your organisation. After authorizing, you can close the browser tab — tokens are saved automatically and will be refreshed as needed.

---

### Mode 2: Custom Connections (Paid)

This uses the OAuth2 `client_credentials` grant type. It requires a [Xero Custom Connection](https://developer.xero.com/documentation/guides/oauth2/custom-connections/) subscription (paid add-on).

#### Configuring your Xero Developer account

Set up a Custom Connection following [these instructions](https://developer.xero.com/documentation/guides/oauth2/custom-connections/).

#### Required Scopes

Custom connections require different scopes depending on when they were created:

| Custom Connection Created | Required Scopes |
|---------------------------|-----------------|
| Before Apr 29, 2026       | SCOPES_V1 (bundled permissions) |
| From Apr 29, 2026         | SCOPES_V2 (granular permissions) |

> The MCP server automatically tries V1 scopes first and falls back to V2 if needed. You can override these by setting the `XERO_SCOPES` environment variable to a space-separated list of scopes.

#### MCP Client Config

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

---

### Mode 3: [REDACTED_TOKEN]

Use a pre-obtained bearer token. Suitable for testing or when you manage token acquisition externally.

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

> **Note:** `XERO_CLIENT_BEARER_TOKEN` takes precedence over all other settings if defined.

---

## Environment Variable Reference

| Variable | Mode | Description |
|----------|------|-------------|
| `XERO_CLIENT_ID` | 1, 2 | OAuth2 client ID from your Xero app |
| `XERO_CLIENT_SECRET` | 1, 2 | OAuth2 client secret |
| `XERO_REDIRECT_URI` | 1 | Redirect URI for OAuth2 Web App flow (e.g. `http://localhost:5000/callback`). Setting this activates Mode 1. |
| `XERO_CLIENT_BEARER_TOKEN` | 3 | Pre-obtained bearer token. Takes highest priority if set. |
| `XERO_SCOPES` | 2 | Optional: override OAuth scopes (space-separated). Only applies to Custom Connection mode. |

---

## Available MCP Commands

- `list-accounts` — Retrieve a list of accounts
- `list-contacts` — Retrieve a list of contacts from Xero
- `list-credit-notes` — Retrieve a list of credit notes
- `list-invoices` — Retrieve a list of invoices
- `list-items` — Retrieve a list of items
- `list-manual-journals` — Retrieve a list of manual journals
- `list-organisation-details` — Retrieve details about an organisation
- `list-profit-and-loss` — Retrieve a profit and loss report
- `list-quotes` — Retrieve a list of quotes
- `list-tax-rates` — Retrieve a list of tax rates
- `list-payments` — Retrieve a list of payments
- `list-trial-balance` — Retrieve a trial balance report
- `list-bank-transactions` — Retrieve a list of bank account transactions
- `list-payroll-employees` — Retrieve a list of Payroll Employees
- `list-report-balance-sheet` — Retrieve a balance sheet report
- `list-payroll-employee-leave` — Retrieve a Payroll Employee's leave records
- `list-payroll-employee-leave-balances` — Retrieve a Payroll Employee's leave balances
- `list-payroll-employee-leave-types` — Retrieve a list of Payroll leave types
- `list-payroll-leave-periods` — Retrieve a list of a Payroll Employee's leave periods
- `list-payroll-leave-types` — Retrieve a list of all available leave types in Xero Payroll
- `list-timesheets` — Retrieve a list of Payroll Timesheets
- `list-aged-receivables-by-contact` — Retrieves aged receivables for a contact
- `list-aged-payables-by-contact` — Retrieves aged payables for a contact
- `list-contact-groups` — Retrieve a list of contact groups
- `list-tracking-categories` — Retrieve a list of tracking categories
- `create-bank-transaction` — Create a new bank transaction
- `create-contact` — Create a new contact
- `create-credit-note` — Create a new credit note
- `create-invoice` — Create a new invoice
- `create-item` — Create a new item
- `create-manual-journal` — Create a new manual journal
- `create-payment` — Create a new payment
- `create-quote` — Create a new quote
- `create-payroll-timesheet` — Create a new Payroll Timesheet
- `create-tracking-category` — Create a new tracking category
- `create-tracking-option` — Create a new tracking option
- `update-bank-transaction` — Update an existing bank transaction
- `update-contact` — Update an existing contact
- `update-invoice` — Update an existing draft invoice
- `update-item` — Update an existing item
- `update-manual-journal` — Update an existing manual journal
- `update-quote` — Update an existing draft quote
- `update-credit-note` — Update an existing draft credit note
- `update-tracking-category` — Update an existing tracking category
- `update-tracking-options` — Update tracking options
- `update-payroll-timesheet-line` — Update a line on an existing Payroll Timesheet
- `approve-payroll-timesheet` — Approve a Payroll Timesheet
- `revert-payroll-timesheet` — Revert an approved Payroll Timesheet
- `add-payroll-timesheet-line` — Add new line on an existing Payroll Timesheet
- `delete-payroll-timesheet` — Delete an existing Payroll Timesheet
- `get-payroll-timesheet` — Retrieve an existing Payroll Timesheet

---

## For Developers

### Installation

```bash
# Using npm
npm install

# Using pnpm
pnpm install
```

### Building

```bash
npm run build
```

### Running locally

```bash
npm start
```
