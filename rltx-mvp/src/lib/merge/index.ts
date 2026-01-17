// Merge.dev Integration - Main Export
// Unified API for CRM, HRIS, Accounting integrations

// Client and configuration
export {
  getMergeClient,
  MERGE_INTEGRATIONS,
  CATEGORY_LABELS,
  getAllIntegrations,
  getIntegrationById,
  type MergeCategory,
  type MergeIntegration,
} from "./client";

// Types
export type {
  // CRM Models
  MergeContact,
  MergeLead,
  MergeAccount,
  MergeOpportunity,
  // HRIS Models
  MergeEmployee,
  MergeEmployment,
  // Common
  MergeAddress,
  MergeEmailAddress,
  MergePhoneNumber,
  // API
  MergePaginatedResponse,
  MergeLinkTokenResponse,
  MergeAccountDetails,
  MergeLinkedAccount,
  // Webhooks
  MergeWebhookPayload,
  MergeWebhookEvent,
} from "./types";

// Transforms
export {
  // Individual transforms
  dateToAge,
  incomeToBracket,
  payRateToAnnualIncome,
  locationToType,
  normalizeGender,
  normalizeEducation,
  extractPrimaryAddress,
  generateLocationName,
  // Model transforms
  transformMergeContact,
  transformMergeLead,
  transformMergeEmployee,
  // Batch transforms
  batchTransformContacts,
  batchTransformEmployees,
  calculateCompleteness,
  type TransformResult,
} from "./transforms";

// Accounts storage
export {
  setLinkedAccount,
  getLinkedAccount,
  getAccountToken,
  getAllLinkedAccounts,
  deleteLinkedAccount,
  type LinkedAccountData,
} from "./accounts";
