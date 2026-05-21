import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Download, Upload, RotateCw } from "lucide-react";
import { toast } from "sonner";
import chairBaseUrl from "@/assets/chair-base.png";

export const Route = createFileRoute("/")({
  component: RoomPlanner,
});

type ItemKind = "furniture" | "chair";

type Item = {
  id: string;
  name: string;
  width: number; // cm
  length: number; // cm
  color: string;
  x: number; // cm from left (top-left of unrotated rectangle)
  y: number; // cm from top
  rotation: number; // degrees, rotated around center
  kind: ItemKind;
};

// Axis-aligned bounding box of a rotated rectangle, in cm.
function rotatedAABB(w: number, l: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: w * c + l * s, h: w * s + l * c };
}

// Clamp item position so its rotated AABB stays inside the room.
function clampPos(item: Item, roomW: number, roomL: number, x: number, y: number) {
  const aabb = rotatedAABB(item.width, item.length, item.rotation);
  const cx = x + item.width / 2;
  const cy = y + item.length / 2;
  const minCx = aabb.w / 2;
  const maxCx = roomW - aabb.w / 2;
  const minCy = aabb.h / 2;
  const maxCy = roomL - aabb.h / 2;
  const ncx = aabb.w > roomW ? roomW / 2 : Math.max(minCx, Math.min(maxCx, cx));
  const ncy = aabb.h > roomL ? roomL / 2 : Math.max(minCy, Math.min(maxCy, cy));
  return { x: ncx - item.width / 2, y: ncy - item.length / 2 };
}

type Opening = {
  id: string;
  wall: "top" | "bottom" | "left" | "right";
  position: number; // cm along the wall
  width: number; // cm
  kind: "door" | "window";
};

const PX_PER_CM_BASE = 1.2; // will be scaled to fit

function RoomPlanner() {
  const [roomW, setRoomW] = useState(400);
  const [roomL, setRoomL] = useState(300);
  const [draftW, setDraftW] = useState("400");
  const [draftL, setDraftL] = useState("300");
  const dirty = draftW !== String(roomW) || draftL !== String(roomL);
  const applyRoom = () => {
    const w = Math.max(50, parseInt(draftW, 10) || 0);
    const l = Math.max(50, parseInt(draftL, 10) || 0);
    setRoomW(w);
    setRoomL(l);
    setDraftW(String(w));
    setDraftL(String(l));
    // clamp items inside new bounds
    setItems((prev) =>
      prev.map((i) => {
        const c = clampPos(i, w, l, i.x, i.y);
        return { ...i, x: c.x, y: c.y };
      }),
    );
  };
  const [items, setItems] = useState<Item[]>([
    { id: crypto.randomUUID(), name: "Desk", width: 140, length: 70, color: "#8B5E3C", x: 20, y: 20, rotation: 0, kind: "furniture" },
    { id: crypto.randomUUID(), name: "Office chair", width: 65, length: 65, color: "#3B6FA0", x: 60, y: 110, rotation: 0, kind: "chair" },
  ]);
  const [openings, setOpenings] = useState<Opening[]>([
    { id: crypto.randomUUID(), wall: "bottom", position: 50, width: 90, kind: "door" },
    { id: crypto.randomUUID(), wall: "top", position: 220, width: 120, kind: "window" },
  ]);

  // new item form
  const [nName, setNName] = useState("");
  const [nW, setNW] = useState(80);
  const [nL, setNL] = useState(40);
  const [nColor, setNColor] = useState("#5cbdb9");
  const [nKind, setNKind] = useState<ItemKind>("furniture");

  // new opening form
  const [oKind, setOKind] = useState<"door" | "window">("door");
  const [oWall, setOWall] = useState<Opening["wall"]>("top");
  const [oPos, setOPos] = useState(50);
  const [oWidth, setOWidth] = useState(90);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // compute scale to fit room into stage with padding
  const pad = 40;
  const scale = Math.min(
    (stageSize.w - pad * 2) / roomW,
    (stageSize.h - pad * 2) / roomL,
  );
  const cm = (v: number) => v * scale;
  const roomPxW = cm(roomW);
  const roomPxL = cm(roomL);
  const offsetX = (stageSize.w - roomPxW) / 2;
  const offsetY = (stageSize.h - roomPxL) / 2;

  const addItem = () => {
    if (!nName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: nName.trim(),
        width: nW,
        length: nL,
        color: nColor,
        x: 10,
        y: 10,
        rotation: 0,
        kind: nKind,
      },
    ]);
    setNName("");
  };

  const removeItem = (id: string) =>
    setItems((p) => p.filter((i) => i.id !== id));
  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((p) =>
      p.map((i) => {
        if (i.id !== id) return i;
        const merged = { ...i, ...patch };
        const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
        return { ...merged, x: c.x, y: c.y };
      }),
    );

  const addOpening = () => {
    setOpenings((p) => [
      ...p,
      { id: crypto.randomUUID(), kind: oKind, wall: oWall, position: oPos, width: oWidth },
    ]);
  };
  const removeOpening = (id: string) =>
    setOpenings((p) => p.filter((o) => o.id !== id));

  // Selection + drag/rotate handling
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragRef = useRef<
    | {
        mode: "move";
        id: string;
        startMouseX: number;
        startMouseY: number;
        startX: number;
        startY: number;
      }
    | {
        mode: "rotate";
        id: string;
        centerClientX: number;
        centerClientY: number;
        startAngle: number;
        startRotation: number;
      }
    | null
  >(null);

  const onPointerDown = (e: React.PointerEvent, item: Item) => {
    e.stopPropagation();
    setSelectedId(item.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: "move",
      id: item.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: item.x,
      startY: item.y,
    };
  };

  const onRotateHandleDown = (e: React.PointerEvent, item: Item) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const stageRect = stageEl.getBoundingClientRect();
    const centerClientX =
      stageRect.left + offsetX + cm(item.x + item.width / 2);
    const centerClientY =
      stageRect.top + offsetY + cm(item.y + item.length / 2);
    const startAngle =
      (Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * 180) /
      Math.PI;
    dragRef.current = {
      mode: "rotate",
      id: item.id,
      centerClientX,
      centerClientY,
      startAngle,
      startRotation: item.rotation,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "move") {
      const dx = (e.clientX - d.startMouseX) / scale;
      const dy = (e.clientY - d.startMouseY) / scale;
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== d.id) return i;
          const c = clampPos(i, roomW, roomL, d.startX + dx, d.startY + dy);
          return { ...i, x: c.x, y: c.y };
        }),
      );
    } else {
      const angle =
        (Math.atan2(e.clientY - d.centerClientY, e.clientX - d.centerClientX) *
          180) /
        Math.PI;
      const delta = angle - d.startAngle;
      const next = ((d.startRotation + delta) % 360 + 360) % 360;
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== d.id) return i;
          const merged = { ...i, rotation: next };
          const c = clampPos(merged, roomW, roomL, merged.x, merged.y);
          return { ...merged, x: c.x, y: c.y };
        }),
      );
    }
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const payload = {
      version: 1,
      room: { width: roomW, length: roomL },
      openings,
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `room-planner-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported planner state");
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const w = Number(data?.room?.width);
      const l = Number(data?.room?.length);
      if (!Number.isFinite(w) || !Number.isFinite(l) || !Array.isArray(data.items) || !Array.isArray(data.openings)) {
        throw new Error("Invalid file format");
      }
      const nextW = Math.max(50, Math.round(w));
      const nextL = Math.max(50, Math.round(l));
      setRoomW(nextW);
      setRoomL(nextL);
      setDraftW(String(nextW));
      setDraftL(String(nextL));
      setOpenings(
        data.openings.map((o: Opening) => ({
          id: o.id || crypto.randomUUID(),
          wall: o.wall,
          position: Number(o.position) || 0,
          width: Number(o.width) || 0,
          kind: o.kind,
        })),
      );
      setItems(
        data.items.map((i: Partial<Item>) => ({
          id: i.id || crypto.randomUUID(),
          name: String(i.name ?? "Item"),
          width: Number(i.width) || 0,
          length: Number(i.length) || 0,
          color: i.color || "#5cbdb9",
          x: Number(i.x) || 0,
          y: Number(i.y) || 0,
          rotation: Number.isFinite(Number(i.rotation)) ? Number(i.rotation) : 0,
          kind: i.kind === "chair" ? "chair" : "furniture",
        })),
      );
      toast.success("Planner state imported");
    } catch (err) {
      toast.error("Could not import file: " + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Room Planner</h1>
            <p className="text-sm text-muted-foreground">
              Sketch your home office and drag furniture to find the right layout.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Room: {roomW} × {roomL} cm
            </span>
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[300px_1fr_300px]">
        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Width (cm)</Label>
                  <Input
                    type="number"
                    value={draftW}
                    min={50}
                    onChange={(e) => setDraftW(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Length (cm)</Label>
                  <Input
                    type="number"
                    value={draftL}
                    min={50}
                    onChange={(e) => setDraftL(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={applyRoom}
                size="sm"
                className="w-full"
                disabled={!dirty}
              >
                Apply dimensions
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Doors & Windows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Type</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={oKind}
                    onChange={(e) => setOKind(e.target.value as "door" | "window")}
                  >
                    <option value="door">Door</option>
                    <option value="window">Window</option>
                  </select>
                </div>
                <div>
                  <Label>Wall</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={oWall}
                    onChange={(e) => setOWall(e.target.value as Opening["wall"])}
                  >
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <Label>Position (cm)</Label>
                  <Input type="number" value={oPos} onChange={(e) => setOPos(+e.target.value || 0)} />
                </div>
                <div>
                  <Label>Width (cm)</Label>
                  <Input type="number" value={oWidth} onChange={(e) => setOWidth(+e.target.value || 0)} />
                </div>
              </div>
              <Button onClick={addOpening} size="sm" className="w-full">
                <Plus className="mr-1 h-4 w-4" /> Add opening
              </Button>
              <Separator />
              <ul className="space-y-1 text-sm">
                {openings.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded-md border px-2 py-1">
                    <span className="capitalize">
                      {o.kind} · {o.wall} · {o.position}cm · {o.width}cm
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeOpening(o.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
                {openings.length === 0 && (
                  <li className="text-xs text-muted-foreground">No openings yet.</li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Furniture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Type</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={nKind}
                  onChange={(e) => setNKind(e.target.value as ItemKind)}
                >
                  <option value="furniture">Furniture (box)</option>
                  <option value="chair">Office chair</option>
                </select>
              </div>
              <div>
                <Label>Name</Label>
                <Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="e.g. Bookshelf" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Width (cm)</Label>
                  <Input type="number" value={nW} onChange={(e) => setNW(+e.target.value || 0)} />
                </div>
                <div>
                  <Label>Length (cm)</Label>
                  <Input type="number" value={nL} onChange={(e) => setNL(+e.target.value || 0)} />
                </div>
              </div>
              <div>
                <Label>Color</Label>
                <input
                  type="color"
                  value={nColor}
                  onChange={(e) => setNColor(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border bg-background"
                />
              </div>
              <Button onClick={addItem} className="w-full" size="sm">
                <Plus className="mr-1 h-4 w-4" /> Add item
              </Button>
            </CardContent>
          </Card>

        </aside>

        {/* Stage */}
        <main className="lg:sticky lg:top-6 lg:self-start lg:h-fit">
          <div
            ref={stageRef}
            className="relative h-[75vh] w-full overflow-hidden rounded-lg border bg-muted/30"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
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
                  const thick = 6;
                  const isH = o.wall === "top" || o.wall === "bottom";
                  const wpx = cm(o.width);
                  const ppx = cm(o.position);
                  const style: React.CSSProperties = {
                    position: "absolute",
                    background: o.kind === "door" ? "var(--background)" : "#bcdcff",
                    border: o.kind === "window" ? "1px solid #3b82f6" : "none",
                  };
                  if (isH) {
                    style.width = wpx;
                    style.height = thick;
                    style.left = ppx;
                    style[o.wall] = -thick / 2;
                  } else {
                    style.height = wpx;
                    style.width = thick;
                    style.top = ppx;
                    style[o.wall] = -thick / 2;
                  }
                  return (
                    <div key={o.id} style={style} title={`${o.kind} (${o.width}cm)`} />
                  );
                })}

                {/* items */}
                {items.map((it) => {
                  const isChair = it.kind === "chair";
                  return (
                    <div
                      key={it.id}
                      onPointerDown={(e) => onPointerDown(e, it)}
                      className={
                        "absolute flex cursor-grab items-center justify-center rounded-sm text-center text-xs font-medium active:cursor-grabbing " +
                        (isChair
                          ? "border-0"
                          : "border border-foreground/30 shadow-sm")
                      }
                      style={{
                        left: cm(it.x),
                        top: cm(it.y),
                        width: cm(it.width),
                        height: cm(it.length),
                        background: isChair ? "transparent" : it.color,
                        backgroundImage: isChair ? `url(${chairBaseUrl})` : undefined,
                        backgroundSize: isChair ? "100% 100%" : undefined,
                        backgroundRepeat: "no-repeat",
                        color: isChair ? "#111" : readableText(it.color),
                        touchAction: "none",
                        userSelect: "none",
                        transform: `rotate(${it.rotation}deg)`,
                        transformOrigin: "center center",
                      }}
                    >
                      <span
                        className="pointer-events-none px-1 leading-tight"
                        style={
                          isChair
                            ? {
                                background: "rgba(255,255,255,0.85)",
                                borderRadius: 4,
                                padding: "1px 4px",
                              }
                            : undefined
                        }
                      >
                        {it.name}
                        <br />
                        <span className="text-[10px] opacity-80">
                          {it.width}×{it.length}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Drag items to reposition. They're clamped to the room's walls. Scale: 1cm ≈ {scale.toFixed(2)}px.
          </p>
        </main>
      </div>
    </div>
  );
}

function readableText(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#000";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#111" : "#fff";
}

// silence unused
void PX_PER_CM_BASE;
