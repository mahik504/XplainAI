import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={180} skipDelayDuration={300}>
      {children}
    </TooltipProvider>
  );
}
