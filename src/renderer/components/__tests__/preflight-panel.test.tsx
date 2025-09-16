import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PreflightApi, PreflightFixResponse, PreflightLastResponse, PreflightRunResponse } from "@shared/ipc";

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
      fix: vi.fn().mockResolvedValue({ fixed: true } as PreflightFixResponse),
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

  it("shows docker ports remediation with auto-fix and reruns", async () => {
    const last: PreflightLastResponse = { result: null };
    const run1: PreflightRunResponse = {
      result: {
        items: [
          {
            id: "docker:ports:conflicts",
            title: "Docker port mapping conflicts detected",
            severity: "fail",
            message: "Found 1 Docker port mapping(s) conflicting with planned ports",
            data: {
              sipPort: 5060,
              rtpRange: { start: 10000, end: 10010 },
              conflicts: [{ container: "foo", hostPort: 5060, protocol: "tcp" }],
            },
          },
        ],
        summary: {
          total: 1,
          pass: 0,
          warn: 0,
          fail: 1,
          startedAt: Date.now(),
          finishedAt: Date.now(),
          durationMs: 0,
          overall: "fail",
        },
      },
    };
    const run2: PreflightRunResponse = {
      result: {
        items: [
          { id: "docker:ports:none", title: "No Docker port mapping conflicts", severity: "pass", message: "ok" },
        ],
        summary: {
          total: 1,
          pass: 1,
          warn: 0,
          fail: 0,
          startedAt: Date.now(),
          finishedAt: Date.now(),
          durationMs: 0,
          overall: "pass",
        },
      },
    };

    const runMock = vi.fn().mockResolvedValueOnce(run1).mockResolvedValueOnce(run2);
    const fixMock = vi.fn().mockResolvedValue({ fixed: true } satisfies PreflightFixResponse);

    window.preflight = {
      last: vi.fn().mockResolvedValue(last),
      run: runMock,
      fix: fixMock,
    } as unknown as PreflightApi;

    render(<PreflightPanel deploymentId="dep_fix" />);

    // Run once to get conflicts
    const runBtn = await screen.findByRole("button", { name: /Run Preflight/i });
    await userEvent.click(runBtn);
    expect(await screen.findByText(/Docker port mapping conflicts detected/i)).toBeTruthy();

    // Click Auto-fix, then it should rerun and show pass
    const fixBtn = await screen.findByRole("button", { name: /Auto-fix/i });
    await userEvent.click(fixBtn);

    expect(fixMock).toHaveBeenCalledWith({ deploymentId: "dep_fix", itemId: "docker:ports:conflicts" });
    expect(runMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/No Docker port mapping conflicts/i)).toBeTruthy();
  });

  it("shows docker unavailable remediation and retries", async () => {
    const last: PreflightLastResponse = { result: null };
    const run1: PreflightRunResponse = {
      result: {
        items: [
          { id: "docker:available:nok", title: "Docker is not available", severity: "fail", message: "not running" },
        ],
        summary: { total: 1, pass: 0, warn: 0, fail: 1, startedAt: 0, finishedAt: 0, durationMs: 0, overall: "fail" },
      },
    };
    const run2: PreflightRunResponse = {
      result: {
        items: [{ id: "docker:available:ok", title: "Docker is available", severity: "pass", message: "ok" }],
        summary: { total: 1, pass: 1, warn: 0, fail: 0, startedAt: 0, finishedAt: 0, durationMs: 0, overall: "pass" },
      },
    };

    const runMock = vi.fn().mockResolvedValueOnce(run1).mockResolvedValueOnce(run2);

    window.preflight = {
      last: vi.fn().mockResolvedValue(last),
      run: runMock,
      fix: vi.fn().mockResolvedValue({ fixed: false } as PreflightFixResponse),
    } as unknown as PreflightApi;

    render(<PreflightPanel deploymentId="dep_docker_unavailable" />);

    const runBtn = await screen.findByRole("button", { name: /Run Preflight/i });
    await userEvent.click(runBtn);
    const notAvail = await screen.findAllByText(/Docker is not available/i);
    expect(notAvail.length).toBeGreaterThan(0);

    const retryBtn = await screen.findByRole("button", { name: /Retry Preflight/i });
    await userEvent.click(retryBtn);
    expect(runMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Docker is available/i)).toBeTruthy();
  });

  it("cleans up docker name collisions via fix and reruns", async () => {
    const last: PreflightLastResponse = { result: null };
    const run1: PreflightRunResponse = {
      result: {
        items: [
          {
            id: "docker:names:collisions",
            title: "Docker name collisions detected",
            severity: "fail",
            message: "Found 2",
            data: { containers: ["a"], networks: ["b"], volumes: [] },
          },
        ],
        summary: { total: 1, pass: 0, warn: 0, fail: 1, startedAt: 0, finishedAt: 0, durationMs: 0, overall: "fail" },
      },
    };
    const run2: PreflightRunResponse = {
      result: {
        items: [{ id: "docker:names:none", title: "No Docker name collisions", severity: "pass", message: "ok" }],
        summary: { total: 1, pass: 1, warn: 0, fail: 0, startedAt: 0, finishedAt: 0, durationMs: 0, overall: "pass" },
      },
    };

    const runMock = vi.fn().mockResolvedValueOnce(run1).mockResolvedValueOnce(run2);
    const fixMock = vi.fn().mockResolvedValue({ fixed: true } satisfies PreflightFixResponse);

    window.preflight = {
      last: vi.fn().mockResolvedValue(last),
      run: runMock,
      fix: fixMock,
    } as unknown as PreflightApi;

    render(<PreflightPanel deploymentId="dep_names" />);

    const runBtn = await screen.findByRole("button", { name: /Run Preflight/i });
    await userEvent.click(runBtn);
    expect(await screen.findByText(/Docker name collisions detected/i)).toBeTruthy();

    const cleanupBtn = await screen.findByRole("button", { name: /Clean up matching Docker resources/i });
    await userEvent.click(cleanupBtn);

    expect(fixMock).toHaveBeenCalledWith({ deploymentId: "dep_names", itemId: "docker:names:collisions" });
    expect(runMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/No Docker name collisions/i)).toBeTruthy();
  });
});
