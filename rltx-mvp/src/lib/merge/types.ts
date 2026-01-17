// Merge.dev Unified Model Types
// These represent the normalized data structures from Merge's unified API

// =============================================================================
// CRM MODELS
// =============================================================================

export interface MergeContact {
  id: string;
  remote_id: string | null;
  first_name: string | null;
  last_name: string | null;
  account: string | null;
  addresses: MergeAddress[];
  email_addresses: MergeEmailAddress[];
  phone_numbers: MergePhoneNumber[];
  last_activity_at: string | null;
  remote_created_at: string | null;
  remote_updated_at: string | null;
  remote_was_deleted: boolean;
  field_mappings: Record<string, unknown> | null;
  remote_data: Record<string, unknown>[] | null;
}

export interface MergeLead {
  id: string;
  remote_id: string | null;
  owner: string | null;
  lead_source: string | null;
  title: string | null;
  company: string | null;
  first_name: string | null;
  last_name: string | null;
  addresses: MergeAddress[];
  email_addresses: MergeEmailAddress[];
  phone_numbers: MergePhoneNumber[];
  converted_date: string | null;
  converted_contact: string | null;
  converted_account: string | null;
  remote_created_at: string | null;
  remote_updated_at: string | null;
  remote_was_deleted: boolean;
  field_mappings: Record<string, unknown> | null;
  remote_data: Record<string, unknown>[] | null;
}

export interface MergeAccount {
  id: string;
  remote_id: string | null;
  owner: string | null;
  name: string | null;
  description: string | null;
  industry: string | null;
  website: string | null;
  number_of_employees: number | null;
  addresses: MergeAddress[];
  phone_numbers: MergePhoneNumber[];
  last_activity_at: string | null;
  remote_created_at: string | null;
  remote_updated_at: string | null;
  remote_was_deleted: boolean;
}

export interface MergeOpportunity {
  id: string;
  remote_id: string | null;
  name: string | null;
  description: string | null;
  amount: number | null;
  owner: string | null;
  account: string | null;
  stage: string | null;
  status: "OPEN" | "WON" | "LOST" | null;
  last_activity_at: string | null;
  close_date: string | null;
  remote_created_at: string | null;
  remote_updated_at: string | null;
  remote_was_deleted: boolean;
}

// =============================================================================
// HRIS MODELS
// =============================================================================

export interface MergeEmployee {
  id: string;
  remote_id: string | null;
  employee_number: string | null;
  company: string | null;
  first_name: string | null;
  last_name: string | null;
  display_full_name: string | null;
  username: string | null;
  groups: string[];
  work_email: string | null;
  personal_email: string | null;
  mobile_phone_number: string | null;
  employments: MergeEmployment[];
  home_location: string | null;
  work_location: string | null;
  manager: string | null;
  team: string | null;
  pay_group: string | null;
  ssn: string | null;
  gender: "MALE" | "FEMALE" | "NON-BINARY" | "OTHER" | "DECLINE_TO_SELF_IDENTIFY" | null;
  ethnicity: string | null;
  marital_status: "SINGLE" | "MARRIED_FILING_JOINTLY" | "MARRIED_FILING_SEPARATELY" | "HEAD_OF_HOUSEHOLD" | "QUALIFYING_WIDOW_WIDOWER_WITH_DEPENDENT_CHILD" | null;
  date_of_birth: string | null;
  hire_date: string | null;
  start_date: string | null;
  termination_date: string | null;
  employment_status: "ACTIVE" | "PENDING" | "INACTIVE" | null;
  avatar: string | null;
  remote_created_at: string | null;
  remote_was_deleted: boolean;
}

export interface MergeEmployment {
  id: string;
  remote_id: string | null;
  employee: string | null;
  job_title: string | null;
  pay_rate: number | null;
  pay_period: "HOUR" | "DAY" | "WEEK" | "EVERY_TWO_WEEKS" | "SEMIMONTHLY" | "MONTH" | "QUARTER" | "EVERY_SIX_MONTHS" | "YEAR" | null;
  pay_frequency: string | null;
  pay_currency: string | null;
  pay_group: string | null;
  flsa_status: "EXEMPT" | "SALARIED_NONEXEMPT" | "NONEXEMPT" | "OWNER" | null;
  effective_date: string | null;
  employment_type: "FULL_TIME" | "PART_TIME" | "INTERN" | "CONTRACTOR" | "FREELANCE" | null;
}

// =============================================================================
// COMMON MODELS
// =============================================================================

export interface MergeAddress {
  street_1: string | null;
  street_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  address_type: "BILLING" | "SHIPPING" | "MAILING" | "OTHER" | null;
}

export interface MergeEmailAddress {
  email_address: string | null;
  email_address_type: "PERSONAL" | "WORK" | "OTHER" | null;
}

export interface MergePhoneNumber {
  phone_number: string | null;
  phone_number_type: "HOME" | "WORK" | "MOBILE" | "SKYPE" | "OTHER" | null;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface MergePaginatedResponse<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface MergeLinkTokenResponse {
  link_token: string;
  integration_name: string | null;
  magic_link_url: string | null;
}

export interface MergeAccountDetails {
  id: string;
  integration: string;
  integration_slug: string;
  category: string;
  end_user_origin_id: string | null;
  end_user_organization_name: string;
  end_user_email_address: string;
  status: string;
  webhook_listener_url: string;
  is_duplicate: boolean | null;
}

// =============================================================================
// LINKED ACCOUNT (Connection)
// =============================================================================

export interface MergeLinkedAccount {
  id: string;
  integration: {
    name: string;
    slug: string;
    categories: string[];
    image: string;
    square_image: string;
    color: string;
  };
  category: string;
  end_user_origin_id: string | null;
  end_user_organization_name: string;
  end_user_email_address: string;
  status: "COMPLETE" | "INCOMPLETE" | "RELINK_NEEDED";
  webhook_listener_url: string;
  account_token: string;
}

// =============================================================================
// WEBHOOK TYPES
// =============================================================================

export interface MergeWebhookPayload {
  hook: {
    event: string;
    target: string;
  };
  linked_account_id: string;
  data: {
    linked_account: MergeLinkedAccount;
    [key: string]: unknown;
  };
}

export type MergeWebhookEvent =
  | "linked_account.created"
  | "linked_account.deleted"
  | "sync.completed"
  | "changed_data"
  | "sync.errored";
