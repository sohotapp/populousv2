"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  side: "left" | "right";
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizeHandle({ side, onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      // For left sidebar, positive delta = expand
      // For right sidebar, negative delta = expand
      const adjustedDelta = side === "left" ? delta : -delta;
      onResize(adjustedDelta);
      setStartX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, startX, side, onResize]);

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 w-1 cursor-col-resize z-10 group",
        side === "left" ? "right-0" : "left-0",
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Visual indicator on hover/drag */}
      <div
        className={cn(
          "absolute inset-y-0 w-0.5 transition-colors duration-100",
          side === "left" ? "right-0" : "left-0",
          isDragging
            ? "bg-[hsl(0,0%,30%)]"
            : "bg-transparent group-hover:bg-[hsl(0,0%,20%)]"
        )}
      />
    </div>
  );
}
