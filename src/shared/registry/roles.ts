/**
 * Logical role taxonomy for images/services used in compose templates.
 *
 * Roles intentionally model high-level capabilities rather than specific providers.
 * The image registry maps concrete images to these roles.
 */

export const LOGICAL_ROLES = ["asr", "tts", "llm", "sts", "infra"] as const;

export type LogicalRole = (typeof LOGICAL_ROLES)[number];

/** Stable ordering used for display and deterministic operations */
export const ROLE_ORDER: Readonly<Record<LogicalRole, number>> = {
  asr: 1,
  tts: 2,
  llm: 3,
  sts: 4,
  infra: 5,
};

export function isLogicalRole(value: unknown): value is LogicalRole {
  return typeof value === "string" && (LOGICAL_ROLES as readonly string[]).includes(value);
}

export function assertLogicalRole(value: unknown): asserts value is LogicalRole {
  if (!isLogicalRole(value)) {
    const allowed = LOGICAL_ROLES.join(", ");
    throw new Error(`Invalid LogicalRole: ${String(value)}. Allowed: ${allowed}`);
  }
}

export function normalizeRole(value: string): LogicalRole {
  const candidate = value.trim().toLowerCase();
  assertLogicalRole(candidate);
  return candidate;
}

export function uniqueRoles(values: Iterable<LogicalRole>): LogicalRole[] {
  const seen = new Set<LogicalRole>();
  for (const role of values) {
    if (isLogicalRole(role)) seen.add(role);
  }
  return Array.from(seen);
}

export function sortRoles(values: Iterable<LogicalRole>): LogicalRole[] {
  return uniqueRoles(values).sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]);
}
