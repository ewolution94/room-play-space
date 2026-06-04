import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Copy,
  RotateCw,
  Square,
  Sliders,
  Layers,
  Package,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Move,
  Ruler,
  Palette,
  Maximize2,
} from "lucide-react";
import type { SidebarProps, Preset, Opening, Item } from "@/types/planner";
import { PRESETS, PRESET_ICON } from "@/lib/planner-presets";
import { getDefaultHeight } from "./ThreeDView";

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

export function Sidebar({
  t,
  lang,
  items,
  openings,
  selectedIds,
  setSelectedIds,
  nName,
  setNName,
  nW,
  setNW,
  nL,
  setNL,
  nColor,
  setNColor,
  oKind,
  setOKind,
  oWall,
  setOWall,
  oPos,
  setOPos,
  oWidth,
  setOWidth,
  roomW,
  roomL,
  draftW,
  setDraftW,
  draftL,
  setDraftL,
  dirty,
  applyRoom,
  addPreset,
  addCustomBox,
  addOpening,
  updateOpening,
  removeOpening,
  removeItem,
  updateItem,
  duplicateSelected,
  removeSelected,
  threeDActive = false,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"add" | "layers">("add");
  const [customBoxOpen, setCustomBoxOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  // Group presets by category for catalog rendering
  const categorized = useMemo(() => {
    const map: Record<string, Preset[]> = {};
    for (const p of PRESETS) {
      (map[p.category] ||= []).push(p);
    }
    return map;
  }, []);

  // Find the currently selected item if exactly 1 is selected
  const selectedItem = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return items.find((i) => i.id === id) || null;
  }, [selectedIds, items]);

  const handleNudge = (dx: number, dy: number, shift: boolean) => {
    if (!selectedItem || threeDActive) return;
    const step = shift ? 10 : 1;
    updateItem(selectedItem.id, {
      x: selectedItem.x + dx * step,
      y: selectedItem.y + dy * step,
    });
  };

  return (
    <aside id="tour-sidebar" className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:shrink-0">
      {threeDActive && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400 dark:bg-amber-500/10 backdrop-blur-sm shadow-sm flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            {lang === "de" ? "3D-Ansicht Aktiv" : "3D Mode Active"}
          </div>
          <p className="text-[10.5px] leading-normal opacity-90">
            {lang === "de"
              ? "Das Hinzufügen von Möbeln, Ändern von Raummaßen und Bearbeiten von Elementen ist im 3D-Modus deaktiviert. Wechseln Sie in die 2D-Ansicht, um Änderungen vorzunehmen."
              : "Adding furniture, changing room dimensions, and editing elements are disabled in 3D view. Switch to 2D mode to make changes."}
          </p>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1">
        <Button
          variant={activeTab === "add" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("add")}
          className="h-8"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {lang === "de" ? "Hinzufügen" : "Add"}
        </Button>
        <Button
          variant={activeTab === "layers" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("layers")}
          className="h-8 relative"
        >
          <Layers className="mr-1.5 h-4 w-4" />
          {lang === "de" ? "Ebenen" : "Layers"}
          {(items.length > 0 || openings.length > 0) && (
            <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {items.length + openings.length}
            </span>
          )}
        </Button>
      </div>

      {/* Tab Contents Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {activeTab === "add" ? (
          <>
            {/* Catalog Preset Cards */}
            <Card id="tour-catalog" className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
              <div className="px-4 py-3 font-semibold text-sm border-b border-border/20 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-primary" />
                {t.catalog}
              </div>
              <CardContent className="p-3 space-y-3">
                {Object.entries(categorized).map(([cat, list]) => (
                  <div key={cat}>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                      {t.categories[cat] ?? cat}
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {list.map((p) => {
                        const Icon = PRESET_ICON[p.key] ?? Square;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            disabled={threeDActive}
                            onClick={() => addPreset(p)}
                            className="group flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border border-border/40 bg-background/50 p-1 text-center transition-all duration-200 hover:border-primary hover:bg-accent/50 disabled:opacity-50 disabled:pointer-events-none"
                            title={`${lang === "de" ? p.nameDe : p.nameEn} (${p.w}×${p.l}cm)`}
                          >
                            <Icon
                              className="h-4.5 w-4.5 text-foreground/85 transition group-hover:scale-105"
                              strokeWidth={1.5}
                            />
                            <span className="line-clamp-1 text-[8.5px] font-medium leading-tight text-muted-foreground/90">
                              {lang === "de" ? p.nameDe : p.nameEn}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Advanced Elements Dialog Triggers */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              {/* Custom box dialog */}
              <Dialog open={customBoxOpen} onOpenChange={setCustomBoxOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={threeDActive}
                    className="h-9 text-xs font-semibold w-full hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    {lang === "de" ? "Möbel-Ersteller" : "Custom Item"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-1.5">
                      <Plus className="h-5 w-5 text-primary" />
                      {t.customBox}
                    </DialogTitle>
                    <DialogDescription>
                      {lang === "de" ? "Erstellen Sie ein maßgeschneidertes Möbelstück für Ihre Raumplanung." : "Create a customized furniture item for your room layout."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.name}</Label>
                      <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                        <span className="pl-2.5 text-muted-foreground/75">
                          <Sliders className="h-3.5 w-3.5" />
                        </span>
                        <Input
                          value={nName}
                          onChange={(e) => setNName(e.target.value)}
                          placeholder={t.namePlaceholder}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 h-8 text-xs w-full bg-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.width}</Label>
                        <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                          <span className="pl-2.5 text-muted-foreground/75">
                            <Ruler className="h-3.5 w-3.5" />
                          </span>
                          <Input
                            type="number"
                            value={nW}
                            onChange={(e) => setNW(+e.target.value || 0)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                          />
                          <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.length}</Label>
                        <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                          <span className="pl-2.5 text-muted-foreground/75">
                            <Ruler className="h-3.5 w-3.5" />
                          </span>
                          <Input
                            type="number"
                            value={nL}
                            onChange={(e) => setNL(+e.target.value || 0)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                          />
                          <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.color}</Label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {SWATCHES.map((sw) => {
                          const isSelected = nColor.toLowerCase() === sw.value.toLowerCase();
                          return (
                            <button
                              key={sw.value}
                              type="button"
                              onClick={() => setNColor(sw.value)}
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
                        <div className="relative h-6 w-6 shrink-0 rounded-full border border-border/60 hover:scale-110 transition-all duration-200 overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer">
                          <Palette className="h-3 w-3 text-muted-foreground pointer-events-none" />
                          <input
                            type="color"
                            value={nColor}
                            onChange={(e) => setNColor(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title={t.color}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={() => {
                        addCustomBox();
                        setCustomBoxOpen(false);
                      }}
                      className="w-full sm:w-auto h-9 text-xs font-semibold"
                    >
                      <Plus className="mr-1 h-4 w-4" /> {t.addItem}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Openings dialog */}
              <Dialog open={openingOpen} onOpenChange={setOpeningOpen}>
                <DialogTrigger asChild>
                  <Button
                    id="tour-openings"
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={threeDActive}
                    className="h-9 text-xs font-semibold w-full hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 border-dashed"
                  >
                    <Sliders className="h-3.5 w-3.5 text-primary" />
                    {lang === "de" ? "Wandöffnungen" : "Openings"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-1.5">
                      <Sliders className="h-5 w-5 text-primary" />
                      {t.openings}
                    </DialogTitle>
                    <DialogDescription>
                      {lang === "de" ? "Fügen Sie Türen oder Fenster in die Außenwände Ihres Raums ein." : "Add doors or windows to the outer walls of your room."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.type}</Label>
                        <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                          <span className="pl-2.5 text-muted-foreground/75">
                            <Square className="h-3.5 w-3.5" />
                          </span>
                          <select
                            className="w-full bg-transparent pl-1.5 pr-2 h-8 text-xs focus:outline-none focus:ring-0 focus:border-0 border-0 cursor-pointer"
                            value={oKind}
                            onChange={(e) => setOKind(e.target.value as "door" | "window")}
                          >
                            <option value="door" className="bg-background">{t.door}</option>
                            <option value="window" className="bg-background">{t.window}</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.wall}</Label>
                        <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                          <span className="pl-2.5 text-muted-foreground/75">
                            <Sliders className="h-3.5 w-3.5" />
                          </span>
                          <select
                            className="w-full bg-transparent pl-1.5 pr-2 h-8 text-xs focus:outline-none focus:ring-0 focus:border-0 border-0 cursor-pointer"
                            value={oWall}
                            onChange={(e) => setOWall(e.target.value as Opening["wall"])}
                          >
                            <option value="top" className="bg-background">{t.top}</option>
                            <option value="bottom" className="bg-background">{t.bottom}</option>
                            <option value="left" className="bg-background">{t.left}</option>
                            <option value="right" className="bg-background">{t.right}</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.position}</Label>
                        <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                          <span className="pl-2.5 text-muted-foreground/75">
                            <Ruler className="h-3.5 w-3.5" />
                          </span>
                          <Input
                            type="number"
                            value={oPos}
                            onChange={(e) => setOPos(+e.target.value || 0)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                          />
                          <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.width}</Label>
                        <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                          <span className="pl-2.5 text-muted-foreground/75">
                            <Ruler className="h-3.5 w-3.5" />
                          </span>
                          <Input
                            type="number"
                            value={oWidth}
                            onChange={(e) => setOWidth(+e.target.value || 0)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                          />
                          <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={() => {
                        addOpening();
                        setOpeningOpen(false);
                      }}
                      className="w-full sm:w-auto h-9 text-xs font-semibold"
                    >
                      <Plus className="mr-1 h-4 w-4" /> {t.addOpening}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </>
        ) : (
          /* Layers view: Lists all items & openings currently placed */
          <Card className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm flex-1">
            <div className="px-4 py-3 font-semibold text-sm border-b border-border/20">
              {lang === "de" ? "Elemente auf der Arbeitsfläche" : "Active Elements"}
            </div>
            <CardContent className="p-3 space-y-4">
              {/* Furniture List */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t.items} ({items.length})
                </h4>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-md">
                    {t.noItems}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                    {items.map((it) => {
                      const isSelected = selectedIds.has(it.id);
                      return (
                        <div
                          key={it.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (e.shiftKey) {
                              setSelectedIds((s) => {
                                const n = new Set(s);
                                if (n.has(it.id)) n.delete(it.id);
                                else n.add(it.id);
                                return n;
                              });
                            } else {
                              setSelectedIds(new Set([it.id]));
                            }
                          }}
                          className={`flex items-center justify-between gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? "bg-primary/10 border-primary font-medium"
                              : "bg-background/40 hover:bg-accent/40 border-border/40"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="h-3.5 w-3.5 rounded border border-foreground/10 shrink-0"
                              style={{ background: it.color }}
                            />
                            <span className="truncate">{it.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-muted-foreground">
                              {it.width}×{it.length}cm
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={threeDActive}
                              className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem(it.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator className="bg-border/30" />

              {/* Openings List */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {t.openings} ({openings.length})
                </h4>
                {openings.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-md">
                    {t.noOpenings}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {openings.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between gap-1.5 p-1.5 rounded-md border border-border/40 bg-background/40 text-xs"
                      >
                        <span className="truncate min-w-0 capitalize">
                          {o.kind === "door" ? t.door : t.window} · {t[o.wall]} ·{" "}
                          {Math.round(o.position)}cm
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{o.width}cm</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={threeDActive}
                            className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
                            onClick={() => removeOpening(o.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Contextual Properties Inspector */}
      <Card id="tour-inspector" className="border-primary/20 shadow-md bg-card/90 backdrop-blur-md shrink-0 border-t-2">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary border-b border-border/20 flex items-center justify-between bg-primary/5">
          <span>
            {selectedItem
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
          {selectedIds.size > 0 && (
            <span className="bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold">
              {t.selectedCount(selectedIds.size)}
            </span>
          )}
        </div>
        <CardContent className="p-3">
          {selectedItem ? (
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
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
