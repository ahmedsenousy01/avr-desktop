import type { TemplateMetaForUI } from "../templates-grid";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplatesGrid } from "../templates-grid";

afterEach(() => {
  cleanup();
});

function makeTemplates(): TemplateMetaForUI[] {
  return [
    {
      id: "openai",
      displayName: "OpenAI (Modular)",
      summary: "Modular pipeline using OpenAI for LLM stage.",
      badges: ["Modular", "LLM"],
      stackType: "modular",
    },
    {
      id: "openai-realtime",
      displayName: "OpenAI Realtime (STS)",
      summary: "STS stack using OpenAI Realtime bi-directional audio.",
      badges: ["STS"],
      stackType: "sts",
    },
  ];
}

describe("TemplatesGrid", () => {
  it("renders template cards with badges and summaries", () => {
    const templates = makeTemplates();
    const onCreate = vi.fn();
    const { getByText, getAllByText } = render(
      <TemplatesGrid
        templates={templates}
        onCreate={onCreate}
      />
    );

    // Titles
    expect(getByText("OpenAI (Modular)")).toBeTruthy();
    expect(getByText("OpenAI Realtime (STS)")).toBeTruthy();

    // Summaries
    expect(getByText(/Modular pipeline using OpenAI/)).toBeTruthy();
    expect(getByText(/STS stack using OpenAI Realtime/)).toBeTruthy();

    // Badges & type label
    expect(getByText("Modular")).toBeTruthy();
    expect(getByText("LLM")).toBeTruthy();
    expect(getAllByText("STS").length).toBeGreaterThan(0);
  });

  it("fires onCreate with the template id when Create is clicked", () => {
    const templates = makeTemplates();
    const onCreate = vi.fn();
    const { getByTestId } = render(
      <TemplatesGrid
        templates={templates}
        onCreate={onCreate}
      />
    );

    const btn = getByTestId("create-openai") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith("openai");
  });

  it("disables Create when isCreateDisabled is true", () => {
    const templates = makeTemplates();
    const onCreate = vi.fn();
    const { getByTestId } = render(
      <TemplatesGrid
        templates={templates}
        onCreate={onCreate}
        isCreateDisabled
      />
    );
    const btn = getByTestId("create-openai") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
