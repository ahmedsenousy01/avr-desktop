import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ensureDeploymentEnvSeeded,
  getDeploymentEnvFilePath,
  readDeploymentEnv,
  removeServiceVariable,
  resolveServiceTemplatesInValue,
  toServiceTemplate,
  upsertServiceVariable,
  validatePresenceOnly,
} from "@main/services/deployment-env-store";
import { createDeployment } from "@main/services/deployments-store";
import { setWorkspaceRootForTesting } from "@main/services/workspace-root";

const tmpRoot = path.join(process.cwd(), `.tmp-test-${Date.now()}`);

describe("deployment-env-store", () => {
  afterEach(() => {
    if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });
    setWorkspaceRootForTesting(null);
  });

  it("seeds environment.json with defaults from registry on first access", () => {
    setWorkspaceRootForTesting(tmpRoot);
    const dep = createDeployment({ type: "sts", providers: { sts: "openai-realtime" } });

    const before = readDeploymentEnv(dep.id);
    expect(before).toBeNull();

    const seeded = ensureDeploymentEnvSeeded(dep.id);
    const file = getDeploymentEnvFilePath(dep.id);
    expect(file && fs.existsSync(file)).toBe(true);

    // Should include services that have defaults (e.g., avr-core, ami/others)
    expect(Object.keys(seeded.services).length).toBeGreaterThan(0);
  });

  it("supports add/update/remove of custom variables per service", () => {
    setWorkspaceRootForTesting(tmpRoot);
    const dep = createDeployment({ type: "sts", providers: { sts: "openai-realtime" } });

    // add
    let env = upsertServiceVariable(dep.id, "custom-svc", "FOO", "bar");
    expect(env.services["custom-svc"].FOO).toBe("bar");

    // update
    env = upsertServiceVariable(dep.id, "custom-svc", "FOO", "baz");
    expect(env.services["custom-svc"].FOO).toBe("baz");

    // remove
    env = removeServiceVariable(dep.id, "custom-svc", "FOO");
    expect(env.services["custom-svc"]).toBeUndefined();
  });

  it("reports missing required variables by service (presence only)", () => {
    setWorkspaceRootForTesting(tmpRoot);
    const dep = createDeployment({ type: "sts", providers: { sts: "openai-realtime" } });

    // Seed and then remove a required var to force a missing report
    ensureDeploymentEnvSeeded(dep.id);
    removeServiceVariable(dep.id, "avr-core", "STS_URL");

    const result = validatePresenceOnly(dep.id);
    // Required vars differ by service; we expect at least one missing to be reported
    expect(Object.keys(result.missingByService).length).toBeGreaterThan(0);
  });

  it("interpolates service names in URLs to template notation and resolves back", () => {
    const templated = toServiceTemplate("http://avr-ami:6006");
    expect(templated).toBe("http://{{service:avr-ami}}:6006");
    const resolved = resolveServiceTemplatesInValue(templated, (name) => name);
    expect(resolved).toBe("http://avr-ami:6006");
  });
});
