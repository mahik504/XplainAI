import type { ReactNode } from "react";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallbackType="full">
      <TooltipProvider delayDuration={180} skipDelayDuration={300}>
        {children}
      </TooltipProvider>
    </ErrorBoundary>
  );
}

