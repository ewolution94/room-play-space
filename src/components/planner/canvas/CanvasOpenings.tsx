import React from "react";
import type { Opening, Point } from "@/types/planner";
import { resolveWallSegment } from "@/lib/hallway-shapes";
import { effectiveSwing } from "@/lib/opening-geometry";
import {
  isGlazedOpening,
  isSwingingOpening,
  openingKindLabel,
  openingLeaves,
} from "@/lib/openings";
import { STRINGS } from "@/lib/planner-translations";
import type { WallOpenInterval } from "@/lib/room-adjacency";
import { inwardNormal, type WallSlopeMap } from "@/lib/wall-slopes";
import {
  dormerAround,
  openingProblem,
  roofWindowGeometry,
  roofWindowLength,
  type RoomShell,
} from "@/lib/roof-windows";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";

interface CanvasOpeningsProps {
  openings: Opening[];
  setOpenings: React.Dispatch<React.SetStateAction<Opening[]>>;
  corners: Point[];
  /** Roof windows sit in these slopes, and doors and windows on a sloped
   * wall stay inside their dormer (lib/roof-windows.ts). */
  wallSlopes: WallSlopeMap;
  ceilingHeight: number;
  scale: number;
  cm: (val: number) => number;
  pushHistory: () => void;
  lang: string;
  selectedOpeningId: string | null;
  setSelectedOpeningId: React.Dispatch<React.SetStateAction<string | null>>;
  // Open interval(s) per wall (wallColorKey() format) -- see
  // room-adjacency.ts. An opening whose span actually falls inside one of
  // these is skipped (not deleted -- see MultiRoomInspector.tsx for why
  // auto-detected opens deliberately don't touch saved opening data), so
  // it reappears exactly where it was if the wall is later closed again.
  // One sitting in a still-closed sub-run of a partially-open wall keeps
  // rendering normally.
  openWalls: Map<string, WallOpenInterval[]>;
  /** Mobile view-only mode (see useMobileViewOnly): a tap/drag on a door or
   * window becomes a no-op instead of selecting/moving it, so the gesture
   * passes through untouched to the stage's own pan handler -- on mobile,
   * a drag anywhere on the canvas should only ever pan the view. */
  viewOnly?: boolean;
  /** Door or window id -> the items in its way (lib/clearance.ts): drawn red, and counted in
   * the tooltip. */
  blockedOpenings?: Map<string, string[]>;
}

export function CanvasOpenings({
  openings,
  setOpenings,
  corners,
  wallSlopes,
  ceilingHeight,
  scale,
  cm,
  pushHistory,
  lang,
  selectedOpeningId,
  setSelectedOpeningId,
  openWalls,
  viewOnly,
  blockedOpenings,
}: CanvasOpeningsProps) {
  const coarse = useCoarsePointer();
  // A drag only ever lands where the opening can be built; one that already
  // couldn't (an imported room, say) keeps the old clamp-only behaviour.
  const shellFor = (list: Opening[]): RoomShell => ({
    corners,
    wallSlopes,
    ceilingHeight,
    openings: list,
  });
  const fitsAt = (prev: Opening[], moved: Opening) =>
    !openingProblem(moved, shellFor(prev.map((x) => (x.id === moved.id ? moved : x))));
  return (
    <>
      {openings.map((o) => {
        if (o.kind === "roof-window") {
          return (
            <RoofWindowOnPlan
              key={o.id}
              o={o}
              corners={corners}
              wallSlopes={wallSlopes}
              ceilingHeight={ceilingHeight}
              scale={scale}
              cm={cm}
              lang={lang}
              isSelected={selectedOpeningId === o.id}
              viewOnly={viewOnly}
              hitPad={coarse ? 12 : 4}
              onSelect={() => setSelectedOpeningId(o.id)}
              pushHistory={pushHistory}
              setOpenings={setOpenings}
              fitsAt={fitsAt}
              buildable={fitsAt(openings, o)}
            />
          );
        }
        // An opening whose span actually overlaps an open interval on its
        // wall has nothing to hang a door/window on there -- mirrors the
        // same string-vs-numeric wall key convention used throughout (see
        // ThreeDView.tsx's identical colorKey derivation).
        const wallKey = typeof o.wall === "string" ? o.wall : String(o.wall);
        const openIntervals = openWalls.get(wallKey) ?? [];
        const oStart = o.position;
        const oEnd = o.position + o.width;
        if (openIntervals.some((iv) => oStart < iv.end && oEnd > iv.start)) return null;

        // Find start and end corners for the wall
        const seg = resolveWallSegment(corners, o.wall);
        if (!seg) return null;
        const ptA = seg.a;
        const ptB = seg.b;

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
        const hitThick = coarse ? 40 : 24; // px; finger-sized on a touch screen
        const isGlazed = isGlazedOpening(o.kind);
        const swings = isSwingingOpening(o.kind);
        const leaves = openingLeaves(o);
        const visualThickCm = 5;

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
          height: cm(visualThickCm),
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
        const blockedBy = blockedOpenings?.get(o.id)?.length ?? 0;
        const frameColor = blockedBy
          ? "#ef4444"
          : o.color || (isGlazed ? "rgb(14, 165, 233)" : "#475569");

        // Calculate paths for door swing in 2D. A terrace door swings like
        // any other door -- that's most of the point of drawing one in plan,
        // since floor-length glazing still eats the floor it opens over --
        // so it gets the same leaf + arc, doubled when it has two leaves.
        const swingPaths: { leaf: string; arc: string }[] = [];
        const W = cm(o.width);
        const hinge = o.hinge || "start";

        // "in" must mean into the room on every wall. The paths below are
        // written in the opening's own rotated frame, whose -y side is only
        // actually inward when ptA->ptB runs forward -- and
        // resolveWallSegment deliberately walks "bottom" and "left"
        // backwards. See effectiveSwing for the full story; measured before
        // the fix, a `swing: "in"` door drew OUTSIDE the room on top and
        // right, inside on bottom and left.
        const swing = effectiveSwing(o.swing, corners, ptA, ptB);

        /**
         * One hinged leaf. `origin` is where it's hinged along the opening
         * (0 = the start end, `W` = the far end) and `span` how far it
         * reaches -- the full width for a single leaf, half for each of a
         * pair. The wall itself is the line y = W in this local frame.
         *
         * The four hinge x swing cases below are the original single-leaf
         * paths with the radius parameterised; the arc sweep flags are
         * carried over verbatim rather than re-derived, since (per
         * docs/LEARNINGS.md) they don't follow a pattern you can reason your
         * way to.
         */
        const leafPaths = (origin: number, span: number, hingedAtStart: boolean) => {
          const tip = hingedAtStart ? origin + span : origin - span;
          if (hingedAtStart) {
            return swing === "in"
              ? {
                  leaf: `M ${origin},${W} L ${origin},${W - span}`,
                  arc: `M ${tip},${W} A ${span},${span} 0 0,0 ${origin},${W - span}`,
                }
              : {
                  leaf: `M ${origin},${W} L ${origin},${W + span}`,
                  arc: `M ${tip},${W} A ${span},${span} 0 0,1 ${origin},${W + span}`,
                };
          }
          return swing === "in"
            ? {
                leaf: `M ${origin},${W} L ${origin},${W - span}`,
                arc: `M ${tip},${W} A ${span},${span} 0 0,1 ${origin},${W - span}`,
              }
            : {
                leaf: `M ${origin},${W} L ${origin},${W + span}`,
                arc: `M ${tip},${W} A ${span},${span} 0 0,0 ${origin},${W + span}`,
              };
        };

        if (swings) {
          if (leaves === 2) {
            // A pair meeting in the middle: each leaf is half the opening
            // and hinged at its own end, so the two arcs mirror each other.
            swingPaths.push(leafPaths(0, W / 2, true), leafPaths(W, W / 2, false));
          } else {
            swingPaths.push(leafPaths(hinge === "start" ? 0 : W, W, hinge === "start"));
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
          // Deliberately does NOT stopPropagation/preventDefault here --
          // leaving the event completely untouched lets it bubble up to
          // the stage's own pan handler, same as if this element weren't
          // here at all.
          if (viewOnly) return;
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
          // On a sloped wall a door or window lives in a dormer's front, so
          // it slides within that dormer rather than along the whole wall.
          const dormer = dormerAround(wallSlopes[wallKey], o);
          const minPos = dormer ? dormer.position : 0;
          const maxPos = dormer
            ? Math.max(minPos, dormer.position + dormer.width - o.width)
            : Math.max(0, wallLen - o.width);
          const wasBuildable = fitsAt(openings, o);

          const move = (ev: PointerEvent) => {
            const curMouseX = (ev.clientX - stageRect.left) / scale;
            const curMouseY = (ev.clientY - stageRect.top) / scale;
            const pdx = curMouseX - startMouseX;
            const pdy = curMouseY - startMouseY;

            // Vector projection onto the wall unit vector
            const shift = pdx * Ux + pdy * Uy;
            const next = Math.min(maxPos, Math.max(minPos, startPos + shift));

            setOpenings((prev) => {
              const moved = { ...o, ...prev.find((x) => x.id === o.id), position: next };
              // Stops at a neighbour instead of sliding over it.
              if (wasBuildable && !fitsAt(prev, moved)) return prev;
              return prev.map((x) => (x.id === o.id ? moved : x));
            });
          };

          const up = (ev: PointerEvent) => {
            try {
              target.releasePointerCapture(ev.pointerId);
            } catch {
              // Only throws once the pointer is no longer active -- no capture left to release.
            }
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };

          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        };

        const strings = STRINGS[lang === "de" ? "de" : "en"];
        const kindLabel = openingKindLabel(o, strings);
        const dragLabel = lang === "de" ? "ziehen zum Bewegen" : "drag to move";

        return (
          <HoverTooltip
            key={o.id}
            content={`${kindLabel} (${o.width}cm) — ${blockedBy ? `${strings.openingBlocked(blockedBy)} — ` : ""}${dragLabel}`}
          >
            <div style={containerStyle} onPointerDown={onOpeningDown}>
              {/* 2D swing representation -- one leaf for a door, two for a
                  double terrace door. */}
              {swingPaths.length > 0 && (
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
                  {swingPaths.map((p, i) => (
                    <React.Fragment key={i}>
                      {/* Door Leaf (Solid) */}
                      <path
                        d={p.leaf}
                        fill="none"
                        stroke={frameColor}
                        className={o.color ? "" : "stroke-slate-600 dark:stroke-slate-300"}
                        strokeWidth="1.5"
                      />
                      {/* Swing Arc (Dashed) */}
                      <path
                        d={p.arc}
                        fill="none"
                        stroke={frameColor}
                        className={o.color ? "" : "stroke-slate-400 dark:stroke-slate-500"}
                        strokeWidth="1.2"
                        strokeDasharray="3,3"
                        opacity="0.9"
                      />
                    </React.Fragment>
                  ))}
                </svg>
              )}

              <div style={visualStyle}>
                {/* The glazing line down the middle of the pane, and -- on a
                    two-leaf terrace door -- the mullion the two leaves meet
                    at, which is what tells the two apart at a glance. */}
                {isGlazed && (
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
                {leaves === 2 && (
                  <div
                    style={{
                      position: "absolute",
                      background: frameColor,
                      top: 0,
                      bottom: 0,
                      left: "50%",
                      width: "1.5px",
                      transform: "translateX(-50%)",
                    }}
                  />
                )}
              </div>
            </div>
          </HoverTooltip>
        );
      })}
    </>
  );
}

/**
 * A roof window on the plan: its footprint inside the slope band (it's in
 * the ceiling, so drawn dashed, the way plans draw what's overhead). Dragged
 * along the wall and up or down the slope at once; a move that would take it
 * out of its slope, into a dormer or over another roof window is tried along
 * each direction alone before it's refused, so it slides along whatever
 * stopped it.
 */
function RoofWindowOnPlan({
  o,
  corners,
  wallSlopes,
  ceilingHeight,
  scale,
  cm,
  lang,
  isSelected,
  viewOnly,
  hitPad,
  onSelect,
  pushHistory,
  setOpenings,
  fitsAt,
  buildable,
}: {
  o: Opening;
  corners: Point[];
  wallSlopes: WallSlopeMap;
  ceilingHeight: number;
  scale: number;
  cm: (val: number) => number;
  lang: string;
  isSelected: boolean;
  viewOnly?: boolean;
  hitPad: number;
  onSelect: () => void;
  pushHistory: () => void;
  setOpenings: React.Dispatch<React.SetStateAction<Opening[]>>;
  fitsAt: (prev: Opening[], moved: Opening) => boolean;
  /** Whether it can be built where it is now: only then is a drag held to that. */
  buildable: boolean;
}) {
  const geo = roofWindowGeometry(o, corners, wallSlopes, ceilingHeight);
  const seg = resolveWallSegment(corners, o.wall);
  const slope = wallSlopes[String(o.wall)];
  if (!geo || !seg || !slope) return null;
  const dx = seg.b.x - seg.a.x;
  const dy = seg.b.y - seg.a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const u = { x: dx / len, y: dy / len };
  const n = inwardNormal(corners, seg.a, seg.b);
  const cx = geo.footprint.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = geo.footprint.reduce((sum, p) => sum + p.y, 0) / 4;
  const depth = geo.highOff - geo.lowOff;
  const thetaDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const frame = o.color || "rgb(14, 165, 233)";
  const rise = ceilingHeight - slope.kneeHeight;

  const onDown = (e: React.PointerEvent) => {
    if (viewOnly) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointers (tests) can't be captured; real ones always can.
    }
    pushHistory();
    const stageEl = document.getElementById("tour-canvas");
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / scale;
    const startY = (e.clientY - rect.top) / scale;
    const startPos = o.position;
    const startLowOff = geo.lowOff;

    const move = (ev: PointerEvent) => {
      const pdx = (ev.clientX - rect.left) / scale - startX;
      const pdy = (ev.clientY - rect.top) / scale - startY;
      const along = Math.round(startPos + pdx * u.x + pdy * u.y);
      // Distance into the room on the plan becomes height up the slope.
      const lowOff = startLowOff + pdx * n.x + pdy * n.y;
      const sill = Math.round(slope.kneeHeight + (rise * lowOff) / slope.run);
      setOpenings((prev) => {
        const current = prev.find((x) => x.id === o.id) ?? o;
        const tries = [
          { ...current, position: along, sill },
          { ...current, position: along },
          { ...current, sill },
        ];
        const moved = buildable ? tries.find((c) => fitsAt(prev, c)) : tries[0];
        if (!moved) return prev;
        return prev.map((x) => (x.id === o.id ? moved : x));
      });
    };
    const up = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // Only throws once the pointer is no longer active -- no capture left to release.
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const strings = STRINGS[lang === "de" ? "de" : "en"];
  const size = `${Math.round(o.width)} × ${Math.round(roofWindowLength(o))} cm`;
  return (
    <HoverTooltip
      content={`${strings.roofWindow} (${size}) — ${strings.roofWindowTop(Math.round(geo.high))} — ${lang === "de" ? "ziehen zum Bewegen" : "drag to move"}`}
    >
      <div
        role="button"
        aria-label={`${strings.roofWindow} ${size}`}
        onPointerDown={onDown}
        style={{
          position: "absolute",
          left: cm(cx),
          top: cm(cy),
          width: cm(o.width) + 2 * hitPad,
          height: cm(depth) + 2 * hitPad,
          transform: `translate(-50%, -50%) rotate(${thetaDeg}deg)`,
          cursor: "move",
          touchAction: "none",
          zIndex: isSelected ? 12 : 5,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: hitPad,
            background: "rgba(56, 189, 248, 0.22)",
            border: `1.5px dashed ${frame}`,
            borderRadius: 2,
            outline: isSelected ? "2px solid var(--primary)" : undefined,
            outlineOffset: isSelected ? 2 : undefined,
          }}
        >
          {/* The sash bar across the middle, as on the wall windows. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              height: 1,
              background: frame,
              opacity: 0.7,
            }}
          />
        </div>
      </div>
    </HoverTooltip>
  );
}
