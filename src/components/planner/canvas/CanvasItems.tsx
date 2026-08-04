import React from "react";
import { RotateCw, Wand2 } from "lucide-react";
import { readableText } from "@/lib/planner-math";
import { PRESET_BY_KEY, getDefaultHeight } from "@/lib/planner-presets";
import type { Item } from "@/types/planner";
import { HoverTooltip } from "@/components/ui/hover-tooltip";

interface CanvasItemsProps {
  items: Item[];
  selectedIds: Set<string>;
  cm: (val: number) => number;
  onItemPointerDown: (e: React.PointerEvent, item: Item) => void;
  onRotateHandleDown: (e: React.PointerEvent, item: Item) => void;
  dragToRotateLabel: string;
  /** Tooltip clarifying the compact "L×W×H" figure on each box. */
  dimsLabel: string;
  /** The same clarification printed inline after the numbers ("L×W×H" /
   * "L×B×H") -- three bare figures are ambiguous, and a tooltip only helps
   * someone who already thought to hover. */
  dimsAxesLabel: string;
  /** Items that are too tall for the sloped ceiling where they currently
   * sit, keyed by item id (see SlopeFitIssue in CanvasArea.tsx). Deliberately
   * a persistent marker rather than a drop-time toast: a layout you come back
   * to tomorrow should still tell you what's wrong with it. */
  slopeIssues?: Map<string, { available: number; required: number; shortfall: number }>;
}

// Base stacking order by layer -- "under" items (rugs, mats) always render
// beneath "main" furniture, which renders beneath "on-top" items (lamps,
// laptops, ...), which renders beneath "wall" items (sconces, art, mirrors
// -- mounted highest of all, so they should never visually disappear
// behind floor furniture in this 2D top-down view). Selected items are
// boosted above everything regardless of layer so they're never hidden
// mid-drag. Opacity gives the same tiers a visual read even when items
// overlap: under items read as translucent/beneath, on-top and wall items
// are nearly solid but slightly lifted.
const LAYER_BASE_Z: Record<string, number> = { under: 1, main: 2, "on-top": 3, wall: 4 };
const LAYER_OPACITY: Record<string, number> = { under: 0.55, main: 1, "on-top": 0.92, wall: 0.85 };

export function CanvasItems({
  items,
  selectedIds,
  cm,
  onItemPointerDown,
  onRotateHandleDown,
  dragToRotateLabel,
  dimsLabel,
  dimsAxesLabel,
  slopeIssues,
}: CanvasItemsProps) {
  // Whole cm -- a dragged item's raw float would otherwise render 15 digits
  // in a box a few pixels wide.
  const round = (v: number) => Math.round(v);
  return (
    <>
      {items.map((it) => {
        const isSelected = selectedIds.has(it.id);
        const layer = it.layer ?? "main";
        const shape = it.shape ?? "rect";
        const baseZ = LAYER_BASE_Z[layer] ?? LAYER_BASE_Z.main;
        // A real Kenney 3D model (see Preset.kitModel) whose color has been
        // changed away from the preset's own default is "tinted" -- the 3D
        // view recolors the model's original materials to match (see
        // tintKitMaterial in ThreeDView.tsx), which is easy to forget was
        // done since the 2D box here always just shows it.color regardless.
        // A quiet corner marker (see below) is the only 2D-side hint that
        // what's rendered in 3D isn't the model's stock appearance.
        const preset = it.icon ? PRESET_BY_KEY[it.icon] : undefined;
        const isKitTinted =
          !!preset?.kitModel && it.color.toLowerCase() !== preset.color.toLowerCase();
        const slopeIssue = slopeIssues?.get(it.id);
        return (
          <div
            key={it.id}
            onPointerDown={(e) => onItemPointerDown(e, it)}
            className="absolute flex cursor-all-scroll items-center justify-center text-center text-xs font-medium"
            style={{
              left: cm(it.x),
              top: cm(it.y),
              width: cm(it.width),
              height: cm(it.length),
              color: readableText(it.color),
              touchAction: "none",
              userSelect: "none",
              transform: `rotate(${it.rotation}deg)`,
              transformOrigin: "center center",
              // Selection wins the outline when both apply -- you need to
              // see what you've got hold of. The slope warning still reads
              // through via the badge below.
              outline: isSelected
                ? "2px solid var(--primary)"
                : slopeIssue
                  ? "2px dashed #f59e0b"
                  : undefined,
              outlineOffset: isSelected || slopeIssue ? 2 : undefined,
              zIndex: isSelected ? baseZ + 10 : baseZ,
            }}
            title={
              slopeIssue
                ? `Needs ${Math.round(slopeIssue.required)} cm, only ${Math.round(slopeIssue.available)} cm available here`
                : undefined
            }
          >
            {/* Visible swatch -- separate from the outer hit box so the
                collision/drag/rotation footprint always stays the full
                width x length rectangle even when the item is drawn as a
                circle (e.g. a round table or rug). */}
            <div
              className={`absolute inset-0 border border-foreground/30 ${layer === "on-top" ? "shadow-md" : "shadow-sm"}`}
              style={{
                background: it.color,
                opacity: LAYER_OPACITY[layer] ?? 1,
                borderRadius: shape === "circle" ? "50%" : "2px",
              }}
            />
            {isKitTinted && (
              <span
                className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-background bg-primary text-primary-foreground shadow-sm"
                aria-hidden="true"
              >
                <Wand2 className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
            {/* Available headroom, shown on the item that's currently
                selected -- which includes the one being dragged, since a
                drag selects it and `items` updates live, so this reads as a
                continuous "max NNN cm here" while you move something under
                a slope. Counter-rotated so the text stays upright on a
                rotated item. */}
            {slopeIssue && isSelected && (
              <span
                className="pointer-events-none absolute -top-6 left-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-amber-950 shadow-sm"
                style={{ transform: `translateX(-50%) rotate(${-it.rotation}deg)` }}
              >
                {Math.round(slopeIssue.available)} cm · −{Math.round(slopeIssue.shortfall)} cm
              </span>
            )}
            {(() => {
              const minDim = Math.min(it.width, it.length);
              const fontSize = minDim < 35 ? 8 : minDim < 55 ? 10 : 12;
              const dimSize = minDim < 35 ? 7 : minDim < 55 ? 9 : 10;
              return (
                <div
                  className="pointer-events-none relative flex flex-col items-center justify-center leading-tight"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    overflow: "hidden",
                    fontSize,
                    padding: "2px 4px",
                    wordBreak: "break-word",
                  }}
                >
                  <HoverTooltip content={it.name}>
                    <span
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.name}
                    </span>
                  </HoverTooltip>
                  {/* Length × Width × Height, with the axis order spelled
                      out after it -- the numbers on their own don't say
                      which is which, and this reordered the first two from
                      the width×length it used to print. Height comes from
                      the item's own value, falling back to its preset
                      default -- the same number the 3D view and the slope
                      fit-check use, so all three agree. The tooltip stays
                      for the full wording (and the unit). */}
                  <HoverTooltip content={dimsLabel}>
                    <span style={{ fontSize: dimSize, opacity: 0.8 }}>
                      {round(it.length)}×{round(it.width)}×
                      {round(it.height ?? getDefaultHeight(it.icon, it.kind))}{" "}
                      <span style={{ opacity: 0.7 }}>{dimsAxesLabel}</span>
                    </span>
                  </HoverTooltip>
                </div>
              );
            })()}
            {isSelected && selectedIds.size === 1 && (
              <>
                <div
                  className="pointer-events-none absolute left-1/2 h-6 w-px -translate-x-1/2 bg-foreground/60"
                  style={{ top: -24 }}
                />
                <HoverTooltip content={dragToRotateLabel}>
                  <div
                    role="button"
                    onPointerDown={(e) => onRotateHandleDown(e, it)}
                    className="absolute left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-foreground bg-background text-foreground shadow active:cursor-grabbing"
                    style={{
                      top: -34,
                      touchAction: "none",
                    }}
                  >
                    <RotateCw className="h-3 w-3" strokeWidth={2.5} />
                  </div>
                </HoverTooltip>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
