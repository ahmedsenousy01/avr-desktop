import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeploymentsApi, DeploymentsListItem, DeploymentsListResponse } from "@shared/ipc";

import "@renderer/lib/api";

import { AsteriskPage } from "@renderer/pages/asterisk-page";

const nowIso = new Date().toISOString();

describe("AsteriskPage", () => {
  beforeEach(() => {
    const items: DeploymentsListItem[] = [
      { id: "1", slug: "one", name: "One", type: "modular", updatedAt: nowIso },
      { id: "2", slug: "two", name: "Two", type: "sts", updatedAt: nowIso },
    ];
    window.deployments = {
      createFromTemplate: vi.fn(async () => ({ id: "t", name: "t" })),
      createFromSelection: vi.fn(async () => ({ id: "s", name: "s" })),
      get: vi.fn(async ({ id }) => {
        const base = items.find((d) => d.id === id) ?? items[0];
        return {
          id: base.id,
          name: base.name,
          slug: base.slug,
          type: base.type,
          asterisk: undefined,
          updatedAt: base.updatedAt,
        };
      }),
      list: vi.fn(async (): Promise<DeploymentsListResponse> => ({ deployments: items })),
      update: vi.fn(async ({ id, name }) => ({ id, name: name ?? "" })),
      duplicate: vi.fn(async ({ id, name }) => ({ id: id + "-copy", name: name ?? "Copy" })),
      delete: vi.fn(async () => ({ ok: true })),
    } satisfies DeploymentsApi;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders deployment selector and editor", async () => {
    render(<AsteriskPage />);
    expect(await screen.findByText("Asterisk Configuration")).toBeTruthy();
    await waitFor(() => expect(window.deployments?.list).toHaveBeenCalled());
    expect(await screen.findByLabelText("Deployment")).toBeTruthy();
    expect(await screen.findByLabelText("External IP")).toBeTruthy();
  });
});
