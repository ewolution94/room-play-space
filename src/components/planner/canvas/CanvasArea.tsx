import React from "react";
import type { CanvasAreaProps } from "@/types/planner";
import { ThreeDView } from "../ThreeDView";
import { HintBanner } from "./HintBanner";
import { RoomDimensionBadge } from "./RoomDimensionBadge";
import { CanvasOpenings } from "./CanvasOpenings";
import { CanvasItems } from "./CanvasItems";
import { CanvasMarquee } from "./CanvasMarquee";
import { CanvasRuler } from "./CanvasRuler";
import { ToolbarOverlay } from "./ToolbarOverlay";

export function CanvasArea({
  t,
  stageRef,
  scale,
  offsetX,
  offsetY,
  roomPxW,
  roomPxL,
  cm,
  roomW,
  roomL,
  dirty,
  collisionEnabled,
  setCollisionEnabled,
  rulerMode,
  setRulerMode,
  openings,
  setOpenings,
  items,
  selectedIds,
  setSelectedIds,
  rulerStart,
  rulerEnd,
  rulerHover,
  clearRuler,
  marqueeRect,
  onStagePointerDown,
  onStagePointerMove,
  onStagePointerUp,
  onItemPointerDown,
  onRotateHandleDown,
  pushHistory,
  threeDActive,
  setThreeDActive,
}: CanvasAreaProps) {
  const selectedLabel = selectedIds.size > 0 ? t.selectedCount(selectedIds.size) : undefined;

  return (
    <main className="min-w-0 lg:h-full lg:min-h-0 flex flex-col gap-2">
      <HintBanner
        t={t}
        scale={scale}
        rulerMode={rulerMode}
        threeDActive={threeDActive}
      />
      <div
        ref={stageRef}
        id="tour-canvas"
        className={`relative min-h-0 flex-1 w-full rounded-lg border bg-muted/30 ${
          threeDActive ? "overflow-hidden" : "overflow-visible"
        }`}
        onPointerDown={threeDActive ? undefined : onStagePointerDown}
        onPointerMove={threeDActive ? undefined : onStagePointerMove}
        onPointerUp={threeDActive ? undefined : onStagePointerUp}
        style={{
          touchAction: threeDActive ? "auto" : "none",
          cursor: threeDActive ? undefined : rulerMode ? "crosshair" : undefined,
        }}
      >
        {/* Room dimensions label (top-left of canvas) */}
        <RoomDimensionBadge
          roomW={roomW}
          roomL={roomL}
          selectedLabel={selectedLabel}
        />

        {threeDActive ? (
          <ThreeDView
            t={t}
            roomW={roomW}
            roomL={roomL}
            items={items}
            openings={openings}
            selectedIds={selectedIds}
          />
        ) : (
          scale > 0 && (
            <div
              className="absolute box-content border-[4px] border-slate-700 dark:border-slate-400 bg-background shadow-md transition-all duration-100"
              style={{
                left: offsetX,
                top: offsetY,
                width: roomPxW,
                height: roomPxL,
                backgroundImage:
                  "radial-gradient(hsl(var(--foreground) / 0.08) 1.5px, transparent 1.5px)",
                backgroundSize: `${cm(50)}px ${cm(50)}px`,
              }}
            >
              {/* openings */}
              <CanvasOpenings
                openings={openings}
                setOpenings={setOpenings}
                roomW={roomW}
                roomL={roomL}
                scale={scale}
                cm={cm}
                pushHistory={pushHistory}
                lang={t.title === "Raumplaner" ? "de" : "en"}
              />

              {/* items */}
              <CanvasItems
                items={items}
                selectedIds={selectedIds}
                cm={cm}
                onItemPointerDown={onItemPointerDown}
                onRotateHandleDown={onRotateHandleDown}
                dragToRotateLabel={t.dragToRotate}
              />

              {/* marquee */}
              <CanvasMarquee marqueeRect={marqueeRect} cm={cm} />

              {/* ruler overlay */}
              <CanvasRuler
                rulerMode={rulerMode}
                rulerStart={rulerStart}
                rulerEnd={rulerEnd}
                rulerHover={rulerHover}
                cm={cm}
                roomPxW={roomPxW}
                roomPxL={roomPxL}
              />
            </div>
          )
        )}

        {/* Floating bottom toolbar */}
        <ToolbarOverlay
          t={t}
          collisionEnabled={collisionEnabled}
          setCollisionEnabled={setCollisionEnabled}
          rulerMode={rulerMode}
          setRulerMode={setRulerMode}
          threeDActive={threeDActive}
          setThreeDActive={setThreeDActive}
          rulerStart={rulerStart}
          rulerEnd={rulerEnd}
          clearRuler={clearRuler}
        />
      </div>
    </main>
  );
}
