import { listXeroOrganisationDetails } from "../../handlers/list-xero-organisation-details.handler.js";
import { getExternalLink } from "../../helpers/get-external-link.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";

const ListOrganisationDetailsTool = CreateXeroTool(
  "list-organisation-details",
  "Lists the organisation details from Xero. Use this tool to get information about the current Xero organisation.",
  {},
  async () => {
    const response = await listXeroOrganisationDetails();
    if (response.error !== null) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching organisation details: ${response.error || "Unknown error"}`,
          },
        ],
      };
    }

    const organisation = response.result;

    if (!organisation) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No organisation details found.",
          },
        ],
      };
    }

    const resolvedExternalLinks = await Promise.all(
      organisation.externalLinks?.map(async (link, index) => {
        const deepLink = link.url
          ? await getExternalLink(link.url)
          : null;
        return `${index + 1}. ${link.linkType}: ${deepLink || link.url}`;
      }) || []
    );

    const addresses = organisation.addresses?.map((address, index) => {
      return `Address ${index + 1} (${address.addressType || ""}): ${[
        address.addressLine1,
        address.addressLine2,
        address.city,
        address.postalCode,
        address.country,
      ]
        .filter(Boolean)
        .join(", ")}`;
    }).join("\n") || "No addresses available.";

    const phones = organisation.phones?.map((phone, index) => {
      return `Phone ${index + 1}: ${phone.phoneType || "Unknown type"} - ${
        phone.phoneNumber || "No number"
      }`;
    }).join("\n") || "No phone numbers available.";

    const organisationDetails = [
      `Name: ${organisation.name || "Unnamed"}`,
      `Legal Name: ${organisation.legalName || "Unnamed"}`,
      `Short Code: ${organisation.shortCode || "No short code"}`,
      `Organisation ID: ${organisation.organisationID || "No ID"}`,
      `Version: ${organisation.version || "Unknown version"}`,
      `Organisation Type: ${organisation.organisationType || "Unknown type"}`,
      `Base Currency: ${organisation.baseCurrency || "Unknown currency"}`,
      `Country Code: ${organisation.countryCode || "Unknown country"}`,
      `Timezone: ${organisation.timezone || "Unknown timezone"}`,
      `Addresses:\n${addresses}`,
      `Phone Numbers:\n${phones}`,
      `External Links:\n${resolvedExternalLinks.join("\n")}`,
    ].filter(Boolean).join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Organisation Details:`,
        },
        {
          type: "text" as const,
          text: organisationDetails,
        },
      ],
    };
  },
);

export default ListOrganisationDetailsTool;