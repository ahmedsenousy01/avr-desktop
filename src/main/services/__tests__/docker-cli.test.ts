import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

// Create a hoisted mock for node:child_process so ESM import bindings are overridden
const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  default: { spawn: spawnMock },
  spawn: spawnMock,
}));

// Helper to stub spawn per test
function setSpawnImpl(impl: (cmd: string, args: string[]) => ChildProcess | unknown): void {
  spawnMock.mockImplementation((cmd: string, args: string[]) => impl(cmd, args) as unknown as ChildProcess);
}

// Import after mocking so module under test receives the mocked spawn
const { checkDockerAvailable, DockerError, runDocker } = await import("../docker-cli");

function createMockChild({
  stdoutData = "",
  stderrData = "",
  exitCode = 0,
  delayMs = 0,
  errorOnStart = false,
}: {
  stdoutData?: string;
  stderrData?: string;
  exitCode?: number;
  delayMs?: number;
  errorOnStart?: boolean;
}) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const listeners: Record<"error" | "close", ((arg?: unknown) => void)[]> = { error: [], close: [] };
  const child = {
    stdout,
    stderr,
    on: (event: "error" | "close", cb: (arg?: unknown) => void) => {
      listeners[event].push(cb);
      return child;
    },
    kill: () => undefined,
  };

  if (errorOnStart) {
    queueMicrotask(() => {
      for (const cb of listeners.error) cb(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    });
    return child;
  }

  if (delayMs <= 0) {
    queueMicrotask(() => {
      if (stdoutData) stdout.write(stdoutData);
      stdout.end();
      if (stderrData) stderr.write(stderrData);
      stderr.end();
      for (const cb of listeners.close) cb(exitCode);
    });
  } else {
    setTimeout(() => {
      if (stdoutData) stdout.write(stdoutData);
      stdout.end();
      if (stderrData) stderr.write(stderrData);
      stderr.end();
      for (const cb of listeners.close) cb(exitCode);
    }, delayMs);
  }

  return child;
}

describe("runDocker", () => {
  afterEach(() => {
    spawnMock.mockReset();
    vi.useRealTimers();
  });

  it("resolves with stdout/stderr on success", async () => {
    setSpawnImpl(() => createMockChild({ stdoutData: "ok\n", stderrData: "" }));
    const res = await runDocker(["ps"], { timeoutMs: 1000 });
    expect(res.stdout).toContain("ok");
    expect(res.exitCode).toBe(0);
  });

  it("rejects with DockerError on non-zero exit", async () => {
    setSpawnImpl(() => createMockChild({ stderrData: "boom", exitCode: 125 }));
    await expect(runDocker(["ps"], { timeoutMs: 1000 })).rejects.toBeInstanceOf(DockerError);
  });

  it("rejects on timeout", async () => {
    vi.useFakeTimers();
    setSpawnImpl(() => createMockChild({ delayMs: 10_000 }));
    const p = runDocker(["ps"], { timeoutMs: 5 });
    vi.advanceTimersByTime(10);
    await expect(p).rejects.toThrow(/timed out/i);
  });
});

describe("checkDockerAvailable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns available with parsed version", async () => {
    setSpawnImpl(() => createMockChild({ stdoutData: "25.0.3\n" }));
    const res = await checkDockerAvailable(1000);
    expect(res.available).toBe(true);
    expect(res.version).toBe("25.0.3");
  });

  it("returns not available when CLI missing", async () => {
    setSpawnImpl(() => createMockChild({ errorOnStart: true }));
    const res = await checkDockerAvailable(1000);
    expect(res.available).toBe(false);
    expect(res.message).toMatch(/not found/i);
  });

  it("returns not available when daemon not running", async () => {
    setSpawnImpl(() =>
      createMockChild({ stderrData: "error during connect: cannot connect to the Docker daemon", exitCode: 1 })
    );
    const res = await checkDockerAvailable(1000);
    expect(res.available).toBe(false);
    expect(res.message).toMatch(/daemon/i);
  });

  it("returns not available on timeout", async () => {
    vi.useFakeTimers();
    setSpawnImpl(() => createMockChild({ delayMs: 10_000 }));
    const p = checkDockerAvailable(5);
    vi.advanceTimersByTime(10);
    const res = await p;
    expect(res.available).toBe(false);
    expect(res.message).toMatch(/timed out/i);
  });
});
