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

There are 2 modes of authentication supported in the Xero MCP server:

#### 1. Custom Connections

This is a better choice for testing and development which allows you to specify client id and secrets for a specific organisation.
It is also the recommended approach if you are integrating this into 3rd party MCP clients such as Claude Desktop.

##### Configuring your Xero Developer account

Set up a Custom Connection following these instructions: https://developer.xero.com/documentation/guides/oauth2/custom-connections/

##### Required Scopes

Custom connections require different scopes depending on when they were created. **All scopes in the relevant list must be added to your custom connection:**

| Custom Connection Created | Required Scopes |
|---------------------------|-----------------|
| Before Apr 29, 2026 | [SCOPES_V1](src/clients/xero-client.ts#L82-L90) (bundled permissions) |
| From Apr 29, 2026 | [SCOPES_V2](src/clients/xero-client.ts#L93-L112) (granular permissions) |

> **Note:** The MCP server automatically tries V1 scopes first and falls back to V2 if needed.
> 
> You can override these by setting the `XERO_SCOPES` environment variable to a space-separated list of scopes.

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
        "XERO_CLIENT_SECRET": "your_client_secret_here",
        "XERO_SCOPES": "accounting.invoices accounting.contacts accounting.settings"
      }
    }
  }
}
```

The `XERO_SCOPES` variable is optional. If omitted, the default scopes listed above will be used.

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

##### Required Scopes for Bearer Token

When obtaining a bearer token, you must request the appropriate scopes. The scopes you request should be:

> **Note:** Some scopes are being deprecated in favour of more granular scopes. See the [Xero OAuth 2.0 Scopes documentation](https://developer.xero.com/documentation/guides/oauth2/scopes/) for details on deprecation timelines.

```
accounting.transactions (Deprecated)
accounting.transactions.read (Deprecated)
accounting.invoices
accounting.invoices.read
accounting.payments
accounting.payments.read
accounting.banktransactions
accounting.banktransactions.read
accounting.manualjournals
accounting.manualjournals.read
accounting.reports.read (Deprecated)
accounting.reports.aged.read
accounting.reports.balancesheet.read
accounting.reports.profitandloss.read
accounting.reports.trialbalance.read
accounting.contacts 
accounting.settings 
payroll.settings 
payroll.employees 
payroll.timesheets
```


### Tenant selection

Xero credentials can be authorised for more than one organisation. A *tenant ID* is the GUID identifying one of those organisations, and every tenanted tool in this server takes it as a required `tenantId` argument.

Earlier versions did not: they called Xero with whichever organisation the Xero SDK happened to place first in the connections list, which is the *most recently updated* organisation, not a stable choice. On a multi-organisation connection that made the target of a read or a write non-deterministic. Requiring the caller to name the organisation removes that ambiguity, and a request that does not name an authorised organisation now fails instead of guessing.

#### Discovering tenant IDs

Call the `list-tenants` tool. It is read-only, takes no arguments, and returns the `tenantId`, name and type of every organisation the credentials are authorised for. The same information is available from the Xero [`/connections`](https://developer.xero.com/documentation/guides/oauth2/tenants/) endpoint.

#### Example

```jsonc
// list-tenants
{}

// list-invoices, targeting one of the organisations it returned
{
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "page": 1
}
```

Single-organisation connections work the same way: there is one tenant ID, and it must still be supplied.

#### Bearer token vs Custom Connection

- **Bearer token**: `tenantId` is required on every tenanted tool and is validated against the organisations the token is authorised for.
- **Custom Connection**: the credential is bound to exactly one organisation, so `tenantId` is optional. When it is supplied it is validated against the bound organisation and a mismatch is rejected.

#### Failure behaviour

Requests that cannot be attributed to an authorised organisation are rejected before any tenanted call to Xero. Two layers are involved:

1. **Schema validation, in the MCP SDK.** Omitting `tenantId` entirely on a bearer token setup never reaches this server's code: the SDK rejects the call with its own protocol error, along the lines of *"Invalid arguments for tool list-accounts: ... path: [tenantId] ... Required"*.
2. **Tenant resolution, in this server.** Anything that satisfies the schema is then resolved and validated:

- Blank `tenantId` (bearer token): *"This tool requires a tenantId. Use the list-tenants tool to see the organisations this connection is authorised for."* This is rejected before any network call at all — a request naming no organisation can never succeed, so no authentication round trip is spent on it.
- A tenant ID that is not authorised: *"The supplied tenantId does not match any authorised Xero connection."*
- A tenant ID other than the bound organisation (Custom Connection): *"This server uses a Xero Custom Connection bound to a single organisation; the supplied tenantId does not match it."*

Error messages never list the authorised tenant IDs; use `list-tenants` to see them.

#### Migrating from earlier versions

This is a breaking change for bearer token setups: tool calls that previously omitted `tenantId` now fail as described above instead of silently acting on an arbitrary organisation. MCP clients pick the new required argument up from the tool schema automatically; hard-coded call sites need the argument added.

Custom Connection setups keep working without changes, because `tenantId` stays optional and the organisation sent to Xero is unchanged. The one new behaviour there is validation: supplying a `tenantId` that is not the bound organisation is now rejected, where previously the field did not exist.

### Available MCP Commands

Every command below except `list-tenants` takes a `tenantId` argument identifying the Xero organisation to act on. See [Tenant selection](#tenant-selection).

- `list-tenants`: Retrieve the Xero organisations these credentials are authorised for, and their tenant IDs
- `list-accounts`: Retrieve a list of accounts
- `list-contacts`: Retrieve a list of contacts from Xero
- `list-credit-notes`: Retrieve a list of credit notes
- `list-invoices`: Retrieve a list of invoices
- `list-items`: Retrieve a list of items
- `list-manual-journals`: Retrieve a list of manual journals
- `list-organisation-details`: Retrieve details about an organisation
- `list-profit-and-loss`: Retrieve a profit and loss report
- `list-quotes`: Retrieve a list of quotes
- `list-tax-rates`: Retrieve a list of tax rates
- `list-payments`: Retrieve a list of payments
- `list-trial-balance`: Retrieve a trial balance report
- `list-bank-transactions`: Retrieve a list of bank account transactions
- `list-payroll-employees`: Retrieve a list of Payroll Employees
- `list-report-balance-sheet`: Retrieve a balance sheet report
- `list-payroll-employee-leave`: Retrieve a Payroll Employee's leave records
- `list-payroll-employee-leave-balances`: Retrieve a Payroll Employee's leave balances
- `list-payroll-employee-leave-types`: Retrieve a list of Payroll leave types
- `list-payroll-leave-periods`: Retrieve a list of a Payroll Employee's leave periods
- `list-payroll-leave-types`: Retrieve a list of all available leave types in Xero Payroll
- `list-timesheets`: Retrieve a list of Payroll Timesheets
- `list-aged-receivables-by-contact`: Retrieves aged receivables for a contact
- `list-aged-payables-by-contact`: Retrieves aged payables for a contact
- `list-contact-groups`: Retrieve a list of contact groups
- `list-tracking-categories`: Retrieve a list of tracking categories
- `create-bank-transaction`: Create a new bank transaction
- `create-contact`: Create a new contact
- `create-credit-note`: Create a new credit note
- `create-invoice`: Create a new invoice
- `create-item`: Create a new item
- `create-manual-journal`: Create a new manual journal
- `create-payment`: Create a new payment
- `create-quote`: Create a new quote
- `create-payroll-timesheet`: Create a new Payroll Timesheet
- `create-tracking-category`: Create a new tracking category
- `create-tracking-option`: Create a new tracking option
- `update-bank-transaction`: Update an existing bank transaction
- `update-contact`: Update an existing contact
- `update-invoice`: Update an existing draft invoice
- `update-item`: Update an existing item
- `update-manual-journal`: Update an existing manual journal
- `update-quote`: Update an existing draft quote
- `update-credit-note`: Update an existing draft credit note
- `update-tracking-category`: Update an existing tracking category
- `update-tracking-options`: Update tracking options
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
