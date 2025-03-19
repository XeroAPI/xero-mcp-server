import { xeroClient } from "./xero/client.js";
import { Contact } from "xero-node";
import dotenv from "dotenv";

dotenv.config();

async function testXeroConnection() {
  try {
    const tokenResponse = await xeroClient.getClientCredentialsToken();

    // Test contacts API
    const contacts = await xeroClient.accountingApi.getContacts(
      tokenResponse.access_token,
    );

    // Return test results instead of logging
    return {
      success: true,
      contactsCount: contacts.body.contacts?.length || 0,
      contacts: contacts.body.contacts?.map((contact: Contact) => ({
        name: contact.name,
        email: contact.emailAddress || "No email",
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Only run if this file is being executed directly
if (require.main === module) {
  testXeroConnection()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(() => process.exit(1));
}

export { testXeroConnection };
