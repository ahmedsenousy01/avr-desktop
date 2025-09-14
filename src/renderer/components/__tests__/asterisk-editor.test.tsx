import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    const rtpStart = await screen.findByLabelText("RTP Start");
    const rtpEnd = await screen.findByLabelText("RTP End");

    fireEvent.change(rtpStart, { target: { value: "20000" } });
    fireEvent.change(rtpEnd, { target: { value: "10000" } });

    await waitFor(() => {
      expect(screen.getByText("rtpEnd must be greater than or equal to rtpStart")).toBeTruthy();
    });
  });

  it("opens preview modal and shows rendered file names", async () => {
    render(<AsteriskEditor />);
    fireEvent.click(screen.getByText("Preview"));
    await waitFor(() => expect(window.asterisk?.renderConfig).toHaveBeenCalled());
    expect(await screen.findByText("pjsip.conf")).toBeTruthy();
  });
});
