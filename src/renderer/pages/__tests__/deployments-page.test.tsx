import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DeploymentsApi,
  DeploymentsDeleteResponse,
  DeploymentsDuplicateResponse,
  DeploymentsListItem,
  DeploymentsListResponse,
  DeploymentsUpdateResponse,
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
    fireEvent.click(renameButtons[0]);
    const input = await screen.findByDisplayValue("One");
    fireEvent.change(input, { target: { value: "One Renamed" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(window.deployments?.update).toHaveBeenCalledWith({ id: "1", name: "One Renamed" }));
    await waitFor(() => expect(window.deployments?.list).toHaveBeenCalledTimes(2));
  });

  it("duplicates a deployment", async () => {
    render(<DeploymentsPage />);
    const duplicateButtons = await screen.findAllByText("Duplicate");
    fireEvent.click(duplicateButtons[0]);
    await waitFor(() => expect(window.deployments?.duplicate).toHaveBeenCalledWith({ id: "1", name: "One Copy" }));
  });

  it("deletes a deployment", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DeploymentsPage />);
    const deleteButtons = await screen.findAllByText("Delete");
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(window.deployments?.delete).toHaveBeenCalledWith({ id: "1" }));
    confirmSpy.mockRestore();
  });
});
