import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Copy, Check, RefreshCw, Layers, ShieldAlert, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorBoundaryFallbackType = "full" | "panel" | "canvas" | "inline";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  fallbackType?: ErrorBoundaryFallbackType;
  title?: string;
  description?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  onSwitchTo2D?: () => void;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    if (process.env.NODE_ENV !== "test") {
      console.error("[XplainAI ErrorBoundary] Caught exception:", error, errorInfo);
    }
  }

  public reset = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
  };

  private copyErrorReport = (): void => {
    const { error, errorInfo } = this.state;
    const report = [
      `=== XplainAI Error Telemetry Report ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `Error: ${error?.name ?? "Unknown"}: ${error?.message ?? "No message"}`,
      `Stack: ${error?.stack ?? "No stack"}`,
      `Component Stack: ${errorInfo?.componentStack ?? "No component stack"}`,
    ].join("\n");

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(report).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

  public override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;
    const {
      fallback,
      fallbackType = "full",
      title,
      description,
      onSwitchTo2D,
      className,
    } = this.props;

    if (fallback) {
      if (typeof fallback === "function") {
        return fallback(error ?? new Error("Unknown error"), this.reset);
      }
      return fallback;
    }

    // 1. WebGL Canvas Fallback
    if (fallbackType === "canvas") {
      return (
        <div
          role="alert"
          className={cn(
            "relative flex size-full min-h-[300px] flex-col items-center justify-center p-6 text-center bg-[#030712]/95 border border-cyan-500/20 rounded-xl backdrop-blur-xl",
            className,
          )}
        >
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <Cpu className="size-7 animate-pulse" />
          </div>

          <h3 className="mb-1.5 text-base font-semibold text-white font-sans">
            {title ?? "WebGL Constellation Suspended"}
          </h3>
          <p className="mb-6 max-w-md text-xs text-slate-400 font-mono leading-relaxed">
            {description ??
              (error?.message
                ? `Graphics pipeline encountered an issue: ${error.message}`
                : "The 3D WebGL renderer encountered a hardware or context interruption.")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={this.reset}
              className="gap-2 bg-cyan-500 text-black hover:bg-cyan-400 font-mono text-xs shadow-[0_0_15px_rgba(6,182,212,0.35)]"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry 3D Canvas</span>
            </Button>

            {onSwitchTo2D ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onSwitchTo2D}
                className="gap-2 border-white/15 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1] hover:text-white font-mono text-xs"
              >
                <Layers className="size-3.5 text-cyan-400" />
                <span>Switch to 2D Flow</span>
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    // 2. Inline Fallback (for Chips & Markdown)
    if (fallbackType === "inline") {
      return (
        <span
          role="alert"
          className={cn(
            "inline-flex items-center gap-1.5 rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-mono text-red-300 border border-red-500/20",
            className,
          )}
        >
          <AlertTriangle className="size-3 text-red-400 shrink-0" />
          <span className="truncate max-w-[200px]">{error?.message ?? "Render error"}</span>
          <button
            type="button"
            onClick={this.reset}
            className="ml-1 underline text-red-400 hover:text-red-200 cursor-pointer"
            title="Retry render"
          >
            Retry
          </button>
        </span>
      );
    }

    // 3. Panel Fallback (for Sidebars & Cockpit Panels)
    if (fallbackType === "panel") {
      return (
        <div
          role="alert"
          className={cn(
            "flex size-full min-h-[220px] flex-col items-center justify-center p-5 text-center bg-[#070b16]/90 border border-red-500/20 rounded-xl backdrop-blur-xl",
            className,
          )}
        >
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
            <AlertTriangle className="size-5" />
          </div>
          <h4 className="mb-1 text-sm font-semibold text-white">{title ?? "Panel Encountered an Error"}</h4>
          <p className="mb-4 max-w-xs text-xs text-slate-400 font-mono leading-relaxed line-clamp-3">
            {error?.message ?? "An unexpected component error occurred."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={this.reset}
            className="gap-2 border-red-500/30 bg-red-500/10 text-xs font-mono text-red-200 hover:bg-red-500/20 hover:text-white"
          >
            <RefreshCw className="size-3.5" />
            <span>Reload Panel</span>
          </Button>
        </div>
      );
    }

    // 4. Full Page / App Root Fallback
    return (
      <div
        role="alert"
        className={cn(
          "relative flex min-h-screen w-full flex-col items-center justify-center p-6 bg-[#030712] text-foreground font-sans",
          className,
        )}
      >
        <div className="relative z-10 w-full max-w-xl rounded-2xl border border-red-500/30 bg-[#0a0f1d]/95 p-8 shadow-[0_0_60px_rgba(239,68,68,0.15)] backdrop-blur-2xl">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/15 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.3)]">
            <ShieldAlert className="size-8" />
          </div>

          <h2 className="mb-2 text-xl font-bold tracking-tight text-white">
            {title ?? "Session Interruption Detected"}
          </h2>
          <p className="mb-6 text-sm text-slate-400 leading-relaxed">
            {description ??
              "XplainAI encountered an unhandled interface exception. Your epistemic data and session history are securely preserved."}
          </p>

          {error ? (
            <div className="mb-6 overflow-hidden rounded-xl border border-white/10 bg-black/60 p-4 font-mono text-xs">
              <div className="mb-1.5 flex items-center justify-between text-red-400 font-semibold">
                <span>{error.name}: {error.message}</span>
                <button
                  type="button"
                  onClick={this.copyErrorReport}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                  title="Copy error report"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="size-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>
              </div>
              {error.stack ? (
                <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap text-[11px] text-slate-500 scrollbar-slim">
                  {error.stack}
                </pre>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="default"
              onClick={this.reset}
              className="gap-2 bg-cyan-500 text-black hover:bg-cyan-400 font-mono text-xs font-semibold shadow-[0_0_20px_rgba(6,182,212,0.35)]"
            >
              <RefreshCw className="size-4" />
              <span>Recover Session</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              className="gap-2 border-white/15 bg-white/[0.05] text-xs font-mono text-slate-200 hover:bg-white/[0.1] hover:text-white"
            >
              <span>Reload Application</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export function withErrorBoundary<P extends object>(
  ComponentToWrap: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <ComponentToWrap {...props} />
    </ErrorBoundary>
  );
  WrappedComponent.displayName = `WithErrorBoundary(${ComponentToWrap.displayName || ComponentToWrap.name || "Component"})`;
  return WrappedComponent;
}
