import { AnimatePresence, motion } from "framer-motion";
import { Check, Mic, MicOff, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { hudAudio } from "@/features/audio/audio-sfx";
import { cn } from "@/lib/utils";

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscribed: (text: string) => void;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  onTranscribed,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopVoice();
      return;
    }

    hudAudio.playSweep();
    startVoice();

    return () => {
      stopVoice();
    };
  }, [isOpen]);

  const startVoice = async () => {
    setErrorMsg(null);
    setTranscript("");

    // 1. Initialize Speech Recognition
    const SpeechRecClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecClass) {
      setErrorMsg("Web Speech API not supported in this browser. Please type or use Chrome/Edge.");
    } else {
      try {
        const recognition = new SpeechRecClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          hudAudio.playChirp();
        };

        recognition.onresult = (event: any) => {
          let currentText = "";
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          setTranscript(currentText);
          hudAudio.playClick(1400);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          if (event.error !== "no-speech") {
            setErrorMsg(`Voice input status: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.error("SpeechRecognition start failed:", err);
      }
    }

    // 2. Initialize Audio Reactive Waveform Analyzer
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;

        const AudioCtxClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const audioCtx = new AudioCtxClass();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const draw = () => {
            if (!canvasRef.current) return;
            animFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.2;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              const val = dataArray[i] ?? 0;
              const barHeight = (val / 255) * canvas.height * 0.9;

              // Glowing tactical gradient
              const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
              gradient.addColorStop(0, "rgba(225, 29, 72, 0.2)");
              gradient.addColorStop(0.5, "rgba(255, 46, 99, 0.8)");
              gradient.addColorStop(1, "rgba(6, 182, 212, 1.0)");

              ctx.fillStyle = gradient;
              ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

              x += barWidth;
            }
          };
          draw();
        }
      }
    } catch (e) {
      console.warn("Microphone stream not accessible for waveform:", e);
    }
  };

  const stopVoice = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsListening(false);
  };

  const handleApply = () => {
    hudAudio.playChirp();
    if (transcript.trim()) {
      onTranscribed(transcript.trim());
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-rose-500/60 bg-[#0c040b]/95 p-6 shadow-[0_0_50px_rgba(225,29,72,0.3)] backdrop-blur-2xl"
        >
          {/* Top HUD Header */}
          <div className="flex items-center justify-between border-b border-rose-950/70 pb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex size-3 items-center justify-center">
                <span
                  className={cn(
                    "absolute inline-flex size-full rounded-full opacity-75",
                    isListening ? "animate-ping bg-rose-500" : "bg-zinc-600",
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex size-2 rounded-full",
                    isListening ? "bg-rose-400" : "bg-zinc-500",
                  )}
                />
              </div>
              <span className="font-mono text-xs font-bold tracking-widest text-rose-300 uppercase">
                JARVIS VOICE COCKPIT · AUDIO TELEMETRY
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                hudAudio.playClick();
                onClose();
              }}
              className="rounded-lg p-1 text-zinc-400 transition hover:bg-rose-950/50 hover:text-rose-200"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Audio Waveform Canvas */}
          <div className="my-5 flex flex-col items-center justify-center gap-3">
            <div className="relative h-24 w-full overflow-hidden rounded-xl border border-rose-950/80 bg-black/60 p-2 shadow-inner">
              <canvas
                ref={canvasRef}
                width={400}
                height={80}
                className="size-full opacity-90"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {!isListening && (
                  <span className="font-mono text-xs text-zinc-500">Microphone standby</span>
                )}
              </div>
            </div>

            {/* Transcript Preview */}
            <div className="min-h-[70px] w-full rounded-xl border border-rose-950/70 bg-[#140612]/60 p-3 font-mono text-xs leading-relaxed text-foreground/90">
              {transcript ? (
                <span className="text-rose-100">{transcript}</span>
              ) : (
                <span className="text-zinc-500 italic">
                  {isListening ? "Listening... Speak your research inquiry..." : "Click Start to speak"}
                </span>
              )}
            </div>

            {errorMsg && (
              <p className="font-mono text-[11px] text-amber-400">{errorMsg}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 border-t border-rose-950/70 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                hudAudio.playClick();
                if (isListening) {
                  stopVoice();
                } else {
                  startVoice();
                }
              }}
              className={cn(
                "gap-2 font-mono text-xs",
                isListening
                  ? "border-rose-500/60 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
                  : "border-rose-950/80 text-zinc-400 hover:bg-rose-950/40 hover:text-rose-200",
              )}
            >
              {isListening ? <Mic className="size-3.5 text-rose-400" /> : <MicOff className="size-3.5" />}
              <span>{isListening ? "Pause Listening" : "Resume Voice"}</span>
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  hudAudio.playClick();
                  onClose();
                }}
                className="font-mono text-xs text-zinc-400 hover:bg-rose-950/40 hover:text-rose-200"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!transcript.trim()}
                onClick={handleApply}
                className="gap-2 border border-rose-500/60 bg-rose-600 font-mono text-xs text-white hover:bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.4)]"
              >
                <Check className="size-3.5" />
                <span>Inject to Inquiry</span>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
