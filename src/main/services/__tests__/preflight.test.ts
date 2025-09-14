import { describe, expect, it } from "vitest";

import type { Deployment } from "@shared/types/deployments";
import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import { buildPortProbePlan, createAsteriskRtpValidationCheck } from "@main/services/preflight";

function makeDeployment(partial?: Partial<Deployment>): Deployment {
  const base: Deployment = {
    id: "d1",
    name: "Test",
    slug: "test",
    type: "modular",
    providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" },
    asterisk: { ...DEFAULT_ASTERISK_CONFIG },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...base, ...partial } as Deployment;
}

describe("preflight asterisk + ports", () => {
  it("buildPortProbePlan uses defaults when asterisk is missing", () => {
    const dep = makeDeployment({ asterisk: undefined });
    const plan = buildPortProbePlan(dep);
    expect(plan.sipPort).toBe(DEFAULT_ASTERISK_CONFIG.sipPort);
    expect(plan.rtpRange).toEqual({ start: DEFAULT_ASTERISK_CONFIG.rtpStart, end: DEFAULT_ASTERISK_CONFIG.rtpEnd });
  });

  it("buildPortProbePlan uses provided asterisk values", () => {
    const dep = makeDeployment({
      asterisk: { ...DEFAULT_ASTERISK_CONFIG, sipPort: 5070, rtpStart: 40000, rtpEnd: 41000 },
    });
    const plan = buildPortProbePlan(dep);
    expect(plan.sipPort).toBe(5070);
    expect(plan.rtpRange).toEqual({ start: 40000, end: 41000 });
  });

  it("RTP validation: overlap with SIP yields fail", async () => {
    const dep = makeDeployment({
      asterisk: { ...DEFAULT_ASTERISK_CONFIG, sipPort: 12000, rtpStart: 11000, rtpEnd: 13000 },
    });
    const check = createAsteriskRtpValidationCheck(dep);
    const res = await check.run({});
    const items = Array.isArray(res) ? res : res ? [res] : [];
    const overlap = items.find((i) => i.id === "asterisk:rtp:overlap:sip");
    expect(overlap).toBeTruthy();
    expect(overlap?.severity).toBe("fail");
    expect(overlap?.message).toMatch(/SIP port 12000/);
  });

  it("RTP validation: invalid ordering yields fail", async () => {
    const dep = makeDeployment({ asterisk: { ...DEFAULT_ASTERISK_CONFIG, rtpStart: 5000, rtpEnd: 4000 } });
    const check = createAsteriskRtpValidationCheck(dep);
    const res = await check.run({});
    const items = Array.isArray(res) ? res : res ? [res] : [];
    const order = items.find((i) => i.id === "asterisk:rtp:bounds:order");
    expect(order).toBeTruthy();
    expect(order?.severity).toBe("fail");
    expect(order?.message).toMatch(/start .* less than end/i);
  });

  it("RTP validation: valid config yields pass", async () => {
    const dep = makeDeployment({
      asterisk: { ...DEFAULT_ASTERISK_CONFIG, sipPort: 5060, rtpStart: 10000, rtpEnd: 10019 },
    });
    const check = createAsteriskRtpValidationCheck(dep);
    const res = await check.run({});
    const items = Array.isArray(res) ? res : res ? [res] : [];
    const ok = items.find((i) => i.id === "asterisk:rtp:ok");
    expect(ok).toBeTruthy();
    expect(ok?.severity).toBe("pass");
    expect(ok?.message).toMatch(/RTP 10000-10019/);
  });
});
