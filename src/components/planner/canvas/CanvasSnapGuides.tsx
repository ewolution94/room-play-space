import React from "react";
import type { SnapGuide } from "@/types/planner";

interface CanvasSnapGuidesProps {
  guides: SnapGuide[];
  cm: (val: number) => number;
}

/** The lines a drag has snapped to (snapMove in lib/planner-math.ts), shown while it's held. */
export function CanvasSnapGuides({ guides, cm }: CanvasSnapGuidesProps) {
  if (guides.length === 0) return null;
  return (
    <>
      {guides.map((g) =>
        g.axis === "x" ? (
          <div
            key={`x${g.at}`}
            className="pointer-events-none absolute border-l border-dashed border-primary"
            style={{ left: cm(g.at), top: cm(g.from), height: cm(g.to - g.from), zIndex: 30 }}
          />
        ) : (
          <div
            key={`y${g.at}`}
            className="pointer-events-none absolute border-t border-dashed border-primary"
            style={{ top: cm(g.at), left: cm(g.from), width: cm(g.to - g.from), zIndex: 30 }}
          />
        ),
      )}
    </>
  );
}
