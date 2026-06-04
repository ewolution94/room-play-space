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
  const handleNudge = (dx: number, dy: number, shift: boolean) => {
    if (!selectedItem || threeDActive) return;
    const step = shift ? 10 : 1;
    updateItem(selectedItem.id, {
      x: selectedItem.x + dx * step,
      y: selectedItem.y + dy * step,
    });
  };

  return (
    <Card id="tour-inspector" className="border-primary/20 shadow-md bg-card/90 backdrop-blur-md shrink-0 border-t-2 overflow-hidden">
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
              {t[selectedOpening.wall] || selectedOpening.wall}
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
                {selectedOpening.kind === "door" ? t.door : t.window} · {t[selectedOpening.wall] || selectedOpening.wall}
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
                      className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 ${
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
                <div className="relative h-6 w-6 shrink-0 rounded-full border border-border/60 hover:scale-110 transition-all duration-200 overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer">
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
                      type="number"
                      value={selectedOpening.width}
                      onChange={(e) => updateOpening(selectedOpening.id, { width: +e.target.value || 0 })}
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
                      type="number"
                      value={Math.round(selectedOpening.position)}
                      onChange={(e) => updateOpening(selectedOpening.id, { position: +e.target.value || 0 })}
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
                      className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 ${
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
                <div className="relative h-6 w-6 shrink-0 rounded-full border border-border/60 hover:scale-110 transition-all duration-200 overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer">
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
                      type="number"
                      value={selectedItem.width}
                      onChange={(e) => updateItem(selectedItem.id, { width: +e.target.value || 0 })}
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
                      type="number"
                      value={selectedItem.length}
                      onChange={(e) => updateItem(selectedItem.id, { length: +e.target.value || 0 })}
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
                      type="number"
                      value={selectedItem.height ?? getDefaultHeight(selectedItem.icon, selectedItem.kind)}
                      onChange={(e) => updateItem(selectedItem.id, { height: +e.target.value || 0 })}
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
                      type="number"
                      value={selectedItem.elevation ?? 0}
                      onChange={(e) => updateItem(selectedItem.id, { elevation: +e.target.value || 0 })}
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
                    type="number"
                    value={Math.round(selectedItem.rotation)}
                    onChange={(e) =>
                      updateItem(selectedItem.id, {
                        rotation: (((+e.target.value || 0) % 360) + 360) % 360,
                      })
                    }
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

            {/* Graphical Nudge Pad */}
            <div className="flex flex-col items-center gap-2 p-3 bg-muted/40 dark:bg-muted/10 rounded-lg border border-border/30">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Move className="h-3.5 w-3.5" />
                {lang === "de" ? "Feinpositionierung" : "Nudge Position"}
              </div>
              <div className="grid grid-cols-3 gap-1.5 w-28 aspect-square">
                <div />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  className="h-8 w-8 active:scale-90 transition-all hover:bg-primary/5 hover:border-primary/40"
                  onClick={(e) => handleNudge(0, -1, e.shiftKey)}
                  title={lang === "de" ? "Nach oben verschieben (Shift für 10cm)" : "Nudge Up (Shift for 10cm)"}
                  disabled={threeDActive}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <div />

                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  className="h-8 w-8 active:scale-90 transition-all hover:bg-primary/5 hover:border-primary/40"
                  onClick={(e) => handleNudge(-1, 0, e.shiftKey)}
                  title={lang === "de" ? "Nach links verschieben (Shift für 10cm)" : "Nudge Left (Shift for 10cm)"}
                  disabled={threeDActive}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center text-muted-foreground text-[9px] font-bold select-none bg-background border border-border/40 rounded shadow-sm w-8 h-8">
                  Shift
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  className="h-8 w-8 active:scale-90 transition-all hover:bg-primary/5 hover:border-primary/40"
                  onClick={(e) => handleNudge(1, 0, e.shiftKey)}
                  title={lang === "de" ? "Nach rechts verschieben (Shift für 10cm)" : "Nudge Right (Shift for 10cm)"}
                  disabled={threeDActive}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  className="h-8 w-8 active:scale-90 transition-all hover:bg-primary/5 hover:border-primary/40"
                  onClick={(e) => handleNudge(0, 1, e.shiftKey)}
                  title={lang === "de" ? "Nach unten verschieben (Shift für 10cm)" : "Nudge Down (Shift for 10cm)"}
                  disabled={threeDActive}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <div />
              </div>
              <span className="text-[9px] text-muted-foreground/80 italic text-center select-none">
                {lang === "de" ? "Shift gedrückt halten: 10cm Schritte" : "Hold Shift: 10cm steps"}
              </span>
            </div>
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
                {(["top", "right", "bottom", "left"] as const).map((side) => {
                  const currentColor = wallColors?.[side] || "#f1f5f9";
                  return (
                    <div
                      key={side}
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
                              [side]: newCol,
                            }));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title={`${t[side] || side} color`}
                          disabled={threeDActive}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-medium text-foreground capitalize truncate leading-tight">
                          {t[side] || side}
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
