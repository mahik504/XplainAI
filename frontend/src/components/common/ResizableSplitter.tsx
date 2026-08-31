import React, { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

interface ResizableSplitterProps {
  onResize: (newWidth: number) => void;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function ResizableSplitter({
  onResize,
  minWidth = 320,
  maxWidth = 800,
  className,
  onDragStart,
  onDragEnd,
}: ResizableSplitterProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = true;
      setDragging(true);
      onDragStart?.();
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onDragStart],
  );

  const handleTouchStart = useCallback(() => {
    dragRef.current = true;
    setDragging(true);
    onDragStart?.();
    document.body.style.userSelect = "none";
  }, [onDragStart]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      // Calculate cockpit width from right edge of screen
      const newWidth = Math.max(minWidth, Math.min(maxWidth, window.innerWidth - e.clientX));
      onResize(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragRef.current || !e.touches[0]) return;
      const clientX = e.touches[0].clientX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, window.innerWidth - clientX));
      onResize(newWidth);
    };

    const handleEnd = () => {
      if (!dragRef.current) return;
      dragRef.current = false;
      setDragging(false);
      onDragEnd?.();
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [maxWidth, minWidth, onDragEnd, onResize]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Explain Cockpit width"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={() => {
        // Double-click to toggle 50% split
        const halfWidth = Math.round(window.innerWidth * 0.5);
        onResize(Math.max(minWidth, Math.min(maxWidth, halfWidth)));
      }}
      className={cn(
        "group relative flex w-3 cursor-col-resize shrink-0 items-center justify-center transition-colors select-none z-30",
        dragging ? "bg-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.4)]" : "hover:bg-cyan-500/15",
        className,
      )}
      title="Drag to resize Explain Cockpit (Double-click to split 50/50)"
    >
      {/* Visual divider line & center grip handle */}
      <div
        className={cn(
          "h-full w-px transition-colors",
          dragging ? "bg-cyan-400" : "bg-white/[0.08] group-hover:bg-cyan-500/50",
        )}
      />
      <div
        className={cn(
          "absolute flex h-8 w-4 items-center justify-center rounded border transition-all",
          dragging
            ? "border-cyan-400 bg-cyan-950 text-cyan-200 shadow-md"
            : "border-white/10 bg-[#070b16]/90 text-slate-500 group-hover:border-cyan-500/40 group-hover:text-cyan-300",
        )}
      >
        <GripVertical className="size-3" />
      </div>
    </div>
  );
}
