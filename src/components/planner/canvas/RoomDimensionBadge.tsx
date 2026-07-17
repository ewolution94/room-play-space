import React from "react";
import { SlidersHorizontal } from "lucide-react";

interface RoomDimensionBadgeProps {
  roomW: number;
  roomL: number;
  selectedLabel?: string;
}

export function RoomDimensionBadge({ roomW, roomL, selectedLabel }: RoomDimensionBadgeProps) {
  return (
    <div className="absolute left-3 top-3 z-10 select-none">
      <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold shadow-sm text-foreground/80">
        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
        {roomW} × {roomL} cm
        {selectedLabel && (
          <span className="text-muted-foreground/75 font-normal">· {selectedLabel}</span>
        )}
      </div>
    </div>
  );
}
