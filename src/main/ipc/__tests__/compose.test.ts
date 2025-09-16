import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ProvidersStoreModule from "@main/services/providers-store";
import { ComposeChannels } from "@shared/ipc";
import { DEFAULT_ASTERISK_CONFIG } from "@shared/types/asterisk";
import { createDeployment, updateDeployment } from "@main/services/deployments-store";
import * as dockerCli from "@main/services/docker-cli";
import * as store from "@main/services/providers-store";
import { setWorkspaceRootForTesting } from "@main/services/workspace-root";

import { registerComposeIpcHandlers } from "../compose";

type IpcHandler = (event: unknown, payload: unknown) => unknown | Promise<unknown>;
const handlers = new Map<string, IpcHandler>();
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    },
  },
  app: {
    getPath: () => os.tmpdir(),
  },
  __mockInvoke: async (channel: string, payload: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No handler for ${channel}`);
    return handler(undefined, payload);
  },
}));

vi.mock("@main/services/providers-store", async () => {
  const actual = await vi.importActual<typeof ProvidersStoreModule>("@main/services/providers-store");
  return {
    ...actual,
    readProviders: vi.fn(actual.readProviders),
  };
});

const invoke = async (channel: string, payload?: unknown) => {
  const electron = await import("electron");
  // @ts-expect-error mocked helper
  return electron.__mockInvoke(channel, payload);
};

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "avr-compose-ipc-test-"));
}

function rmDirRecursive(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

describe("compose IPC", () => {
  let tmpRoot: string;

  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    tmpRoot = mkTempDir();
    setWorkspaceRootForTesting(tmpRoot);
    registerComposeIpcHandlers();
  });

  it("compose:generate builds and writes docker-compose.yml and returns summary", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    await updateDeployment(dep.id, { asterisk: DEFAULT_ASTERISK_CONFIG });
    vi.mocked(store).readProviders.mockReturnValue({
      openai: { apiKey: "sk" },
      anthropic: { apiKey: "" },
      gemini: { apiKey: "" },
      deepgram: { apiKey: "sk" },
      elevenlabs: { apiKey: "sk" },
    });

    const res = (await invoke(ComposeChannels.generate, { deploymentId: dep.id })) as {
      filePath: string;
      changed: boolean;
      services: string[];
    };
    expect(res.filePath.endsWith("docker-compose.yml")).toBe(true);
    expect(res.changed).toBe(true);
    expect(res.services.length).toBeGreaterThan(0);
    const content = fs.readFileSync(res.filePath, "utf8");
    expect(content.includes(`${dep.slug}-asterisk`)).toBe(true);
  });

  it("compose:up runs docker compose up -d in deployment directory and returns services", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    await updateDeployment(dep.id, { asterisk: DEFAULT_ASTERISK_CONFIG });
    vi.mocked(store).readProviders.mockReturnValue({
      openai: { apiKey: "sk" },
      anthropic: { apiKey: "" },
      gemini: { apiKey: "" },
      deepgram: { apiKey: "sk" },
      elevenlabs: { apiKey: "sk" },
    });

    const runSpy = vi.spyOn(dockerCli, "runDocker").mockResolvedValue({ stdout: "done", stderr: "", exitCode: 0 });
    const res = (await invoke(ComposeChannels.up, { deploymentId: dep.id })) as {
      services: string[];
      stdout: string;
    };
    expect(res.services.length).toBeGreaterThan(0);
    expect(res.stdout).toContain("done");
    expect(runSpy).toHaveBeenCalled();
    const args = runSpy.mock.calls[0][0] as string[];
    const opts = runSpy.mock.calls[0][1] as { cwd?: string };
    expect(args).toEqual(["compose", "up", "-d"]);
    expect(Boolean(opts.cwd) && typeof opts.cwd === "string").toBe(true);
  });

  it("compose:down runs docker compose down in deployment directory and returns services", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    await updateDeployment(dep.id, { asterisk: DEFAULT_ASTERISK_CONFIG });
    vi.mocked(store).readProviders.mockReturnValue({
      openai: { apiKey: "sk" },
      anthropic: { apiKey: "" },
      gemini: { apiKey: "" },
      deepgram: { apiKey: "sk" },
      elevenlabs: { apiKey: "sk" },
    });
    const runSpy = vi.spyOn(dockerCli, "runDocker").mockResolvedValue({ stdout: "down", stderr: "", exitCode: 0 });
    const res = (await invoke(ComposeChannels.down, { deploymentId: dep.id })) as {
      services: string[];
      stdout: string;
    };
    expect(res.services.length).toBeGreaterThan(0);
    expect(res.stdout).toContain("down");
    expect(runSpy).toHaveBeenCalled();
    const args = runSpy.mock.calls[0][0] as string[];
    const opts = runSpy.mock.calls[0][1] as { cwd?: string };
    expect(args).toEqual(["compose", "down"]);
    expect(Boolean(opts.cwd) && typeof opts.cwd === "string").toBe(true);
  });

  afterEach(() => {
    setWorkspaceRootForTesting(null);
    rmDirRecursive(tmpRoot);
  });

  it("compose:status returns unknown for services when docker ps json missing", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    await updateDeployment(dep.id, { asterisk: DEFAULT_ASTERISK_CONFIG });
    vi.mocked(store).readProviders.mockReturnValue({
      openai: { apiKey: "sk" },
      anthropic: { apiKey: "" },
      gemini: { apiKey: "" },
      deepgram: { apiKey: "sk" },
      elevenlabs: { apiKey: "sk" },
    });
    const res = (await invoke(ComposeChannels.status, { deploymentId: dep.id })) as {
      services: { service: string; state: string }[];
    };
    expect(Array.isArray(res.services)).toBe(true);
    expect(res.services.length).toBeGreaterThan(0);
    for (const s of res.services) {
      expect(["running", "exited", "unknown"]).toContain(s.state);
    }
  });

  it("compose:status enriches health via docker inspect when missing in ps", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    await updateDeployment(dep.id, { asterisk: DEFAULT_ASTERISK_CONFIG });
    vi.mocked(store).readProviders.mockReturnValue({
      openai: { apiKey: "sk" },
      anthropic: { apiKey: "" },
      gemini: { apiKey: "" },
      deepgram: { apiKey: "sk" },
      elevenlabs: { apiKey: "sk" },
    });

    const psJson = JSON.stringify([
      { Service: `${dep.slug}-core`, State: "running" },
      { Service: `${dep.slug}-asterisk`, State: "running" },
    ]);
    const inspectJson = JSON.stringify([
      { Name: `/${dep.slug}-core`, State: { Health: { Status: "healthy" } } },
      { Name: `/${dep.slug}-asterisk`, State: { Health: { Status: "unhealthy" } } },
    ]);

    const runSpy = vi.spyOn(dockerCli, "runDocker");
    runSpy.mockImplementationOnce(async () => ({ stdout: psJson, stderr: "", exitCode: 0 }));
    runSpy.mockImplementationOnce(async () => ({ stdout: inspectJson, stderr: "", exitCode: 0 }));

    const res = (await invoke(ComposeChannels.status, { deploymentId: dep.id })) as {
      services: { service: string; state: string; health?: string; role?: string }[];
    };
    const core = res.services.find((s) => s.service === `${dep.slug}-core`);
    const ast = res.services.find((s) => s.service === `${dep.slug}-asterisk`);
    if (!core || !ast) throw new Error("Expected services not found");
    expect(core.health).toBe("healthy");
    expect(ast.health).toBe("unhealthy");
    expect(core.role).toBe("core");
    expect(ast.role).toBe("asterisk");
  });

  it("compose:up maps DockerError to friendly message", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    vi.mocked(store).readProviders.mockReturnValue({
      openai: { apiKey: "sk" },
      anthropic: { apiKey: "" },
      gemini: { apiKey: "" },
      deepgram: { apiKey: "sk" },
      elevenlabs: { apiKey: "sk" },
    });
    vi.spyOn(dockerCli, "runDocker").mockRejectedValueOnce(
      new dockerCli.DockerError("failed", 1, "error during connect: cannot connect to the Docker daemon")
    );
    await expect(invoke(ComposeChannels.up, { deploymentId: dep.id })).rejects.toThrow(/daemon/i);
  });

  it("compose:logsStart returns an id and logsStop stops it", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    const cancel = vi.fn();
    vi.spyOn(dockerCli, "runDockerStream").mockReturnValue({
      cancel,
      on: vi.fn(),
      emit: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      once: vi.fn(),
      listeners: vi.fn(),
      listenerCount: vi.fn(),
      eventNames: vi.fn(),
    } as unknown as ReturnType<typeof dockerCli.runDockerStream>);
    const start = (await invoke(ComposeChannels.logsStart, { deploymentId: dep.id })) as { subscriptionId: string };
    expect(typeof start.subscriptionId).toBe("string");
    const stop = (await invoke(ComposeChannels.logsStop, { subscriptionId: start.subscriptionId })) as {
      stopped: boolean;
    };
    expect(stop.stopped).toBe(true);
    expect(cancel).toHaveBeenCalled();
  });

  it("compose:logsStart maps DockerError to friendly message", async () => {
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    // Simulate docker stream failing to start (daemon not reachable)
    vi.spyOn(dockerCli, "runDockerStream").mockImplementation(() => {
      throw new dockerCli.DockerError("failed", 1, "error during connect: cannot connect to the Docker daemon");
    });
    await expect(invoke(ComposeChannels.logsStart, { deploymentId: dep.id })).rejects.toThrow(
      /Docker daemon is not running or not reachable/i
    );
  });

  it("compose:statusStart emits statusUpdate events and statusStop cancels", async () => {
    vi.useFakeTimers();
    const dep = createDeployment({ type: "modular", providers: { llm: "openai", asr: "deepgram", tts: "elevenlabs" } });
    vi.mocked(store).readProviders.mockReturnValue({
      openai: { apiKey: "sk" },
      anthropic: { apiKey: "" },
      gemini: { apiKey: "" },
      deepgram: { apiKey: "sk" },
      elevenlabs: { apiKey: "sk" },
    });

    // Always return empty compose ps output
    vi.spyOn(dockerCli, "runDocker").mockResolvedValue({ stdout: "[]", stderr: "", exitCode: 0 });

    const startHandler = handlers.get(ComposeChannels.statusStart);
    if (!startHandler) throw new Error("statusStart handler not registered");
    const events: { channel: string; payload: unknown }[] = [];
    const mockEvent = {
      sender: { send: (channel: string, payload: unknown) => events.push({ channel, payload }) },
    } as unknown as { sender: { send: (channel: string, payload: unknown) => void } };
    const { subscriptionId } = (await startHandler(mockEvent, { deploymentId: dep.id, intervalMs: 500 })) as {
      subscriptionId: string;
    };

    vi.advanceTimersByTime(600);
    // Allow microtasks from async tick to settle
    await Promise.resolve();
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    const payload = last.payload as { subscriptionId?: string; services?: unknown };
    expect(typeof payload.subscriptionId).toBe("string");
    expect(payload.subscriptionId).toBe(subscriptionId);

    const stopHandler = handlers.get(ComposeChannels.statusStop);
    if (!stopHandler) throw new Error("statusStop handler not registered");
    const stopped = (await stopHandler(undefined as unknown as { sender: unknown }, { subscriptionId })) as {
      stopped: boolean;
    };
    expect(stopped.stopped).toBe(true);
    vi.useRealTimers();
  });
});
