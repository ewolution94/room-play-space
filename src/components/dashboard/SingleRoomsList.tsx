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
import { loadSingleRooms, removeSingleRoom, updateSingleRoom } from "@/lib/single-rooms";
import { SAVED_ROW_CLASS, SavedRowBody, SavedRowRename } from "@/components/dashboard/SavedRow";
import type { Lang, RoomLayout } from "@/types/planner";
import { DoorOpen, Pencil, Trash2 } from "lucide-react";

interface SingleRoomsListProps {
  lang: Lang;
}

/**
 * Every standalone room the user has saved -- the dashboard is the only
 * place they're listed, deliberately: they are not part of any floor plan,
 * so they must never appear in a home's floor switcher (a single room
 * showing up as its own "floor" there is precisely the conflation this
 * whole split undoes). That also makes this the only place they can be
 * deleted -- or renamed -- from, hence the per-row actions.
 *
 * A room inside a home is renamed in the multi-room inspector; a standalone
 * room has no equivalent surface, so without this its name was fixed at
 * whatever it was created as. Same interaction as renaming a Home in the
 * list beside it -- see SavedRowRename.
 */
export function SingleRoomsList({ lang }: SingleRoomsListProps) {
  // Client-only, same SSR-hydration-safe pattern as the app's other
  // localStorage-backed reads -- starts empty (matching what the server
  // rendered) then fills in once mounted.
  const [rooms, setRooms] = useState<RoomLayout[]>([]);
  const [pendingDelete, setPendingDelete] = useState<RoomLayout | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setRooms(loadSingleRooms());
  }, []);

  /**
   * Unlike a Home, a room's name is a plain required string with no
   * position-based default to fall back on, so an empty value is simply
   * not a rename -- the old name stays.
   */
  const commitRename = (roomId: string) => {
    const trimmed = draft.trim();
    if (trimmed) {
      updateSingleRoom(roomId, { name: trimmed });
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, name: trimmed } : r)));
    }
    setRenamingId(null);
  };

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
        {rooms.map((room) => {
          const swatch = (
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-border/60"
              style={{ backgroundColor: room.color }}
            />
          );
          const subtitle = `${Math.round(room.width)}×${Math.round(room.length)} cm · ${room.items.length} ${
            lang === "de" ? "Objekte" : "items"
          }`;
          return (
            <li key={room.id} className="flex items-center gap-2">
              {renamingId === room.id ? (
                <SavedRowRename
                  leading={swatch}
                  subtitle={subtitle}
                  label={lang === "de" ? "Raum umbenennen" : "Rename room"}
                  value={draft}
                  onChange={setDraft}
                  onCommit={() => commitRename(room.id)}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
                <Link
                  to="/room/$roomId"
                  params={{ roomId: room.id }}
                  className={`min-w-0 flex-1 ${SAVED_ROW_CLASS}`}
                >
                  <SavedRowBody leading={swatch} title={room.name} subtitle={subtitle} />
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(room.name);
                  setRenamingId(room.id);
                }}
                aria-label={lang === "de" ? "Raum umbenennen" : "Rename room"}
                className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </Button>
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
          );
        })}
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
