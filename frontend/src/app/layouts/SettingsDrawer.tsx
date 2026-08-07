import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useUIStore } from "@/stores/ui-store";

interface SettingRowProps {
  id: string;
  label: string;
  description: string;
  control: ReactNode;
}

function SettingRow({ id, label, description, control }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

export function SettingsDrawer() {
  const settingsOpen = useUIStore((state) => state.settingsOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const ambientMotion = useUIStore((state) => state.ambientMotion);
  const setAmbientMotion = useUIStore((state) => state.setAmbientMotion);
  const glassStrength = useUIStore((state) => state.glassStrength);
  const setGlassStrength = useUIStore((state) => state.setGlassStrength);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed);

  return (
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Interface preferences for this workspace.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <p className="pt-4 pb-1 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Appearance
          </p>

          <SettingRow
            id="ambient-motion"
            label="Ambient motion"
            description="Animate the background field. Disable to reduce GPU load on projectors."
            control={
              <Switch
                id="ambient-motion"
                checked={ambientMotion}
                onCheckedChange={setAmbientMotion}
              />
            }
          />

          <Separator />

          <div className="py-3.5">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="glass-strength">Glass intensity</Label>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {Math.round(glassStrength * 100)}%
              </span>
            </div>
            <p className="pt-1 pb-3 text-xs leading-relaxed text-muted-foreground">
              Blur and translucency of every panel surface.
            </p>
            <Slider
              id="glass-strength"
              value={[glassStrength]}
              onValueChange={([value]) => {
                setGlassStrength(value ?? 1);
              }}
              min={0}
              max={1}
              step={0.05}
            />
          </div>

          <Separator />

          <p className="pt-6 pb-1 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Layout
          </p>

          <SettingRow
            id="compact-sidebar"
            label="Compact sidebar"
            description="Collapse the navigation rail to icons only."
            control={
              <Switch
                id="compact-sidebar"
                checked={sidebarCollapsed}
                onCheckedChange={setSidebarCollapsed}
              />
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
