import type React from "react";
import { resolveWallSegment } from "@/lib/hallway-shapes";
import {
  STANDING_HEIGHT,
  distanceToClearHeight,
  dormerFootprints,
  inwardNormal,
  parseWallKey,
  type WallSlopeMap,
} from "@/lib/wall-slopes";
import type { Point } from "@/types/planner";
import { STRINGS } from "@/lib/planner-translations";

interface CanvasSlopesProps {
  corners: Point[];
  wallSlopes: WallSlopeMap;
  ceilingHeight: number;
  /** cm -> px, the canvas's own scale conversion. */
  cm: (v: number) => number;
  /** Disambiguates this render's SVG <defs> ids from any other instance's. */
  idKey: string;
  lang: string;
  /** Dragging a dormer along its wall (absent: dormers are only drawn).
   * \`move\` gets the wanted position and is refused quietly when it can't be
   * built there; \`start\` opens the drag's one undo step. */
  dormerDrag?: {
    scale: number;
    start: () => void;
    move: (wallKey: string, id: string, position: number) => void;
  };
}

/**
 * Draws sloped ceilings ("Dachschrägen") on the 2D floor plan.
 *
 * This is the layer that makes the feature *useful* rather than decorative:
 * 3D shows you a slope exists, but you plan against the 2D plan, so the
 * restriction has to be legible here without doing arithmetic. Three things
 * are drawn per sloped wall:
 *
 * 1. A gradient band `run` cm deep, darkest at the wall -- "the roof comes
 *    down here, and it gets worse this way".
 * 2. Contour lines at meaningful heights, with the standing-height line
 *    emphasised. That line ("you can stand upright past here") is the single
 *    most-drawn annotation on real attic plans.
 * 3. A label giving the actual range, "110 → 240 cm".
 *
 * Everything is clipped to the room polygon, so an L-shaped room gets a
 * correctly-trimmed band for free. The band is deliberately extended well
 * past the wall's own endpoints before clipping: the roof plane continues
 * across the room's full width, so a point beyond the wall segment's end is
 * still under that pitch (same reasoning as distanceToWallLine's use of the
 * infinite line in wall-slopes.ts).
 */
export function CanvasSlopes({
  corners,
  wallSlopes,
  ceilingHeight,
  cm,
  idKey,
  lang,
  dormerDrag,
}: CanvasSlopesProps) {
  const entries = Object.entries(wallSlopes);
  if (entries.length === 0 || corners.length < 3) return null;

  const roomPoints = corners.map((c) => `${cm(c.x)},${cm(c.y)}`).join(" ");
  // A dormer raises the roof over its stretch: the band, its contours and
  // labels stop there (masked out) and the dormer is drawn on its own.
  const dormers = dormerFootprints(corners, wallSlopes, ceilingHeight).filter((d) => d.depth > 0);
  const toPoints = (pts: Point[]) => pts.map((p) => `${cm(p.x)},${cm(p.y)}`).join(" ");
  const strings = STRINGS[lang === "de" ? "de" : "en"];

  // Heights worth marking. Filtered per slope to those it actually crosses,
  // so a shallow slope doesn't draw four lines on top of each other.
  const CONTOURS = [100, 150, STANDING_HEIGHT, 220];

  return (
    <g className="pointer-events-none">
      <defs>
        <clipPath id={`slopeRoomClip-${idKey}`}>
          <polygon points={roomPoints} />
        </clipPath>
        <mask id={`slopeDormerMask-${idKey}`}>
          <polygon points={roomPoints} fill="white" />
          {dormers.map((d) => (
            <polygon key={d.dormer.id} points={toPoints(d.outline)} fill="black" />
          ))}
        </mask>
      </defs>

      <g
        clipPath={`url(#slopeRoomClip-${idKey})`}
        mask={dormers.length ? `url(#slopeDormerMask-${idKey})` : undefined}
      >
        {entries.map(([wallKey, slope]) => {
          if (slope.run <= 0 || slope.kneeHeight >= ceilingHeight) return null;
          const seg = resolveWallSegment(corners, parseWallKey(wallKey));
          if (!seg) return null;

          const { a, b } = seg;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len === 0) return null;

          // Unit vector along the wall, and the direction into the room.
          // inwardNormal probes the polygon rather than negating the outward
          // normal: the named-wall convention walks "bottom" and "left"
          // backwards, which silently flips a winding-derived normal and put
          // the whole band outside the room.
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          const { x: nx, y: ny } = inwardNormal(corners, a, b);

          // Overshoot along the wall so the band spans the whole room after
          // clipping, however the polygon is shaped.
          const EXT = 5000;
          const p0 = { x: a.x - ux * EXT, y: a.y - uy * EXT };
          const p1 = { x: b.x + ux * EXT, y: b.y + uy * EXT };
          const p2 = { x: p1.x + nx * slope.run, y: p1.y + ny * slope.run };
          const p3 = { x: p0.x + nx * slope.run, y: p0.y + ny * slope.run };
          const bandPoints = [p0, p1, p2, p3].map((p) => `${cm(p.x)},${cm(p.y)}`).join(" ");

          // Gradient runs along the inward normal from the wall midpoint,
          // in the same user units as everything else on this canvas.
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const gradId = `slopeGrad-${idKey}-${wallKey}`;

          return (
            <g key={`slope-${wallKey}`}>
              <defs>
                <linearGradient
                  id={gradId}
                  gradientUnits="userSpaceOnUse"
                  x1={cm(midX)}
                  y1={cm(midY)}
                  x2={cm(midX + nx * slope.run)}
                  y2={cm(midY + ny * slope.run)}
                >
                  {/* amber-500. A literal rather than a Tailwind class:
                      `stop-color` isn't reliably settable from a utility
                      class inside a gradient stop. */}
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.38} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>

              <polygon points={bandPoints} fill={`url(#${gradId})`} />

              {/* Inner edge of the slope -- past this the ceiling is flat. */}
              <line
                x1={cm(p3.x)}
                y1={cm(p3.y)}
                x2={cm(p2.x)}
                y2={cm(p2.y)}
                className="stroke-amber-500/50"
                strokeWidth={1}
                strokeDasharray="4 4"
              />

              {CONTOURS.filter((h) => h > slope.kneeHeight && h < ceilingHeight).map(
                (h, ci, arr) => {
                  const d = distanceToClearHeight(slope, h, ceilingHeight);
                  const c0 = { x: p0.x + nx * d, y: p0.y + ny * d };
                  const c1 = { x: p1.x + nx * d, y: p1.y + ny * d };
                  const isStanding = h === STANDING_HEIGHT;
                  // Spread the labels ALONG the wall rather than stacking them
                  // all at its midpoint: contour lines can sit only a few cm
                  // apart on a steep slope, so perpendicular offset alone is
                  // not enough separation and they overprint each other.
                  const along = ((ci + 1) / (arr.length + 1)) * len;
                  const lx = a.x + ux * along + nx * d;
                  const ly = a.y + uy * along + ny * d;
                  return (
                    <g key={`contour-${wallKey}-${h}`}>
                      <line
                        x1={cm(c0.x)}
                        y1={cm(c0.y)}
                        x2={cm(c1.x)}
                        y2={cm(c1.y)}
                        className={isStanding ? "stroke-amber-600" : "stroke-amber-500/40"}
                        strokeWidth={isStanding ? 1.5 : 1}
                        strokeDasharray={isStanding ? undefined : "2 5"}
                      />
                      <text
                        x={cm(lx)}
                        y={cm(ly)}
                        dx={4}
                        dy={-3}
                        className={
                          isStanding ? "fill-amber-700 dark:fill-amber-400" : "fill-amber-600/70"
                        }
                        style={{
                          fontSize: isStanding ? 10 : 9,
                          fontWeight: isStanding ? 700 : 500,
                        }}
                      >
                        {isStanding
                          ? lang === "de"
                            ? `${h} cm · aufrecht`
                            : `${h} cm · upright`
                          : `${h} cm`}
                      </text>
                    </g>
                  );
                },
              )}

              {/* Range label, hugging the wall itself. Kept near the wall's
                  start so it can't collide with the contour labels, which
                  are distributed across the middle of the span. */}
              <text
                x={cm(a.x + ux * len * 0.12 + nx * 12)}
                y={cm(a.y + uy * len * 0.12 + ny * 12)}
                textAnchor="middle"
                dominantBaseline="hanging"
                className="fill-amber-700 dark:fill-amber-400"
                style={{ fontSize: 10, fontWeight: 700 }}
              >
                {Math.round(slope.kneeHeight)} → {Math.round(ceilingHeight)} cm
              </text>
            </g>
          );
        })}
      </g>

      {dormers.map((d) => {
        const [w0, w1, d1, d0] = d.outline;
        const label = `${strings.dormer} · ${Math.round(d.height)} cm`;
        const onDown = (e: React.PointerEvent<SVGPolygonElement>) => {
          if (!dormerDrag) return;
          // Keep the stage's pan out of it.
          e.stopPropagation();
          e.preventDefault();
          const target = e.currentTarget;
          try {
            target.setPointerCapture(e.pointerId);
          } catch {
            // Synthetic pointers (tests) can't be captured; real ones always can.
          }
          dormerDrag.start();
          const len = Math.hypot(w1.x - w0.x, w1.y - w0.y) || 1;
          const ux = (w1.x - w0.x) / len;
          const uy = (w1.y - w0.y) / len;
          const startX = e.clientX;
          const startY = e.clientY;
          const startPos = d.dormer.position;
          const move = (ev: PointerEvent) => {
            const dx = (ev.clientX - startX) / dormerDrag.scale;
            const dy = (ev.clientY - startY) / dormerDrag.scale;
            dormerDrag.move(d.wallKey, d.dormer.id, Math.round(startPos + dx * ux + dy * uy));
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
        return (
          <g key={`dormer-${d.dormer.id}`}>
            <polygon
              points={toPoints(d.outline)}
              className="fill-amber-500/5 stroke-amber-600/70"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              style={{
                pointerEvents: dormerDrag ? "all" : "none",
                cursor: dormerDrag ? "move" : undefined,
                touchAction: "none",
              }}
              onPointerDown={onDown}
            >
              <title>{label}</title>
            </polygon>
            <text
              x={cm((w0.x + w1.x + d1.x + d0.x) / 4)}
              y={cm((w0.y + w1.y + d1.y + d0.y) / 4)}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-amber-700 dark:fill-amber-400"
              style={{ fontSize: 10, fontWeight: 700 }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
