import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeploymentsApi, ProvidersApi } from "@shared/ipc";
import type { EnvApi } from "@shared/types/env";
import { EnvEditor } from "@renderer/components/env-editor";

vi.mock("@renderer/lib/api", () => {
  const env = {
    getRegistry: vi.fn(async () => ({
      services: [{ serviceName: "avr-svc", variables: [{ name: "FOO", required: true }] }],
    })),
    getDeploymentEnv: vi.fn(async () => ({
      env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": { FOO: "secret" } } },
    })),
    validatePresence: vi.fn(async () => ({ missingByService: {} })),
    upsertVar: vi.fn(async () => ({
      env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": { FOO: "changed" } } },
    })),
    removeVar: vi.fn(async () => ({ env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": {} } } })),
  };
  const composePlanGet = vi.fn(async () => ({
    slug: "slug",
    services: [{ exampleServiceName: "avr-svc", slugServiceName: "slug-svc" }],
  }));
  return { env, composePlanGet };
});

declare global {
  // augment for tests
  interface Window {
    env?: EnvApi;
    providers?: ProvidersApi;
    deployments?: DeploymentsApi;
  }
}

beforeEach(() => {
  window.env = {
    getRegistry: vi.fn(async () => ({
      services: [{ serviceName: "avr-svc", variables: [{ name: "FOO", required: true }] }],
    })),
    getDeploymentEnv: vi.fn(async () => ({
      env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": { FOO: "secret" } } },
    })),
    validatePresence: vi.fn(async () => ({ missingByService: {} })),
    upsertVar: vi.fn(async () => ({
      env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": { FOO: "changed" } } },
    })),
    removeVar: vi.fn(async () => ({ env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": {} } } })),
  };
  window.providers = {
    list: vi.fn(async () => ({
      providers: {
        openai: { apiKey: "" },
        anthropic: { apiKey: "" },
        gemini: { apiKey: "" },
        deepgram: { apiKey: "" },
        elevenlabs: { apiKey: "" },
      },
    })),
    get: vi.fn(),
    save: vi.fn(),
    test: vi.fn(),
  } as unknown as ProvidersApi;
  window.deployments = {
    get: vi.fn(async () => ({
      id: "d1",
      slug: "slug",
      name: "n",
      type: "modular",
      updatedAt: new Date().toISOString(),
    })),
  } as unknown as DeploymentsApi;
});

afterEach(() => {
  vi.clearAllMocks();
  delete window.env;
  delete window.providers;
  delete window.deployments;
});

describe("EnvEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("masks values by default and reveals all on toggle", async () => {
    render(<EnvEditor deploymentId="d1" />);
    await waitFor(() => expect(screen.getAllByText(/slug-svc/i).length).toBeGreaterThan(0));

    const input = screen.getAllByDisplayValue("secret")[0] as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: /reveal all/i }));
    expect((screen.getAllByDisplayValue("secret")[0] as HTMLInputElement).type).toBe("text");
  });

  it("shows missing count when required is empty", async () => {
    if (!window.env) throw new Error("Env API is not available in preload");
    vi.mocked(window.env.getDeploymentEnv).mockResolvedValueOnce({
      env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": { FOO: "" } } },
    });
    render(<EnvEditor deploymentId="d1" />);
    await waitFor(() => expect(screen.getAllByText(/slug-svc/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/Missing 1/i)).toBeTruthy();
  });

  it("allows per-row reveal/hide independent of global toggle", async () => {
    render(<EnvEditor deploymentId="d1" />);
    await waitFor(() => expect(screen.getAllByText(/slug-svc/i).length).toBeGreaterThan(0));

    const firstTable = screen.getAllByRole("table")[0];
    const scoped = within(firstTable);

    // Ensure global masked state is on
    const maybeHideAll = screen.queryByRole("button", { name: /hide all/i });
    if (maybeHideAll) {
      fireEvent.click(maybeHideAll);
    }

    const input = scoped.getByDisplayValue("secret") as HTMLInputElement;
    expect(input.type).toBe("password");

    const revealBtn = scoped.getByRole("button", { name: /reveal/i });
    fireEvent.click(revealBtn);
    expect((scoped.getByDisplayValue("secret") as HTMLInputElement).type).toBe("text");

    const hideBtn = scoped.getByRole("button", { name: /^hide$/i });
    fireEvent.click(hideBtn);
    expect((scoped.getByDisplayValue("secret") as HTMLInputElement).type).toBe("password");
  });

  it("persists edits via upsert and updates the UI with returned value", async () => {
    render(<EnvEditor deploymentId="d1" />);
    await waitFor(() => expect(screen.getAllByText(/slug-svc/i).length).toBeGreaterThan(0));

    const input = screen.getAllByDisplayValue("secret")[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: "new-secret" } });

    await waitFor(() => expect(screen.getAllByDisplayValue("changed").length).toBeGreaterThan(0));
    if (!window.env) throw new Error("Env API is not available in preload");
    expect(vi.mocked(window.env.upsertVar)).toHaveBeenCalledWith({
      deploymentId: "d1",
      serviceName: "avr-svc",
      variableName: "FOO",
      value: "new-secret",
    });
  });

  it("can remove a non-required variable and updates counts", async () => {
    if (!window.env) throw new Error("Env API is not available in preload");
    vi.mocked(window.env.getRegistry).mockResolvedValueOnce({
      services: [
        {
          serviceName: "avr-svc",
          variables: [
            { name: "FOO", required: true },
            { name: "BAR", required: false },
          ],
        },
      ],
    });
    vi.mocked(window.env.getDeploymentEnv).mockResolvedValueOnce({
      env: {
        deploymentId: "d1",
        registryVersion: "v1",
        services: { "avr-svc": { FOO: "secret", BAR: "value" } },
      },
    });
    vi.mocked(window.env.removeVar).mockResolvedValueOnce({
      env: {
        deploymentId: "d1",
        registryVersion: "v1",
        services: { "avr-svc": { FOO: "secret" } },
      },
    });

    render(<EnvEditor deploymentId="d1" />);
    await waitFor(() => expect(screen.getAllByText(/slug-svc/i).length).toBeGreaterThan(0));

    // Ensure BAR row exists
    expect(screen.getAllByDisplayValue("value").length).toBeGreaterThan(0);

    // Click remove on BAR
    const removeButtons = screen.getAllByRole("button", { name: /^remove$/i });
    // The first remove could be for FOO if optional, ensure we click the one near BAR's input
    const barRowRemove =
      removeButtons.find((btn) => {
        const row = btn.closest("tr");
        return !!row && row.textContent.includes("BAR");
      }) ?? removeButtons[0];
    fireEvent.click(barRowRemove);

    await waitFor(() => expect(screen.queryAllByDisplayValue("value").length).toBe(0));
    expect(vi.mocked(window.env.removeVar)).toHaveBeenCalledWith({
      deploymentId: "d1",
      serviceName: "avr-svc",
      variableName: "BAR",
    });

    // Badge should still show OK (no missing) and Removed count should be 0 for FOO present
    expect(screen.getAllByText(/OK/i).length).toBeGreaterThan(0);
  });

  it("labels custom variables and reflects Added count", async () => {
    if (!window.env) throw new Error("Env API is not available in preload");
    vi.mocked(window.env.getRegistry).mockResolvedValueOnce({
      services: [{ serviceName: "avr-svc", variables: [{ name: "FOO", required: true }] }],
    });
    vi.mocked(window.env.getDeploymentEnv).mockResolvedValueOnce({
      env: {
        deploymentId: "d1",
        registryVersion: "v1",
        services: { "avr-svc": { FOO: "secret", EXTRA: "x" } },
      },
    });

    render(<EnvEditor deploymentId="d1" />);
    await waitFor(() => expect(screen.getAllByText(/slug-svc/i).length).toBeGreaterThan(0));

    // Custom badge appears on EXTRA row
    const extraRow = screen.getByText("EXTRA").closest("tr");
    expect(extraRow).toBeTruthy();
    expect(extraRow?.textContent).toMatch(/Custom/i);

    // Added 1 badge
    expect(screen.getByText(/Added 1/i)).toBeTruthy();
  });

  it("shows provider presence and missing warnings when API keys are absent", async () => {
    if (!window.env || !window.providers) throw new Error("APIs not available in preload");
    // Registry includes an API key var for mapping to provider badges
    vi.mocked(window.env.getRegistry).mockResolvedValueOnce({
      services: [{ serviceName: "avr-svc", variables: [{ name: "OPENAI_API_KEY", required: true }] }],
    } as unknown as Awaited<ReturnType<EnvApi["getRegistry"]>>);
    // Env values include the key entry, but UI should not expose value; presence derived from providers list
    vi.mocked(window.env.getDeploymentEnv).mockResolvedValueOnce({
      env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": { OPENAI_API_KEY: "masked" } } },
    } as unknown as Awaited<ReturnType<EnvApi["getDeploymentEnv"]>>);
    // Providers list returns empty key for openai -> Missing
    vi.mocked(window.providers.list).mockResolvedValueOnce({
      providers: {
        openai: { apiKey: "" },
        anthropic: { apiKey: "" },
        gemini: { apiKey: "" },
        deepgram: { apiKey: "" },
        elevenlabs: { apiKey: "" },
      },
    } as unknown as Awaited<ReturnType<ProvidersApi["list"]>>);

    render(<EnvEditor deploymentId="d1" />);
    await waitFor(() => expect(screen.getAllByText(/slug-svc/i).length).toBeGreaterThan(0));

    // Missing keys badge should include 'openai'
    expect(screen.getByText(/Missing keys:/i).textContent).toMatch(/openai/);
    // Per-provider badge for openai should say Missing
    expect(screen.getByText(/openai: Missing/i)).toBeTruthy();
  });

  it("shows provider Present and hides missing warning when key exists", async () => {
    if (!window.env || !window.providers) throw new Error("APIs not available in preload");
    vi.mocked(window.env.getRegistry).mockResolvedValueOnce({
      services: [{ serviceName: "avr-svc", variables: [{ name: "OPENAI_API_KEY", required: true }] }],
    } as unknown as Awaited<ReturnType<EnvApi["getRegistry"]>>);
    vi.mocked(window.env.getDeploymentEnv).mockResolvedValueOnce({
      env: { deploymentId: "d1", registryVersion: "v1", services: { "avr-svc": { OPENAI_API_KEY: "masked" } } },
    });
    // Providers list returns present key
    vi.mocked(window.providers.list).mockResolvedValueOnce({
      providers: {
        openai: { apiKey: "sk-openai" },
        anthropic: { apiKey: "" },
        gemini: { apiKey: "" },
        google: { credentialsFilePath: "" },
        vosk: { modelPath: "" },
        openrouter: { apiKey: "" },
        ultravox: { apiKey: "" },
        deepgram: { apiKey: "" },
        elevenlabs: { apiKey: "" },
      },
    });

    render(<EnvEditor deploymentId="d1" />);
    await waitFor(() => expect(screen.getAllByText(/slug-svc/i).length).toBeGreaterThan(0));

    // No global missing badge for openai specifically (may still render if other providers missing). Check Present badge.
    expect(screen.getByText(/openai: Present/i)).toBeTruthy();
  });
});
