import React from "react";
import type { Opening, Point } from "@/types/planner";

interface CanvasOpeningsProps {
  openings: Opening[];
  setOpenings: React.Dispatch<React.SetStateAction<Opening[]>>;
  corners: Point[];
  scale: number;
  cm: (val: number) => number;
  pushHistory: () => void;
  lang: string;
  selectedOpeningId: string | null;
  setSelectedOpeningId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function CanvasOpenings({
  openings,
  setOpenings,
  corners,
  scale,
  cm,
  pushHistory,
  lang,
  selectedOpeningId,
  setSelectedOpeningId,
}: CanvasOpeningsProps) {
  return (
    <>
      {openings.map((o) => {
        // Find start and end corners for the wall
        let ptA = corners[0];
        let ptB = corners[1];
        if (o.wall === "right") {
          ptA = corners[1];
          ptB = corners[2];
        } else if (o.wall === "bottom") {
          ptA = corners[3];
          ptB = corners[2]; // left-to-right
        } else if (o.wall === "left") {
          ptA = corners[0];
          ptB = corners[3]; // top-to-bottom
        }

        // Calculate wall vector, length, and unit vector
        const dx = ptB.x - ptA.x;
        const dy = ptB.y - ptA.y;
        const wallLen = Math.sqrt(dx * dx + dy * dy);
        if (wallLen <= 0.1) return null;
        const Ux = dx / wallLen;
        const Uy = dy / wallLen;

        // Position of opening center along the wall segment
        const distAlong = o.position + o.width / 2;
        const cx = ptA.x + distAlong * Ux;
        const cy = ptA.y + distAlong * Uy;

        const theta = Math.atan2(dy, dx);
        const thetaDeg = (theta * 180) / Math.PI;

        const isSelected = selectedOpeningId === o.id;
        const hitThick = 24; // 24px hit target
        const isWindow = o.kind === "window";
        const visualThick = isWindow ? 10 : 6;

        const containerStyle: React.CSSProperties = {
          position: "absolute",
          width: cm(o.width),
          height: hitThick,
          left: cm(cx),
          top: cm(cy),
          transform: `translate(-50%, -50%) rotate(${thetaDeg}deg)`,
          transformOrigin: "center center",
          cursor: "move",
          touchAction: "none",
          zIndex: isSelected ? 12 : 5,
          background: "transparent",
        };

        const visualStyle: React.CSSProperties = {
          width: "100%",
          height: `${visualThick}px`,
          margin: "auto",
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          outline: isSelected ? "2px solid var(--primary)" : undefined,
          outlineOffset: isSelected ? 2 : undefined,
        };

        // Get opening color or fall back to default styling
        const frameColor = o.color || (isWindow ? "rgb(14, 165, 233)" : "#475569");

        // Calculate paths for door swing in 2D
        let dLeaf = "";
        let dArc = "";
        const W = cm(o.width);
        const hinge = o.hinge || "start";
        const swing = o.swing || "in";

        if (o.kind === "door") {
          if (hinge === "start") {
            if (swing === "in") {
              dLeaf = `M 0,${W} L 0,0`;
              dArc = `M ${W},${W} A ${W},${W} 0 0,0 0,0`;
            } else {
              dLeaf = `M 0,${W} L 0,${2 * W}`;
              dArc = `M ${W},${W} A ${W},${W} 0 0,1 0,${2 * W}`;
            }
          } else {
            if (swing === "in") {
              dLeaf = `M ${W},${W} L ${W},0`;
              dArc = `M 0,${W} A ${W},${W} 0 0,1 ${W},0`;
            } else {
              dLeaf = `M ${W},${W} L ${W},${2 * W}`;
              dArc = `M 0,${W} A ${W},${W} 0 0,0 ${W},${2 * W}`;
            }
          }
        }

        if (o.kind === "door") {
          visualStyle.background = o.color || "var(--background)";
          visualStyle.borderLeft = `1px solid ${frameColor}`;
          visualStyle.borderRight = `1px solid ${frameColor}`;
          visualStyle.borderTop = o.color ? `1px solid ${frameColor}` : "none";
          visualStyle.borderBottom = o.color ? `1px solid ${frameColor}` : "none";
        } else {
          // Linear gradient window tint with custom frame border color
          visualStyle.background = o.color
            ? `linear-gradient(rgba(56, 189, 248, 0.25), rgba(56, 189, 248, 0.25)), ${o.color}`
            : "linear-gradient(rgba(56, 189, 248, 0.35), rgba(56, 189, 248, 0.35)), var(--background)";
          visualStyle.border = `1.5px solid ${frameColor}`;
          visualStyle.boxShadow = "0 0 4px rgba(56, 189, 248, 0.4)";
          visualStyle.borderRadius = "1px";
        }

        const onOpeningDown = (e: React.PointerEvent) => {
          e.stopPropagation();
          e.preventDefault();
          
          // Select this opening and clear furniture selections
          setSelectedOpeningId(o.id);
          
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);
          pushHistory();

          const stageEl = document.getElementById("tour-canvas");
          if (!stageEl) return;

          const stageRect = stageEl.getBoundingClientRect();
          // Mouse start relative to stage origin in cm
          const startMouseX = (e.clientX - stageRect.left) / scale;
          const startMouseY = (e.clientY - stageRect.top) / scale;
          const startPos = o.position;
          const maxPos = Math.max(0, wallLen - o.width);

          const move = (ev: PointerEvent) => {
            const curMouseX = (ev.clientX - stageRect.left) / scale;
            const curMouseY = (ev.clientY - stageRect.top) / scale;
            const pdx = curMouseX - startMouseX;
            const pdy = curMouseY - startMouseY;

            // Vector projection onto the wall unit vector
            const shift = pdx * Ux + pdy * Uy;
            const next = Math.min(maxPos, Math.max(0, startPos + shift));

            setOpenings((prev) =>
              prev.map((x) => (x.id === o.id ? { ...x, position: next } : x))
            );
          };

          const up = (ev: PointerEvent) => {
            try {
              target.releasePointerCapture(ev.pointerId);
            } catch (err) {}
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };

          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        };

        const kindLabel = o.kind === "door" ? (lang === "de" ? "Tür" : "Door") : (lang === "de" ? "Fenster" : "Window");
        const dragLabel = lang === "de" ? "ziehen zum Bewegen" : "drag to move";

        return (
          <div
            key={o.id}
            style={containerStyle}
            onPointerDown={onOpeningDown}
            title={`${kindLabel} (${o.width}cm) — ${dragLabel}`}
          >
            {/* 2D Door Swing Representation */}
            {o.kind === "door" && (
              <svg
                width={W}
                height={2 * W}
                overflow="visible"
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  overflow: "visible",
                  zIndex: 2,
                }}
              >
                {/* Door Leaf (Solid) */}
                <path
                  d={dLeaf}
                  fill="none"
                  stroke={frameColor}
                  className={o.color ? "" : "stroke-slate-600 dark:stroke-slate-300"}
                  strokeWidth="1.5"
                />
                {/* Swing Arc (Dashed) */}
                <path
                  d={dArc}
                  fill="none"
                  stroke={frameColor}
                  className={o.color ? "" : "stroke-slate-400 dark:stroke-slate-500"}
                  strokeWidth="1.2"
                  strokeDasharray="3,3"
                  opacity="0.9"
                />
              </svg>
            )}

            <div style={visualStyle}>
              {o.kind === "window" && (
                <div
                  style={{
                    position: "absolute",
                    background: frameColor,
                    top: "50%",
                    left: 0,
                    width: "100%",
                    height: "1px",
                    transform: "translateY(-50%)",
                    opacity: 0.8,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
