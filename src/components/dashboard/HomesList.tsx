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
import { countItems, countRooms, homeDisplayName, loadHomes, removeHome } from "@/lib/homes";
import { SAVED_ROW_CLASS, SavedRowBody } from "@/components/dashboard/SavedRow";
import type { Home, Lang } from "@/types/planner";
import { Home as HomeIcon, Trash2 } from "lucide-react";

interface HomesListProps {
  lang: Lang;
}

/**
 * Every saved Home, listed and deletable straight from the dashboard --
 * the exact counterpart of SingleRoomsList, so both halves of the app are
 * managed the same way from the same place.
 *
 * One row per home, not per floor. That distinction is the whole feature:
 * this list used to show one row per *floor* of the single implicit
 * building, which is what made "create a floor plan" look like it had added
 * a storey to someone else's plan (see docs/HOMES-PROPOSAL.md). Floors are
 * switched and added *inside* a home, in its own floor switcher.
 *
 * Deleting a home takes its floors and every room on them, so the confirm
 * says exactly how much. Deleting all of them is allowed, exactly like
 * deleting every single room: nothing re-seeds behind your back, and the
 * example is one click away via "From example" whenever it's wanted.
 */
export function HomesList({ lang }: HomesListProps) {
  // Client-only, same SSR-hydration-safe pattern as the app's other
  // localStorage-backed reads -- starts empty (matching what the server
  // rendered) then fills in once mounted.
  const [homes, setHomes] = useState<Home[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Home | null>(null);

  useEffect(() => {
    setHomes(loadHomes() ?? []);
  }, []);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    removeHome(pendingDelete.id);
    setHomes((prev) => prev.filter((h) => h.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  if (homes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {lang === "de"
          ? "Noch kein Zuhause -- erstelle oben dein erstes."
          : "No homes yet -- create your first one above."}
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {homes.map((home, index) => {
          const floorCount = home.floors.length;
          const roomCount = countRooms(home);
          const itemCount = countItems(home);
          return (
            <li key={home.id} className="flex items-center gap-2">
              <Link
                to="/home/$homeId"
                params={{ homeId: home.id }}
                className={`min-w-0 flex-1 ${SAVED_ROW_CLASS}`}
              >
                <SavedRowBody
                  leading={<HomeIcon className="h-5 w-5 shrink-0 text-muted-foreground" />}
                  title={homeDisplayName(home, index, lang)}
                  subtitle={
                    lang === "de"
                      ? `${floorCount} Etage(n) · ${roomCount} Raum/Räume · ${itemCount} Objekte`
                      : `${floorCount} floor${floorCount === 1 ? "" : "s"} · ${roomCount} room${roomCount === 1 ? "" : "s"} · ${itemCount} item${itemCount === 1 ? "" : "s"}`
                  }
                />
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingDelete(home)}
                aria-label={lang === "de" ? "Zuhause löschen" : "Delete home"}
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
              <HomeIcon className="h-5 w-5 text-primary" />
              {lang === "de" ? "Zuhause löschen" : "Delete home"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const idx = pendingDelete ? homes.indexOf(pendingDelete) : -1;
                const name = pendingDelete ? homeDisplayName(pendingDelete, idx, lang) : "";
                const f = pendingDelete?.floors.length ?? 0;
                const r = pendingDelete ? countRooms(pendingDelete) : 0;
                return lang === "de"
                  ? `"${name}" wird mit allen ${f} Etage(n) und ${r} Räumen darin dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.`
                  : `"${name}", all ${f} floor${f === 1 ? "" : "s"} and the ${r} room${r === 1 ? "" : "s"} on them will be permanently deleted. This cannot be undone.`;
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
