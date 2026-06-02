import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Copy, RotateCw, Square, Sliders, Layers, Package } from "lucide-react";
import type { SidebarProps, Preset, Opening, Item } from "@/types/planner";
import { PRESETS, PRESET_ICON } from "@/lib/planner-presets";
import { getDefaultHeight } from "./ThreeDView";

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

  return (
    <aside id="tour-sidebar" className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start lg:h-[calc(100vh-6rem)]">
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

            {/* Custom box */}
            <Card className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
              <div className="px-4 py-3 font-semibold text-sm border-b border-border/20 flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-primary" />
                {t.customBox}
              </div>
              <CardContent className="p-3 space-y-2.5">
                <div>
                  <Label className="text-xs">{t.name}</Label>
                  <Input
                    value={nName}
                    onChange={(e) => setNName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="h-8 text-xs mt-1"
                    disabled={threeDActive}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{t.width}</Label>
                    <Input
                      type="number"
                      value={nW}
                      onChange={(e) => setNW(+e.target.value || 0)}
                      className="h-8 text-xs mt-1"
                      disabled={threeDActive}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t.length}</Label>
                    <Input
                      type="number"
                      value={nL}
                      onChange={(e) => setNL(+e.target.value || 0)}
                      className="h-8 text-xs mt-1"
                      disabled={threeDActive}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t.color}</Label>
                  <input
                    type="color"
                    value={nColor}
                    onChange={(e) => setNColor(e.target.value)}
                    className="h-8 w-full cursor-pointer rounded-md border mt-1 bg-background p-0.5 disabled:opacity-50 disabled:pointer-events-none"
                    disabled={threeDActive}
                  />
                </div>
                <Button onClick={addCustomBox} className="w-full h-8 text-xs mt-1" size="sm" disabled={threeDActive}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> {t.addItem}
                </Button>
              </CardContent>
            </Card>

            {/* Openings */}
            <Card id="tour-openings" className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
              <div className="px-4 py-3 font-semibold text-sm border-b border-border/20 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-primary" />
                {t.openings}
              </div>
              <CardContent className="p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{t.type}</Label>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-1 disabled:opacity-50 disabled:pointer-events-none"
                      value={oKind}
                      onChange={(e) => setOKind(e.target.value as "door" | "window")}
                      disabled={threeDActive}
                    >
                      <option value="door">{t.door}</option>
                      <option value="window">{t.window}</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">{t.wall}</Label>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-1 disabled:opacity-50 disabled:pointer-events-none"
                      value={oWall}
                      onChange={(e) => setOWall(e.target.value as Opening["wall"])}
                      disabled={threeDActive}
                    >
                      <option value="top">{t.top}</option>
                      <option value="bottom">{t.bottom}</option>
                      <option value="left">{t.left}</option>
                      <option value="right">{t.right}</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">{t.position}</Label>
                    <Input
                      type="number"
                      value={oPos}
                      onChange={(e) => setOPos(+e.target.value || 0)}
                      className="h-8 text-xs mt-1"
                      disabled={threeDActive}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t.width}</Label>
                    <Input
                      type="number"
                      value={oWidth}
                      onChange={(e) => setOWidth(+e.target.value || 0)}
                      className="h-8 text-xs mt-1"
                      disabled={threeDActive}
                    />
                  </div>
                </div>
                <Button onClick={addOpening} size="sm" className="w-full h-8 text-xs" disabled={threeDActive}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> {t.addOpening}
                </Button>
              </CardContent>
            </Card>
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
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedItem.color}
                  onChange={(e) => updateItem(selectedItem.id, { color: e.target.value })}
                  className="h-7 w-7 shrink-0 cursor-pointer rounded border border-border/40 p-0.5 disabled:opacity-50 disabled:pointer-events-none"
                  title={t.color}
                  disabled={threeDActive}
                />
                <Input
                  value={selectedItem.name}
                  onChange={(e) => updateItem(selectedItem.id, { name: e.target.value })}
                  className="h-8 text-xs font-medium"
                  disabled={threeDActive}
                />
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={duplicateSelected}
                    title={t.duplicate}
                    disabled={threeDActive}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeItem(selectedItem.id)}
                    disabled={threeDActive}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t.width}</Label>
                  <Input
                    type="number"
                    value={selectedItem.width}
                    onChange={(e) => updateItem(selectedItem.id, { width: +e.target.value || 0 })}
                    className="h-8 text-xs mt-0.5"
                    disabled={threeDActive}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t.length}</Label>
                  <Input
                    type="number"
                    value={selectedItem.length}
                    onChange={(e) => updateItem(selectedItem.id, { length: +e.target.value || 0 })}
                    className="h-8 text-xs mt-0.5"
                    disabled={threeDActive}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t.height}</Label>
                  <Input
                    type="number"
                    value={selectedItem.height ?? getDefaultHeight(selectedItem.icon, selectedItem.kind)}
                    onChange={(e) => updateItem(selectedItem.id, { height: +e.target.value || 0 })}
                    className="h-8 text-xs mt-0.5"
                    disabled={threeDActive}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t.elevation}</Label>
                  <Input
                    type="number"
                    value={selectedItem.elevation ?? 0}
                    onChange={(e) => updateItem(selectedItem.id, { elevation: +e.target.value || 0 })}
                    className="h-8 text-xs mt-0.5"
                    disabled={threeDActive}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <RotateCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input
                  type="number"
                  value={Math.round(selectedItem.rotation)}
                  onChange={(e) =>
                    updateItem(selectedItem.id, {
                      rotation: (((+e.target.value || 0) % 360) + 360) % 360,
                    })
                  }
                  className="h-8 text-xs flex-1"
                  title={t.rotation}
                  disabled={threeDActive}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs font-medium shrink-0"
                  onClick={() =>
                    updateItem(selectedItem.id, { rotation: (selectedItem.rotation + 90) % 360 })
                  }
                  disabled={threeDActive}
                >
                  +90°
                </Button>
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
                  onClick={duplicateSelected}
                  className="h-8 text-xs"
                  disabled={threeDActive}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> {t.duplicate}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={removeSelected}
                  className="h-8 text-xs"
                  disabled={threeDActive}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {lang === "de" ? "Löschen" : "Delete"}
                </Button>
              </div>
            </div>
          ) : (
            /* Inspector for Room Settings (Nothing selected) */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t.width}</Label>
                  <Input
                    value={draftW}
                    onChange={(e) => setDraftW(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                    disabled={threeDActive}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">{t.length}</Label>
                  <Input
                    value={draftL}
                    onChange={(e) => setDraftL(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                    disabled={threeDActive}
                  />
                </div>
              </div>
              <Button
                onClick={applyRoom}
                size="sm"
                className="w-full h-8 text-xs"
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
