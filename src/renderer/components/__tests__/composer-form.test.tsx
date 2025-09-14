import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComposerForm } from "../composer-form";

afterEach(() => {
  cleanup();
});

describe("ComposerForm", () => {
  it("disables submit until required selections are made (modular)", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { getByRole, getByLabelText } = render(
      <ComposerForm
        mode="modular"
        // @ts-expect-error - intentional test
        value={{ llm: undefined, asr: undefined, tts: undefined }}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );
    const submit = getByRole("button", { name: /create deployment/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(getByLabelText(/llm/i), { target: { value: "openai" } });
    fireEvent.change(getByLabelText(/asr/i), { target: { value: "deepgram" } });
    fireEvent.change(getByLabelText(/tts/i), { target: { value: "elevenlabs" } });
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("disables submit until sts is selected (sts mode)", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { getByRole } = render(
      <ComposerForm
        mode="sts"
        // @ts-expect-error - intentional test
        value={{ sts: undefined }}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );
    const submit = getByRole("button", { name: /create deployment/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
