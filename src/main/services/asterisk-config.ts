/**
 * Token rendering utilities for Asterisk configuration templates.
 *
 * Supported tokens:
 *  - {{EXTERNAL_IP}}
 *  - {{SIP_PORT}}
 *  - {{RTP_START}}
 *  - {{RTP_END}}
 *  - {{CODECS}} (comma-separated)
 *  - {{DTMF_MODE}}
 *
 * Escaping:
 *  - Use \{{ and \}} in templates to output literal braces ({{ or }}) without triggering replacement.
 */
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import type { AsteriskConfig } from "@shared/types/asterisk";
import { validateAsteriskConfig as validateAsteriskConfigSchema } from "@shared/types/asterisk";

/** Left delimiter for tokens in templates */
export const TOKEN_OPEN = "{{" as const;
/** Right delimiter for tokens in templates */
export const TOKEN_CLOSE = "}}" as const;

export type AsteriskTokenName = "EXTERNAL_IP" | "SIP_PORT" | "RTP_START" | "RTP_END" | "CODECS" | "DTMF_MODE";

/** All supported token names (for validation and discovery) */
export const ASTERISK_TOKENS: readonly AsteriskTokenName[] = [
  "EXTERNAL_IP",
  "SIP_PORT",
  "RTP_START",
  "RTP_END",
  "CODECS",
  "DTMF_MODE",
];

/** Build the delimited token string, e.g., "{{EXTERNAL_IP}}" */
export function makeToken(name: AsteriskTokenName): string {
  return `${TOKEN_OPEN}${name}${TOKEN_CLOSE}`;
}

function formatCodecs(codecs: AsteriskConfig["codecs"]): string {
  return codecs.join(",");
}

/** Build a map from delimited tokens to concrete string values for a given config. */
export function buildTokenMap(config: AsteriskConfig): Record<string, string> {
  return {
    [makeToken("EXTERNAL_IP")]: config.externalIp,
    [makeToken("SIP_PORT")]: String(config.sipPort),
    [makeToken("RTP_START")]: String(config.rtpStart),
    [makeToken("RTP_END")]: String(config.rtpEnd),
    [makeToken("CODECS")]: formatCodecs(config.codecs),
    [makeToken("DTMF_MODE")]: config.dtmfMode,
  };
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ESC_OPEN_PLACEHOLDER = "__AST_ESC_OPEN__";
const ESC_CLOSE_PLACEHOLDER = "__AST_ESC_CLOSE__";

/** Render a template using a token map. Unknown tokens are preserved; escaped braces are respected. */
export function renderWithTokens(template: string, tokenMap: Record<string, string>): string {
  if (!template) return template;

  // Protect escaped braces before replacement
  // Replace sequences like "\{{" and "\}}" with placeholders so they survive replacements
  let working = template.replace(/\\\{\{/g, ESC_OPEN_PLACEHOLDER).replace(/\\\}\}/g, ESC_CLOSE_PLACEHOLDER);

  const keys = Object.keys(tokenMap);
  if (keys.length > 0) {
    // Sort by length desc to protect against hypothetical overlapping keys
    const sortedKeys = keys.sort((a, b) => b.length - a.length);
    const pattern = new RegExp(sortedKeys.map(escapeRegExp).join("|"), "g");
    working = working.replace(pattern, (match) => tokenMap[match] ?? match);
  }

  // Restore escaped braces
  return working
    .replace(new RegExp(ESC_OPEN_PLACEHOLDER, "g"), "{{")
    .replace(new RegExp(ESC_CLOSE_PLACEHOLDER, "g"), "}}");
}

const TEMPLATE_FILENAMES = ["ari.conf", "pjsip.conf", "extensions.conf", "manager.conf", "queues.conf"] as const;

function getDefaultTemplatesDir(currentDir: string): string {
  // Try build output first, then fall back to source paths during dev
  const candidates = [
    // When running the built main.js: .vite/build -> .vite/infra/asterisk/conf
    path.resolve(currentDir, "../infra/asterisk/conf"),
    // When running in dev (cwd = repo root)
    path.resolve(process.cwd(), "src/main/infra/asterisk/conf"),
    // From compiled dir up to repo root then src
    path.resolve(currentDir, "../../src/main/infra/asterisk/conf"),
  ];
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // continue
    }
  }
  // Default to the first candidate even if missing; downstream read will throw with context
  return candidates[0];
}

async function readTemplateFile(sourceDir: string, filename: string): Promise<string> {
  const filePath = path.join(sourceDir, filename);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read template '${filename}' from '${sourceDir}': ${message}`);
  }
}

export async function renderAsteriskConfig(
  config: AsteriskConfig,
  sourceDir?: string,
  targetDir?: string,
  preview = true
): Promise<{ files: Record<string, string>; written: string[] }> {
  const validation = validateAsteriskConfigSchema(config);
  if (!validation.valid) {
    throw new Error(`Invalid Asterisk config: ${validation.errors.join(", ")}`);
  }

  const effectiveSourceDir = sourceDir ?? getDefaultTemplatesDir(__dirname);
  const tokenMap = buildTokenMap(config);

  const files: Record<string, string> = {};
  for (const filename of TEMPLATE_FILENAMES) {
    const template = await readTemplateFile(effectiveSourceDir, filename);
    files[filename] = renderWithTokens(template, tokenMap);
  }

  const written: string[] = [];
  if (!preview && targetDir) {
    await fs.mkdir(targetDir, { recursive: true });
    await Promise.all(
      Object.entries(files).map(async ([filename, content]) => {
        const outPath = path.join(targetDir, filename);
        await fs.writeFile(outPath, content, "utf8");
        written.push(outPath);
      })
    );
  }

  return { files, written };
}

export function validateAsteriskConfig(config: AsteriskConfig): { valid: boolean; errors: string[] } {
  return validateAsteriskConfigSchema(config);
}
