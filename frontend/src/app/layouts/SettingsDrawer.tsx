import { useState, type ChangeEvent, type ReactNode } from "react";
import { Check, KeyRound, Server } from "lucide-react";

import { ModelSelector } from "@/components/brand/ModelSelector";
import { Button } from "@/components/ui/button";
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
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-xs font-medium text-foreground">{label}</Label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
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
  const saveHistoryEnabled = useUIStore((state) => state.saveHistoryEnabled);
  const setSaveHistoryEnabled = useUIStore((state) => state.setSaveHistoryEnabled);

  const customApiKey = useUIStore((state) => state.customApiKey);
  const customApiBase = useUIStore((state) => state.customApiBase);
  const customModelId = useUIStore((state) => state.customModelId);
  const setCustomApiConfig = useUIStore((state) => state.setCustomApiConfig);

  const [draftApiKey, setDraftApiKey] = useState(customApiKey);
  const [draftApiBase, setDraftApiBase] = useState(customApiBase);
  const [draftModelId, setDraftModelId] = useState(customModelId);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const connection = useSessionStore((state) => state.connection);
  const providerName = useSessionStore((state) => state.providerName);
  const defaultModel = useSessionStore((state) => state.defaultModel);
  const setActiveModel = useSessionStore((state) => state.setActiveModel);

  const handleSaveCustomEndpoint = () => {
    setCustomApiConfig({
      apiKey: draftApiKey.trim(),
      apiBase: draftApiBase.trim(),
      modelId: draftModelId.trim() || "custom:local-model",
    });
    if (draftModelId.trim()) {
      setActiveModel(`custom:${draftModelId.trim()}`);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      <SheetContent side="right" className="border-border/60 bg-[#0e0e11] sm:max-w-md text-foreground">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold">Settings & Configuration</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Manage AI providers, model endpoints, and privacy preferences.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 scrollbar-slim space-y-6">
          {/* Active Model Section */}
          <div>
            <p className="pt-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              Active Intelligence Model
            </p>
            <div className="py-2">
              <ModelSelector />
            </div>
          </div>

          <Separator className="border-border/40" />

          {/* Custom Endpoint & API Keys (BYOK) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-3.5 text-primary" />
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                Custom Provider & Local LLMs
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Connect local models (Ollama, LM Studio, vLLM) or private OpenAI-compatible endpoints.
            </p>

            <div className="space-y-2.5 rounded-xl border border-border/60 bg-black/20 p-3">
              <div>
                <Label htmlFor="custom-base" className="text-[11px] text-muted-foreground">
                  Base URL
                </Label>
                <input
                  id="custom-base"
                  placeholder="http://localhost:11434/v1"
                  value={draftApiBase}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftApiBase(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-border/60 bg-black/30 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 font-mono outline-none focus:border-primary/50"
                />
              </div>

              <div>
                <Label htmlFor="custom-key" className="text-[11px] text-muted-foreground">
                  API Key (Stored locally in browser)
                </Label>
                <input
                  id="custom-key"
                  type="password"
                  placeholder="sk-…"
                  value={draftApiKey}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftApiKey(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-border/60 bg-black/30 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 font-mono outline-none focus:border-primary/50"
                />
              </div>

              <div>
                <Label htmlFor="custom-model" className="text-[11px] text-muted-foreground">
                  Model Identifier
                </Label>
                <input
                  id="custom-model"
                  placeholder="deepseek-r1:70b or llama3.3"
                  value={draftModelId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftModelId(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-border/60 bg-black/30 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 font-mono outline-none focus:border-primary/50"
                />
              </div>

              <Button
                type="button"
                size="sm"
                className="h-8 w-full gap-1.5 text-xs font-medium"
                onClick={handleSaveCustomEndpoint}
              >
                {savedSuccess ? (
                  <>
                    <Check className="size-3 text-emerald-400" />
                    <span>Saved & Activated</span>
                  </>
                ) : (
                  <>
                    <Server className="size-3" />
                    <span>Save Custom Endpoint</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator className="border-border/40" />

          {/* Privacy & History */}
          <div>
            <p className="pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              Privacy & History
            </p>

            <SettingRow
              id="save-history"
              label="Save chat history"
              description="Keep research sessions in the sidebar for future reference."
              control={
                <Switch
                  id="save-history"
                  checked={saveHistoryEnabled}
                  onCheckedChange={setSaveHistoryEnabled}
                />
              }
            />
          </div>

          <Separator className="border-border/40" />

          {/* Appearance */}
          <div>
            <p className="pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              Visual Preferences
            </p>

            <SettingRow
              id="ambient-motion"
              label="Ambient motion"
              description="Subtle kinetic animations in 3D topology."
              control={
                <Switch
                  id="ambient-motion"
                  checked={ambientMotion}
                  onCheckedChange={setAmbientMotion}
                />
              }
            />

            <div className="py-2.5">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="glass-strength" className="text-xs">Glass intensity</Label>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {Math.round(glassStrength * 100)}%
                </span>
              </div>
              <Slider
                id="glass-strength"
                value={[glassStrength]}
                onValueChange={([value]) => {
                  setGlassStrength(value ?? 1);
                }}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>
          </div>

          <Separator className="border-border/40" />

          {/* System Telemetry */}
          <div>
            <p className="pb-2 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              System Telemetry
            </p>
            <dl className="space-y-1.5 rounded-lg bg-black/20 p-2.5 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Backend Link</dt>
                <dd className="font-mono text-foreground">{connection}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Provider Engine</dt>
                <dd className="text-foreground">{providerName ?? "FastAPI Native"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Default Architecture</dt>
                <dd className="text-foreground">{defaultModel ?? "gpt-4o"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

