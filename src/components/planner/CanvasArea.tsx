import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlidersHorizontal, Ruler, RotateCw, Zap, ZapOff } from "lucide-react";
import type { Item, Opening } from "@/types/planner";
import { readableText } from "@/lib/planner-math";
import type { TranslationStrings } from "@/lib/planner-translations";

interface CanvasAreaProps {
  t: TranslationStrings;
  stageRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  offsetX: number;
  offsetY: number;
  roomPxW: number;
  roomPxL: number;
  cm: (v: number) => number;
  roomW: number;
  roomL: number;
  draftW: string;
  setDraftW: (w: string) => void;
  draftL: string;
  setDraftL: (l: string) => void;
  dirty: boolean;
  applyRoom: () => void;
  collisionEnabled: boolean;
  setCollisionEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  rulerMode: boolean;
  setRulerMode: React.Dispatch<React.SetStateAction<boolean>>;
  openings: Opening[];
  setOpenings: React.Dispatch<React.SetStateAction<Opening[]>>;
  items: Item[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  rulerStart: { x: number; y: number } | null;
  rulerEnd: { x: number; y: number } | null;
  rulerHover: { x: number; y: number } | null;
  clearRuler: () => void;
  marqueeRect: { x: number; y: number; w: number; h: number } | null;
  onStagePointerDown: (e: React.PointerEvent) => void;
  onStagePointerMove: (e: React.PointerEvent) => void;
  onStagePointerUp: () => void;
  onItemPointerDown: (e: React.PointerEvent, item: Item) => void;
  onRotateHandleDown: (e: React.PointerEvent, item: Item) => void;
  pushHistory: () => void;
}

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
  draftW,
  setDraftW,
  draftL,
  setDraftL,
  dirty,
  applyRoom,
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
}: CanvasAreaProps) {
  return (
    <main className="min-w-0 h-[calc(100vh-6rem)] lg:sticky lg:top-20 lg:self-start flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 rounded-md border bg-background/80 px-3 py-1.5 shadow-sm">
        <p className="text-xs text-foreground">
          {rulerMode ? t.rulerHint : t.hint} {`(1cm ≈ ${scale.toFixed(2)}px)`}
        </p>
        {rulerMode && (rulerStart || rulerEnd) && (
          <Button variant="ghost" size="sm" onClick={clearRuler}>
            <XIcon className="mr-1 h-3 w-3" /> {t.rulerClear}
          </Button>
        )}
      </div>
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 w-full overflow-visible rounded-lg border bg-muted/30"
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        style={{ touchAction: "none", cursor: rulerMode ? "crosshair" : undefined }}
      >
        {/* Room dimensions (top-left of canvas) — click to edit */}
        <div className="absolute left-3 top-3 z-10">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                title={t.roomLabel}
                className="shadow-sm"
              >
                <SlidersHorizontal className="mr-1 h-4 w-4" />
                {roomW} × {roomL} cm
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {t.selectedCount(selectedIds.size)}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-4" onPointerDown={(e) => e.stopPropagation()}>
              <div className="space-y-2">
                <h4 className="font-medium leading-none">{t.roomLabel}</h4>
                <p className="text-sm text-muted-foreground">Adjust width and length.</p>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="width">{t.width}</Label>
                  <Input
                    id="width"
                    value={draftW}
                    onChange={(e) => setDraftW(e.target.value)}
                    className="col-span-2 h-8"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="length">{t.length}</Label>
                  <Input
                    id="length"
                    value={draftL}
                    onChange={(e) => setDraftL(e.target.value)}
                    className="col-span-2 h-8"
                  />
                </div>
              </div>
              <Button onClick={applyRoom} size="sm" className="w-full" disabled={!dirty}>
                {t.apply}
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Canvas controls (top-right of canvas) */}
        <div
          className="absolute right-3 top-3 z-10 flex gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Collision toggle */}
          <Button
            variant={collisionEnabled ? "outline" : "destructive"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setCollisionEnabled((v) => !v);
            }}
            title={t.collisionHint}
            className="shadow-sm transition-all duration-200"
          >
            {collisionEnabled ? (
              <Zap className="mr-1 h-4 w-4" />
            ) : (
              <ZapOff className="mr-1 h-4 w-4" />
            )}
            {collisionEnabled ? t.collisionOn : t.collisionOff}
          </Button>

          {/* Ruler toggle */}
          <Button
            variant={rulerMode ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setRulerMode((v) => !v);
            }}
            title={t.rulerHint}
            className="shadow-sm"
          >
            <Ruler className="mr-1 h-4 w-4" />
            {rulerMode ? t.rulerOn : t.ruler}
          </Button>
        </div>

        {scale > 0 && (
          <div
            className="absolute border-2 border-foreground bg-background shadow-sm"
            style={{
              left: offsetX,
              top: offsetY,
              width: roomPxW,
              height: roomPxL,
            }}
          >
            {/* openings */}
            {openings.map((o) => {
              const isH = o.wall === "top" || o.wall === "bottom";
              const wallLen = isH ? roomW : roomL;
              const wpx = cm(o.width);
              const ppx = cm(o.position);
              const wallThick = 6;
              const originX =
                o.wall === "bottom"
                  ? ppx
                  : o.wall === "top"
                    ? ppx + wpx
                    : o.wall === "left"
                      ? 0
                      : roomPxW;
              const originY =
                o.wall === "bottom"
                  ? roomPxL
                  : o.wall === "top"
                    ? 0
                    : o.wall === "left"
                      ? ppx
                      : ppx + wpx;
              const rotation =
                o.wall === "bottom" ? 0 : o.wall === "top" ? 180 : o.wall === "left" ? 90 : -90;

              const hingeEnd = o.kind === "door" && o.hinge === "end";
              const swingOut = o.kind === "door" && o.swing === "out";

              let adjustedOriginX = originX;
              let adjustedOriginY = originY;

              if (hingeEnd) {
                if (o.wall === "bottom") adjustedOriginX = ppx + wpx;
                else if (o.wall === "top") adjustedOriginX = ppx;
                else if (o.wall === "left") adjustedOriginY = ppx + wpx;
                else adjustedOriginY = ppx;
              }

              const transform =
                `translate(${adjustedOriginX}px, ${adjustedOriginY}px) rotate(${rotation}deg)` +
                (hingeEnd ? " scaleX(-1)" : "") +
                (swingOut ? " scaleY(-1)" : "");

              const onOpeningDown = (e: React.PointerEvent) => {
                e.stopPropagation();
                e.preventDefault();
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
                    prev.map((x) => (x.id === id ? { ...x, position: next } : x)),
                  );
                };
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              };

              return (
                <svg
                  key={o.id}
                  width={1}
                  height={1}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    overflow: "visible",
                    transform,
                    transformOrigin: "0 0",
                    zIndex: 5,
                  }}
                >
                  {/* hit area */}
                  <rect
                    x={0}
                    y={-wallThick - 3}
                    width={wpx}
                    height={(wallThick + 3) * 2}
                    fill="transparent"
                    style={{ cursor: isH ? "ew-resize" : "ns-resize", touchAction: "none" }}
                    onPointerDown={onOpeningDown}
                  >
                    <title>{`${o.kind === "door" ? "Door" : "Window"} (${o.width}cm) — drag to move`}</title>
                  </rect>

                  {/* wall gap */}
                  <rect
                    x={0}
                    y={-wallThick / 2}
                    width={wpx}
                    height={wallThick}
                    fill="var(--background)"
                    pointerEvents="none"
                  />

                  {o.kind === "door" ? (
                    <>
                      {/* Swing Arc */}
                      <path
                        d={`M 0,0 A ${wpx},${wpx} 0 0,1 ${wpx * Math.cos((-35 * Math.PI) / 180)},${wpx * Math.sin((-35 * Math.PI) / 180)}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        className="text-foreground/30"
                        pointerEvents="none"
                      />
                      {/* Door panel */}
                      <line
                        x1={0}
                        y1={0}
                        x2={wpx}
                        y2={0}
                        stroke="#a0522d"
                        strokeWidth={4}
                        strokeLinecap="round"
                        transform={`rotate(-35)`}
                        pointerEvents="none"
                      />
                    </>
                  ) : (
                    <rect
                      x={0}
                      y={-wallThick / 2}
                      width={wpx}
                      height={wallThick}
                      fill="#c7d3dc"
                      stroke="#7f8c99"
                      strokeWidth={0.75}
                      pointerEvents="none"
                    />
                  )}
                </svg>
              );
            })}

            {/* items */}
            {items.map((it) => {
              const isSelected = selectedIds.has(it.id);
              return (
                <div
                  key={it.id}
                  onPointerDown={(e) => onItemPointerDown(e, it)}
                  className={
                    "absolute flex cursor-grab items-center justify-center rounded-sm text-center text-xs font-medium active:cursor-grabbing border border-foreground/30 shadow-sm"
                  }
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
                        title={t.dragToRotate}
                        onPointerDown={(e) => onRotateHandleDown(e, it)}
                        className="absolute left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-foreground bg-background text-foreground shadow active:cursor-grabbing"
                        style={{
                          top: -34,
                          touchAction: "none",
                          color: "hsl(var(--foreground, 0 0% 10%))",
                        }}
                      >
                        <RotateCw className="h-3 w-3" strokeWidth={2.5} color="#111" />
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* marquee */}
            {marqueeRect && (marqueeRect.w > 0 || marqueeRect.h > 0) && (
              <div
                className="pointer-events-none absolute border border-primary bg-primary/10"
                style={{
                  left: cm(marqueeRect.x),
                  top: cm(marqueeRect.y),
                  width: cm(marqueeRect.w),
                  height: cm(marqueeRect.h),
                }}
              />
            )}

            {/* ruler overlay */}
            {rulerMode &&
              rulerStart &&
              (() => {
                const end = rulerEnd ?? rulerHover ?? rulerStart;
                const dx = end.x - rulerStart.x;
                const dy = end.y - rulerStart.y;
                const distCm = Math.sqrt(dx * dx + dy * dy);
                const midX = (rulerStart.x + end.x) / 2;
                const midY = (rulerStart.y + end.y) / 2;
                const ax = cm(rulerStart.x);
                const ay = cm(rulerStart.y);
                const bx = cm(end.x);
                const by = cm(end.y);
                return (
                  <svg
                    className="pointer-events-none absolute inset-0 text-foreground"
                    width={roomPxW}
                    height={roomPxL}
                    style={{ overflow: "visible" }}
                  >
                    <line
                      x1={ax}
                      y1={ay}
                      x2={bx}
                      y2={by}
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeDasharray="2 5"
                      strokeLinecap="round"
                    />
                    <circle cx={ax} cy={ay} r={4} fill="currentColor" />
                    <circle cx={bx} cy={by} r={4} fill="currentColor" />
                    <g transform={`translate(${cm(midX)}, ${cm(midY)})`}>
                      <rect
                        x={-34}
                        y={-24}
                        width={68}
                        height={20}
                        rx={4}
                        fill="white"
                        stroke="currentColor"
                      />
                      <text
                        x={0}
                        y={-10}
                        textAnchor="middle"
                        fontSize={11}
                        fill="currentColor"
                        style={{ fontWeight: 600 }}
                      >
                        {distCm.toFixed(1)} cm
                      </text>
                    </g>
                  </svg>
                );
              })()}
          </div>
        )}
      </div>
    </main>
  );
}

// Local X icon helper
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
