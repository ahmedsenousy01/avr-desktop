import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeploymentRunPanel } from "../deployment-run-panel";

vi.mock("@renderer/lib/api", async () => {
  return {
    composeGenerate: vi.fn(async () => ({ filePath: "/tmp/docker-compose.yml", changed: true, services: [] })),
    composeUp: vi.fn(async () => ({ services: ["svc1"], stdout: "started" })),
    composeDown: vi.fn(async () => ({ services: ["svc1"], stdout: "stopped" })),
    composeStatus: vi.fn(async () => ({
      services: [
        { service: "dep-asterisk", state: "running", health: "healthy", containerId: "abcd1234", role: "pbx" },
      ],
    })),
    composeLogsStart: vi.fn(async () => ({ subscriptionId: "sub_1" })),
    composeLogsStop: vi.fn(async () => ({ stopped: true })),
  };
});

type ComposeEvents = {
  onLogsData: (cb: (payload: unknown) => void) => void;
  onLogsClosed: (cb: (payload: unknown) => void) => void;
};

declare global {
  interface Window {
    composeEvents?: ComposeEvents;
  }
}

describe("DeploymentRunPanel", () => {
  let emitLogsData: ((payload: unknown) => void) | null = null;
  let _emitLogsClosed: ((payload: unknown) => void) | null = null;

  beforeEach(() => {
    window.composeEvents = {
      onLogsData: (cb) => {
        emitLogsData = cb;
      },
      onLogsClosed: (cb) => {
        _emitLogsClosed = cb;
      },
    } satisfies ComposeEvents;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.composeEvents = undefined;
    emitLogsData = null;
    _emitLogsClosed = null;
  });

  it("renders status table from composeStatus", async () => {
    render(<DeploymentRunPanel deploymentId="dep_1" />);
    expect(await screen.findByText("Status")).toBeTruthy();
    const table = await screen.findByRole("table");
    expect(await within(table).findByText("dep-asterisk")).toBeTruthy();
    expect(await screen.findByText(/Running 1\/1/)).toBeTruthy();
  });

  it("follows and stops logs, rendering chunks", async () => {
    render(<DeploymentRunPanel deploymentId="dep_1" />);

    const followBtn = await screen.findByRole("button", { name: /Follow Logs/i });
    await userEvent.click(followBtn);

    await waitFor(() => expect(emitLogsData).toBeTruthy());
    emitLogsData?.({ subscriptionId: "sub_1", chunk: "hello" });
    expect(await screen.findByText("hello")).toBeTruthy();

    const stopBtn = await screen.findByRole("button", { name: /Stop Logs/i });
    await userEvent.click(stopBtn);
    await waitFor(() => expect(screen.getByRole("button", { name: /Follow Logs/i })).toBeTruthy());
  });

  it("generates compose and shows message", async () => {
    render(<DeploymentRunPanel deploymentId="dep_1" />);
    const genBtn = await screen.findByRole("button", { name: /Generate/i });
    await userEvent.click(genBtn);
    expect(await screen.findByText(/docker-compose.yml/)).toBeTruthy();
  });

  it("shows remediation hints when docker is unavailable", async () => {
    const api = await import("@renderer/lib/api");
    vi.spyOn(api, "composeLogsStart").mockRejectedValueOnce(new Error("Docker daemon is not running or not reachable"));
    render(<DeploymentRunPanel deploymentId="dep_1" />);
    const followBtn = await screen.findByRole("button", { name: /Follow Logs/i });
    await userEvent.click(followBtn);
    expect(await screen.findByText(/Docker daemon not running/i)).toBeTruthy();
    expect(await screen.findByText(/Start Docker Desktop/i)).toBeTruthy();
  });
});
