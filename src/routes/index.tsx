import { createFileRoute } from "@tanstack/react-router";
import { useRoomPlanner } from "@/hooks/use-room-planner";
import { useTheme } from "@/hooks/use-theme";
import { useMobileViewOnly } from "@/hooks/use-mobile-view-only";
import { Header } from "@/components/planner/Header";
import { Sidebar } from "@/components/planner/sidebar";
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
        exportJSON={planner.exportJSON}
        fileInputRef={planner.fileInputRef}
        onImportFile={planner.onImportFile}
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

      <div
        className={
          isMobileViewOnly
            ? "flex flex-1 min-h-0 w-full flex-col p-2"
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
            setCorners={planner.setCorners}
            wallColors={planner.wallColors}
            setWallColors={planner.setWallColors}
            selectedOpeningId={planner.selectedOpeningId}
            setSelectedOpeningId={planner.setSelectedOpeningId}
            openWalls={planner.openWalls}
          />
        )}

        {/* Right column: Drawing Stage */}
        <CanvasArea
          t={planner.t}
          stageRef={planner.stageRef}
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
        />
      </div>
    </div>
  );
}
