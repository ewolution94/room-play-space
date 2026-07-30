import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { generateDefaultApartmentLayout } from "@/lib/default-apartment";
import { createFloor, loadFloors, saveActiveFloorId, saveFloors } from "@/lib/floors";
import { TOUR_KEY } from "@/hooks/use-room-planner";
import type { Lang } from "@/types/planner";
import { FilePlus2, Sparkles } from "lucide-react";

interface CreateFloorFlowProps {
  lang: Lang;
}

/**
 * Unlike CreateSingleRoomFlow, neither path here needs any user input --
 * "from scratch" is just an empty floor (rooms get added on /rooms, which
 * already has that UI) and "from example" is one deterministic apartment
 * layout -- so this renders its two actions directly, no dialog/form step.
 */
export function CreateFloorFlow({ lang }: CreateFloorFlowProps) {
  const navigate = useNavigate();

  const finish = () => {
    // Same reasoning as CreateSingleRoomFlow's finish(): a deliberate
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

  const createFromExample = () => {
    const floors = loadFloors() ?? [];
    const rooms = generateDefaultApartmentLayout(lang);
    const floor = createFloor(rooms);
    saveFloors([...floors, floor]);
    saveActiveFloorId(floor.id);
    toast.success(lang === "de" ? "Beispieletage erstellt" : "Example floor created");
    finish();
  };

  return (
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
              ? "Voll eingerichtete Beispiel-Wohnung"
              : "A fully furnished example apartment"}
          </div>
        </div>
      </button>
    </div>
  );
}
