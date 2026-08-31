import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/ui-store";

const RAMP = " ·.:-=+*#%@XPLAINAI";

export function AsciiTerrainBackground() {
  const preRef = useRef<HTMLPreElement>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;

    let asciiRAF = 0;
    let asciiLast = 0;
    let asciiT = 0;
    let asciiCols = 0;
    let asciiRows = 0;
    let asciiRadius = 240;

    const asciiSize = () => {
      if (!pre) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      asciiCols = Math.ceil(width / 6.8) + 8;
      asciiRows = Math.ceil(height / 10.5) + 8;
      asciiRadius = Math.max(160, Math.min(width, height) * 0.4);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = pre.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / 7.2,
        y: (e.clientY - rect.top) / 12.0,
        active: true,
      };
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("resize", asciiSize);
    asciiSize();

    const asciiFrame = (now: number) => {
      asciiRAF = requestAnimationFrame(asciiFrame);
      if (now - asciiLast < 33) return; // ~30-40fps for optimal ASCII text flow
      asciiLast = now;
      const prefersReduced =
        typeof window !== "undefined" &&
        Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      if (useUIStore.getState().ambientMotion && !prefersReduced) {
        asciiT += 0.038;
      }

      let out = "";
      const cx = asciiCols / 2;
      const cy = asciiRows * 0.46;
      const K = (Math.PI * 2 * 5.5) / asciiRadius;

      const mx = mouseRef.current.active ? mouseRef.current.x : cx;
      const my = mouseRef.current.active ? mouseRef.current.y : cy;

      for (let y = 0; y < asciiRows; y++) {
        for (let x = 0; x < asciiCols; x++) {
          const pdx = (x - cx) * 7.2;
          const pdy = (y - cy) * 12.0;
          const rr = Math.hypot(pdx, pdy);
          const nr = rr / asciiRadius;

          // Mouse proximity ripple
          const mdx = (x - mx) * 7.2;
          const mdy = (y - my) * 12.0;
          const mdist = Math.hypot(mdx, mdy);
          const mWave = Math.sin(mdist * 0.08 - asciiT * 2.5) * Math.exp(-mdist * 0.008) * 1.5;

          const rings = Math.cos(rr * K - asciiT * 1.8 + mWave);
          const core = Math.max(0, 1.2 - nr * 5.5);
          const chaos =
            Math.sin(x * 0.16 + asciiT) * 0.5 +
            Math.cos(y * 0.2 - asciiT * 0.8) * 0.5 +
            Math.sin((x + y) * 0.1 + asciiT * 1.3) * 0.4;
          const w = Math.max(0, 1.2 - nr);
          const v = rings * 2.4 * w + core * 3.4 + chaos * (1.3 - 0.75 * w) + (mouseRef.current.active && mdist < 120 ? 1.2 : 0);

          const idx = Math.floor(((v + 2.8) / 6.4) * (RAMP.length - 1));
          out += RAMP[Math.max(0, Math.min(RAMP.length - 1, idx))];
        }
        out += "\n";
      }

      if (pre) {
        pre.textContent = out;
      }
    };

    asciiRAF = requestAnimationFrame(asciiFrame);

    return () => {
      cancelAnimationFrame(asciiRAF);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", asciiSize);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden select-none bg-transparent">
      {/* Meta Kaihos Electric Cyan ASCII Terrain Matrix */}
      <pre
        ref={preRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full font-mono text-[9px] leading-[10px] sm:text-[11px] sm:leading-[12px] text-cyan-400/[0.18] font-bold whitespace-pre tracking-tighter transition-opacity duration-500 select-none overflow-hidden"
        style={{
          textShadow: "0 0 12px rgba(0, 240, 255, 0.3)",
        }}
      />
    </div>
  );
}
