import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { generateDefaultApartmentLayout } from "@/lib/default-apartment";
import { createFloor, loadFloors, saveActiveFloorId, saveFloors } from "@/lib/floors";
import { TOUR_KEY } from "@/hooks/use-room-planner";
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
import type { Lang } from "@/types/planner";
import { FilePlus2, Sparkles } from "lucide-react";

interface CreateFloorFlowProps {
  lang: Lang;
}

/**
 * The two "create a floor" actions. Neither needs a form -- "from scratch"
 * is just an empty floor (rooms get added on /rooms, which already has that
 * UI) and "from example" is one deterministic apartment layout -- so they
 * render directly, with only the example path ever showing a dialog (the
 * overwrite confirmation below).
 *
 * The two differ in where the new floor lands, deliberately:
 *
 * - "From scratch" APPENDS. Adding a storey on top of what you already have
 *   is the whole point.
 * - "From example" targets the GROUND FLOOR specifically. The example is one
 *   fixed, fully-furnished ground-floor apartment, so appending it made it
 *   arrive as "1st Floor"/"2nd Floor" -- and clicking it twice left two
 *   identical apartments stacked on different storeys, which is nonsense
 *   for a layout that is by definition the ground level of a building.
 *   Replacing occupied ground-floor rooms is confirmed first, since that's
 *   destructive; an absent or empty ground floor is filled silently.
 */
export function CreateFloorFlow({ lang }: CreateFloorFlowProps) {
  const navigate = useNavigate();
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

  const finish = () => {
    // Same reasoning as the single-room creation flows: a deliberate
    // dashboard creation shouldn't be followed by useRoomPlanner's
    // first-visit tour ambushing the first room the user clicks into on
    // this new floor.
    window.localStorage.setItem(TOUR_KEY, "1");
    navigate({ to: "/rooms" });
  };

  const createEmpty = () => {
    const floors = loadFloors() ?? [];
    const floor = createFloor([]);
    saveFloors([...floors, floor]);
    // Without this, /rooms keeps showing whatever floor was already
    // active and the one just created is invisible until manually
    // selected in the floor switcher -- looks exactly like it never saved.
    saveActiveFloorId(floor.id);
    toast.success(lang === "de" ? "Neue Etage erstellt" : "New floor created");
    finish();
  };

  /**
   * Writes the example apartment into floor index 0, keeping that floor's
   * existing id and name if there already is one -- so an upper storey the
   * user built stays exactly where it is, and nothing that references the
   * ground floor by id (the active-floor pointer, lastActive) is broken by
   * swapping its contents.
   */
  const writeExampleToGroundFloor = () => {
    const floors = loadFloors() ?? [];
    const rooms = generateDefaultApartmentLayout(lang);
    const ground = floors[0] ? { ...floors[0], rooms } : createFloor(rooms);
    saveFloors([ground, ...floors.slice(1)]);
    saveActiveFloorId(ground.id);
    toast.success(lang === "de" ? "Beispiel-Erdgeschoss geladen" : "Example ground floor loaded");
    finish();
  };

  const createFromExample = () => {
    const floors = loadFloors() ?? [];
    if (floors[0] && floors[0].rooms.length > 0) {
      setConfirmReplaceOpen(true);
      return;
    }
    writeExampleToGroundFloor();
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={createEmpty}
          className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:border-primary/40"
        >
          <FilePlus2 className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {lang === "de" ? "Von Grund auf" : "From scratch"}
            </div>
            <div className="text-xs text-muted-foreground">
              {lang === "de"
                ? "Leere Etage, Räume später hinzufügen"
                : "Empty floor, add rooms later"}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={createFromExample}
          className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:border-primary/40"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {lang === "de" ? "Aus Beispiel" : "From example"}
            </div>
            <div className="text-xs text-muted-foreground">
              {lang === "de"
                ? "Voll eingerichtetes Beispiel-Erdgeschoss"
                : "A fully furnished example ground floor"}
            </div>
          </div>
        </button>
      </div>

      <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "de" ? "Erdgeschoss ersetzen?" : "Replace the ground floor?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "de"
                ? "Das Beispiel ist ein Erdgeschoss. Dein aktuelles Erdgeschoss wird durch die Beispiel-Wohnung ersetzt -- höhere Etagen bleiben unverändert. Das lässt sich nicht rückgängig machen."
                : "The example is a ground floor. Your current ground floor will be replaced by the example apartment -- any floors above it are left untouched. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "de" ? "Abbrechen" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={writeExampleToGroundFloor}>
              {lang === "de" ? "Ersetzen" : "Replace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
