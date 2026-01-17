"use client";

// Real brand logos using Simple Icons CDN
// https://simpleicons.org - 3000+ brand SVGs
// CDN: https://cdn.simpleicons.org/{slug}/{color}

import { Database, FileText, Globe, Table } from "lucide-react";

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

// Simple Icons CDN URL builder
function simpleIconUrl(slug: string, color: string = "b3b3b3"): string {
  return `https://cdn.simpleicons.org/${slug}/${color}`;
}

// Connector to Simple Icons slug mapping
// See: https://github.com/simple-icons/simple-icons/blob/develop/slugs.md
const CONNECTOR_ICON_MAP: Record<string, { slug: string; fallback?: React.ComponentType<LogoProps> }> = {
  // CRM (includes Merge integrations)
  salesforce: { slug: "salesforce" },
  hubspot: { slug: "hubspot" },
  pipedrive: { slug: "pipedrive" },
  "zoho-crm": { slug: "zoho" },
  close: { slug: "close" },
  copper: { slug: "copper" },
  freshsales: { slug: "freshworks" },
  "dynamics-365": { slug: "dynamics365" },

  // HRIS (Merge integrations)
  workday: { slug: "workday" },
  bamboohr: { slug: "bamboo" },
  gusto: { slug: "gusto" },
  rippling: { slug: "rippling" },
  adp: { slug: "adp" },
  personio: { slug: "personio" },
  paylocity: { slug: "paylocity" },

  // Accounting (Merge integrations)
  quickbooks: { slug: "quickbooks" },
  xero: { slug: "xero" },
  netsuite: { slug: "oracle" },
  sage: { slug: "sage" },

  // Ticketing (Merge integrations)
  freshdesk: { slug: "freshdesk" },

  // ATS (Merge integrations)
  greenhouse: { slug: "greenhouse" },
  lever: { slug: "lever" },
  workable: { slug: "workable" },

  // Databases
  postgres: { slug: "postgresql" },
  mysql: { slug: "mysql" },
  mongodb: { slug: "mongodb" },
  mariadb: { slug: "mariadb" },

  // Data Warehouses
  snowflake: { slug: "snowflake" },
  bigquery: { slug: "googlebigquery" },
  redshift: { slug: "amazonaws" }, // No dedicated Redshift icon, use AWS
  databricks: { slug: "databricks" },

  // Files & Storage
  csv: { slug: "files", fallback: FileIcon },
  "google-sheets": { slug: "googlesheets" },
  s3: { slug: "amazons3" },
  gcs: { slug: "googlecloud" },

  // Marketing
  mailchimp: { slug: "mailchimp" },
  klaviyo: { slug: "klaviyo" },
  sendgrid: { slug: "sendgrid" },

  // Analytics
  mixpanel: { slug: "mixpanel" },
  amplitude: { slug: "amplitude" },
  segment: { slug: "segment" },
  "google-analytics": { slug: "googleanalytics" },

  // APIs
  "rest-api": { slug: "openapi", fallback: APIIcon },
  graphql: { slug: "graphql" },

  // Survey/Research
  surveymonkey: { slug: "surveymonkey" },
  typeform: { slug: "typeform" },
  qualtrics: { slug: "qualtrics" },

  // Other Popular
  stripe: { slug: "stripe" },
  shopify: { slug: "shopify" },
  zendesk: { slug: "zendesk" },
  intercom: { slug: "intercom" },
  slack: { slug: "slack" },
  notion: { slug: "notion" },
  airtable: { slug: "airtable" },
  github: { slug: "github" },
  jira: { slug: "jira" },
  asana: { slug: "asana" },
  linear: { slug: "linear" },
  twilio: { slug: "twilio" },
  plaid: { slug: "plaid" },
};

// Fallback icons using Lucide
function FileIcon({ className = "w-4 h-4", style }: LogoProps) {
  return <FileText className={className} style={style} />;
}

function APIIcon({ className = "w-4 h-4", style }: LogoProps) {
  return <Globe className={className} style={style} />;
}

function DatabaseIcon({ className = "w-4 h-4", style }: LogoProps) {
  return <Database className={className} style={style} />;
}

function TableIcon({ className = "w-4 h-4", style }: LogoProps) {
  return <Table className={className} style={style} />;
}

// Main component that renders the appropriate logo
export function ConnectorLogo({
  connectorId,
  className = "w-5 h-5",
  style,
  color = "b3b3b3", // Default grayscale to match Linear design
}: {
  connectorId: string;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}) {
  const mapping = CONNECTOR_ICON_MAP[connectorId];

  if (mapping) {
    // Use Simple Icons CDN
    return (
      <img
        src={simpleIconUrl(mapping.slug, color)}
        alt={connectorId}
        className={className}
        style={{ ...style, objectFit: "contain" }}
        onError={(e) => {
          // Fallback to Lucide icon if CDN fails
          e.currentTarget.style.display = "none";
          const parent = e.currentTarget.parentElement;
          if (parent && mapping.fallback) {
            parent.innerHTML = ""; // Clear the img
            // We'll handle this with a fallback div
          }
        }}
      />
    );
  }

  // Default fallback
  return <DatabaseIcon className={className} style={style} />;
}

// Helper function to get the logo component (for backwards compatibility)
export function getConnectorLogo(connectorId: string): React.ComponentType<LogoProps> {
  // Return a component that renders ConnectorLogo
  return function ConnectorLogoWrapper(props: LogoProps) {
    return (
      <ConnectorLogo
        connectorId={connectorId}
        className={props.className}
        style={props.style}
      />
    );
  };
}

// Check if a connector has a real brand logo
export function hasRealLogo(connectorId: string): boolean {
  return connectorId in CONNECTOR_ICON_MAP;
}

// Get all supported connector IDs
export function getSupportedConnectors(): string[] {
  return Object.keys(CONNECTOR_ICON_MAP);
}
