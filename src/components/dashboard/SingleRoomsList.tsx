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
import { loadSingleRooms, removeSingleRoom } from "@/lib/single-rooms";
import { SAVED_ROW_CLASS, SavedRowBody } from "@/components/dashboard/SavedRow";
import type { Lang, RoomLayout } from "@/types/planner";
import { DoorOpen, Trash2 } from "lucide-react";

interface SingleRoomsListProps {
  lang: Lang;
}

/**
 * Every standalone room the user has saved -- the dashboard is the only
 * place they're listed, deliberately: they are not part of any floor plan,
 * so they must never appear in the /rooms floor switcher (a single room
 * showing up as its own "floor" there is precisely the conflation this
 * whole split undoes). That also makes this the only place they can be
 * deleted from, hence the per-row delete.
 */
export function SingleRoomsList({ lang }: SingleRoomsListProps) {
  // Client-only, same SSR-hydration-safe pattern as the app's other
  // localStorage-backed reads -- starts empty (matching what the server
  // rendered) then fills in once mounted.
  const [rooms, setRooms] = useState<RoomLayout[]>([]);
  const [pendingDelete, setPendingDelete] = useState<RoomLayout | null>(null);

  useEffect(() => {
    setRooms(loadSingleRooms());
  }, []);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    removeSingleRoom(pendingDelete.id);
    // Mirror the removal locally rather than re-reading what we just wrote.
    setRooms((prev) => prev.filter((r) => r.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  if (rooms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {lang === "de"
          ? "Noch keine einzelnen Räume -- erstelle oben deinen ersten."
          : "No single rooms yet -- create your first one above."}
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {rooms.map((room) => (
          <li key={room.id} className="flex items-center gap-2">
            <Link
              to="/room/$roomId"
              params={{ roomId: room.id }}
              className={`min-w-0 flex-1 ${SAVED_ROW_CLASS}`}
            >
              <SavedRowBody
                leading={
                  <span
                    className="h-5 w-5 shrink-0 rounded-full border border-border/60"
                    style={{ backgroundColor: room.color }}
                  />
                }
                title={room.name}
                subtitle={`${Math.round(room.width)}×${Math.round(room.length)} cm · ${room.items.length} ${
                  lang === "de" ? "Objekte" : "items"
                }`}
              />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingDelete(room)}
              aria-label={lang === "de" ? "Raum löschen" : "Delete room"}
              className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              {lang === "de" ? "Raum löschen" : "Delete room"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "de"
                ? `"${pendingDelete?.name}" wird dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.`
                : `"${pendingDelete?.name}" will be permanently deleted. This cannot be undone.`}
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
