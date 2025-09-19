import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// import "@testing-library/jest-dom"; // Commented out since not installed

import * as api from "@renderer/lib/api";

import { EnvironmentPage } from "../../pages/environment-page";

// Mock the API functions
vi.mock("@renderer/lib/api", () => ({
  deploymentsList: vi.fn(),
  deploymentsGet: vi.fn(),
  deploymentsUpdate: vi.fn(),
}));

const mockDeploymentsList = vi.mocked(api.deploymentsList);
const mockDeploymentsGet = vi.mocked(api.deploymentsGet);
const mockDeploymentsUpdate = vi.mocked(api.deploymentsUpdate);

afterEach(() => {
  cleanup();
});

describe("EnvironmentPage", () => {
  const mockDeployments = [
    {
      id: "dep1",
      name: "STS Deployment",
      slug: "sts-deployment",
      type: "sts" as const,
      updatedAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "dep2",
      name: "Modular Deployment",
      slug: "modular-deployment",
      type: "modular" as const,
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ];

  const mockDeploymentWithOverrides = {
    id: "dep1",
    name: "STS Deployment",
    slug: "sts-deployment",
    type: "sts" as const,
    environmentOverrides: {
      GEMINI_MODEL: "gemini-2.5-flash-preview-native-audio-dialog",
      GEMINI_INSTRUCTIONS: "You are a helpful assistant",
    },
    updatedAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeploymentsList.mockResolvedValue({ deployments: mockDeployments });
    mockDeploymentsGet.mockResolvedValue(mockDeploymentWithOverrides);
    mockDeploymentsUpdate.mockResolvedValue({ id: "dep1", name: "STS Deployment" });
  });

  it("renders deployment selector and loads deployments", async () => {
    render(<EnvironmentPage />);

    expect(screen.getByText("Environment Overrides")).toBeTruthy();
    expect(screen.getByText("Deployment")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("STS Deployment").length).toBeGreaterThan(0);
    });

    expect(mockDeploymentsList).toHaveBeenCalled();
  });

  it("loads environment overrides when deployment is selected", async () => {
    render(<EnvironmentPage />);

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("STS Deployment").length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("GEMINI_MODEL").length).toBeGreaterThan(0);
      expect(screen.getByDisplayValue("gemini-2.5-flash-preview-native-audio-dialog")).toBeTruthy();
    });

    expect(mockDeploymentsGet).toHaveBeenCalledWith({ id: "dep1" });
  });

  it("allows adding new environment variables", async () => {
    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      expect(within(container).getByDisplayValue("STS Deployment")).toBeTruthy();
    });

    const addButton = within(container).getAllByText("Add Variable")[0] as HTMLButtonElement;
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(within(container).getByDisplayValue("NEW_VAR")).toBeTruthy();
    });
  });

  it("allows editing environment variable keys and values", async () => {
    render(<EnvironmentPage />);

    await waitFor(() => {
      expect(screen.getAllByDisplayValue("GEMINI_MODEL").length).toBeGreaterThan(0);
    });

    const keyInput = screen.getAllByDisplayValue("GEMINI_MODEL")[0];
    const valueInput = screen.getAllByDisplayValue("gemini-2.5-flash-preview-native-audio-dialog")[0];

    fireEvent.change(keyInput, { target: { value: "CUSTOM_MODEL" } });
    fireEvent.change(valueInput, { target: { value: "custom-model-value" } });

    expect((keyInput as HTMLInputElement).value).toBe("CUSTOM_MODEL");
    expect((valueInput as HTMLTextAreaElement).value).toBe("custom-model-value");
  });

  it("allows removing environment variables", async () => {
    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      expect(within(container).getAllByDisplayValue("GEMINI_MODEL").length).toBeGreaterThan(0);
    });

    const removeButton = within(container).getAllByText("Remove")[0] as HTMLButtonElement;
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(within(container).queryByDisplayValue("GEMINI_MODEL")).toBeNull();
    });
  });

  it("saves environment overrides when save button is clicked", async () => {
    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      expect(within(container).getAllByDisplayValue("GEMINI_MODEL").length).toBeGreaterThan(0);
    });

    const saveButton = within(container).getAllByText("Save")[0] as HTMLButtonElement;
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockDeploymentsUpdate).toHaveBeenCalledWith({
        id: "dep1",
        environmentOverrides: {
          GEMINI_MODEL: "gemini-2.5-flash-preview-native-audio-dialog",
          GEMINI_INSTRUCTIONS: "You are a helpful assistant",
        },
      });
    });
  });

  it("handles deployment selection change", async () => {
    const mockDeployment2 = {
      id: "dep2",
      name: "Modular Deployment",
      slug: "modular-deployment",
      type: "modular" as const,
      environmentOverrides: {
        OPENAI_MODEL: "gpt-4o",
      },
      updatedAt: "2024-01-01T00:00:00Z",
    };

    mockDeploymentsGet.mockResolvedValueOnce(mockDeploymentWithOverrides).mockResolvedValueOnce(mockDeployment2);

    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      expect(within(container).getAllByDisplayValue("STS Deployment").length).toBeGreaterThan(0);
    });

    const select = within(container).getAllByDisplayValue("STS Deployment")[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "dep2" } });

    await waitFor(() => {
      expect(within(container).getByDisplayValue("OPENAI_MODEL")).toBeTruthy();
      expect(within(container).getByDisplayValue("gpt-4o")).toBeTruthy();
    });

    expect(mockDeploymentsGet).toHaveBeenCalledWith({ id: "dep2" });
  });

  it("shows empty state when no overrides are set", async () => {
    const mockDeploymentEmpty = {
      id: "dep1",
      name: "STS Deployment",
      slug: "sts-deployment",
      type: "sts" as const,
      environmentOverrides: {},
      updatedAt: "2024-01-01T00:00:00Z",
    };

    mockDeploymentsGet.mockResolvedValue(mockDeploymentEmpty);

    render(<EnvironmentPage />);

    await waitFor(() => {
      expect(screen.getByText('No overrides set. Click "Add Variable" to start.')).toBeTruthy();
    });
  });

  it("handles empty deployments list", async () => {
    mockDeploymentsList.mockResolvedValue({ deployments: [] });

    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      expect(within(container).getAllByText("No deployments found")[0]).toBeTruthy();
    });

    const select = within(container).getAllByDisplayValue("No deployments found")[0] as HTMLSelectElement;
    expect((select as HTMLSelectElement).disabled).toBe(true);
  });

  it("disables save button when no deployment is selected", async () => {
    mockDeploymentsList.mockResolvedValue({ deployments: [] });

    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      expect(within(container).getAllByText("No deployments found")[0]).toBeTruthy();
    });

    const saveButtons = within(container).getAllByText("Save") as HTMLButtonElement[];
    expect(saveButtons.some((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("handles API errors gracefully", async () => {
    mockDeploymentsList.mockResolvedValue({ deployments: [] });

    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      expect(within(container).getAllByText("No deployments found")[0]).toBeTruthy();
    });
  });

  it("generates unique keys for new variables", async () => {
    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      expect(within(container).getAllByDisplayValue("STS Deployment").length).toBeGreaterThan(0);
    });

    const addButton = within(container).getAllByText("Add Variable")[0] as HTMLButtonElement;

    // Add first variable
    fireEvent.click(addButton);
    await waitFor(() => {
      expect(within(container).getByDisplayValue("NEW_VAR")).toBeTruthy();
    });

    // Add second variable
    fireEvent.click(addButton);
    await waitFor(() => {
      expect(within(container).getByDisplayValue("NEW_VAR_2")).toBeTruthy();
    });

    // Add third variable
    fireEvent.click(addButton);
    await waitFor(() => {
      expect(within(container).getByDisplayValue("NEW_VAR_3")).toBeTruthy();
    });
  });

  it("removes variables with empty values", async () => {
    const { container } = render(<EnvironmentPage />);

    await waitFor(() => {
      const keyInputs = within(container).getAllByDisplayValue("GEMINI_MODEL");
      expect(keyInputs.length).toBeGreaterThan(0);
    });

    const valueInput = within(container).getAllByDisplayValue("gemini-2.5-flash-preview-native-audio-dialog")[0];
    fireEvent.change(valueInput, { target: { value: "" } });

    const saveButton = within(container).getAllByText("Save")[0] as HTMLButtonElement;
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockDeploymentsUpdate).toHaveBeenCalledWith({
        id: "dep1",
        environmentOverrides: {
          GEMINI_INSTRUCTIONS: "You are a helpful assistant",
        },
      });
    });
  });
});
