import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
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
import {
  loadFloors,
  saveFloors,
  saveActiveFloorId,
  loadActiveFloorId,
  floorDisplayName,
} from "@/lib/floors";
import { SAVED_ROW_CLASS, SavedRowBody } from "@/components/dashboard/SavedRow";
import type { Floor, Lang } from "@/types/planner";
import { LayoutGrid, Trash2 } from "lucide-react";

interface FloorPlansListProps {
  lang: Lang;
}

/**
 * Every saved floor plan, listed and deletable straight from the dashboard
 * -- the multi-room counterpart to SingleRoomsList, so both halves of the
 * app are managed the same way from the same place.
 *
 * One thing differs from the single-room list, forced by the fact that a
 * floor is part of a building rather than a free-standing thing: opening
 * one has to set the active floor first, since /rooms shows whichever floor
 * is active rather than taking one in the URL.
 *
 * Deleting every floor is allowed, exactly like deleting every single room.
 * That's only safe because /rooms no longer re-seeds the example apartment
 * on an empty store (it seeds a blank floor instead) -- the example is one
 * click away via the dashboard's "From example" whenever it's wanted, so
 * nothing is ever really lost. The floor switcher inside /rooms keeps its
 * own can't-delete-the-last-one rule, since deleting the floor you're
 * currently standing on has nowhere to land.
 */
export function FloorPlansList({ lang }: FloorPlansListProps) {
  // Client-only, same SSR-hydration-safe pattern as the app's other
  // localStorage-backed reads -- starts empty (matching what the server
  // rendered) then fills in once mounted.
  const [floors, setFloors] = useState<Floor[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Floor | null>(null);

  useEffect(() => {
    setFloors(loadFloors() ?? []);
  }, []);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const next = floors.filter((f) => f.id !== pendingDelete.id);
    saveFloors(next);
    // Re-point the active floor if it was the one just deleted --
    // loadActiveFloorId falls back to the first floor when the saved id no
    // longer exists, so this just persists that resolved choice.
    saveActiveFloorId(loadActiveFloorId(next));
    setFloors(next);
    setPendingDelete(null);
  };

  if (floors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {lang === "de"
          ? "Noch keine Etage -- erstelle oben deine erste."
          : "No floors yet -- create your first one above."}
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {floors.map((floor, index) => {
          const roomCount = floor.rooms.length;
          const itemCount = floor.rooms.reduce((n, r) => n + r.items.length, 0);
          return (
            <li key={floor.id} className="flex items-center gap-2">
              <Link
                to="/rooms"
                // /rooms renders the active floor, so pick it before going
                // there -- otherwise clicking any row lands on whichever
                // floor happened to be active already.
                onClick={() => saveActiveFloorId(floor.id)}
                className={`min-w-0 flex-1 ${SAVED_ROW_CLASS}`}
              >
                <SavedRowBody
                  leading={<LayoutGrid className="h-5 w-5 shrink-0 text-muted-foreground" />}
                  title={floorDisplayName(floor, index, lang)}
                  subtitle={
                    lang === "de"
                      ? `${roomCount} Raum/Räume · ${itemCount} Objekte`
                      : `${roomCount} room${roomCount === 1 ? "" : "s"} · ${itemCount} item${itemCount === 1 ? "" : "s"}`
                  }
                />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingDelete(floor)}
                aria-label={lang === "de" ? "Etage löschen" : "Delete floor"}
                className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              {lang === "de" ? "Etage löschen" : "Delete floor"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const idx = pendingDelete ? floors.indexOf(pendingDelete) : -1;
                const name = pendingDelete ? floorDisplayName(pendingDelete, idx, lang) : "";
                const n = pendingDelete?.rooms.length ?? 0;
                return lang === "de"
                  ? `"${name}" und alle ${n} Räume darin werden dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.`
                  : `"${name}" and all ${n} room${n === 1 ? "" : "s"} on it will be permanently deleted. This cannot be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "de" ? "Abbrechen" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {lang === "de" ? "Löschen" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
