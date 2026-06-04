import React from "react";
import type { Opening } from "@/types/planner";

interface CanvasOpeningsProps {
  openings: Opening[];
  setOpenings: React.Dispatch<React.SetStateAction<Opening[]>>;
  roomW: number;
  roomL: number;
  scale: number;
  cm: (val: number) => number;
  pushHistory: () => void;
  lang: string;
}

export function CanvasOpenings({
  openings,
  setOpenings,
  roomW,
  roomL,
  scale,
  cm,
  pushHistory,
  lang,
}: CanvasOpeningsProps) {
  return (
    <>
      {openings.map((o) => {
        const isH = o.wall === "top" || o.wall === "bottom";
        const wallLen = isH ? roomW : roomL;
        const wpx = cm(o.width);
        const ppx = cm(o.position);
        const hitThick = 20; // 20px hit target
        const isWindow = o.kind === "window";
        const visualThick = isWindow ? 10 : 6; // Thicker windows for better visibility

        const containerStyle: React.CSSProperties = {
          position: "absolute",
          cursor: isH ? "ew-resize" : "ns-resize",
          touchAction: "none",
          zIndex: 5,
          background: "transparent",
        };

        if (isH) {
          containerStyle.width = wpx;
          containerStyle.height = hitThick;
          containerStyle.left = ppx;
          containerStyle[o.wall] = -hitThick / 2;
        } else {
          containerStyle.width = hitThick;
          containerStyle.height = wpx;
          containerStyle.top = ppx;
          containerStyle[o.wall] = -hitThick / 2;
        }

        const visualStyle: React.CSSProperties = {
          width: isH ? "100%" : `${visualThick}px`,
          height: isH ? `${visualThick}px` : "100%",
          margin: "auto",
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        };

        if (o.kind === "door") {
          visualStyle.background = "var(--background)";
          if (isH) {
            visualStyle.borderLeft = "1px solid hsl(var(--foreground) / 0.3)";
            visualStyle.borderRight = "1px solid hsl(var(--foreground) / 0.3)";
          } else {
            visualStyle.borderTop = "1px solid hsl(var(--foreground) / 0.3)";
            visualStyle.borderBottom = "1px solid hsl(var(--foreground) / 0.3)";
          }
        } else {
          // Cool cyan/sky blue architectural window tint
          visualStyle.background =
            "linear-gradient(rgba(56, 189, 248, 0.35), rgba(56, 189, 248, 0.35)), var(--background)";
          visualStyle.border = "1.5px solid rgb(14, 165, 233)"; // sky-500 border
          visualStyle.boxShadow = "0 0 4px rgba(56, 189, 248, 0.4)";
          visualStyle.borderRadius = "1px";
        }

        const onOpeningDown = (e: React.PointerEvent) => {
          e.stopPropagation();
          e.preventDefault();
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);
          pushHistory();
          const startClient = isH ? e.clientX : e.clientY;
          const startPos = o.position;
          const id = o.id;
          const maxPos = Math.max(0, wallLen - o.width);
          const move = (ev: PointerEvent) => {
            const cur = isH ? ev.clientX : ev.clientY;
            const delta = (cur - startClient) / scale;
            const next = Math.min(maxPos, Math.max(0, startPos + delta));
            setOpenings((prev) =>
              prev.map((x) => (x.id === id ? { ...x, position: next } : x))
            );
          };
          const up = (ev: PointerEvent) => {
            try {
              target.releasePointerCapture(ev.pointerId);
            } catch (err) {
              // ignore release errors
            }
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
            <div style={visualStyle}>
              {o.kind === "window" && (
                <div
                  style={{
                    position: "absolute",
                    background: "rgb(14, 165, 233)",
                    top: isH ? "50%" : 0,
                    left: isH ? 0 : "50%",
                    width: isH ? "100%" : "1px",
                    height: isH ? "1px" : "100%",
                    transform: isH ? "translateY(-50%)" : "translateX(-50%)",
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
