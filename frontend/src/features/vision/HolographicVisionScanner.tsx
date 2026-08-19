import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, RefreshCw, Scan, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { hudAudio } from "@/features/audio/audio-sfx";

interface HolographicVisionScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (capturedDataUrl: string, promptText: string) => void;
}

export const HolographicVisionScanner: React.FC<HolographicVisionScannerProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const [streamActive, setStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [inquiryText, setInquiryText] = useState("Analyze this document/diagram and explain the structural evidence.");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    hudAudio.playSweep();
    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMsg(null);
    setCapturedImage(null);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStreamActive(true);
        hudAudio.playChirp();
      } else {
        setErrorMsg("Camera access not supported on this browser.");
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      setErrorMsg("Camera access blocked or unavailable. Please grant webcam permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    hudAudio.playClick(1800);

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedImage(dataUrl);
      hudAudio.playChirp();
    }
  };

  const retakeFrame = () => {
    hudAudio.playClick();
    setCapturedImage(null);
  };

  const handleConfirm = () => {
    hudAudio.playChirp();
    if (capturedImage) {
      onCapture(capturedImage, inquiryText);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-rose-500/60 bg-[#0c040b]/95 p-6 shadow-[0_0_60px_rgba(225,29,72,0.35)] backdrop-blur-2xl font-mono"
        >
          {/* HUD Header */}
          <div className="flex items-center justify-between border-b border-rose-950/70 pb-3">
            <div className="flex items-center gap-2">
              <Scan className="size-4 text-rose-400 animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-rose-300 uppercase">
                HOLOGRAPHIC VISION COCKPIT · OPTICAL SENSOR
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

          {/* Viewport Area */}
          <div className="relative my-4 aspect-video w-full overflow-hidden rounded-xl border border-rose-950/80 bg-black/90 shadow-2xl">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured Telemetry Frame"
                className="size-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="size-full object-cover"
              />
            )}

            {/* Futuristic HUD Overlays */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
              {/* Corner brackets */}
              <div className="flex items-center justify-between text-[10px] text-rose-400/80">
                <div className="flex items-center gap-1 border-t-2 border-l-2 border-rose-500/80 p-1">
                  <span>[LENS: 84° FOV]</span>
                </div>
                <div className="flex items-center gap-1 border-t-2 border-r-2 border-rose-500/80 p-1">
                  <span>[FPS: 60.0]</span>
                </div>
              </div>

              {/* Center Holographic Reticle */}
              <div className="flex items-center justify-center">
                <div className="relative flex size-24 items-center justify-center">
                  <div className="absolute size-full rounded-full border border-dashed border-rose-500/40 animate-spin" />
                  <div className="size-12 rounded-full border border-cyan-400/50" />
                  <div className="size-1 rounded-full bg-rose-400 shadow-[0_0_8px_#ff2e63]" />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-rose-400/80">
                <div className="flex items-center gap-1 border-b-2 border-l-2 border-rose-500/80 p-1">
                  <span>[MODE: EVIDENCE_EXTRACT]</span>
                </div>
                <div className="flex items-center gap-1 border-b-2 border-r-2 border-rose-500/80 p-1">
                  <span>[ISO: AUTO]</span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-xs text-amber-400">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Prompt description for the image inquiry */}
          {capturedImage ? (
            <div className="my-3 space-y-1.5">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider">
                Research Inquiry on Captured Optical Evidence:
              </label>
              <input
                type="text"
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
                className="h-9 w-full rounded-lg border border-rose-950/80 bg-black/50 px-3 text-xs text-foreground outline-none focus:border-rose-500/60"
              />
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-rose-950/70 pt-4">
            {!capturedImage ? (
              <Button
                type="button"
                disabled={!streamActive}
                onClick={captureFrame}
                className="w-full gap-2 border border-rose-500/60 bg-rose-600 font-mono text-xs text-white hover:bg-rose-500 shadow-[0_0_25px_rgba(225,29,72,0.4)]"
              >
                <Camera className="size-4" />
                <span>Capture Analysis Frame</span>
              </Button>
            ) : (
              <div className="flex w-full items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retakeFrame}
                  className="gap-2 border-rose-950/80 text-xs text-zinc-400 hover:bg-rose-950/40 hover:text-rose-200"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Retake</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirm}
                  className="gap-2 border border-rose-500/60 bg-rose-600 text-xs text-white hover:bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.4)]"
                >
                  <Check className="size-3.5" />
                  <span>Send to Explainable Research</span>
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
