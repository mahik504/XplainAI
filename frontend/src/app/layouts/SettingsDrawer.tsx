import type { ReactNode } from "react";

import { ModelSelector } from "@/components/brand/ModelSelector";
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
import { useSessionStore } from "@/stores/session-store";
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
  const connection = useSessionStore((state) => state.connection);
  const providerName = useSessionStore((state) => state.providerName);
  const defaultModel = useSessionStore((state) => state.defaultModel);

  return (
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      <SheetContent side="right" className="border-border/50 bg-[#0A0A0F]">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Workspace preferences for XplainAI.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <p className="pt-4 pb-1 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Model
          </p>
          <div className="py-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Selects the model used for the next request.
            </p>
            <ModelSelector />
          </div>

          <Separator />

          <p className="pt-4 pb-1 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Appearance
          </p>

          <SettingRow
            id="ambient-motion"
            label="Ambient motion"
            description="Subtle background motion. Disable to reduce GPU load."
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
              Blur and translucency of panel surfaces.
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

          <p className="pt-4 pb-1 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Connection
          </p>
          <dl className="space-y-1.5 py-3 text-xs text-muted-foreground">
            <div className="flex justify-between gap-3">
              <dt>Status</dt>
              <dd className="text-foreground">{connection}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Provider</dt>
              <dd className="text-foreground">{providerName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Default model</dt>
              <dd className="text-foreground">{defaultModel ?? "—"}</dd>
            </div>
          </dl>

          <Separator />

          <p className="pt-4 pb-2 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
            Explainability
          </p>
          <p className="pb-4 text-xs leading-relaxed text-muted-foreground">
            XplainAI shows observable response structure — claims, evidence markers, hedges, and
            retrieved sources. It does not expose hidden chain-of-thought or guarantee factual
            verification.
          </p>

          <button
            type="button"
            className="mb-6 rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
            onClick={() => {
              setAmbientMotion(true);
              setGlassStrength(0.9);
            }}
          >
            Reset appearance preferences
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
