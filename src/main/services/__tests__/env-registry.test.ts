import { describe, expect, it } from "vitest";

import { ENV_REGISTRY, ENV_REGISTRY_VERSION } from "../../services/env-registry";

describe("ENV_REGISTRY", () => {
  it("exposes a version string", () => {
    expect(typeof ENV_REGISTRY_VERSION).toBe("string");
    expect(ENV_REGISTRY.version).toBe(ENV_REGISTRY_VERSION);
  });

  it("contains expected core services", () => {
    const serviceNames = ENV_REGISTRY.services.map((s) => s.serviceName);
    expect(serviceNames).toContain("avr-core");
    expect(serviceNames).toContain("avr-ami");
    expect(serviceNames).toContain("avr-asterisk");
  });

  it("normalizes service names and sorts variables (avr-core)", () => {
    const core = ENV_REGISTRY.services.find((s) => s.serviceName === "avr-core");
    expect(core).toBeTruthy();
    if (!core) return;

    const names = core.variables.map((v) => v.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
    // no duplicates
    expect(new Set(names).size).toBe(names.length);
  });

  it("marks variables as required when no default is present", () => {
    const openai = ENV_REGISTRY.services.find((s) => s.serviceName === "avr-llm-openai");
    expect(openai).toBeTruthy();
    if (!openai) return;

    const apiKey = openai.variables.find((v) => v.name === "OPENAI_API_KEY");
    expect(apiKey).toBeTruthy();
    if (!apiKey) return;

    expect(apiKey.required).toBe(true);
  });

  it("applies defaults when present and sets required=false", () => {
    const core = ENV_REGISTRY.services.find((s) => s.serviceName === "avr-core");
    expect(core).toBeTruthy();
    if (!core) return;

    const port = core.variables.find((v) => v.name === "PORT");
    expect(port).toBeTruthy();
    if (!port) return;

    expect(port.defaultValue).toBe("5001");
    expect(port.required).toBe(false);
  });

  it("is shallowly immutable (freezes services and variables arrays)", () => {
    expect(() => {
      (ENV_REGISTRY.services as unknown as unknown[]).push({});
    }).toThrow();
    const some = ENV_REGISTRY.services[0];
    expect(() => {
      (some.variables as unknown as unknown[]).push({});
    }).toThrow();
  });
});
