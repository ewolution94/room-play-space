import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { generateDefaultApartmentLayout } from "@/lib/default-apartment";
import { createFloor } from "@/lib/floors";
import { addHome, createHome, saveActiveHomeId } from "@/lib/homes";
import { TOUR_KEY } from "@/hooks/use-room-planner";
import {
  CREATE_OPTION_LIST_CLASS,
  CreateOptionButton,
} from "@/components/dashboard/CreateOptionButton";
import type { Home, Lang } from "@/types/planner";
import { FilePlus2, Sparkles } from "lucide-react";

interface CreateHomeFlowProps {
  lang: Lang;
}

/**
 * The two "create a Home" actions. Neither needs a form -- "from scratch"
 * is a home with one empty ground floor (rooms get added on the home's own
 * route, which already has that UI) and "from example" is one deterministic
 * apartment layout -- so they render directly, with no dialog at all.
 *
 * Both create a **new, independent** home. That's the whole point of the
 * change: this card used to append a *storey to the one implicit building*,
 * so clicking it twice gave you one building with two floors rather than
 * two plans (see docs/HOMES-PROPOSAL.md). It's also what deleted the
 * "Replace the ground floor?" confirmation that used to live here -- the
 * example now lands in a brand-new home's ground floor, so there is
 * nothing to overwrite and nothing to confirm.
 */
export function CreateHomeFlow({ lang }: CreateHomeFlowProps) {
  const navigate = useNavigate();

  const open = (home: Home) => {
    addHome(home);
    saveActiveHomeId(home.id);
    // Same reasoning as the single-room creation flows: a deliberate
    // dashboard creation shouldn't be followed by useRoomPlanner's
    // first-visit tour ambushing the first room the user clicks into.
    window.localStorage.setItem(TOUR_KEY, "1");
    navigate({ to: "/home/$homeId", params: { homeId: home.id } });
  };

  const createEmpty = () => {
    // createHome()'s default is exactly this: one empty ground floor, so a
    // new home opens straight into a usable floor with the add-room
    // sidebar rather than an empty state.
    open(createHome());
    toast.success(lang === "de" ? "Neues Zuhause erstellt" : "New home created");
  };

  const createFromExample = () => {
    open(createHome([createFloor(generateDefaultApartmentLayout(lang))]));
    toast.success(lang === "de" ? "Beispiel-Zuhause geladen" : "Example home loaded");
  };

  return (
    <div className={CREATE_OPTION_LIST_CLASS}>
      <CreateOptionButton
        icon={FilePlus2}
        title={lang === "de" ? "Von Grund auf" : "From scratch"}
        description={
          lang === "de" ? "Leeres Erdgeschoss, Räume später" : "Empty ground floor, rooms later"
        }
        onClick={createEmpty}
      />
      <CreateOptionButton
        icon={Sparkles}
        title={lang === "de" ? "Aus Beispiel" : "From example"}
        description={
          lang === "de"
            ? "Voll eingerichtetes Beispiel-Erdgeschoss"
            : "A fully furnished example ground floor"
        }
        onClick={createFromExample}
      />
    </div>
  );
}
