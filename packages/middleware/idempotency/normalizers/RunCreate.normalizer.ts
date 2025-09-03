import { RunCreateInput } from '../../validation/schemas/RunCreate.schema';

// Normalize request body for consistent idempotency hashing
export function normalizeRunCreateBody(body: any): RunCreateInput {
  // Create a normalized copy with required name
  const normalized: Partial<RunCreateInput> = {};
  
  // Normalize name (trim whitespace, ensure it's a string)
  if (body.name !== undefined) {
    normalized.name = String(body.name).trim();
  }
  
  // Normalize input (preserve as-is, validation will handle type checking)
  if (body.input !== undefined) {
    normalized.input = body.input;
  }
  
  // Normalize client_token (trim whitespace, ensure it's a string)
  if (body.client_token !== undefined) {
    normalized.client_token = String(body.client_token).trim();
  }
  
  // Normalize tags (ensure array, trim each tag, filter empty ones)
  if (body.tags !== undefined) {
    if (Array.isArray(body.tags)) {
      normalized.tags = body.tags
        .map((tag: any) => String(tag).trim())
        .filter((tag: string) => tag.length > 0);
    } else if (typeof body.tags === 'string') {
      // Handle comma-separated string
      normalized.tags = body.tags
        .split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    }
  }
  
  // Ensure we have a name (required by schema)
  if (!normalized.name) {
    normalized.name = 'unnamed-run';
  }
  
  return normalized as RunCreateInput;
}

// Generate a stable hash for the normalized body
export function generateNormalizedHash(body: any): string {
  const normalized = normalizeRunCreateBody(body);
  
  // Sort keys for consistent ordering
  const sortedKeys = Object.keys(normalized).sort();
  
  // Create a stable representation
  const stable = sortedKeys.reduce((acc, key) => {
    const value = normalized[key as keyof RunCreateInput];
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
  
  // Convert to JSON string with consistent formatting
  const jsonString = JSON.stringify(stable, null, 0);
  
  // Simple hash function for the normalized string
  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

// Compare two bodies for idempotency
export function areBodiesEquivalent(body1: any, body2: any): boolean {
  const hash1 = generateNormalizedHash(body1);
  const hash2 = generateNormalizedHash(body2);
  return hash1 === hash2;
}
