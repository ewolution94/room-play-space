import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useRoomPlanner } from "@/hooks/use-room-planner";
import { useTheme } from "@/hooks/use-theme";
import { useMobileViewOnly } from "@/hooks/use-mobile-view-only";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useCustomCatalog } from "@/hooks/use-custom-catalog";
import type { CatalogSaveDraft } from "@/types/planner";
import { SWATCHES } from "@/lib/swatches";
import { extractBundledCustomCatalog, mergeCustomCatalog } from "@/lib/custom-catalog";
import { Header } from "@/components/planner/Header";
import { Sidebar } from "@/components/planner/sidebar";
import { SaveToCatalogDialog } from "@/components/planner/sidebar/SaveToCatalogDialog";
import { CanvasArea } from "@/components/planner/canvas";
import { TourOverlay } from "@/components/planner/TourOverlay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/")({
  component: RoomPlanner,
});

function RoomPlanner() {
  const { theme, toggleTheme, isDark } = useTheme();
  const planner = useRoomPlanner();
  const { t, resetMode, setResetMode, confirmReset } = planner;
  const { isMobileViewOnly } = useMobileViewOnly();
  const { collapsed: sidebarCollapsed, toggle: toggleSidebarCollapsed } = useSidebarCollapsed();

  // "My Own Catalog" -- owned here (not by Sidebar or CanvasArea) because
  // both the Add tab's My Catalog list (inside Sidebar) and the Inspector's
  // "Save to My Catalog" action (inside CanvasArea) need to open the exact
  // same dialog against the exact same saved list, and those two components
  // are siblings, not nested -- see SidebarProps/CanvasAreaProps' own doc
  // comments in types/planner.ts.
  const customCatalog = useCustomCatalog();
  const [saveDraft, setSaveDraft] = useState<CatalogSaveDraft | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const openSaveDialog = (draft: CatalogSaveDraft) => {
    setSaveDraft(draft);
    setSaveDialogOpen(true);
  };
  const handleSaveDialogSave = (values: { name: string; w: number; l: number; color: string }) => {
    if (saveDraft?.editingId) {
      customCatalog.updateItem(saveDraft.editingId, {
        nameEn: values.name,
        nameDe: values.name,
        w: values.w,
        l: values.l,
        color: values.color,
      });
    } else {
      customCatalog.addItem({
        nameEn: values.name,
        nameDe: values.name,
        w: values.w,
        l: values.l,
        color: values.color,
        sourceKey: saveDraft?.sourceKey,
        layer: saveDraft?.layer,
        shape: saveDraft?.shape,
      });
    }
  };

  // Bundles/extracts/merges the current My Catalog list into single-room
  // export/import -- use-room-planner.ts's own buildRoomExportPreview/
  // validateRoomImport/applyRoomImport know nothing about custom catalogs;
  // these wrap them with that behavior (see HeaderProps' own doc comment in
  // types/planner.ts for why the wrapping happens here specifically, not
  // inside the hook itself).
  const buildRoomExportPreviewWithCatalog = (includeCatalog: boolean) => {
    const preview = planner.buildRoomExportPreview();
    if (!includeCatalog || customCatalog.items.length === 0) return preview;
    return {
      ...preview,
      json: { ...(preview.json as Record<string, unknown>), customCatalog: customCatalog.items },
    };
  };

  const validateRoomImportWithCatalog = (raw: unknown, includeCatalog: boolean) => {
    const base = planner.validateRoomImport(raw);
    if (!base.ok || !includeCatalog) return base;
    const bundled = extractBundledCustomCatalog(raw);
    if (bundled.length === 0) return base;
    return {
      ...base,
      summaryLines: [
        ...base.summaryLines,
        planner.lang === "de"
          ? `+ ${bundled.length} Katalog-Element(e)`
          : `+ ${bundled.length} My Catalog item(s)`,
      ],
    };
  };

  const applyRoomImportWithCatalog = (raw: unknown, includeCatalog: boolean) => {
    planner.applyRoomImport(raw);
    if (!includeCatalog) return;
    const bundled = extractBundledCustomCatalog(raw);
    if (bundled.length === 0) return;
    customCatalog.replaceAll(mergeCustomCatalog(customCatalog.items, bundled));
  };

  // h-dvh (not just min-h-screen) so the flex column below has a real
  // bounded height on mobile browsers too -- min-height alone technically
  // still lets flex-1 children grow correctly in principle, but combined
  // with mobile browsers' notoriously unreliable 100vh (address bar
  // show/hide changing the viewport), h-dvh keeps this exact to the
  // visible viewport instead of occasionally over/under-sizing it.
  return (
    <div className="h-dvh lg:h-screen overflow-hidden flex flex-col bg-background">
      <Header
        t={planner.t}
        lang={planner.lang}
        setLang={planner.setLang}
        canUndo={planner.canUndo}
        canRedo={planner.canRedo}
        undo={planner.undo}
        redo={planner.redo}
        items={planner.items}
        openings={planner.openings}
        buildRoomExportPreview={buildRoomExportPreviewWithCatalog}
        validateRoomImport={validateRoomImportWithCatalog}
        applyRoomImport={applyRoomImportWithCatalog}
        customCatalogCount={customCatalog.items.length}
        setResetMode={planner.setResetMode}
        setTourOpen={planner.setTourOpen}
        setTourStep={planner.setTourStep}
        theme={theme}
        toggleTheme={toggleTheme}
        roomsUrl="/rooms"
        viewOnly={isMobileViewOnly}
      />

      <AlertDialog open={resetMode !== null} onOpenChange={(o) => !o && setResetMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resetMode === "all" ? t.resetAll : t.resetItems}</AlertDialogTitle>
            <AlertDialogDescription>
              {resetMode === "all" ? t.confirmResetAll : t.confirmReset}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>{t.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TourOverlay
        t={planner.t}
        tourOpen={planner.tourOpen}
        tourStep={planner.tourStep}
        setTourStep={planner.setTourStep}
        closeTour={planner.closeTour}
        threeDActive={planner.threeDActive}
        setThreeDActive={planner.setThreeDActive}
      />

      <SaveToCatalogDialog
        lang={planner.lang}
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        draft={saveDraft}
        onSave={handleSaveDialogSave}
        swatches={SWATCHES}
      />

      <div
        className={
          isMobileViewOnly
            ? "flex flex-1 min-h-0 w-full flex-col p-2"
            : sidebarCollapsed
              ? "grid w-full gap-4 px-4 py-4 lg:grid-cols-[64px_minmax(0,1fr)] lg:flex-1 lg:min-h-0"
              : "grid w-full gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:flex-1 lg:min-h-0"
        }
      >
        {/* Left column: Unified Tabbed Sidebar -- hidden entirely in mobile
            view-only mode (see useMobileViewOnly): there's no room to add
            items/edit properties on a small screen, so the canvas gets the
            whole viewport instead. */}
        {!isMobileViewOnly && (
          <Sidebar
            t={planner.t}
            lang={planner.lang}
            items={planner.items}
            openings={planner.openings}
            selectedIds={planner.selectedIds}
            setSelectedIds={planner.setSelectedIds}
            nName={planner.nName}
            setNName={planner.setNName}
            nW={planner.nW}
            setNW={planner.setNW}
            nL={planner.nL}
            setNL={planner.setNL}
            nColor={planner.nColor}
            setNColor={planner.setNColor}
            nLayer={planner.nLayer}
            setNLayer={planner.setNLayer}
            nShape={planner.nShape}
            setNShape={planner.setNShape}
            oKind={planner.oKind}
            setOKind={planner.setOKind}
            oWall={planner.oWall}
            setOWall={planner.setOWall}
            oPos={planner.oPos}
            setOPos={planner.setOPos}
            oWidth={planner.oWidth}
            setOWidth={planner.setOWidth}
            roomW={planner.roomW}
            roomL={planner.roomL}
            addPreset={planner.addPreset}
            addCustomBox={planner.addCustomBox}
            addOpening={planner.addOpening}
            removeOpening={planner.removeOpening}
            removeItem={planner.removeItem}
            threeDActive={planner.threeDActive}
            corners={planner.corners}
            selectedOpeningId={planner.selectedOpeningId}
            setSelectedOpeningId={planner.setSelectedOpeningId}
            openWalls={planner.openWalls}
            customCatalog={customCatalog}
            openSaveDialog={openSaveDialog}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebarCollapsed}
          />
        )}

        {/* Right column: Drawing Stage */}
        <CanvasArea
          t={planner.t}
          lang={planner.lang}
          stageRef={planner.stageRef}
          stageReady={planner.stageReady}
          scale={planner.scale}
          offsetX={planner.offsetX}
          offsetY={planner.offsetY}
          roomPxW={planner.roomPxW}
          roomPxL={planner.roomPxL}
          cm={planner.cm}
          roomW={planner.roomW}
          roomL={planner.roomL}
          draftW={planner.draftW}
          setDraftW={planner.setDraftW}
          draftL={planner.draftL}
          setDraftL={planner.setDraftL}
          dirty={planner.dirty}
          applyRoom={planner.applyRoom}
          collisionEnabled={planner.collisionEnabled}
          setCollisionEnabled={planner.setCollisionEnabled}
          rulerMode={planner.rulerMode}
          setRulerMode={planner.setRulerMode}
          openings={planner.openings}
          setOpenings={planner.setOpenings}
          items={planner.items}
          selectedIds={planner.selectedIds}
          setSelectedIds={planner.setSelectedIds}
          rulerStart={planner.rulerStart}
          rulerEnd={planner.rulerEnd}
          rulerHover={planner.rulerHover}
          clearRuler={planner.clearRuler}
          marqueeRect={planner.marqueeRect}
          multiSelectMode={planner.multiSelectMode}
          setMultiSelectMode={planner.setMultiSelectMode}
          ctrlHeld={planner.ctrlHeld}
          isPanning={planner.isPanning}
          onStagePointerDown={planner.onStagePointerDown}
          onStagePointerMove={planner.onStagePointerMove}
          onStagePointerUp={planner.onStagePointerUp}
          onItemPointerDown={planner.onItemPointerDown}
          onRotateHandleDown={planner.onRotateHandleDown}
          pushHistory={planner.pushHistory}
          threeDActive={planner.threeDActive}
          setThreeDActive={planner.setThreeDActive}
          corners={planner.corners}
          setCorners={planner.setCorners}
          wallColors={planner.wallColors}
          setWallColors={planner.setWallColors}
          flooring={planner.flooring}
          setFlooring={planner.setFlooring}
          selectedOpeningId={planner.selectedOpeningId}
          setSelectedOpeningId={planner.setSelectedOpeningId}
          zoomFactor={planner.zoomFactor}
          setZoomFactor={planner.setZoomFactor}
          isDark={isDark}
          updateItem={planner.updateItem}
          removeItem={planner.removeItem}
          duplicateSelected={planner.duplicateSelected}
          removeSelected={planner.removeSelected}
          updateOpening={planner.updateOpening}
          removeOpening={planner.removeOpening}
          openWalls={planner.openWalls}
          openSaveDialog={openSaveDialog}
        />
      </div>
    </div>
  );
}
