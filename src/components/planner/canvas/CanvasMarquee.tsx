import React from "react";
import type { MarqueeRect } from "@/types/planner";

interface CanvasMarqueeProps {
  marqueeRect: MarqueeRect | null;
  cm: (val: number) => number;
}

export function CanvasMarquee({ marqueeRect, cm }: CanvasMarqueeProps) {
  if (!marqueeRect || (marqueeRect.w <= 0 && marqueeRect.h <= 0)) return null;

  return (
    <div
      className="pointer-events-none absolute border border-primary bg-primary/10"
      style={{
        left: cm(marqueeRect.x),
        top: cm(marqueeRect.y),
        width: cm(marqueeRect.w),
        height: cm(marqueeRect.h),
      }}
    />
  );
}
