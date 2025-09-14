import { describe, expect, it } from "vitest";

import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import { buildTokenMap, makeToken, renderWithTokens } from "@main/services/asterisk-config";

describe("asterisk-config token mapping and rendering", () => {
  it("builds a token map from config", () => {
    const map = buildTokenMap(DEFAULT_ASTERISK_CONFIG);
    expect(map[makeToken("EXTERNAL_IP")]).toBe("");
    expect(map[makeToken("SIP_PORT")]).toBe(String(DEFAULT_ASTERISK_CONFIG.sipPort));
    expect(map[makeToken("RTP_START")]).toBe(String(DEFAULT_ASTERISK_CONFIG.rtpStart));
    expect(map[makeToken("RTP_END")]).toBe(String(DEFAULT_ASTERISK_CONFIG.rtpEnd));
    expect(map[makeToken("CODECS")]).toBe(DEFAULT_ASTERISK_CONFIG.codecs.join(","));
    expect(map[makeToken("DTMF_MODE")]).toBe(DEFAULT_ASTERISK_CONFIG.dtmfMode);
  });

  it("renders a template by replacing known tokens and preserving unknowns", () => {
    const cfg = { ...DEFAULT_ASTERISK_CONFIG, externalIp: "203.0.113.10", sipPort: 5070 };
    const map = buildTokenMap(cfg);
    const tpl = [
      "bind_addr={{EXTERNAL_IP}}:{{SIP_PORT}}",
      "rtp_range={{RTP_START}}-{{RTP_END}}",
      "allow_codecs={{CODECS}}; dtmf={{DTMF_MODE}}",
      "unknown={{NOT_A_TOKEN}}",
    ].join("\n");
    const out = renderWithTokens(tpl, map);
    expect(out).toContain("bind_addr=203.0.113.10:5070");
    expect(out).toContain(`rtp_range=${cfg.rtpStart}-${cfg.rtpEnd}`);
    expect(out).toContain(`allow_codecs=${cfg.codecs.join(",")}; dtmf=${cfg.dtmfMode}`);
    expect(out).toContain("unknown={{NOT_A_TOKEN}}");
  });

  it("supports escaped braces to output literal {{ and }}", () => {
    const cfg = { ...DEFAULT_ASTERISK_CONFIG, externalIp: "198.51.100.5" };
    const out = renderWithTokens("\\{{ literal }} {{EXTERNAL_IP}} \\}}", buildTokenMap(cfg));
    expect(out).toBe("{{ literal }} 198.51.100.5 }}");
  });

  it("does not partially collide when tokens share substrings", () => {
    // Simulate hypothetical overlapping token names by crafting custom map
    const map = {
      "{{FOO}}": "X",
      "{{FOO_BAR}}": "Y",
    } as Record<string, string>;
    const out = renderWithTokens("{{FOO}}-{{FOO_BAR}}", map);
    expect(out).toBe("X-Y");
  });
});
