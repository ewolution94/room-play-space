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
        return (
          <div
            key={it.id}
            onPointerDown={(e) => onItemPointerDown(e, it)}
            className="absolute flex cursor-all-scroll items-center justify-center rounded-sm text-center text-xs font-medium border border-foreground/30 shadow-sm"
            style={{
              left: cm(it.x),
              top: cm(it.y),
              width: cm(it.width),
              height: cm(it.length),
              background: it.color,
              color: readableText(it.color),
              touchAction: "none",
              userSelect: "none",
              transform: `rotate(${it.rotation}deg)`,
              transformOrigin: "center center",
              outline: isSelected ? "2px solid var(--primary)" : undefined,
              outlineOffset: isSelected ? 2 : undefined,
              zIndex: isSelected ? 10 : 1,
            }}
          >
            {(() => {
              const minDim = Math.min(it.width, it.length);
              const fontSize = minDim < 35 ? 8 : minDim < 55 ? 10 : 12;
              const dimSize = minDim < 35 ? 7 : minDim < 55 ? 9 : 10;
              return (
                <div
                  className="pointer-events-none flex flex-col items-center justify-center leading-tight"
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
