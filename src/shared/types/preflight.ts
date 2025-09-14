export type PreflightSeverity = "pass" | "warn" | "fail";

export interface PreflightItem {
  /** Stable unique identifier for this check item */
  id: string;
  /** Short, human-friendly title of the check */
  title: string;
  /** Outcome severity */
  severity: PreflightSeverity;
  /** Detailed message describing the finding */
  message: string;
  /** Optional remediation hint or link text */
  remediation?: string;
  /** Optional extra machine-readable diagnostic data */
  data?: Record<string, unknown>;
}
