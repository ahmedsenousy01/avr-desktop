import { z } from "zod/v4";

/**
 * Asterisk configuration model used by deployments to render conf files.
 * Includes enumerations for supported DTMF modes and codecs, a Zod schema
 * for validation, and opinionated defaults suitable for typical VoIP setups.
 */
export const SUPPORTED_DTMF_MODES = ["rfc4733", "inband", "info"] as const;
export type AsteriskDtmfMode = (typeof SUPPORTED_DTMF_MODES)[number];

/** Common codecs supported by example images and Asterisk out of the box. */
export const SUPPORTED_CODECS = ["opus", "ulaw", "alaw", "g722"] as const;
export type AsteriskCodec = (typeof SUPPORTED_CODECS)[number];

export const AsteriskConfigSchema = z
  .object({
    externalIp: z.string().trim(),
    sipPort: z.number().int().min(1).max(65535),
    rtpStart: z.number().int().min(1).max(65535),
    rtpEnd: z.number().int().min(1).max(65535),
    /**
     * Codec names as expected by Asterisk (e.g., "ulaw", "opus").
     * Final allowed values will be enumerated in sub-task 1.2.
     */
    codecs: z.array(z.enum(SUPPORTED_CODECS)).nonempty(),
    /**
     * DTMF mode (e.g., "rfc4733"). Supported values to be enumerated in sub-task 1.2.
     */
    dtmfMode: z.enum(SUPPORTED_DTMF_MODES),
    /**
     * Minimal PJSIP overrides: callers can set section/option pairs as needed.
     * Example: { "transport-udp.bind": "0.0.0.0:5060" }
     */
    pjsip: z.record(z.string(), z.unknown()),
  })
  .refine((v) => v.rtpStart <= v.rtpEnd, {
    path: ["rtpEnd"],
    message: "rtpEnd must be greater than or equal to rtpStart",
  });

export type AsteriskConfig = z.infer<typeof AsteriskConfigSchema>;

export const DEFAULT_ASTERISK_CONFIG: AsteriskConfig = {
  externalIp: "",
  sipPort: 5060,
  rtpStart: 10000,
  rtpEnd: 20000,
  /** Default codec preference favors quality (opus) with ulaw fallback. */
  codecs: ["opus", "ulaw"],
  dtmfMode: "rfc4733",
  pjsip: {},
};

export function isValidAsteriskConfig(input: unknown): input is AsteriskConfig {
  return AsteriskConfigSchema.safeParse(input).success;
}

export function validateAsteriskConfig(input: unknown): { valid: boolean; errors: string[] } {
  const parsed = AsteriskConfigSchema.safeParse(input);
  if (parsed.success) return { valid: true, errors: [] };
  return { valid: false, errors: parsed.error.issues.map((i) => i.message) };
}
