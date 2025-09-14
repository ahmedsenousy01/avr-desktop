import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DeploymentsApi,
  DeploymentsDeleteResponse,
  DeploymentsDuplicateResponse,
  DeploymentsListItem,
  DeploymentsListResponse,
  DeploymentsUpdateResponse,
  PreflightApi,
  PreflightLastResponse,
} from "@shared/ipc";
import { DeploymentsPage } from "@renderer/pages/deployments-page";

const nowIso = new Date().toISOString();

describe("DeploymentsPage", () => {
  beforeEach(() => {
    const items: DeploymentsListItem[] = [
      { id: "1", slug: "one", name: "One", type: "modular", updatedAt: nowIso },
      { id: "2", slug: "two", name: "Two", type: "sts", updatedAt: nowIso },
    ];
    window.deployments = {
      createFromTemplate: vi.fn(async () => ({ id: "t", name: "t" })),
      createFromSelection: vi.fn(async () => ({ id: "s", name: "s" })),
      list: vi.fn(async (): Promise<DeploymentsListResponse> => ({ deployments: items })),
      update: vi.fn(async ({ id, name }): Promise<DeploymentsUpdateResponse> => ({ id, name: name ?? "" })),
      duplicate: vi.fn(
        async ({ id, name }): Promise<DeploymentsDuplicateResponse> => ({ id: id + "-copy", name: name ?? "Copy" })
      ),
      delete: vi.fn(async (): Promise<DeploymentsDeleteResponse> => ({ ok: true })),
    } satisfies DeploymentsApi;

    // Default: no prior preflight results
    window.preflight = {
      last: vi.fn(async (_req: { deploymentId: string }): Promise<PreflightLastResponse> => ({ result: null })),
      run: vi.fn(async () => ({
        result: {
          items: [],
          summary: {
            total: 0,
            pass: 0,
            warn: 0,
            fail: 0,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            durationMs: 0,
            overall: "pass",
          },
        },
      })),
    } as unknown as PreflightApi;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders list and actions", async () => {
    render(<DeploymentsPage />);
    expect(await screen.findByText("Deployments")).toBeTruthy();
    expect(await screen.findByText("One")).toBeTruthy();
    expect(await screen.findByText("Two")).toBeTruthy();
    expect(screen.getAllByText("Rename").length).toBeGreaterThan(0);
  });

  it("renames a deployment", async () => {
    render(<DeploymentsPage />);
    const renameButtons = await screen.findAllByText("Rename");
    await userEvent.click(renameButtons[0]);
    const input = (await screen.findByDisplayValue("One")) as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, "One Renamed");
    await userEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(window.deployments?.update).toHaveBeenCalledWith({ id: "1", name: "One Renamed" }));
    await waitFor(() => expect(window.deployments?.list).toHaveBeenCalledTimes(2));
  });

  it("duplicates a deployment", async () => {
    render(<DeploymentsPage />);
    const duplicateButtons = await screen.findAllByText("Duplicate");
    await userEvent.click(duplicateButtons[0]);
    await waitFor(() => expect(window.deployments?.duplicate).toHaveBeenCalledWith({ id: "1", name: "One Copy" }));
  });

  it("deletes a deployment", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DeploymentsPage />);
    const deleteButtons = await screen.findAllByText("Delete");
    await userEvent.click(deleteButtons[0]);
    await waitFor(() => expect(window.deployments?.delete).toHaveBeenCalledWith({ id: "1" }));
    confirmSpy.mockRestore();
  });

  it("gates Start button based on preflight status", async () => {
    // Fail for id=1, Pass for id=2
    (window.preflight as unknown as PreflightApi).last = vi.fn(async ({ deploymentId }: { deploymentId: string }) => {
      if (deploymentId === "1") {
        return {
          result: {
            items: [{ id: "x", title: "fail", severity: "fail", message: "f" }],
            summary: {
              total: 1,
              pass: 0,
              warn: 0,
              fail: 1,
              startedAt: Date.now(),
              finishedAt: Date.now(),
              durationMs: 5,
              overall: "fail",
            },
          },
        };
      }
      return {
        result: {
          items: [{ id: "y", title: "ok", severity: "pass", message: "ok" }],
          summary: {
            total: 1,
            pass: 1,
            warn: 0,
            fail: 0,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            durationMs: 5,
            overall: "pass",
          },
        },
      };
    }) as unknown as PreflightApi["last"];

    render(<DeploymentsPage />);
    // Two Start buttons: first disabled, second enabled
    const startButtons = await screen.findAllByText("Start");
    expect((startButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((startButtons[1] as HTMLButtonElement).disabled).toBe(false);
  });
});
