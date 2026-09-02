import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { ErrorBoundary, withErrorBoundary } from "./ErrorBoundary";

// Component that conditionally throws
function ProblemChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Simulated component explosion");
  }
  return <div data-testid="healthy-child">System Operational</div>;
}

function RecoverableParent() {
  const [shouldThrow, setShouldThrow] = useState(true);
  return (
    <ErrorBoundary onReset={() => setShouldThrow(false)}>
      <ProblemChild shouldThrow={shouldThrow} />
    </ErrorBoundary>
  );
}

describe("ErrorBoundary", () => {
  const originalError = console.error;

  beforeEach(() => {
    // Suppress react error boundary console logging during test
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it("renders children normally when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("healthy-child")).toBeInTheDocument();
    expect(screen.getByText("System Operational")).toBeInTheDocument();
  });

  it("catches errors and renders the full fallback UI by default", () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Session Interruption Detected")).toBeInTheDocument();
    expect(screen.getAllByText(/Simulated component explosion/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Recover Session/i })).toBeInTheDocument();
  });

  it("calls onError callback when error is caught", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Simulated component explosion" }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it("renders dedicated WebGL canvas fallback when fallbackType='canvas'", () => {
    const onSwitchTo2D = vi.fn();

    render(
      <ErrorBoundary fallbackType="canvas" onSwitchTo2D={onSwitchTo2D}>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("WebGL Constellation Suspended")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry 3D Canvas/i })).toBeInTheDocument();

    const switchBtn = screen.getByRole("button", { name: /Switch to 2D Flow/i });
    expect(switchBtn).toBeInTheDocument();
    fireEvent.click(switchBtn);
    expect(onSwitchTo2D).toHaveBeenCalledTimes(1);
  });

  it("renders panel fallback when fallbackType='panel'", () => {
    render(
      <ErrorBoundary fallbackType="panel" title="Custom Panel Error">
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Custom Panel Error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reload Panel/i })).toBeInTheDocument();
  });

  it("renders inline fallback when fallbackType='inline'", () => {
    render(
      <ErrorBoundary fallbackType="inline">
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByText(/Simulated component explosion/).length).toBeGreaterThan(0);
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("supports custom fallback render function", () => {
    render(
      <ErrorBoundary
        fallback={(err, reset) => (
          <div data-testid="custom-fallback">
            <span>Custom: {err.message}</span>
            <button onClick={reset}>Try Again</button>
          </div>
        )}
      >
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.getByText("Custom: Simulated component explosion")).toBeInTheDocument();
  });

  it("allows recovering view via reset action", () => {
    render(<RecoverableParent />);

    expect(screen.getByText("Session Interruption Detected")).toBeInTheDocument();

    const recoverButton = screen.getByRole("button", { name: /Recover Session/i });
    fireEvent.click(recoverButton);

    expect(screen.getByTestId("healthy-child")).toBeInTheDocument();
    expect(screen.getByText("System Operational")).toBeInTheDocument();
  });

  it("withErrorBoundary HOC wraps components correctly", () => {
    const SafeComponent = withErrorBoundary(ProblemChild, { fallbackType: "panel" });

    render(<SafeComponent shouldThrow={true} />);
    expect(screen.getByText("Panel Encountered an Error")).toBeInTheDocument();
  });
});
