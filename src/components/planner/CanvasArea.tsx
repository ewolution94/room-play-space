import React from "react";
import { Button } from "@/components/ui/button";
import { Ruler, RotateCw, Zap, ZapOff, SlidersHorizontal } from "lucide-react";
import { readableText } from "@/lib/planner-math";
import type { CanvasAreaProps } from "@/types/planner";

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
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-background/40 backdrop-blur-sm px-3.5 py-2 shadow-sm">
        <p className="text-[11px] text-muted-foreground">
          {rulerMode ? t.rulerHint : t.hint}{" "}
          <span className="font-semibold text-foreground/75">{`(1cm ≈ ${scale.toFixed(2)}px)`}</span>
        </p>
      </div>
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 w-full overflow-visible rounded-lg border bg-muted/30"
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        style={{ touchAction: "none", cursor: rulerMode ? "crosshair" : undefined }}
      >
        {/* Room dimensions label (top-left of canvas) */}
        <div className="absolute left-3 top-3 z-10 select-none">
          <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold shadow-sm text-foreground/80">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            {roomW} × {roomL} cm
            {selectedIds.size > 0 && (
              <span className="text-muted-foreground/75 font-normal">
                · {t.selectedCount(selectedIds.size)}
              </span>
            )}
          </div>
        </div>

        {scale > 0 && (
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
            {openings.map((o) => {
              const isH = o.wall === "top" || o.wall === "bottom";
              const wallLen = isH ? roomW : roomL;
              const wpx = cm(o.width);
              const ppx = cm(o.position);
              const hitThick = 20; // 20px hit target
              const visualThick = 6; // 6px visual thickness

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
                visualStyle.background = "#c7d3dc";
                visualStyle.border = "1px solid #7f8c99";
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
                    prev.map((x) => (x.id === id ? { ...x, position: next } : x)),
                  );
                };
                const up = (ev: PointerEvent) => {
                  target.releasePointerCapture(ev.pointerId);
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              };

              return (
                <div
                  key={o.id}
                  style={containerStyle}
                  onPointerDown={onOpeningDown}
                  title={`${o.kind === "door" ? "Door" : "Window"} (${o.width}cm) — drag to move`}
                >
                  <div style={visualStyle} />
                </div>
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

        {/* Floating bottom toolbar */}
        <div
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 backdrop-blur-md px-3.5 py-1.5 shadow-lg select-none"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Collision toggle */}
          <Button
            variant={collisionEnabled ? "ghost" : "destructive"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setCollisionEnabled((v) => !v);
            }}
            title={t.collisionHint}
            className={`h-8 rounded-full px-3 text-xs gap-1.5 font-medium transition-all ${
              collisionEnabled
                ? "text-teal-600 hover:text-teal-700 hover:bg-teal-500/10 dark:text-teal-400 dark:hover:text-teal-300 dark:hover:bg-teal-400/10"
                : ""
            }`}
          >
            {collisionEnabled ? (
              <Zap className="h-3.5 w-3.5" />
            ) : (
              <ZapOff className="h-3.5 w-3.5" />
            )}
            {collisionEnabled ? t.collisionOn : t.collisionOff}
          </Button>

          <div className="h-4 w-px bg-border/40" />

          {/* Ruler toggle */}
          <Button
            variant={rulerMode ? "secondary" : "ghost"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setRulerMode((v) => !v);
            }}
            title={t.rulerHint}
            className={`h-8 rounded-full px-3 text-xs gap-1.5 font-medium ${
              rulerMode
                ? "text-sky-600 bg-sky-500/10 hover:bg-sky-500/20 dark:text-sky-400 dark:bg-sky-400/10 dark:hover:bg-sky-400/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ruler className="h-3.5 w-3.5" />
            {rulerMode ? t.rulerOn : t.ruler}
          </Button>

          {rulerMode && (rulerStart || rulerEnd) && (
            <>
              <div className="h-4 w-px bg-border/40" />
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  clearRuler();
                }}
                className="h-8 rounded-full px-3 text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <XIcon className="h-3.5 w-3.5" />
                {t.rulerClear}
              </Button>
            </>
          )}
        </div>
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
