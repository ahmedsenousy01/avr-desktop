import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AsteriskApi } from "@shared/ipc";

import "@renderer/lib/api";

import { AsteriskEditor } from "@renderer/components/asterisk-editor";

describe("AsteriskEditor", () => {
  beforeEach(() => {
    window.asterisk = {
      validateConfig: vi.fn(async () => ({ valid: true, errors: [] })),
      renderConfig: vi.fn(async () => ({ files: { "pjsip.conf": "allow=ulaw" } })),
    } satisfies AsteriskApi;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders fields and validates rtp range", async () => {
    render(<AsteriskEditor />);

    const rtpStart = (await screen.findByLabelText("RTP Start")) as HTMLInputElement;
    const rtpEnd = (await screen.findByLabelText("RTP End")) as HTMLInputElement;

    await userEvent.clear(rtpStart);
    await userEvent.type(rtpStart, "20000");
    await userEvent.clear(rtpEnd);
    await userEvent.type(rtpEnd, "10000");

    await waitFor(() => {
      expect(screen.getByText("rtpEnd must be greater than or equal to rtpStart")).toBeTruthy();
    });
  });

  it("opens preview modal and shows rendered file names", async () => {
    render(<AsteriskEditor />);
    await userEvent.click(await screen.findByText("Preview"));
    await waitFor(() => expect(window.asterisk?.renderConfig).toHaveBeenCalled());
    expect(await screen.findByText("pjsip.conf")).toBeTruthy();
  });
});
