import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

const cyanDrift = { x: [0, 48, 0], y: [0, 32, 0], opacity: [0.35, 0.7, 0.35] };
const violetDrift = { x: [0, -56, 0], y: [0, -28, 0], opacity: [0.3, 0.65, 0.3] };

interface NeuralPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function NeuralField({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let frame = 0;
    let points: NeuralPoint[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let running = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${String(width)}px`;
      canvas.style.height = `${String(height)}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(36, Math.max(18, Math.floor((width * height) / 70_000)));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
      }));
    };

    const draw = () => {
      if (!running) return;
      context.clearRect(0, 0, width, height);

      for (const point of points) {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < 0 || point.x > width) point.vx *= -1;
        if (point.y < 0 || point.y > height) point.vy *= -1;
      }

      const linkDistance = Math.min(160, width * 0.12);

      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        if (!a) continue;

        for (let j = i + 1; j < points.length; j += 1) {
          const b = points[j];
          if (!b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > linkDistance) continue;

          const alpha = (1 - dist / linkDistance) * 0.28;
          context.strokeStyle = `oklch(0.82 0.135 199 / ${String(alpha)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }

        context.fillStyle = "oklch(0.85 0.14 197 / 0.55)";
        context.beginPath();
        context.arc(a.x, a.y, 1.4, 0, Math.PI * 2);
        context.fill();
      }

      frame = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  if (!active) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 opacity-70" />;
}

export function AmbientBackground() {
  const ambientMotion = useUIStore((state) => state.ambientMotion);
  const prefersReducedMotion = useReducedMotion();
  const animated = ambientMotion && prefersReducedMotion !== true;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,oklch(0.24_0.05_250_/_70%),transparent_68%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_80%_100%,oklch(0.22_0.07_300_/_45%),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_80%,oklch(0.3_0.08_199_/_18%),transparent_70%)]" />

      <motion.div
        className="absolute -top-40 -left-32 size-[38rem] rounded-full bg-neon-cyan/14 blur-[120px] will-change-transform"
        {...(animated ? { animate: cyanDrift } : {})}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute -right-40 -bottom-48 size-[42rem] rounded-full bg-neon-violet/16 blur-[130px] will-change-transform"
        {...(animated ? { animate: violetDrift } : {})}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      <NeuralField active={animated} />
      <div className={cn("absolute inset-0", animated ? "moving-grid" : "grid-overlay")} />
      <div className="scanline-overlay absolute inset-0" />
    </div>
  );
}
