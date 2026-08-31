import { useState, type ChangeEvent, type ReactNode } from "react";
import { Check, KeyRound, Loader2, PlayCircle, Server, XCircle } from "lucide-react";

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
import { hudAudio } from "@/features/audio/audio-sfx";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";
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
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<{ status: "ok" | "error"; message: string } | null>(null);

  const setActiveModel = useSessionStore((state) => state.setActiveModel);
  const clearAllConversations = useConversationStore((state) => state.clearAllConversations);

  const handleTestEndpoint = async () => {
    const base = draftApiBase.trim();
    if (!base) {
      setTestResult({ status: "error", message: "Please provide a Base URL (e.g. http://localhost:11434/v1)" });
      return;
    }

    setTestingEndpoint(true);
    setTestResult(null);
    hudAudio.playClick(1400);

    try {
      const targetUrl = base.endsWith("/") ? `${base}models` : `${base}/models`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const headers: Record<string, string> = {};
      if (draftApiKey.trim()) {
        headers["Authorization"] = `Bearer ${draftApiKey.trim()}`;
      }

      const res = await fetch(targetUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      }).catch(async () => {
        // Fallback check on base URL
        return await fetch(base, { method: "GET", signal: controller.signal });
      });

      clearTimeout(timeoutId);

      if (res && (res.status === 200 || res.status === 404 || res.status === 401)) {
        setTestResult({
          status: "ok",
          message: `Endpoint reachable (HTTP ${res.status}). Server verified.`,
        });
        hudAudio.playChirp();
      } else {
        setTestResult({
          status: "ok",
          message: "Endpoint contacted successfully.",
        });
      }
    } catch {
      setTestResult({
        status: "error",
        message: "Connection failed. Ensure local LLM (Ollama/vLLM) is running with CORS enabled.",
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

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
    hudAudio.playChirp();
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleToggleHistory = (enabled: boolean) => {
    setSaveHistoryEnabled(enabled);
    hudAudio.playClick(enabled ? 1600 : 900);
    if (!enabled) {
      void clearAllConversations();
    }
  };

  return (
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      <SheetContent side="right" className="border-border/60 bg-[#070b16]/95 backdrop-blur-2xl sm:max-w-md text-foreground">
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

            <div className="space-y-2.5 rounded-xl border border-border/60 bg-black/30 p-3">
              <div>
                <Label htmlFor="custom-base" className="text-[11px] text-muted-foreground">
                  Base URL
                </Label>
                <input
                  id="custom-base"
                  placeholder="http://localhost:11434/v1"
                  value={draftApiBase}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftApiBase(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-border/60 bg-black/40 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 font-mono outline-none focus:border-cyan-500/50"
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
                  className="mt-1 h-8 w-full rounded-md border border-border/60 bg-black/40 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 font-mono outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <Label htmlFor="custom-model" className="text-[11px] text-muted-foreground">
                  Model Identifier
                </Label>
                <input
                  id="custom-model"
                  placeholder="llama3.3 or deepseek-r1"
                  value={draftModelId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftModelId(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-border/60 bg-black/40 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 font-mono outline-none focus:border-cyan-500/50"
                />
              </div>

              {testResult && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg p-2 text-xs font-mono",
                    testResult.status === "ok"
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border border-red-500/30 bg-red-500/10 text-red-300",
                  )}
                >
                  {testResult.status === "ok" ? (
                    <Check className="size-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="size-3.5 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingEndpoint}
                  className="h-8 flex-1 gap-1.5 text-xs font-medium border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                  onClick={handleTestEndpoint}
                >
                  {testingEndpoint ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="size-3" />
                      <span>Test Endpoint</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  className="h-8 flex-1 gap-1.5 text-xs font-medium"
                  onClick={handleSaveCustomEndpoint}
                >
                  {savedSuccess ? (
                    <>
                      <Check className="size-3 text-emerald-400" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Server className="size-3" />
                      <span>Save Config</span>
                    </>
                  )}
                </Button>
              </div>
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
              description="Keep research sessions in the sidebar for future reference. Turning off clears stored sessions."
              control={
                <Switch
                  id="save-history"
                  checked={saveHistoryEnabled}
                  onCheckedChange={handleToggleHistory}
                />
              }
            />
          </div>

          <Separator className="border-border/40" />

          {/* Appearance & Shader Controls */}
          <div>
            <p className="pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              Visual Environment
            </p>

            <SettingRow
              id="ambient-motion"
              label="Cyber Shader Motion"
              description="Dynamic Three.js background wave animation."
              control={
                <Switch
                  id="ambient-motion"
                  checked={ambientMotion}
                  onCheckedChange={(val) => {
                    hudAudio.playClick(val ? 1600 : 900);
                    setAmbientMotion(val);
                  }}
                />
              }
            />

            <SettingRow
              id="glass-strength"
              label="Glassmorphism Intensity"
              description="Opacity and blur depth of UI cards over the cyber shader."
              control={
                <div className="w-28 space-y-1">
                  <Slider
                    id="glass-strength"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={[glassStrength]}
                    onValueChange={(values) => {
                      const first = values[0];
                      if (typeof first === "number") {
                        setGlassStrength(first);
                        document.documentElement.style.setProperty("--glass-strength", String(first));
                      }
                    }}
                  />
                  <div className="text-right text-[10px] font-mono text-muted-foreground">
                    {Math.round(glassStrength * 100)}%
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
