import { describe, expect, it } from "vitest";

import {
  getTemplateMeta,
  listTemplates,
  listTemplatesByStackType,
  TEMPLATE_IDS,
  templateToDeployment,
} from "../template-registry";

describe("template registry", () => {
  it("exposes all template ids and matching metadata", () => {
    const all = listTemplates();
    expect(all.length).toBe(TEMPLATE_IDS.length);
    const ids = new Set(all.map((t) => t.id));
    for (const id of TEMPLATE_IDS) {
      expect(ids.has(id)).toBe(true);
      const meta = getTemplateMeta(id);
      expect(meta.id).toBe(id);
      expect(Array.isArray(meta.tags)).toBe(true);
      expect(Array.isArray(meta.badges)).toBe(true);
      expect(typeof meta.displayName).toBe("string");
      expect(typeof meta.summary).toBe("string");
      expect(typeof meta.exampleCompose).toBe("string");
    }
  });

  it("lists templates by stack type", () => {
    const modular = listTemplatesByStackType("modular");
    expect(modular.length).toBeGreaterThan(0);
    for (const m of modular) {
      expect(m.stackType).toBe("modular");
    }

    const sts = listTemplatesByStackType("sts");
    expect(sts.length).toBeGreaterThan(0);
    for (const s of sts) {
      expect(s.stackType).toBe("sts");
    }

    const integrations = listTemplatesByStackType("integration");
    expect(integrations.length).toBeGreaterThan(0);
    for (const i of integrations) {
      expect(i.stackType).toBe("integration");
    }
  });
});

describe("templateToDeployment", () => {
  it("creates modular skeletons with appropriate prefilled roles", () => {
    const openai = templateToDeployment("openai", "My OpenAI");
    expect(openai.type).toBe("modular");
    expect(openai.name).toBe("My OpenAI");
    if (openai.type === "modular") {
      expect(openai.providers.llm).toBe("openai");
    } else {
      throw new Error("expected modular skeleton");
    }

    const google = templateToDeployment("google");
    expect(google.type).toBe("modular");
    if (google.type === "modular") {
      expect(google.providers.asr).toBe("google");
      expect(google.providers.tts).toBe("google");
    } else {
      throw new Error("expected modular skeleton");
    }
  });

  it("creates sts skeletons with provider set", () => {
    const r = templateToDeployment("openai-realtime");
    expect(r.type).toBe("sts");
    if (r.type === "sts") {
      expect(r.providers.sts).toBe("openai-realtime");
    } else {
      throw new Error("expected sts skeleton");
    }
  });

  it("throws for integration templates that cannot produce deployments", () => {
    expect(() => templateToDeployment("n8n")).toThrow();
  });
});
