import React from "react";
import { RotateCw } from "lucide-react";
import { readableText } from "@/lib/planner-math";
import type { Item } from "@/types/planner";

interface CanvasItemsProps {
  items: Item[];
  selectedIds: Set<string>;
  cm: (val: number) => number;
  onItemPointerDown: (e: React.PointerEvent, item: Item) => void;
  onRotateHandleDown: (e: React.PointerEvent, item: Item) => void;
  dragToRotateLabel: string;
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
}: CanvasItemsProps) {
  return (
    <>
      {items.map((it) => {
        const isSelected = selectedIds.has(it.id);
        const layer = it.layer ?? "main";
        const shape = it.shape ?? "rect";
        const baseZ = LAYER_BASE_Z[layer] ?? LAYER_BASE_Z.main;
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
              outline: isSelected ? "2px solid var(--primary)" : undefined,
              outlineOffset: isSelected ? 2 : undefined,
              zIndex: isSelected ? baseZ + 10 : baseZ,
            }}
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
                  <span
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={it.name}
                  >
                    {it.name}
                  </span>
                  <span style={{ fontSize: dimSize, opacity: 0.8 }}>
                    {it.width}×{it.length}
                  </span>
                </div>
              );
            })()}
            {isSelected && selectedIds.size === 1 && (
              <>
                <div
                  className="pointer-events-none absolute left-1/2 h-6 w-px -translate-x-1/2 bg-foreground/60"
                  style={{ top: -24 }}
                />
                <div
                  role="button"
                  title={dragToRotateLabel}
                  onPointerDown={(e) => onRotateHandleDown(e, it)}
                  className="absolute left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-foreground bg-background text-foreground shadow active:cursor-grabbing"
                  style={{
                    top: -34,
                    touchAction: "none",
                  }}
                >
                  <RotateCw className="h-3 w-3" strokeWidth={2.5} />
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
