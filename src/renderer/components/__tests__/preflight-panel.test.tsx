import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PreflightApi, PreflightLastResponse, PreflightRunResponse } from "@shared/ipc";

import { PreflightPanel } from "../preflight-panel";

declare global {
  interface Window {
    preflight?: PreflightApi;
  }
}

afterEach(() => {
  cleanup();
  (window as unknown as { preflight?: PreflightApi }).preflight = undefined;
});

describe("PreflightPanel", () => {
  it("renders empty state then results after run", async () => {
    const last: PreflightLastResponse = { result: null };
    const run: PreflightRunResponse = {
      result: {
        items: [
          { id: "provider:openai:apiKey", title: "OpenAI API Key", severity: "fail", message: "missing" },
          { id: "docker:available:ok", title: "Docker is available", severity: "pass", message: "ok" },
        ],
        summary: {
          total: 2,
          pass: 1,
          warn: 0,
          fail: 1,
          startedAt: Date.now(),
          finishedAt: Date.now(),
          durationMs: 0,
          overall: "fail",
        },
      },
    };

    window.preflight = {
      last: vi.fn().mockResolvedValue(last),
      run: vi.fn().mockResolvedValue(run),
    } as unknown as PreflightApi;

    render(<PreflightPanel deploymentId="dep_1" />);
    // empty state
    expect(await screen.findByText(/No preflight results yet/i)).toBeTruthy();

    // simulate click run
    const btn = await screen.findByRole("button", { name: /Run Preflight/i });
    await userEvent.click(btn);

    // results
    expect(await screen.findByText(/OpenAI API Key/i)).toBeTruthy();
    expect(await screen.findByText(/Docker is available/i)).toBeTruthy();
  });
});
