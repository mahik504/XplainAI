import { motion } from "framer-motion";
import {
  History,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUIStore, type WorkspacePanel } from "@/stores/ui-store";

const navItems: { id: WorkspacePanel; label: string; icon: LucideIcon }[] = [
  { id: "graph", label: "Graph", icon: Workflow },
  { id: "chat", label: "Conversation", icon: MessagesSquare },
  { id: "timeline", label: "Timeline", icon: History },
  { id: "trust", label: "Signals", icon: ShieldCheck },
];

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-4">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-neon-cyan/30 bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20">
        <span className="absolute inset-0 rounded-xl bg-neon-cyan/20 blur-md" />
        <Sparkles className="relative size-4 text-neon-cyan" />
      </span>
      {!collapsed ? (
        <div className="min-w-0">
          <p className="font-display truncate text-sm font-semibold tracking-tight text-foreground">
            XplainAI
          </p>
          <p className="truncate text-[11px] text-muted-foreground">Explainability OS</p>
        </div>
      ) : null}
    </div>
  );
}

function NavList({ collapsed }: { collapsed: boolean }) {
  const activePanel = useUIStore((state) => state.activePanel);
  const setActivePanel = useUIStore((state) => state.setActivePanel);

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map(({ id, label, icon: Icon }) => {
        const isActive = activePanel === id;

        const button = (
          <button
            type="button"
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              setActivePanel(id);
            }}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
              isActive
                ? "bg-white/[0.06] text-foreground"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              collapsed && "justify-center",
            )}
          >
            {isActive ? (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-neon-cyan shadow-[0_0_12px_var(--neon-cyan)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <Icon
              className={cn("size-4 shrink-0 transition-colors", isActive && "text-neon-cyan")}
            />
            {!collapsed ? <span className="truncate">{label}</span> : null}
          </button>
        );

        if (!collapsed) {
          return <div key={id}>{button}</div>;
        }

        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function SidebarBody({ collapsed }: { collapsed: boolean }) {
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <div className="flex h-full flex-col">
      <Brand collapsed={collapsed} />
      <NavList collapsed={collapsed} />

      <div className="mt-auto flex flex-col gap-1 px-2 pb-3">
        <button
          type="button"
          aria-label="Settings"
          onClick={() => {
            setSettingsOpen(true);
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring",
            collapsed && "justify-center",
          )}
        >
          <Settings className="size-4 shrink-0" />
          {!collapsed ? <span>Settings</span> : null}
        </button>

        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          onClick={toggleSidebar}
          className={cn("hidden lg:flex", collapsed ? "mx-auto" : "justify-start")}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4" />
              <span>Collapse</span>
            </>
          )}
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUIStore((state) => state.sidebarCollapsed);
  const mobileNavOpen = useUIStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 76 : 248 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 hidden shrink-0 border-r border-border/70 bg-white/[0.015] backdrop-blur-2xl lg:block"
      >
        <SidebarBody collapsed={collapsed} />
      </motion.aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Switch between workspace panels</SheetDescription>
          </SheetHeader>
          <SidebarBody collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
