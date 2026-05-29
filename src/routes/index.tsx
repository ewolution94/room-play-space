import { createFileRoute } from "@tanstack/react-router";
import { useRoomPlanner } from "@/hooks/use-room-planner";
import { Header } from "@/components/planner/Header";
import { SidebarLeft } from "@/components/planner/SidebarLeft";
import { SidebarRight } from "@/components/planner/SidebarRight";
import { CanvasArea } from "@/components/planner/CanvasArea";
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
  const planner = useRoomPlanner();
  const { t, resetMode, setResetMode, confirmReset } = planner;

  return (
    <div className="min-h-screen bg-background">
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
      />

      <div className="grid w-full gap-4 px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
        {/* Left column: Presets catalog, custom box, openings */}
        <SidebarLeft
          t={planner.t}
          lang={planner.lang}
          addPreset={planner.addPreset}
          nName={planner.nName}
          setNName={planner.setNName}
          nW={planner.nW}
          setNW={planner.setNW}
          nL={planner.nL}
          setNL={planner.setNL}
          nColor={planner.nColor}
          setNColor={planner.setNColor}
          addCustomBox={planner.addCustomBox}
          oKind={planner.oKind}
          setOKind={planner.setOKind}
          oWall={planner.oWall}
          setOWall={planner.setOWall}
          oPos={planner.oPos}
          setOPos={planner.setOPos}
          oWidth={planner.oWidth}
          setOWidth={planner.setOWidth}
          addOpening={planner.addOpening}
          openings={planner.openings}
          updateOpening={planner.updateOpening}
          removeOpening={planner.removeOpening}
        />

        {/* Center column: Drawing Stage */}
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
          onStagePointerDown={planner.onStagePointerDown}
          onStagePointerMove={planner.onStagePointerMove}
          onStagePointerUp={planner.onStagePointerUp}
          onItemPointerDown={planner.onItemPointerDown}
          onRotateHandleDown={planner.onRotateHandleDown}
          pushHistory={planner.pushHistory}
        />

        {/* Right column: Placed items list */}
        <SidebarRight
          t={planner.t}
          items={planner.items}
          selectedIds={planner.selectedIds}
          setSelectedIds={planner.setSelectedIds}
          duplicateSelected={planner.duplicateSelected}
          removeSelected={planner.removeSelected}
          removeItem={planner.removeItem}
          updateItem={planner.updateItem}
        />
      </div>
    </div>
  );
}
