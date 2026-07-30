import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useRoomPlanner } from "@/hooks/use-room-planner";
import { useTheme } from "@/hooks/use-theme";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { useCustomCatalog } from "@/hooks/use-custom-catalog";
import { useSettings } from "@/hooks/use-settings";
import type { CatalogSaveDraft } from "@/types/planner";
import { SWATCHES } from "@/lib/swatches";
import { extractBundledCustomCatalog, mergeCustomCatalog } from "@/lib/custom-catalog";
import { Header } from "@/components/planner/Header";
import { Sidebar } from "@/components/planner/sidebar";
import { SaveToCatalogDialog } from "@/components/planner/sidebar/SaveToCatalogDialog";
import { SettingsDialog } from "@/components/planner/SettingsDialog";
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

export const Route = createFileRoute("/rooms/$roomId")({
  component: RoomPlannerWrapper,
});

function RoomPlannerWrapper() {
  const { roomId } = Route.useParams();
  const { theme, toggleTheme, isDark } = useTheme();
  const planner = useRoomPlanner(roomId);
  const { t, resetMode, setResetMode, confirmReset } = planner;
  const { collapsed: sidebarCollapsed, toggle: toggleSidebarCollapsed } = useSidebarCollapsed();
  const { settings, update: updateSettings, recordLastActive } = useSettings();
  useEffect(() => {
    recordLastActive({ type: "room", roomId });
  }, [roomId, recordLastActive]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // "My Own Catalog" -- see routes/index.tsx's matching block for why this
  // is owned at the route level rather than by Sidebar or CanvasArea.
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

  // See routes/index.tsx's matching block -- identical reasoning, just
  // against this route's own `planner`/`customCatalog` instances.
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

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-background">
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
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        updateSettings={updateSettings}
        theme={theme}
        toggleTheme={toggleTheme}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebarCollapsed={toggleSidebarCollapsed}
        onTakeTour={() => {
          setSettingsOpen(false);
          planner.setTourStep(0);
          planner.setTourOpen(true);
        }}
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
          sidebarCollapsed
            ? "grid w-full gap-4 px-4 py-4 lg:grid-cols-[64px_minmax(0,1fr)] lg:flex-1 lg:min-h-0"
            : "grid w-full gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:flex-1 lg:min-h-0"
        }
      >
        {/* Left column: Unified Tabbed Sidebar */}
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
          backUrl="/rooms"
          openSaveDialog={openSaveDialog}
        />
      </div>
    </div>
  );
}
