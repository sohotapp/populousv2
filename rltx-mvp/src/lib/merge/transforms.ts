// Transform Layer: Merge.dev Data → RLTX Agent Traits
// Converts unified CRM/HRIS data into agent attributes for simulations

import type { AgentTraits } from "@/db/schema";
import type {
  MergeContact,
  MergeLead,
  MergeEmployee,
  MergeAccount,
  MergeAddress,
} from "./types";

// =============================================================================
// TRANSFORM FUNCTIONS
// =============================================================================

/**
 * Convert a date string to age in years
 */
export function dateToAge(dateString: string | null): number | undefined {
  if (!dateString) return undefined;

  try {
    const birthDate = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age > 0 && age < 120 ? age : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Convert annual income to bracket
 */
export function incomeToBracket(income: number | null | undefined): AgentTraits["income_bracket"] | undefined {
  if (income === null || income === undefined) return undefined;

  if (income < 40000) return "low";
  if (income < 80000) return "medium";
  if (income < 150000) return "high";
  return "affluent";
}

/**
 * Convert pay rate to annual income based on period
 */
export function payRateToAnnualIncome(
  payRate: number | null,
  payPeriod: string | null
): number | undefined {
  if (payRate === null) return undefined;

  const multipliers: Record<string, number> = {
    HOUR: 2080, // 40 hours * 52 weeks
    DAY: 260, // 5 days * 52 weeks
    WEEK: 52,
    EVERY_TWO_WEEKS: 26,
    SEMIMONTHLY: 24,
    MONTH: 12,
    QUARTER: 4,
    EVERY_SIX_MONTHS: 2,
    YEAR: 1,
  };

  const multiplier = multipliers[payPeriod || "YEAR"] || 1;
  return Math.round(payRate * multiplier);
}

/**
 * Classify location as urban/suburban/rural based on city
 * Uses a simple heuristic - in production, would use census/population data
 */
export function locationToType(
  city: string | null,
  state?: string | null
): AgentTraits["location_type"] | undefined {
  if (!city) return undefined;

  const cityLower = city.toLowerCase();

  // Major urban centers
  const urbanCities = [
    "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia",
    "san antonio", "san diego", "dallas", "san jose", "austin", "jacksonville",
    "san francisco", "seattle", "denver", "boston", "washington", "detroit",
    "nashville", "portland", "las vegas", "miami", "atlanta", "baltimore",
    "london", "paris", "tokyo", "berlin", "sydney", "toronto", "vancouver",
    "mumbai", "delhi", "shanghai", "beijing", "singapore", "hong kong",
  ];

  // Suburban indicators
  const suburbanIndicators = [
    "hills", "heights", "park", "grove", "valley", "beach", "springs",
    "village", "township", "estates", "manor", "gardens",
  ];

  // Check for urban
  for (const urbanCity of urbanCities) {
    if (cityLower.includes(urbanCity)) return "urban";
  }

  // Check for suburban indicators
  for (const indicator of suburbanIndicators) {
    if (cityLower.includes(indicator)) return "suburban";
  }

  // Default heuristic: if city name is short, likely a smaller/rural area
  if (city.length < 8) return "rural";

  // Default to suburban
  return "suburban";
}

/**
 * Normalize gender values to RLTX enum
 */
export function normalizeGender(
  gender: string | null
): AgentTraits["gender"] | undefined {
  if (!gender) return undefined;

  const g = gender.toUpperCase();

  if (["M", "MALE", "MAN", "HE"].includes(g)) return "male";
  if (["F", "FEMALE", "WOMAN", "SHE"].includes(g)) return "female";
  if (["NB", "NON-BINARY", "NONBINARY", "NON_BINARY", "ENBY"].includes(g)) return "non-binary";
  if (g === "DECLINE_TO_SELF_IDENTIFY") return undefined;

  return "other";
}

/**
 * Normalize education level
 */
export function normalizeEducation(
  education: string | null
): AgentTraits["education"] | undefined {
  if (!education) return undefined;

  const e = education.toLowerCase();

  if (e.includes("high school") || e.includes("ged") || e.includes("secondary")) {
    return "high_school";
  }
  if (e.includes("some college") || e.includes("associate") || e.includes("aa") || e.includes("as")) {
    return "some_college";
  }
  if (e.includes("bachelor") || e.includes("bs") || e.includes("ba") || e.includes("undergraduate")) {
    return "bachelors";
  }
  if (e.includes("master") || e.includes("mba") || e.includes("ms") || e.includes("ma") || e.includes("graduate")) {
    return "graduate";
  }
  if (e.includes("phd") || e.includes("doctor") || e.includes("md") || e.includes("jd")) {
    return "doctorate";
  }

  return undefined;
}

/**
 * Extract primary address from address array
 */
export function extractPrimaryAddress(addresses: MergeAddress[]): {
  city: string | null;
  state: string | null;
  country: string | null;
} {
  if (!addresses || addresses.length === 0) {
    return { city: null, state: null, country: null };
  }

  // Prefer mailing or primary address
  const primary = addresses.find(a => a.address_type === "MAILING") || addresses[0];

  return {
    city: primary.city,
    state: primary.state,
    country: primary.country,
  };
}

/**
 * Generate location name from address components
 */
export function generateLocationName(
  city: string | null,
  state: string | null,
  country: string | null
): string | undefined {
  const parts = [city, state].filter(Boolean);
  if (parts.length === 0) return country || undefined;
  return parts.join(", ");
}

// =============================================================================
// MERGE MODEL → RLTX AGENT TRANSFORMS
// =============================================================================

/**
 * Transform a Merge CRM Contact to RLTX Agent Traits
 */
export function transformMergeContact(
  contact: MergeContact,
  account?: MergeAccount | null,
  customFields?: Record<string, unknown>
): Partial<AgentTraits> {
  const address = extractPrimaryAddress(contact.addresses);

  const traits: Partial<AgentTraits> = {
    // Name-derived fields (use for occupation inference if needed)
    occupation: extractOccupationFromAccount(account),

    // Location
    location_name: generateLocationName(address.city, address.state, address.country),
    location_type: locationToType(address.city, address.state),
  };

  // Process custom field mappings if provided
  if (customFields) {
    if (customFields.birthdate) {
      traits.age = dateToAge(customFields.birthdate as string);
    }
    if (customFields.income) {
      const income = Number(customFields.income);
      traits.income = income;
      traits.income_bracket = incomeToBracket(income);
    }
    if (customFields.gender) {
      traits.gender = normalizeGender(customFields.gender as string);
    }
    if (customFields.education) {
      traits.education = normalizeEducation(customFields.education as string);
    }
  }

  return removeNullValues(traits);
}

/**
 * Transform a Merge CRM Lead to RLTX Agent Traits
 */
export function transformMergeLead(
  lead: MergeLead,
  customFields?: Record<string, unknown>
): Partial<AgentTraits> {
  const address = extractPrimaryAddress(lead.addresses);

  const traits: Partial<AgentTraits> = {
    occupation: lead.title || undefined,
    location_name: generateLocationName(address.city, address.state, address.country),
    location_type: locationToType(address.city, address.state),
  };

  // Process custom fields
  if (customFields) {
    if (customFields.birthdate) {
      traits.age = dateToAge(customFields.birthdate as string);
    }
    if (customFields.income || customFields.annual_revenue) {
      const income = Number(customFields.income || customFields.annual_revenue);
      traits.income = income;
      traits.income_bracket = incomeToBracket(income);
    }
    if (customFields.gender) {
      traits.gender = normalizeGender(customFields.gender as string);
    }
  }

  return removeNullValues(traits);
}

/**
 * Transform a Merge HRIS Employee to RLTX Agent Traits
 * Employees have richer demographic data
 */
export function transformMergeEmployee(employee: MergeEmployee): Partial<AgentTraits> {
  // Get employment data for job title and pay
  const employment = employee.employments?.[0];

  // Calculate annual income from pay rate
  const annualIncome = employment
    ? payRateToAnnualIncome(employment.pay_rate, employment.pay_period)
    : null;

  const traits: Partial<AgentTraits> = {
    // Demographics
    age: dateToAge(employee.date_of_birth),
    gender: normalizeGender(employee.gender),

    // Employment
    occupation: employment?.job_title || undefined,

    // Income
    income: annualIncome || undefined,
    income_bracket: incomeToBracket(annualIncome),

    // Household (from marital status)
    household_composition: mapMaritalStatusToHousehold(employee.marital_status),
  };

  return removeNullValues(traits);
}

/**
 * Extract occupation from account data
 */
function extractOccupationFromAccount(account?: MergeAccount | null): string | undefined {
  if (!account) return undefined;

  // Try to infer from industry
  if (account.industry) {
    return `${account.industry} Professional`;
  }

  return undefined;
}

/**
 * Map marital status to household composition
 */
function mapMaritalStatusToHousehold(
  status: MergeEmployee["marital_status"]
): string | undefined {
  if (!status) return undefined;

  switch (status) {
    case "SINGLE":
      return "Single";
    case "MARRIED_FILING_JOINTLY":
    case "MARRIED_FILING_SEPARATELY":
      return "Married";
    case "HEAD_OF_HOUSEHOLD":
      return "Single Parent";
    case "QUALIFYING_WIDOW_WIDOWER_WITH_DEPENDENT_CHILD":
      return "Single Parent";
    default:
      return undefined;
  }
}

/**
 * Remove null/undefined values from object
 */
function removeNullValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  ) as Partial<T>;
}

// =============================================================================
// BATCH TRANSFORM
// =============================================================================

export interface TransformResult {
  success: boolean;
  agentId: string;
  sourceId: string;
  traits: Partial<AgentTraits>;
  completeness: number;
  errors?: string[];
}

/**
 * Calculate trait completeness percentage
 */
export function calculateCompleteness(traits: Partial<AgentTraits>): number {
  const requiredTraits = [
    "age",
    "income_bracket",
    "occupation",
    "location_type",
    "location_name",
  ];

  const optionalTraits = [
    "gender",
    "education",
    "income",
    "household_composition",
    "risk_tolerance",
    "price_sensitivity",
    "brand_loyalty",
  ];

  // Required traits have double weight
  const requiredPresent = requiredTraits.filter(t => traits[t as keyof AgentTraits] !== undefined).length;
  const optionalPresent = optionalTraits.filter(t => traits[t as keyof AgentTraits] !== undefined).length;

  const requiredWeight = 2;
  const optionalWeight = 1;

  const totalWeight = requiredTraits.length * requiredWeight + optionalTraits.length * optionalWeight;
  const achievedWeight = requiredPresent * requiredWeight + optionalPresent * optionalWeight;

  return Math.round((achievedWeight / totalWeight) * 100);
}

/**
 * Batch transform contacts to agents
 */
export function batchTransformContacts(
  contacts: MergeContact[],
  accounts?: Map<string, MergeAccount>,
  fieldMappings?: Record<string, string>
): TransformResult[] {
  return contacts.map(contact => {
    const account = contact.account && accounts ? accounts.get(contact.account) : null;

    // Extract custom fields based on mappings
    const customFields: Record<string, unknown> = {};
    if (fieldMappings && contact.field_mappings) {
      for (const [targetTrait, sourceField] of Object.entries(fieldMappings)) {
        const value = contact.field_mappings[sourceField];
        if (value !== undefined) {
          customFields[targetTrait] = value;
        }
      }
    }

    const traits = transformMergeContact(contact, account, customFields);

    return {
      success: true,
      agentId: `agent_${contact.id}`,
      sourceId: contact.id,
      traits,
      completeness: calculateCompleteness(traits),
    };
  });
}

/**
 * Batch transform employees to agents
 */
export function batchTransformEmployees(
  employees: MergeEmployee[]
): TransformResult[] {
  return employees.map(employee => {
    const traits = transformMergeEmployee(employee);

    return {
      success: true,
      agentId: `agent_${employee.id}`,
      sourceId: employee.id,
      traits,
      completeness: calculateCompleteness(traits),
    };
  });
}
