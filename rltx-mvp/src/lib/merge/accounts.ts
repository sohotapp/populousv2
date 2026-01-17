// Merge.dev Linked Accounts Store
// In-memory storage for development (replace with database in production)

export interface LinkedAccountData {
  id: string;
  accountToken: string;
  integrationSlug: string;
  integrationName: string;
  category: string;
  organizationName: string;
  email: string;
  status: string;
  createdAt: string;
}

// In-memory storage - replace with database in production
const linkedAccounts = new Map<string, LinkedAccountData>();

export function setLinkedAccount(id: string, data: LinkedAccountData): void {
  linkedAccounts.set(id, data);
}

export function getLinkedAccount(id: string): LinkedAccountData | undefined {
  return linkedAccounts.get(id);
}

export function getAccountToken(linkedAccountId: string): string | undefined {
  return linkedAccounts.get(linkedAccountId)?.accountToken;
}

export function getAllLinkedAccounts(): LinkedAccountData[] {
  return Array.from(linkedAccounts.values());
}

export function deleteLinkedAccount(id: string): boolean {
  return linkedAccounts.delete(id);
}
