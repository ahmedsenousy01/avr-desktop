// @vitest-environment jsdom
import React, { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProviderForm } from "../provider-form";

const Harness: React.FC<{
  initialKey: string;
  onSave: () => Promise<void> | void;
  onCancel?: () => void;
  onTest: () => Promise<{ ok: boolean; message: string }>;
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
  const renderIntoDocument = (ui: React.ReactElement) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(ui);
    });
    return { container, root };
  };

  it("renders without crashing", () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const onTest = vi.fn().mockResolvedValue({ ok: true, message: "Key present" });

    const { root } = renderIntoDocument(
      <ProviderForm
        providerId="openai"
        apiKey=""
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
        onTest={onTest}
      />
    );

    // unmount to ensure no errors on cleanup
    root.unmount();
  });

  // Additional interaction tests can be added with React Testing Library for reliability

  it("calls onTest when Test is clicked", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    const onTest = vi.fn().mockResolvedValue({ ok: false, message: "Missing or empty apiKey" });

    const { container, root } = renderIntoDocument(
      <ProviderForm
        providerId="openai"
        apiKey=""
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
        onTest={onTest}
      />
    );
    await Promise.resolve();
    const buttons = Array.from(container.querySelectorAll("button"));
    const testButton = buttons.find((b) => (b as HTMLButtonElement).textContent.includes("Test"));
    expect(testButton).toBeTruthy();
    if (testButton) {
      testButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    await Promise.resolve();
    expect(onTest).toHaveBeenCalledTimes(1);
    root.unmount();
  });

  it("invokes onChange when input value changes", async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onTest = vi.fn().mockResolvedValue({ ok: true, message: "Key present" });

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
    const onTest = vi.fn().mockResolvedValue({ ok: true, message: "Key present" });

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
