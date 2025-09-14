import { spawn } from "node:child_process";

export interface RunDockerOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number; // default 10s
}

export interface DockerResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class DockerError extends Error {
  exitCode: number;
  stderr: string;
  constructor(message: string, exitCode: number, stderr: string) {
    super(message);
    this.name = "DockerError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export async function runDocker(args: string[], opts?: RunDockerOptions): Promise<DockerResult> {
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  return await new Promise<DockerResult>((resolve, reject) => {
    let settled = false;
    const child = spawn("docker", args, {
      cwd: opts?.cwd,
      env: opts?.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      reject(new Error(`docker ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const exitCode = code ?? 0;
      if (exitCode !== 0) {
        reject(new DockerError(`docker ${args.join(" ")} failed with code ${exitCode}`, exitCode, stderr.trim()));
      } else {
        resolve({ stdout, stderr, exitCode });
      }
    });
  });
}

export interface DockerAvailability {
  available: boolean;
  version?: string;
  message?: string;
}

export async function checkDockerAvailable(timeoutMs = 5_000): Promise<DockerAvailability> {
  try {
    const { stdout } = await runDocker(["version", "--format", "{{.Server.Version}}"], { timeoutMs });
    const version = stdout.trim();
    if (version.length === 0) {
      return { available: false, message: "Docker responded without a server version" };
    }
    return { available: true, version };
  } catch (err: unknown) {
    const message = getFriendlyDockerErrorMessage(err);
    return { available: false, message };
  }
}

function hasErrorCode(value: unknown): value is { code?: unknown } {
  return typeof value === "object" && value !== null && "code" in (value as Record<string, unknown>);
}

function getFriendlyDockerErrorMessage(err: unknown): string {
  if (hasErrorCode(err) && (err as { code?: unknown }).code === "ENOENT") {
    return "Docker CLI not found in PATH";
  }
  if (err instanceof DockerError) {
    const stderr = err.stderr.toLowerCase();
    if (stderr.includes("cannot connect to the docker daemon") || stderr.includes("error during connect")) {
      return "Docker daemon is not running or not reachable";
    }
    return `Docker error: ${err.stderr || err.message}`.trim();
  }
  if (err instanceof Error) {
    if (/timed out/i.test(err.message)) return err.message;
    return `Failed to run docker: ${err.message}`;
  }
  return "Unknown error while checking Docker availability";
}
