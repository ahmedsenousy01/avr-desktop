// @vitest-environment jsdom
import type { ValidationResult } from "../provider-form";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProviderForm } from "../provider-form";

const Harness: React.FC<{
  initialKey: string;
  onSave: () => Promise<void> | void;
  onCancel?: () => void;
  onTest: (keyToTest: string) => Promise<ValidationResult>;
  onChangeSpy?: (v: string) => void;
}> = ({ initialKey, onSave, onCancel, onTest, onChangeSpy }) => {
  const [key, setKey] = React.useState(initialKey);
  return (
    <ProviderForm
      providerId="openai"
      apiKey={key}
      onChange={(v) => {
        setKey(v);
        onChangeSpy?.(v);
      }}
      onSave={onSave}
      onCancel={onCancel ?? (() => {})}
      onTest={onTest}
    />
  );
};

describe("ProviderForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders without crashing", () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const onTest = vi.fn(
      async (_key: string) => ({ ok: true, message: "Key present", validationType: "presence" }) as ValidationResult
    );
    const { unmount } = render(
      <ProviderForm
        providerId="openai"
        apiKey=""
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
        onTest={onTest}
      />
    );
    unmount();
  });

  // Additional interaction tests can be added with React Testing Library for reliability

  it("calls onTest when Test is clicked", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const onTest = vi.fn(
      async (_key: string) =>
        ({ ok: false, message: "Missing or empty apiKey", validationType: "presence" }) as ValidationResult
    );
    render(
      <ProviderForm
        providerId="openai"
        apiKey=""
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
        onTest={onTest}
      />
    );
    const testButton = await screen.findByRole("button", { name: /test/i });
    await userEvent.click(testButton);
    expect(onTest).toHaveBeenCalledTimes(1);
  });

  it("invokes onChange when input value changes", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onTest = vi.fn(
      async (_key: string) => ({ ok: true, message: "Key present", validationType: "presence" }) as ValidationResult
    );

    render(
      <Harness
        initialKey=""
        onSave={onSave}
        onTest={onTest}
        onChangeSpy={onChange}
      />
    );
    const input = screen.getByLabelText(/api key/i) as HTMLInputElement;
    await userEvent.type(input, "abc");
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("enables Save when dirty and calls onSave on click", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onTest = vi.fn(
      async (_key: string) => ({ ok: true, message: "Key present", validationType: "presence" }) as ValidationResult
    );

    render(
      <Harness
        initialKey="initial"
        onSave={onSave}
        onTest={onTest}
      />
    );
    const input = screen.getByLabelText(/api key/i) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "changed");
    const saveButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
