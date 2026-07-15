import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sliders,
  Copy,
  Trash2,
  Palette,
  Ruler,
  ArrowUp,
  RotateCw,
  Move,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import type { Item, Opening, Point } from "@/types/planner";
import { getDefaultHeight } from "../ThreeDView";
import { wallColorKey } from "@/lib/hallway-shapes";

// Friendly display label for a wall identity -- named ("top"/"right"/...)
// for a plain rectangular room, "Wall N" for a polygon (hallway) room where
// there's no natural top/bottom/left/right concept once it has 6-8 walls.
function wallLabel(wall: Opening["wall"], t: any, lang: string): string {
  if (typeof wall === "number") return lang === "de" ? `Wand ${wall + 1}` : `Wall ${wall + 1}`;
  return t[wall] || wall;
}

const SWATCHES = [
  { name: "Charcoal", value: "#343a40" },
  { name: "Slate", value: "#6c757d" },
  { name: "Walnut", value: "#5c4033" },
  { name: "Oak", value: "#c4a482" },
  { name: "Cream", value: "#f8f9fa" },
  { name: "Sage", value: "#87a987" },
  { name: "Steel", value: "#495057" },
  { name: "Coral", value: "#d9746c" },
];

const OPENING_SWATCHES = [
  { name: "Anthracite", value: "#343a40" },
  { name: "Slate", value: "#475569" },
  { name: "Zinc", value: "#71717a" },
  { name: "White", value: "#f8fafc" },
  { name: "Oak/Wood", value: "#854d0e" },
  { name: "Forest", value: "#14532d" },
  { name: "Navy", value: "#1e3a8a" },
  { name: "Chocolate", value: "#451a03" },
];

interface InspectorSectionProps {
  t: any;
  lang: string;
  threeDActive: boolean;
  selectedItem: Item | null;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedOpening: Opening | null;
  selectedOpeningId: string | null;
  setSelectedOpeningId: React.Dispatch<React.SetStateAction<string | null>>;
  wallColors: Record<string, string>;
  setWallColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  corners: Point[];
  items: Item[];
  updateItem: (id: string, patch: Partial<Item>, options?: { history?: boolean }) => void;
  removeItem: (id: string) => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;
  draftW: string;
  setDraftW: (w: string) => void;
  draftL: string;
  setDraftL: (l: string) => void;
  applyRoom: (customW?: number, customL?: number) => void;
  dirty: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
}

export function InspectorSection({
  t,
  lang,
  threeDActive,
  selectedItem,
  selectedIds,
  setSelectedIds,
  selectedOpening,
  selectedOpeningId,
  setSelectedOpeningId,
  wallColors,
  setWallColors,
  corners,
  items,
  updateItem,
  removeItem,
  duplicateSelected,
  removeSelected,
  updateOpening,
  removeOpening,
  draftW,
  setDraftW,
  draftL,
  setDraftL,
  applyRoom,
  dirty,
  isCollapsed = false,
  onToggleCollapse,
  onHeaderPointerDown,
}: InspectorSectionProps) {

  // Local draft states for selected item
  const [itemDraftW, setItemDraftW] = React.useState("");
  const [itemDraftL, setItemDraftL] = React.useState("");
  const [itemDraftH, setItemDraftH] = React.useState("");
  const [itemDraftElev, setItemDraftElev] = React.useState("");
  const [itemDraftRot, setItemDraftRot] = React.useState("");

  // Local draft states for selected opening
  const [opDraftW, setOpDraftW] = React.useState("");
  const [opDraftPos, setOpDraftPos] = React.useState("");

  // Sync draft states when selections change
  React.useEffect(() => {
    if (selectedItem) {
      setItemDraftW(String(selectedItem.width));
      setItemDraftL(String(selectedItem.length));
      setItemDraftH(String(selectedItem.height ?? getDefaultHeight(selectedItem.icon, selectedItem.kind)));
      setItemDraftElev(String(selectedItem.elevation ?? 0));
      setItemDraftRot(String(selectedItem.rotation));
    }
  }, [
    selectedItem?.id,
    selectedItem?.width,
    selectedItem?.length,
    selectedItem?.height,
    selectedItem?.elevation,
    selectedItem?.rotation
  ]);

  React.useEffect(() => {
    if (selectedOpening) {
      setOpDraftW(String(selectedOpening.width));
      setOpDraftPos(String(Math.round(selectedOpening.position)));
    }
  }, [
    selectedOpening?.id,
    selectedOpening?.width,
    selectedOpening?.position
  ]);

  const itemDirty = React.useMemo(() => {
    if (!selectedItem) return false;
    return (
      itemDraftW !== String(selectedItem.width) ||
      itemDraftL !== String(selectedItem.length) ||
      itemDraftH !== String(selectedItem.height ?? getDefaultHeight(selectedItem.icon, selectedItem.kind)) ||
      itemDraftElev !== String(selectedItem.elevation ?? 0) ||
      itemDraftRot !== String(selectedItem.rotation)
    );
  }, [
    selectedItem,
    itemDraftW,
    itemDraftL,
    itemDraftH,
    itemDraftElev,
    itemDraftRot
  ]);

  const openingDirty = React.useMemo(() => {
    if (!selectedOpening) return false;
    return (
      opDraftW !== String(selectedOpening.width) ||
      opDraftPos !== String(Math.round(selectedOpening.position))
    );
  }, [
    selectedOpening,
    opDraftW,
    opDraftPos
  ]);

  const handleApplyItem = () => {
    if (!selectedItem) return;
    const w = parseFloat(itemDraftW);
    const l = parseFloat(itemDraftL);
    const h = parseFloat(itemDraftH);
    const elev = parseFloat(itemDraftElev);
    const rot = parseFloat(itemDraftRot);

    const patch: Partial<Item> = {};
    if (!isNaN(w) && w > 0) patch.width = w;
    if (!isNaN(l) && l > 0) patch.length = l;
    if (!isNaN(h) && h >= 0) patch.height = h;
    if (!isNaN(elev)) patch.elevation = elev;
    if (!isNaN(rot)) patch.rotation = ((rot % 360) + 360) % 360;

    updateItem(selectedItem.id, patch);
  };

  const handleApplyOpening = () => {
    if (!selectedOpening) return;
    const w = parseFloat(opDraftW);
    const pos = parseFloat(opDraftPos);

    const patch: Partial<Opening> = {};
    if (!isNaN(w) && w > 0) patch.width = w;
    if (!isNaN(pos) && pos >= 0) patch.position = pos;

    updateOpening(selectedOpening.id, patch);
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: "item" | "opening") => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (type === "item") {
        handleApplyItem();
      } else {
        handleApplyOpening();
      }
      (e.target as HTMLElement).blur();
    }
  };

  return (
    <Card
      id="tour-inspector"
      className="border-primary/20 shadow-md bg-card/90 backdrop-blur-md shrink-0 border-t-2 overflow-hidden"
      style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
    >
      <div
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary border-b border-border/20 flex items-center justify-between bg-primary/5 select-none"
        style={{ cursor: onHeaderPointerDown ? "move" : undefined }}
        onPointerDown={onHeaderPointerDown}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {onHeaderPointerDown && (
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          )}
          <span className="truncate">
            {selectedOpening
              ? selectedOpening.kind === "door"
                ? lang === "de"
                  ? "Tür-Details"
                  : "Door Details"
                : lang === "de"
                  ? "Fenster-Details"
                  : "Window Details"
              : selectedItem
                ? lang === "de"
                  ? "Möbel-Details"
                  : "Item Inspector"
                : selectedIds.size > 1
                  ? lang === "de"
                    ? "Mehrfachauswahl"
                    : "Multiple Selection"
                  : lang === "de"
                    ? "Raum-Einstellungen"
                    : "Room Inspector"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedOpening ? (
            <span className="bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold capitalize">
              {wallLabel(selectedOpening.wall, t, lang)}
            </span>
          ) : selectedIds.size > 0 ? (
            <span className="bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold">
              {t.selectedCount(selectedIds.size)}
            </span>
          ) : null}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
              className="p-0.5 rounded hover:bg-primary/10 transition-colors"
              title={isCollapsed ? (lang === "de" ? "Erweitern" : "Expand") : (lang === "de" ? "Einklappen" : "Collapse")}
            >
              {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      {!isCollapsed && <CardContent className="p-3 max-h-[60vh] overflow-y-auto">
        {selectedOpening ? (
          /* Inspector for Selected Door/Window Opening */
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Opening title and delete action */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all flex-1 h-8 px-2 text-xs font-semibold select-none capitalize">
                <Sliders className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/75 shrink-0" />
                {selectedOpening.kind === "door" ? t.door : t.window} · {wallLabel(selectedOpening.wall, t, lang)}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all"
                  onClick={() => {
                    removeOpening(selectedOpening.id);
                    setSelectedOpeningId(null);
                  }}
                  disabled={threeDActive}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Frame/Panel Color Selection */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {lang === "de" ? "Rahmen- & Paneelfarbe" : "Frame & Panel Color"}
              </Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {OPENING_SWATCHES.map((sw) => {
                  const isSelected = (selectedOpening.color || "#475569").toLowerCase() === sw.value.toLowerCase();
                  return (
                    <button
                      key={sw.value}
                      type="button"
                      disabled={threeDActive}
                      onClick={() => updateOpening(selectedOpening.id, { color: sw.value })}
                      className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 will-change-transform ${
                        isSelected
                          ? "ring-2 ring-primary ring-offset-1 border-transparent scale-110"
                          : "border-border/60"
                      }`}
                      style={{ backgroundColor: sw.value }}
                      title={lang === "de" ? `${sw.name} Farbton` : `${sw.name} finish`}
                    />
                  );
                })}
                {/* Custom picker */}
                <div className="relative h-6 w-6 shrink-0 rounded-full border border-border/60 hover:scale-110 transition-all duration-200 overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer will-change-transform">
                  <Palette className="h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    type="color"
                    value={selectedOpening.color || "#475569"}
                    onChange={(e) => updateOpening(selectedOpening.id, { color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title={t.color}
                    disabled={threeDActive}
                  />
                </div>
              </div>
            </div>

            {/* Dimensions Section */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {lang === "de" ? "Maße & Position" : "Dimensions & Position"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t.width}</span>
                  <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                    <span className="pl-2 text-muted-foreground/75">
                      <Ruler className="h-3.5 w-3.5" />
                    </span>
                    <Input
                      value={opDraftW}
                      onChange={(e) => setOpDraftW(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "opening")}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                      disabled={threeDActive}
                    />
                    <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">
                    {lang === "de" ? "Abstand ab Ecke" : "Pos from Corner"}
                  </span>
                  <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                    <span className="pl-2 text-muted-foreground/75">
                      <Ruler className="h-3.5 w-3.5" />
                    </span>
                    <Input
                      value={opDraftPos}
                      onChange={(e) => setOpDraftPos(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "opening")}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                      disabled={threeDActive}
                    />
                    <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hinge & Swing for Doors only */}
            {selectedOpening.kind === "door" && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {lang === "de" ? "Tür-Konfiguration" : "Door Configuration"}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="h-8 text-[11px] font-medium"
                    disabled={threeDActive}
                    onClick={() =>
                      updateOpening(selectedOpening.id, {
                        hinge: selectedOpening.hinge === "start" ? "end" : "start",
                      })
                    }
                  >
                    {t.flipHinge}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="h-8 text-[11px] font-medium"
                    disabled={threeDActive}
                    onClick={() =>
                      updateOpening(selectedOpening.id, {
                        swing: selectedOpening.swing === "in" ? "out" : "in",
                      })
                    }
                  >
                    {t.flipSwing}
                  </Button>
                </div>
              </div>
            )}

            <Button
              onClick={handleApplyOpening}
              size="sm"
              type="button"
              className="w-full h-8 text-xs font-semibold active:scale-95 transition-all mt-1"
              disabled={!openingDirty || threeDActive}
            >
              {t.apply}
            </Button>
          </div>
        ) : selectedItem ? (
          /* Inspector for Single Selected Item */
          <div className="space-y-4">
            {/* Item Name and Quick Actions */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all flex-1">
                <span className="pl-2 text-muted-foreground/75">
                  <Sliders className="h-3.5 w-3.5" />
                </span>
                <Input
                  value={selectedItem.name}
                  onChange={(e) => updateItem(selectedItem.id, { name: e.target.value })}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 h-8 text-xs font-medium w-full bg-transparent"
                  disabled={threeDActive}
                />
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent active:scale-95 transition-all"
                  onClick={duplicateSelected}
                  title={t.duplicate}
                  disabled={threeDActive}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all"
                  onClick={() => removeItem(selectedItem.id)}
                  disabled={threeDActive}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Color & Finish Section */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {lang === "de" ? "Farbe & Finish" : "Color & Finish"}
              </Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {SWATCHES.map((sw) => {
                  const isSelected = selectedItem.color.toLowerCase() === sw.value.toLowerCase();
                  return (
                    <button
                      key={sw.value}
                      type="button"
                      disabled={threeDActive}
                      onClick={() => updateItem(selectedItem.id, { color: sw.value })}
                      className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 will-change-transform ${
                        isSelected
                          ? "ring-2 ring-primary ring-offset-1 border-transparent scale-110"
                          : "border-border/60"
                      }`}
                      style={{ backgroundColor: sw.value }}
                      title={lang === "de" ? `${sw.name} Farbton` : `${sw.name} finish`}
                    />
                  );
                })}
                {/* Custom picker */}
                <div className="relative h-6 w-6 shrink-0 rounded-full border border-border/60 hover:scale-110 transition-all duration-200 overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer will-change-transform">
                  <Palette className="h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    type="color"
                    value={selectedItem.color}
                    onChange={(e) => updateItem(selectedItem.id, { color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title={t.color}
                    disabled={threeDActive}
                  />
                </div>
              </div>
            </div>

            {/* Dimensions Grid */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {lang === "de" ? "Maße & Position" : "Dimensions & Position"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t.width}</span>
                  <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                    <span className="pl-2 text-muted-foreground/75">
                      <Ruler className="h-3.5 w-3.5" />
                    </span>
                    <Input
                      value={itemDraftW}
                      onChange={(e) => setItemDraftW(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "item")}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                      disabled={threeDActive}
                    />
                    <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t.length}</span>
                  <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                    <span className="pl-2 text-muted-foreground/75">
                      <Ruler className="h-3.5 w-3.5" />
                    </span>
                    <Input
                      value={itemDraftL}
                      onChange={(e) => setItemDraftL(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "item")}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                      disabled={threeDActive}
                    />
                    <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t.height}</span>
                  <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                    <span className="pl-2 text-muted-foreground/75">
                      <Ruler className="h-3.5 w-3.5" />
                    </span>
                    <Input
                      value={itemDraftH}
                      onChange={(e) => setItemDraftH(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "item")}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                      disabled={threeDActive}
                    />
                      <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t.elevation}</span>
                  <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                    <span className="pl-2 text-muted-foreground/75">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </span>
                    <Input
                      value={itemDraftElev}
                      onChange={(e) => setItemDraftElev(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "item")}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                      disabled={threeDActive}
                    />
                    <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rotation Section */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {lang === "de" ? "Drehung" : "Rotation"}
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all flex-1">
                  <span className="pl-2 text-muted-foreground/75">
                    <RotateCw className="h-3.5 w-3.5" />
                  </span>
                  <Input
                    value={itemDraftRot}
                    onChange={(e) => setItemDraftRot(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "item")}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-6 h-8 text-xs w-full bg-transparent"
                    title={t.rotation}
                    disabled={threeDActive}
                  />
                  <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">°</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {[-45, 45, 90].map((deg) => (
                    <Button
                      key={deg}
                      variant="outline"
                      size="sm"
                      type="button"
                      className="h-8 px-2 text-xs font-semibold active:scale-95 transition-all"
                      onClick={() => {
                        const newRotation = (((selectedItem.rotation + deg) % 360) + 360) % 360;
                        updateItem(selectedItem.id, { rotation: newRotation });
                      }}
                      disabled={threeDActive}
                    >
                      {deg > 0 ? `+${deg}` : deg}°
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={handleApplyItem}
              size="sm"
              type="button"
              className="w-full h-8 text-xs font-semibold active:scale-95 transition-all mt-1"
              disabled={!itemDirty || threeDActive}
            >
              {t.apply}
            </Button>
          </div>
        ) : selectedIds.size > 1 ? (
          /* Inspector for Multiple Selected Items */
          <div className="space-y-3 text-center py-2">
            <p className="text-xs text-muted-foreground">
              {lang === "de"
                ? `${selectedIds.size} Möbelstücke ausgewählt.`
                : `${selectedIds.size} items currently selected.`}
            </p>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={duplicateSelected}
                className="h-8 text-xs font-semibold"
                disabled={threeDActive}
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> {t.duplicate}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="button"
                onClick={removeSelected}
                className="h-8 text-xs font-semibold"
                disabled={threeDActive}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {lang === "de" ? "Löschen" : "Delete"}
              </Button>
            </div>
          </div>
        ) : (
          /* Inspector for Room Settings (Nothing selected) */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">{t.width}</span>
                <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                  <span className="pl-2 text-muted-foreground/75">
                    <Ruler className="h-3.5 w-3.5" />
                  </span>
                  <Input
                    value={draftW}
                    onChange={(e) => setDraftW(e.target.value)}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                    disabled={threeDActive}
                  />
                  <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">{t.length}</span>
                <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                  <span className="pl-2 text-muted-foreground/75">
                    <Ruler className="h-3.5 w-3.5" />
                  </span>
                  <Input
                    value={draftL}
                    onChange={(e) => setDraftL(e.target.value)}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                    disabled={threeDActive}
                  />
                  <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                </div>
              </div>
            </div>

            {/* Room presets buttons */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Maximize2 className="h-3 w-3 text-muted-foreground" />
                {lang === "de" ? "Raumgröße Presets" : "Room Presets"}
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "3×3m", w: 300, l: 300 },
                  { label: "4×3m", w: 400, l: 300 },
                  { label: "5×4m", w: 500, l: 400 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={threeDActive}
                    onClick={() => {
                      setDraftW(String(preset.w));
                      setDraftL(String(preset.l));
                      applyRoom(preset.w, preset.l);
                    }}
                    className="h-8 text-[10.5px] font-semibold active:scale-95 transition-all hover:bg-primary/5 hover:border-primary/40"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => applyRoom()}
              size="sm"
              type="button"
              className="w-full h-8 text-xs font-semibold active:scale-95 transition-all"
              disabled={!dirty || threeDActive}
            >
              {t.apply}
            </Button>

            <div className="h-px bg-border/20 my-3" />

            {/* Wall Colors Section */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="h-3 w-3 text-muted-foreground" />
                {lang === "de" ? "Wandfarben (2D/3D)" : "Wall Colors (2D/3D)"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: corners.length }, (_, i) => i).map((i) => {
                  const key = wallColorKey(i, corners.length);
                  const currentColor = wallColors?.[key] || "#f1f5f9";
                  const label = corners.length === 4 ? t[key] || key : wallLabel(i, t, lang);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 p-1.5 rounded-md border border-border/40 bg-background/40 hover:border-border/80 transition-all duration-200"
                    >
                      {/* Color Preview & Native Picker */}
                      <div
                        className="relative h-5 w-5 shrink-0 rounded-full border border-border/60 hover:scale-110 active:scale-95 transition-all duration-200 overflow-hidden shadow-sm flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: currentColor }}
                      >
                        <Palette className="h-2.5 w-2.5 text-muted-foreground/60 pointer-events-none" />
                        <input
                          type="color"
                          value={currentColor}
                          onChange={(e) => {
                            const newCol = e.target.value;
                            setWallColors((prev) => ({
                              ...prev,
                              [key]: newCol,
                            }));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title={`${label} color`}
                          disabled={threeDActive}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-medium text-foreground capitalize truncate leading-tight">
                          {label}
                        </span>
                        <span className="text-[8.5px] text-muted-foreground font-mono truncate uppercase leading-none">
                          {currentColor}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>}
    </Card>
  );
}
