import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import type { SidebarProps, Preset } from "@/types/planner";
import { PRESETS } from "@/lib/planner-presets";
import { CatalogSection } from "./CatalogSection";
import { CustomItemDialog } from "./CustomItemDialog";
import { OpeningsDialog } from "./OpeningsDialog";
import { ElementsListSection } from "./ElementsListSection";

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
  nLayer,
  setNLayer,
  nShape,
  setNShape,
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
  addPreset,
  addCustomBox,
  addOpening,
  removeOpening,
  removeItem,
  threeDActive = false,
  corners,
  setCorners,
  wallColors,
  setWallColors,
  flooring,
  setFlooring,
  selectedOpeningId,
  setSelectedOpeningId,
  openWalls,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"add" | "layers">("add");
  const [customBoxOpen, setCustomBoxOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  // Group presets by layer, then by category within each layer, for the
  // catalog's four-tab (Main / Under / On Top / Wall) layout.
  const categorizedByLayer = useMemo(() => {
    const layers: Record<"under" | "main" | "on-top" | "wall", Record<string, Preset[]>> = {
      main: {},
      under: {},
      "on-top": {},
      wall: {},
    };
    for (const p of PRESETS) {
      const layer = p.layer ?? "main";
      const bucket = layers[layer];
      (bucket[p.category] ||= []).push(p);
    }
    return layers;
  }, []);

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
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1 shrink-0">
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
          {lang === "de" ? "Elemente" : "Elements"}
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
            {/* Add Door/Window -- pinned above the furniture catalog
                instead of buried in a small button below it. This is a
                fundamental room-editing action (most rooms need at least
                one door), not an advanced/rare one like Custom Item below,
                so it gets top billing and its own full-width row. */}
            <div className="px-1">
              <OpeningsDialog
                t={t}
                lang={lang}
                threeDActive={threeDActive}
                open={openingOpen}
                onOpenChange={setOpeningOpen}
                oKind={oKind}
                setOKind={setOKind}
                oWall={oWall}
                setOWall={setOWall}
                oPos={oPos}
                setOPos={setOPos}
                oWidth={oWidth}
                setOWidth={setOWidth}
                addOpening={addOpening}
                cornersCount={corners.length}
                corners={corners}
                openWalls={openWalls}
              />
            </div>

            {/* Catalog Preset Cards */}
            <CatalogSection
              t={t}
              lang={lang}
              threeDActive={threeDActive}
              categorizedByLayer={categorizedByLayer}
              addPreset={addPreset}
            />

            {/* Custom Item -- an advanced, rarely-needed escape hatch for a
                one-off size/shape the catalog doesn't cover, so it lives
                below the catalog instead of competing with Add Door/Window
                for the same prime spot. */}
            <div className="px-1">
              <CustomItemDialog
                t={t}
                lang={lang}
                threeDActive={threeDActive}
                open={customBoxOpen}
                onOpenChange={setCustomBoxOpen}
                nName={nName}
                setNName={setNName}
                nW={nW}
                setNW={setNW}
                nL={nL}
                setNL={setNL}
                nColor={nColor}
                setNColor={setNColor}
                nLayer={nLayer}
                setNLayer={setNLayer}
                nShape={nShape}
                setNShape={setNShape}
                addCustomBox={addCustomBox}
                swatches={SWATCHES}
              />
            </div>
          </>
        ) : (
          /* Placed elements lists */
          <ElementsListSection
            t={t}
            lang={lang}
            threeDActive={threeDActive}
            items={items}
            openings={openings}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            selectedOpeningId={selectedOpeningId}
            setSelectedOpeningId={setSelectedOpeningId}
            removeItem={removeItem}
            removeOpening={removeOpening}
          />
        )}
      </div>
    </aside>
  );
}
