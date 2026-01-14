import { NextRequest, NextResponse } from "next/server";
import type { SourceField } from "@/db/schema";

// Mock schema discovery - in production this would call PyAirbyte
const MOCK_SCHEMAS: Record<string, { streamName: string; fields: SourceField[] }[]> = {
  salesforce: [
    {
      streamName: "contacts",
      fields: [
        { name: "Id", type: "string", nullable: false, sample: "003xx000004TmiT" },
        { name: "FirstName", type: "string", nullable: true, sample: "John", suggestedTrait: "name", confidence: 0.6 },
        { name: "LastName", type: "string", nullable: false, sample: "Doe" },
        { name: "Email", type: "string", nullable: true, sample: "john@example.com" },
        { name: "Birthdate", type: "date", nullable: true, sample: "1985-03-15", suggestedTrait: "age", suggestedTransform: "date_to_age", confidence: 0.95 },
        { name: "MailingCity", type: "string", nullable: true, sample: "Austin", suggestedTrait: "location_name", suggestedTransform: "concat", confidence: 0.85 },
        { name: "MailingState", type: "string", nullable: true, sample: "TX" },
        { name: "MailingPostalCode", type: "string", nullable: true, sample: "78701" },
        { name: "Title", type: "string", nullable: true, sample: "VP of Sales", suggestedTrait: "occupation", suggestedTransform: "direct", confidence: 0.9 },
        { name: "Department", type: "string", nullable: true, sample: "Sales" },
        { name: "AccountId", type: "string", nullable: true, sample: "001xx000003DGWF" },
        { name: "Account.Name", type: "string", nullable: true, sample: "Acme Corp" },
        { name: "Account.Industry", type: "string", nullable: true, sample: "Technology" },
        { name: "Account.AnnualRevenue", type: "number", nullable: true, sample: 5000000, suggestedTrait: "income_bracket", suggestedTransform: "income_to_bracket", confidence: 0.7 },
      ],
    },
    {
      streamName: "leads",
      fields: [
        { name: "Id", type: "string", nullable: false, sample: "00Qxx000001rMzS" },
        { name: "FirstName", type: "string", nullable: true, sample: "Jane" },
        { name: "LastName", type: "string", nullable: false, sample: "Smith" },
        { name: "Email", type: "string", nullable: true, sample: "jane@company.com" },
        { name: "Company", type: "string", nullable: false, sample: "Tech Startup Inc" },
        { name: "Title", type: "string", nullable: true, sample: "CTO", suggestedTrait: "occupation", confidence: 0.9 },
        { name: "Industry", type: "string", nullable: true, sample: "Software" },
        { name: "City", type: "string", nullable: true, sample: "San Francisco", suggestedTrait: "location_name", confidence: 0.85 },
        { name: "State", type: "string", nullable: true, sample: "CA" },
        { name: "LeadSource", type: "string", nullable: true, sample: "Web" },
        { name: "Status", type: "string", nullable: false, sample: "Open" },
      ],
    },
    {
      streamName: "accounts",
      fields: [
        { name: "Id", type: "string", nullable: false },
        { name: "Name", type: "string", nullable: false, sample: "Enterprise Corp" },
        { name: "Industry", type: "string", nullable: true, sample: "Financial Services" },
        { name: "AnnualRevenue", type: "number", nullable: true, sample: 10000000 },
        { name: "NumberOfEmployees", type: "number", nullable: true, sample: 500 },
        { name: "BillingCity", type: "string", nullable: true, sample: "New York" },
        { name: "BillingState", type: "string", nullable: true, sample: "NY" },
        { name: "Type", type: "string", nullable: true, sample: "Customer" },
      ],
    },
  ],
  hubspot: [
    {
      streamName: "contacts",
      fields: [
        { name: "id", type: "string", nullable: false },
        { name: "email", type: "string", nullable: true, sample: "contact@example.com" },
        { name: "firstname", type: "string", nullable: true, sample: "Alice" },
        { name: "lastname", type: "string", nullable: true, sample: "Johnson" },
        { name: "phone", type: "string", nullable: true },
        { name: "company", type: "string", nullable: true, sample: "Johnson & Co" },
        { name: "jobtitle", type: "string", nullable: true, sample: "Marketing Manager", suggestedTrait: "occupation", confidence: 0.9 },
        { name: "city", type: "string", nullable: true, sample: "Boston", suggestedTrait: "location_name", confidence: 0.85 },
        { name: "state", type: "string", nullable: true, sample: "MA" },
        { name: "lifecyclestage", type: "string", nullable: true, sample: "customer" },
        { name: "hs_lead_status", type: "string", nullable: true },
        { name: "date_of_birth", type: "date", nullable: true, sample: "1990-07-22", suggestedTrait: "age", suggestedTransform: "date_to_age", confidence: 0.95 },
      ],
    },
    {
      streamName: "companies",
      fields: [
        { name: "id", type: "string", nullable: false },
        { name: "name", type: "string", nullable: false, sample: "TechCorp Inc" },
        { name: "domain", type: "string", nullable: true, sample: "techcorp.com" },
        { name: "industry", type: "string", nullable: true, sample: "Software" },
        { name: "annualrevenue", type: "number", nullable: true, sample: 2500000 },
        { name: "numberofemployees", type: "number", nullable: true, sample: 50 },
        { name: "city", type: "string", nullable: true, sample: "Seattle" },
        { name: "state", type: "string", nullable: true, sample: "WA" },
      ],
    },
  ],
  postgres: [
    {
      streamName: "users",
      fields: [
        { name: "id", type: "number", nullable: false },
        { name: "email", type: "string", nullable: false, sample: "user@db.com" },
        { name: "first_name", type: "string", nullable: true, sample: "Bob" },
        { name: "last_name", type: "string", nullable: true, sample: "Williams" },
        { name: "birth_date", type: "date", nullable: true, sample: "1988-11-30", suggestedTrait: "age", suggestedTransform: "date_to_age", confidence: 0.95 },
        { name: "city", type: "string", nullable: true, sample: "Chicago", suggestedTrait: "location_name", confidence: 0.85 },
        { name: "state", type: "string", nullable: true, sample: "IL" },
        { name: "job_title", type: "string", nullable: true, sample: "Engineer", suggestedTrait: "occupation", confidence: 0.9 },
        { name: "annual_income", type: "number", nullable: true, sample: 95000, suggestedTrait: "income_bracket", suggestedTransform: "income_to_bracket", confidence: 0.9 },
        { name: "gender", type: "string", nullable: true, sample: "male", suggestedTrait: "gender", suggestedTransform: "normalize_gender", confidence: 0.95 },
        { name: "education_level", type: "string", nullable: true, sample: "bachelors", suggestedTrait: "education", confidence: 0.9 },
        { name: "created_at", type: "timestamp", nullable: false },
      ],
    },
    {
      streamName: "customers",
      fields: [
        { name: "customer_id", type: "number", nullable: false },
        { name: "user_id", type: "number", nullable: false },
        { name: "subscription_tier", type: "string", nullable: true, sample: "premium" },
        { name: "monthly_spend", type: "number", nullable: true, sample: 150 },
        { name: "signup_date", type: "date", nullable: true },
        { name: "last_purchase", type: "timestamp", nullable: true },
        { name: "lifetime_value", type: "number", nullable: true, sample: 2500 },
      ],
    },
  ],
};

// GET /api/sources/[id]/schema - Discover schema from source
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // In production, this would call PyAirbyte to discover the actual schema
    // For now, return mock schemas based on connector type

    // Parse connector type from query param or fetch from stored source
    const url = new URL(request.url);
    const connectorType = url.searchParams.get("connector") || "salesforce";

    const schemas = MOCK_SCHEMAS[connectorType] || MOCK_SCHEMAS.salesforce;

    // Generate mock sample records
    const schemasWithSamples = schemas.map((schema) => ({
      id: `schema_${id}_${schema.streamName}`,
      sourceId: id,
      streamName: schema.streamName,
      fields: schema.fields,
      sampleRecords: generateSampleRecords(schema.fields, 5),
      discoveredAt: new Date().toISOString(),
      recordCount: Math.floor(Math.random() * 10000) + 1000,
    }));

    return NextResponse.json(schemasWithSamples);
  } catch (error) {
    console.error("Error discovering schema:", error);
    return NextResponse.json(
      { error: "Failed to discover schema" },
      { status: 500 }
    );
  }
}

// Generate sample records from field definitions
function generateSampleRecords(fields: SourceField[], count: number): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const record: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.sample !== undefined) {
        // Vary the sample slightly
        if (typeof field.sample === "number") {
          record[field.name] = field.sample + Math.floor(Math.random() * 1000) * (i + 1);
        } else if (typeof field.sample === "string" && field.type === "date") {
          // Vary date by adding years
          const date = new Date(field.sample);
          date.setFullYear(date.getFullYear() - i * 2);
          record[field.name] = date.toISOString().split("T")[0];
        } else {
          record[field.name] = field.sample;
        }
      } else if (!field.nullable) {
        record[field.name] = field.type === "number" ? i : `${field.name}_${i}`;
      }
    }
    records.push(record);
  }

  return records;
}
