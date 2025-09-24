import { describe, it } from "vitest";

import type { ImageKey, KeysByRole } from "@shared/registry/images";
import { TEMPLATES } from "@shared/registry/templates";

// This file contains compile-time only typing checks. It has no runtime assertions.
// We rely on TypeScript to enforce constraints; @ts-expect-error is used to verify failures.

describe("registry typing", () => {
  it("role-constrained image keys only accept matching roles", () => {
    // Happy paths
    const asrOk: KeysByRole<"asr"> = "avr-asr-deepgram";
    void asrOk;
    const ttsOk: KeysByRole<"tts"> = "avr-tts-google-cloud-tts";
    void ttsOk;
    const llmOk: KeysByRole<"llm"> = "avr-llm-openai";
    void llmOk;
    const stsOk: KeysByRole<"sts"> = "avr-sts-openai";
    void stsOk;

    // Invalid assignments must fail at compile time
    // @ts-expect-error llm cannot be assigned to asr role
    const _asrBad: KeysByRole<"asr"> = "avr-llm-openai";
    // @ts-expect-error tts cannot be assigned to llm role
    const _llmBad: KeysByRole<"llm"> = "avr-tts-deepgram";
    // @ts-expect-error sts cannot be assigned to tts role
    const _ttsBad: KeysByRole<"tts"> = "avr-sts-gemini";
  });

  it("templates reference image keys consistent with their declared roles", () => {
    // Spot-check a few templates to ensure images.* align with KeysByRole
    const openaiAsr: KeysByRole<"asr"> | undefined = TEMPLATES.openai.images.asr;
    void openaiAsr;
    const openaiLlm: KeysByRole<"llm"> | undefined = TEMPLATES.openai.images.llm;
    void openaiLlm;
    const googleAsr: KeysByRole<"asr"> | undefined = TEMPLATES.google.images.asr;
    void googleAsr;
    const googleTts: KeysByRole<"tts"> | undefined = TEMPLATES.google.images.tts;
    void googleTts;
    const stsKey: KeysByRole<"sts"> = TEMPLATES["openai-realtime"].images.sts;
    void stsKey;

    // Negative checks: ensure incorrect role usage is rejected
    // @ts-expect-error STS image cannot be used where LLM is expected
    const _invalidRole: KeysByRole<"llm"> = TEMPLATES["openai-realtime"].images.sts;
  });

  it("image keys referenced by templates are valid ImageKey values", () => {
    function acceptImageKey(_k: ImageKey): void {}

    // STS templates
    acceptImageKey(TEMPLATES["openai-realtime"].images.sts);
    acceptImageKey(TEMPLATES.ultravox.images.sts);
    acceptImageKey(TEMPLATES["gemini-sts"].images.sts);
    acceptImageKey(TEMPLATES["deepgram-sts"].images.sts);
    acceptImageKey(TEMPLATES["elevenlabs-sts"].images.sts);

    // Modular optional roles
    acceptImageKey(TEMPLATES.openai.images.asr);
    acceptImageKey(TEMPLATES.openai.images.tts);
    acceptImageKey(TEMPLATES.openai.images.llm);

    acceptImageKey(TEMPLATES.google.images.asr);
    acceptImageKey(TEMPLATES.google.images.tts);

    acceptImageKey(TEMPLATES.deepgram.images.asr);

    acceptImageKey(TEMPLATES.vosk.images.asr);
    acceptImageKey(TEMPLATES.vosk.images.tts);
    acceptImageKey(TEMPLATES.vosk.images.llm);

    acceptImageKey(TEMPLATES.n8n.images.asr);
    acceptImageKey(TEMPLATES.n8n.images.tts);
    acceptImageKey(TEMPLATES.n8n.images.llm);
  });
});
