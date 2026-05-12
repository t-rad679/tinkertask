export const ErrorCodes = {
  // Auth
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  email_not_allowlisted: 'email_not_allowlisted',

  // Validation
  validation_failed: 'validation_failed',
  invalid_query: 'invalid_query',
  invalid_recurrence: 'invalid_recurrence',
  invalid_scope_hierarchy: 'invalid_scope_hierarchy',
  parse_failed: 'parse_failed',
  ambiguous_scope: 'ambiguous_scope',

  // Lookup
  not_found: 'not_found',
  scope_not_found: 'scope_not_found',
  scope_type_in_use: 'scope_type_in_use',
  reorder_breaks_hierarchy: 'reorder_breaks_hierarchy',

  // Rate limit
  rate_limited_read: 'rate_limited_read',
  rate_limited_write: 'rate_limited_write',
  rate_limited_pat_create: 'rate_limited_pat_create',

  // Server
  internal: 'internal',
} as const;
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
