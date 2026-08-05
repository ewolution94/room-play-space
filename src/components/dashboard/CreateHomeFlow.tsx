import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { generateDefaultApartmentLayout } from "@/lib/default-apartment";
import { createFloor, floorDisplayName } from "@/lib/floors";
import {
  addHome,
  createHome,
  parseImportedHome,
  saveActiveHomeId,
  withFreshIds,
} from "@/lib/homes";
import { extractBundledCustomCatalog, mergeCustomCatalog } from "@/lib/custom-catalog";
import { useCustomCatalog } from "@/hooks/use-custom-catalog";
import { ExportImportDialog } from "@/components/planner/ExportImportDialog";
import { TOUR_KEY } from "@/hooks/use-room-planner";
import {
  CREATE_OPTION_LIST_CLASS,
  CreateOptionButton,
} from "@/components/dashboard/CreateOptionButton";
import type { Home, Lang } from "@/types/planner";
import { FilePlus2, Sparkles, Upload } from "lucide-react";

interface CreateHomeFlowProps {
  lang: Lang;
}

/**
 * The three "create a Home" actions. Neither needs a form -- "from scratch"
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
  const [importOpen, setImportOpen] = useState(false);
  // Only here to receive a catalog bundled into an imported file -- the
  // dashboard has no catalog UI of its own.
  const customCatalog = useCustomCatalog();

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

  /** Preview only -- must not touch any state (see ExportImportDialog). */
  const validateImport = (_scopeId: string, raw: unknown, includeCatalog: boolean) => {
    const home = parseImportedHome(raw);
    if (!home) {
      return {
        ok: false as const,
        error:
          lang === "de"
            ? "Ungültiges Format -- diese Datei sieht nicht wie ein exportiertes Zuhause oder Geschoss aus."
            : "Invalid format -- this file doesn't look like an exported home or floor plan.",
      };
    }
    const rooms = home.floors.reduce((n, f) => n + f.rooms.length, 0);
    const items = home.floors.reduce(
      (n, f) => n + f.rooms.reduce((m, r) => m + r.items.length, 0),
      0,
    );
    const bundled = includeCatalog ? extractBundledCustomCatalog(raw) : [];
    return {
      ok: true as const,
      summaryLines: [
        home.name ??
          (lang === "de" ? "Ohne Namen (Standard wird vergeben)" : "Un-named (gets the default)"),
        lang === "de" ? `${home.floors.length} Geschosse` : `${home.floors.length} floors`,
        lang === "de" ? `${rooms} Räume` : `${rooms} rooms`,
        lang === "de" ? `${items} Objekte` : `${items} items`,
        ...home.floors.map((f, i) => `· ${floorDisplayName(f, i, lang)} (${f.rooms.length})`),
        ...(bundled.length > 0
          ? [
              lang === "de"
                ? `+ ${bundled.length} Katalog-Element(e)`
                : `+ ${bundled.length} My Catalog item(s)`,
            ]
          : []),
      ],
    };
  };

  const applyImport = (_scopeId: string, raw: unknown, includeCatalog: boolean) => {
    const home = parseImportedHome(raw);
    if (!home) {
      toast.error(lang === "de" ? "Fehler beim Importieren" : "Failed to import file");
      return;
    }
    if (includeCatalog) {
      const bundled = extractBundledCustomCatalog(raw);
      if (bundled.length > 0) {
        customCatalog.replaceAll(mergeCustomCatalog(customCatalog.items, bundled));
      }
    }
    // Fresh floor/room ids: this becomes a NEW home, and importing the same
    // file twice must not leave two homes sharing room ids (see
    // withFreshIds).
    open(createHome(withFreshIds(home.floors), home.name));
    toast.success(lang === "de" ? "Zuhause importiert" : "Home imported");
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
      <CreateOptionButton
        icon={Upload}
        title={lang === "de" ? "Aus Datei" : "From a file"}
        description={lang === "de" ? "Exportiertes Zuhause importieren" : "Import an exported home"}
        onClick={() => setImportOpen(true)}
      />

      <ExportImportDialog
        lang={lang}
        mode="import"
        open={importOpen}
        onOpenChange={setImportOpen}
        title={lang === "de" ? "Zuhause importieren" : "Import a home"}
        description={
          lang === "de"
            ? "Erstellt ein neues Zuhause aus einer exportierten JSON-Datei. Vorhandene Zuhause bleiben unverändert."
            : "Creates a new home from an exported JSON file. Your existing homes are left untouched."
        }
        scopes={[{ id: "new-home", label: lang === "de" ? "Neues Zuhause" : "New home" }]}
        validateImport={validateImport}
        applyImport={applyImport}
        includeOption={{
          label:
            lang === "de" ? "Auch Katalog-Elemente importieren" : "Also import My Catalog items",
          hint:
            lang === "de"
              ? "Falls diese Datei gespeicherte Katalog-Elemente enthält, werden neue zu Meinem Katalog hinzugefügt."
              : "If this file includes saved catalog items, any new ones are added to My Catalog.",
        }}
      />
    </div>
  );
}
