import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TendrilPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const VenomCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const mousePos = useRef({ x: -100, y: -100 });
  const targetPos = useRef({ x: -100, y: -100 });
  const tendrils = useRef<TendrilPoint[]>([]);
  const trailHistory = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    // Only enable on desktop with fine pointer
    if (window.matchMedia("(pointer: coarse)").matches) return;

    // Initialize 6 tendril segment nodes
    tendrils.current = Array.from({ length: 6 }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: 0,
      vy: 0,
    }));

    const handleMouseMove = (e: MouseEvent) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);

      // Check if hovering interactive element
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("button, a, input, textarea, [role='button'], .interactive-hover")
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);
    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let animationId: number;

    const render = () => {
      // Smooth position interpolation (Spring / Lerp)
      const speed = isHovering ? 0.35 : 0.22;
      mousePos.current.x += (targetPos.current.x - mousePos.current.x) * speed;
      mousePos.current.y += (targetPos.current.y - mousePos.current.y) * speed;

      // Update trail history
      trailHistory.current.unshift({ x: mousePos.current.x, y: mousePos.current.y });
      if (trailHistory.current.length > 18) {
        trailHistory.current.pop();
      }

      // Update canvas tendril physics
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (trailHistory.current.length > 2) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Draw organic trailing fluid tendril
        for (let i = 0; i < trailHistory.current.length - 1; i++) {
          const p1 = trailHistory.current[i];
          const p2 = trailHistory.current[i + 1];
          if (!p1 || !p2) continue;
          const progress = 1 - i / trailHistory.current.length;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);

          const alpha = progress * (isHovering ? 0.45 : 0.25);
          const width = progress * (isHovering ? 7 : 3.5);

          ctx.strokeStyle = isHovering
            ? `rgba(0, 240, 255, ${alpha})`
            : `rgba(99, 102, 241, ${alpha})`;
          ctx.lineWidth = width;
          ctx.stroke();
        }

        ctx.restore();
      }

      // Update custom cursor nucleus DOM
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0)`;
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", resize);
    };
  }, [isHovering, isVisible]);

  if (!isVisible) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[9998] select-none"
        aria-hidden="true"
      />
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] -translate-x-1/2 -translate-y-1/2 will-change-transform"
        aria-hidden="true"
      >
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full transition-all duration-200 ease-out",
            isHovering
              ? "size-10 bg-cyan-500/15 border border-cyan-400 shadow-[0_0_24px_rgba(0,240,255,0.6)] backdrop-blur-[2px]"
              : "size-4 bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.8)]",
            isClicking && "scale-75 bg-cyan-300 shadow-[0_0_32px_rgba(0,240,255,1)]"
          )}
        >
          {isHovering && (
            <>
              {/* Organic targeting tendril notches */}
              <span className="absolute -top-1.5 size-1 bg-cyan-300 rounded-full shadow-[0_0_6px_#00F0FF]" />
              <span className="absolute -bottom-1.5 size-1 bg-cyan-300 rounded-full shadow-[0_0_6px_#00F0FF]" />
              <span className="absolute -left-1.5 size-1 bg-cyan-300 rounded-full shadow-[0_0_6px_#00F0FF]" />
              <span className="absolute -right-1.5 size-1 bg-cyan-300 rounded-full shadow-[0_0_6px_#00F0FF]" />
              <span className="size-1.5 rounded-full bg-cyan-400 animate-ping" />
            </>
          )}
        </div>
      </div>
    </>
  );
};
