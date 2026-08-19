import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, RefreshCw, Scan, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { hudAudio } from "@/features/audio/audio-sfx";

interface HolographicVisionScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageUrl: string, promptText: string) => void;
}

export function HolographicVisionScanner({
  isOpen,
  onClose,
  onCapture,
}: HolographicVisionScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setPermissionError(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    hudAudio.playSweep();
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      } else {
        setPermissionError("Camera API not supported in this environment.");
      }
    } catch (err: any) {
      console.warn("Could not access camera:", err);
      setPermissionError("Camera access denied. Please grant permission to scan documents or diagrams.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    hudAudio.playChirp();
    setIsScanning(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCapturedImage(dataUrl);
    }

    setTimeout(() => {
      setIsScanning(false);
    }, 600);
  };

  const handleInject = () => {
    if (!capturedImage) return;
    hudAudio.playClick(1600);
    const opticalPrompt = `[OPTICAL SCAN CAPTURED]: Please analyze and explain the visual evidence, equations, and diagrams extracted from this research snapshot.`;
    onCapture(capturedImage, opticalPrompt);
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
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-cyan-500/40 bg-[#0a0f1d]/95 p-6 shadow-[0_0_50px_rgba(6,182,212,0.25)] backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 font-mono">
            <div className="flex items-center gap-2">
              <Scan className="size-4 text-cyan-400 animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-cyan-300 uppercase">
                OPTICAL VISION SCANNER
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                hudAudio.playClick();
                onClose();
              }}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Viewport */}
          <div className="relative my-4 aspect-video w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black shadow-inner">
            {permissionError ? (
              <div className="flex size-full flex-col items-center justify-center p-6 text-center font-mono text-xs text-amber-300">
                <p>{permissionError}</p>
                <p className="mt-2 text-[11px] text-slate-400">
                  You can upload files or paste research papers directly in chat.
                </p>
              </div>
            ) : capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured optical analysis"
                className="size-full object-cover"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="size-full object-cover"
                />

                {/* HUD Reticles */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative size-24 rounded-full border border-cyan-400/40 animate-spin" style={{ animationDuration: "12s" }}>
                    <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
                  </div>
                  <div className="absolute size-14 rounded-full border border-cyan-400/30" />
                </div>

                {/* Corner Brackets */}
                <div className="pointer-events-none absolute inset-4 flex flex-col justify-between">
                  <div className="flex justify-between font-mono text-[10px] text-cyan-400/70">
                    <span>[LENS: 84° FOV]</span>
                    <span>[FPS: 60.0]</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-cyan-400/70">
                    <span>[MODE: EVIDENCE_EXTRACT]</span>
                    <span>[ISO: AUTO]</span>
                  </div>
                </div>

                {/* Scanning Laser */}
                {isScanning && (
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent animate-pulse" />
                )}
              </>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 font-mono text-xs">
            {capturedImage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  hudAudio.playClick();
                  setCapturedImage(null);
                  startCamera();
                }}
                className="gap-1.5 border-white/10 text-slate-300 hover:bg-white/[0.06] hover:text-white"
              >
                <RefreshCw className="size-3.5" />
                <span>Retake Frame</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={Boolean(permissionError)}
                onClick={captureFrame}
                className="w-full gap-2 border border-cyan-500/50 bg-gradient-to-r from-cyan-500 to-indigo-600 font-mono text-xs text-white hover:from-cyan-400 hover:to-indigo-500 shadow-[0_0_20px_rgba(6,182,212,0.35)]"
              >
                <Camera className="size-4" />
                <span>Capture Analysis Frame</span>
              </Button>
            )}

            {capturedImage && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    hudAudio.playClick();
                    onClose();
                  }}
                  className="text-slate-400 hover:bg-white/[0.06] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleInject}
                  className="gap-1.5 border border-cyan-500/50 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500 shadow-[0_0_20px_rgba(6,182,212,0.35)]"
                >
                  <Check className="size-3.5" />
                  <span>Analyze Frame</span>
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
