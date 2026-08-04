import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Layers, BookmarkPlus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { SidebarProps } from "@/types/planner";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { SWATCHES } from "@/lib/swatches";
import { CatalogSection } from "./CatalogSection";
import { CustomItemDialog } from "./CustomItemDialog";
import { OpeningsDialog } from "./OpeningsDialog";
import { ElementsListSection } from "./ElementsListSection";
import { MyCatalogSection } from "./MyCatalogSection";

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
  oLeaves,
  setOLeaves,
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
  selectedOpeningId,
  setSelectedOpeningId,
  openWalls,
  slopeIssues,
  customCatalog,
  openSaveDialog,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"add" | "catalog" | "layers">("add");
  const [customBoxOpen, setCustomBoxOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  if (collapsed) {
    const railTabs: { key: typeof activeTab; icon: typeof Plus; badge: number }[] = [
      { key: "add", icon: Plus, badge: 0 },
      { key: "catalog", icon: BookmarkPlus, badge: customCatalog.items.length },
      { key: "layers", icon: Layers, badge: items.length + openings.length },
    ];
    return (
      <aside className="flex flex-col items-center gap-2 py-1 lg:h-full lg:shrink-0">
        <HoverTooltip content={lang === "de" ? "Seitenleiste einblenden" : "Expand sidebar"}>
          <Button variant="outline" size="sm" onClick={onToggleCollapsed} className="h-9 w-9 p-0">
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </HoverTooltip>
        <div className="flex flex-col gap-1.5 mt-1">
          {railTabs.map(({ key, icon: Icon, badge }) => (
            <HoverTooltip
              key={key}
              content={
                key === "add"
                  ? lang === "de"
                    ? "Hinzufügen"
                    : "Add"
                  : key === "catalog"
                    ? lang === "de"
                      ? "Mein Katalog"
                      : "My Catalog"
                    : lang === "de"
                      ? "Elemente"
                      : "Elements"
              }
            >
              <Button
                variant={activeTab === key ? "default" : "outline"}
                size="sm"
                className="relative h-9 w-9 p-0"
                onClick={() => {
                  setActiveTab(key);
                  onToggleCollapsed();
                }}
              >
                <Icon className="h-4 w-4" />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {badge}
                  </span>
                )}
              </Button>
            </HoverTooltip>
          ))}
        </div>
      </aside>
    );
  }

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
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="grid flex-1 min-w-0 grid-cols-3 gap-1 rounded-lg border bg-muted/50 p-1">
          <Button
            variant={activeTab === "add" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("add")}
            className="h-8 px-1.5"
          >
            <Plus className="mr-1 h-4 w-4 shrink-0" />
            <span className="truncate">{lang === "de" ? "Hinzufügen" : "Add"}</span>
          </Button>
          <Button
            variant={activeTab === "catalog" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("catalog")}
            className="h-8 relative px-1.5"
          >
            <BookmarkPlus className="mr-1 h-4 w-4 shrink-0" />
            <span className="truncate">{lang === "de" ? "Mein Katalog" : "My Catalog"}</span>
            {customCatalog.items.length > 0 && (
              <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {customCatalog.items.length}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === "layers" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("layers")}
            className="h-8 relative px-1.5"
          >
            <Layers className="mr-1 h-4 w-4 shrink-0" />
            <span className="truncate">{lang === "de" ? "Elemente" : "Elements"}</span>
            {(items.length > 0 || openings.length > 0) && (
              <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {items.length + openings.length}
              </span>
            )}
          </Button>
        </div>
        <HoverTooltip content={lang === "de" ? "Seitenleiste einklappen" : "Collapse sidebar"}>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleCollapsed}
            className="h-9 w-9 p-0 shrink-0"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </HoverTooltip>
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
                oLeaves={oLeaves}
                setOLeaves={setOLeaves}
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
            <CatalogSection t={t} lang={lang} threeDActive={threeDActive} addPreset={addPreset} />

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
        ) : activeTab === "catalog" ? (
          <MyCatalogSection
            lang={lang}
            threeDActive={threeDActive}
            addPreset={addPreset}
            customCatalog={customCatalog}
            openSaveDialog={openSaveDialog}
          />
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
            slopeIssues={slopeIssues}
          />
        )}
      </div>
    </aside>
  );
}
