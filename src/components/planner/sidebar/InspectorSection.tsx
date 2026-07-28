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
  PaintBucket,
  Wand2,
  BookmarkPlus,
} from "lucide-react";
import type { CatalogSaveDraft, Item, Opening, Point, RoomFlooring } from "@/types/planner";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { wallColorKey, wallLabel } from "@/lib/hallway-shapes";
import { FLOOR_MATERIALS } from "@/lib/floor-materials";
import { FloorSwatchPreview } from "@/lib/floor-pattern-svg";
import { PRESET_BY_KEY, getDefaultHeight, resolveEffectiveElevation } from "@/lib/planner-presets";
import { SWATCHES } from "@/lib/swatches";
import { LayoutGrid } from "lucide-react";

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
  flooring: RoomFlooring;
  setFlooring: React.Dispatch<React.SetStateAction<RoomFlooring>>;
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
  /** Opens the "Save to My Catalog" dialog, prefilled from a draft -- see
   * the "Save to My Catalog" quick action below, the only entry point into
   * My Catalog's create flow (see CatalogTile.tsx's doc comment for why it
   * isn't also on every catalog grid tile). */
  openSaveDialog: (draft: CatalogSaveDraft) => void;
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
  flooring,
  setFlooring,
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
  openSaveDialog,
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
      setItemDraftH(
        String(selectedItem.height ?? getDefaultHeight(selectedItem.icon, selectedItem.kind)),
      );
      // While riding on another item (placedOnId), the displayed elevation
      // is the derived one (host height + host elevation), not the item's
      // own stored field -- see resolveEffectiveElevation's doc comment.
      // `items` is in the dependency array below (not just selectedItem's
      // own fields) so this stays correct if the HOST's height/elevation
      // changes while this item is still the one selected.
      setItemDraftElev(String(resolveEffectiveElevation(selectedItem, items)));
      setItemDraftRot(String(selectedItem.rotation));
    }
  }, [
    selectedItem?.id,
    selectedItem?.width,
    selectedItem?.length,
    selectedItem?.height,
    selectedItem?.elevation,
    selectedItem?.placedOnId,
    selectedItem?.rotation,
    items,
  ]);

  React.useEffect(() => {
    if (selectedOpening) {
      setOpDraftW(String(selectedOpening.width));
      setOpDraftPos(String(Math.round(selectedOpening.position)));
    }
  }, [selectedOpening?.id, selectedOpening?.width, selectedOpening?.position]);

  const itemDirty = React.useMemo(() => {
    if (!selectedItem) return false;
    return (
      itemDraftW !== String(selectedItem.width) ||
      itemDraftL !== String(selectedItem.length) ||
      itemDraftH !==
        String(selectedItem.height ?? getDefaultHeight(selectedItem.icon, selectedItem.kind)) ||
      itemDraftElev !== String(resolveEffectiveElevation(selectedItem, items)) ||
      itemDraftRot !== String(selectedItem.rotation)
    );
  }, [selectedItem, items, itemDraftW, itemDraftL, itemDraftH, itemDraftElev, itemDraftRot]);

  const openingDirty = React.useMemo(() => {
    if (!selectedOpening) return false;
    return (
      opDraftW !== String(selectedOpening.width) ||
      opDraftPos !== String(Math.round(selectedOpening.position))
    );
  }, [selectedOpening, opDraftW, opDraftPos]);

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
            <HoverTooltip
              content={
                isCollapsed
                  ? lang === "de"
                    ? "Erweitern"
                    : "Expand"
                  : lang === "de"
                    ? "Einklappen"
                    : "Collapse"
              }
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse();
                }}
                className="p-0.5 rounded hover:bg-primary/10 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </button>
            </HoverTooltip>
          )}
        </div>
      </div>
      {!isCollapsed && (
        <CardContent className="p-3 max-h-[60vh] overflow-y-auto">
          {selectedOpening ? (
            /* Inspector for Selected Door/Window Opening */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Opening title and delete action */}
              <div className="flex items-center gap-2">
                <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all flex-1 h-8 px-2 text-xs font-semibold select-none capitalize">
                  <Sliders className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/75 shrink-0" />
                  {selectedOpening.kind === "door" ? t.door : t.window} ·{" "}
                  {wallLabel(selectedOpening.wall, t, lang)}
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
                    const isSelected =
                      (selectedOpening.color || "#475569").toLowerCase() === sw.value.toLowerCase();
                    return (
                      <HoverTooltip
                        key={sw.value}
                        content={lang === "de" ? `${sw.name} Farbton` : `${sw.name} finish`}
                      >
                        <button
                          type="button"
                          disabled={threeDActive}
                          onClick={() => updateOpening(selectedOpening.id, { color: sw.value })}
                          className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 will-change-transform ${
                            isSelected
                              ? "ring-2 ring-primary ring-offset-1 border-transparent scale-110"
                              : "border-border/60"
                          }`}
                          style={{ backgroundColor: sw.value }}
                        />
                      </HoverTooltip>
                    );
                  })}
                  {/* Custom picker */}
                  <HoverTooltip content={t.color}>
                    <div className="relative h-6 w-6 shrink-0 rounded-full border border-border/60 hover:scale-110 transition-all duration-200 overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer will-change-transform">
                      <Palette className="h-3 w-3 text-muted-foreground pointer-events-none" />
                      <input
                        type="color"
                        value={selectedOpening.color || "#475569"}
                        onChange={(e) => updateOpening(selectedOpening.id, { color: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        disabled={threeDActive}
                      />
                    </div>
                  </HoverTooltip>
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
                      <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                        cm
                      </span>
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
                      <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                        cm
                      </span>
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
                  <HoverTooltip content={t.duplicate}>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 hover:bg-accent active:scale-95 transition-all"
                      onClick={duplicateSelected}
                      disabled={threeDActive}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </HoverTooltip>
                  <HoverTooltip
                    content={lang === "de" ? "Zu meinem Katalog speichern" : "Save to My Catalog"}
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 hover:bg-primary/10 hover:text-primary active:scale-95 transition-all"
                      onClick={() =>
                        openSaveDialog({
                          name: selectedItem.name,
                          w: selectedItem.width,
                          l: selectedItem.length,
                          color: selectedItem.color,
                          sourceKey: selectedItem.icon,
                          layer: selectedItem.layer,
                          shape: selectedItem.shape,
                        })
                      }
                      disabled={threeDActive}
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                    </Button>
                  </HoverTooltip>
                  <HoverTooltip content={lang === "de" ? "Löschen" : "Delete"}>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all"
                      onClick={() => removeItem(selectedItem.id)}
                      disabled={threeDActive}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </HoverTooltip>
                </div>
              </div>

              {/* Color & Finish Section */}
              {(() => {
                // A real Kenney 3D model (Preset.kitModel) whose color has
                // been changed away from the preset's own default gets its
                // original materials recolored to match (see
                // tintKitMaterial in ThreeDView.tsx) -- easy to forget was
                // done since this panel otherwise looks identical to a
                // plain procedural box's color picker. `kitTintOriginal`
                // drives a prominent banner (below) with a one-click
                // revert, rather than a small tag easy to miss.
                const preset = selectedItem.icon ? PRESET_BY_KEY[selectedItem.icon] : undefined;
                const kitTintOriginal =
                  preset?.kitModel &&
                  selectedItem.color.toLowerCase() !== preset.color.toLowerCase()
                    ? preset.color
                    : null;
                return (
                  <div className={kitTintOriginal ? "space-y-2.5" : "space-y-1.5"}>
                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {lang === "de" ? "Farbe & Finish" : "Color & Finish"}
                    </Label>
                    {kitTintOriginal && (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-2">
                        <span className="flex items-center gap-2 text-[11px] font-medium text-primary leading-tight">
                          <Wand2 className="h-3.5 w-3.5 shrink-0" />
                          {lang === "de"
                            ? "3D-Modellfarbe wurde überschrieben"
                            : "3D model color overridden"}
                        </span>
                        <HoverTooltip content={`Original: ${kitTintOriginal}`}>
                          <button
                            type="button"
                            disabled={threeDActive}
                            onClick={() => updateItem(selectedItem.id, { color: kitTintOriginal })}
                            className="shrink-0 cursor-pointer rounded-md bg-primary px-2 py-1 text-[10.5px] font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
                          >
                            {lang === "de" ? "Zurücksetzen" : "Reset"}
                          </button>
                        </HoverTooltip>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SWATCHES.map((sw) => {
                        const isSelected =
                          selectedItem.color.toLowerCase() === sw.value.toLowerCase();
                        return (
                          <HoverTooltip
                            key={sw.value}
                            content={lang === "de" ? `${sw.name} Farbton` : `${sw.name} finish`}
                          >
                            <button
                              type="button"
                              disabled={threeDActive}
                              onClick={() => updateItem(selectedItem.id, { color: sw.value })}
                              className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 will-change-transform ${
                                isSelected
                                  ? "ring-2 ring-primary ring-offset-1 border-transparent scale-110"
                                  : "border-border/60"
                              }`}
                              style={{ backgroundColor: sw.value }}
                            />
                          </HoverTooltip>
                        );
                      })}
                      {/* Custom picker */}
                      <HoverTooltip content={t.color}>
                        <div className="relative h-6 w-6 shrink-0 rounded-full border border-border/60 hover:scale-110 transition-all duration-200 overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer will-change-transform">
                          <Palette className="h-3 w-3 text-muted-foreground pointer-events-none" />
                          <input
                            type="color"
                            value={selectedItem.color}
                            onChange={(e) => updateItem(selectedItem.id, { color: e.target.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            disabled={threeDActive}
                          />
                        </div>
                      </HoverTooltip>
                    </div>
                  </div>
                );
              })()}

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
                      <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                        cm
                      </span>
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
                      <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                        cm
                      </span>
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
                      <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                        cm
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">{t.elevation}</span>
                    <HoverTooltip
                      content={
                        selectedItem.placedOnId
                          ? lang === "de"
                            ? "Wird automatisch aus der Höhe des Objekts darunter berechnet"
                            : "Automatically derived from the item it's placed on"
                          : ""
                      }
                    >
                      <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                        <span className="pl-2 text-muted-foreground/75">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </span>
                        <Input
                          value={itemDraftElev}
                          onChange={(e) => setItemDraftElev(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, "item")}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent disabled:opacity-70"
                          disabled={threeDActive || Boolean(selectedItem.placedOnId)}
                        />
                        <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                          cm
                        </span>
                      </div>
                    </HoverTooltip>
                  </div>
                </div>

                {/* Place on top of another item -- lets ANY item ride on
                    top of any other, not just the built-in "on-top" layer
                    (see Item.placedOnId's doc comment). Elevation above
                    switches to a read-only derived value the moment a host
                    is picked; position keeps tracking the host automatically
                    whenever it's dragged (use-room-planner.ts). */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">
                    {lang === "de" ? "Auf anderem Objekt platzieren" : "Place on top of"}
                  </span>
                  <select
                    value={selectedItem.placedOnId ?? ""}
                    onChange={(e) => {
                      const hostId = e.target.value || undefined;
                      updateItem(selectedItem.id, {
                        placedOnId: hostId,
                        ...(hostId ? {} : { elevation: 0 }),
                      });
                    }}
                    disabled={threeDActive}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary transition-all disabled:opacity-50"
                  >
                    <option value="">
                      {lang === "de" ? "Keins (auf dem Boden)" : "None (on the floor)"}
                    </option>
                    {items
                      .filter((i) => i.id !== selectedItem.id && i.placedOnId !== selectedItem.id)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                  </select>
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
                    <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                      °
                    </span>
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
                    <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                      cm
                    </span>
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
                    <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                      cm
                    </span>
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
                        <HoverTooltip content={`${label} color`}>
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
                              disabled={threeDActive}
                            />
                          </div>
                        </HoverTooltip>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[10px] font-medium text-foreground capitalize truncate leading-tight">
                            {label}
                          </span>
                          <span className="text-[8.5px] text-muted-foreground font-mono truncate uppercase leading-none">
                            {currentColor}
                          </span>
                        </div>
                        {/* Quick action: apply this exact wall's color to
                          every other wall in the room, instead of having
                          to open the color picker N times to match one
                          color across all walls. */}
                        <HoverTooltip
                          content={
                            lang === "de"
                              ? "Diese Farbe auf alle Wände anwenden"
                              : "Apply this color to all walls"
                          }
                        >
                          <button
                            type="button"
                            disabled={threeDActive}
                            onClick={() => {
                              const allKeys = Array.from({ length: corners.length }, (_, j) =>
                                wallColorKey(j, corners.length),
                              );
                              setWallColors((prev) => {
                                const next = { ...prev };
                                for (const k of allKeys) next[k] = currentColor;
                                return next;
                              });
                            }}
                            className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <PaintBucket className="h-3 w-3" />
                          </button>
                        </HoverTooltip>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-border/20 my-3" />

              {/* Flooring Section -- material/pattern swatch grid (each
                tile a live miniature of that material's actual pattern,
                see floor-pattern-svg.tsx) plus a native color picker that
                tints whichever material is currently selected. Mirrors the
                Wall Colors section's swatch+picker convention above. */}
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutGrid className="h-3 w-3 text-muted-foreground" />
                  {lang === "de" ? "Bodenbelag" : "Flooring"}
                </Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {FLOOR_MATERIALS.map((mat) => {
                    const isSelected = flooring.key === mat.key;
                    const previewColor = isSelected ? flooring.color : mat.defaultColor;
                    return (
                      <HoverTooltip key={mat.key} content={lang === "de" ? mat.nameDe : mat.nameEn}>
                        <button
                          type="button"
                          disabled={threeDActive}
                          onClick={() => setFlooring({ key: mat.key, color: mat.defaultColor })}
                          className={`aspect-square w-full block rounded-md overflow-hidden border transition-all duration-150 active:scale-95 ${
                            isSelected
                              ? "border-primary ring-1 ring-primary"
                              : "border-border/40 hover:border-border/80"
                          }`}
                        >
                          <FloorSwatchPreview materialKey={mat.key} color={previewColor} size={32} />
                        </button>
                      </HoverTooltip>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-md border border-border/40 bg-background/40 hover:border-border/80 transition-all duration-200">
                  <HoverTooltip content={lang === "de" ? "Bodenfarbe" : "Floor color"}>
                    <div
                      className="relative h-5 w-5 shrink-0 rounded-full border border-border/60 hover:scale-110 active:scale-95 transition-all duration-200 overflow-hidden shadow-sm flex items-center justify-center cursor-pointer"
                      style={{ backgroundColor: flooring.color }}
                    >
                      <Palette className="h-2.5 w-2.5 text-muted-foreground/60 pointer-events-none" />
                      <input
                        type="color"
                        value={flooring.color}
                        onChange={(e) => setFlooring((prev) => ({ ...prev, color: e.target.value }))}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        disabled={threeDActive}
                      />
                    </div>
                  </HoverTooltip>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-medium text-foreground capitalize truncate leading-tight">
                      {lang === "de"
                        ? (FLOOR_MATERIALS.find((m) => m.key === flooring.key)?.nameDe ?? "")
                        : (FLOOR_MATERIALS.find((m) => m.key === flooring.key)?.nameEn ?? "")}
                    </span>
                    <span className="text-[8.5px] text-muted-foreground font-mono truncate uppercase leading-none">
                      {flooring.color}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
