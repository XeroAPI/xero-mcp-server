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

    const resolvedExternalLinks = organisation.externalLinks?.map((link, index) => `${index + 1}. ${link.linkType}: ${link.url ? getExternalLink(link.url) : link.url}`) || []

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

    const paymentTerms = organisation.paymentTerms
    ? Object.entries(organisation.paymentTerms).map(([key, value], index) => {
        return `${index + 1}. ${key}: ${value}`;
      }).join("\n")
    : "No payment terms available.";

    const phones = organisation.phones?.map((phone, index) => {
      return `Phone ${index + 1}: ${phone.phoneType || "Unknown type"} - ${
        phone.phoneNumber || "No number"
      }`;
    }).join("\n") || "No phone numbers available.";

    const organisationDetails = [
      `Name: ${organisation.name} || "No name available."`,
      `Legal Name: ${organisation.legalName} || "No legal name available."`,
      `Pays Tax: ${organisation.paysTax ? "Yes" : "No"}`,
      `Short Code: ${organisation.shortCode} || "No short code available."`,
      `Organisation ID: ${organisation.organisationID} || "No organisation ID available."`,
      `Version: ${organisation.version} || "No version available."`,
      organisation.organisationType ? `Organisation Type: ${organisation.organisationType}` : null,
      `Base Currency: ${organisation.baseCurrency} || "No base currency available."`,
      `Country Code: ${organisation.countryCode} || "No country code available."`,
      `Timezone: ${organisation.timezone} || "No timezone available."`,
      organisation.registrationNumber ? `Registration Number: ${organisation.registrationNumber}` : null,
      organisation.taxNumber ? `Tax Number: ${organisation.taxNumber}` : null,
      organisation.organisationEntityType ? `Organisation Entity Type: ${organisation.organisationEntityType}` : null,
      `Financial Year End Day: ${organisation.financialYearEndDay} || "No financial year end day set."`,
      `Financial Year End Month: ${organisation.financialYearEndMonth} || "No financial year end month set."`,
      `Sales Tax Basis: ${organisation.salesTaxBasis} || "No sales tax basis available."`,
      `Sales Tax Period: ${organisation.salesTaxPeriod} || "No sales tax period available."`,
      organisation.periodLockDate ? `Period Lock Date: ${organisation.periodLockDate}` : null,
      organisation.organisationStatus ? `Organisation Status: ${organisation.organisationStatus}` : null,
      `Created Date: ${organisation.createdDateUTC} || "No created date available."`,
      `Edition: ${organisation.edition} || "No edition available."`,
      `Class: ${organisation._class} || "No class available."`,
      `Is Demo Company: ${organisation.isDemoCompany ? "Yes" : "No"}`,
      organisation.lineOfBusiness ? `Line of Business: ${organisation.lineOfBusiness}` : null,
      `Addresses:\n${addresses}`,
      `Phone Numbers:\n${phones}`,
      `External Links:\n${resolvedExternalLinks.join("\n")}`,
      `Payment Terms:\n${paymentTerms}`,
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