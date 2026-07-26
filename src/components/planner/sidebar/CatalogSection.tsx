import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Package, Search, Square, X } from "lucide-react";
import type { Preset } from "@/types/planner";
import { PRESET_ICON } from "@/lib/planner-presets";
import { buildCatalogByLayer } from "@/lib/custom-catalog";
import { CatalogTile } from "./CatalogTile";

type CatalogLayer = "main" | "under" | "on-top" | "wall";

// Filters a layer's category->presets map down to entries whose name (in
// the active language) matches the search query, dropping any category
// left with zero matches so CatalogGrid's empty-state only shows when the
// *whole* tab has nothing left, not per-category.
function filterCategorized(
  categorized: Record<string, Preset[]>,
  query: string,
  lang: string,
): Record<string, Preset[]> {
  const q = query.trim().toLowerCase();
  if (!q) return categorized;
  const result: Record<string, Preset[]> = {};
  for (const [cat, list] of Object.entries(categorized)) {
    const matches = list.filter((p) =>
      (lang === "de" ? p.nameDe : p.nameEn).toLowerCase().includes(q),
    );
    if (matches.length) result[cat] = matches;
  }
  return result;
}

interface CatalogSectionProps {
  t: any;
  lang: string;
  threeDActive: boolean;
  addPreset: (preset: Preset) => void;
}

const LAYER_ORDER: CatalogLayer[] = ["main", "under", "on-top", "wall"];

function CatalogGrid({
  t,
  lang,
  threeDActive,
  categorized,
  addPreset,
  isFiltering,
}: {
  t: any;
  lang: string;
  threeDActive: boolean;
  categorized: Record<string, Preset[]>;
  addPreset: (preset: Preset) => void;
  isFiltering?: boolean;
}) {
  const entries = Object.entries(categorized);
  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground text-center py-4">
        {isFiltering
          ? (t.catalogNoMatches ?? "No items match your search.")
          : lang === "de"
            ? "Keine Elemente in dieser Kategorie."
            : "No items in this category."}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {entries.map(([cat, list]) => (
        <div key={cat}>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            {t.categories[cat] ?? cat}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {list.map((p) => {
              const Icon = PRESET_ICON[p.key] ?? Square;
              const has3dModel = Boolean(p.kitModel);
              const label = lang === "de" ? p.nameDe : p.nameEn;
              return (
                <CatalogTile
                  key={p.key}
                  icon={Icon}
                  label={label}
                  title={`${label} (${p.w}×${p.l}cm)${has3dModel ? (lang === "de" ? " — echtes 3D-Modell" : " — real 3D model") : ""}`}
                  hasModel={has3dModel}
                  disabled={threeDActive}
                  onAdd={() => addPreset(p)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CatalogSection({ t, lang, threeDActive, addPreset }: CatalogSectionProps) {
  const [activeLayer, setActiveLayer] = useState<CatalogLayer>("main");
  const [query, setQuery] = useState("");

  // Static -- PRESETS and IKEA_CATALOG never change at runtime, so this only
  // ever needs to run once per mount, not per keystroke/tab-switch.
  const categorizedByLayer = useMemo(() => buildCatalogByLayer(), []);

  const filteredByLayer = useMemo(() => {
    const out = {} as Record<CatalogLayer, Record<string, Preset[]>>;
    for (const layer of LAYER_ORDER) {
      out[layer] = filterCategorized(categorizedByLayer[layer], query, lang);
    }
    return out;
  }, [categorizedByLayer, query, lang]);

  return (
    <Card id="tour-catalog" className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
      <div className="px-4 py-3 font-semibold text-sm border-b border-border/20 flex items-center gap-1.5">
        <Package className="h-4 w-4 text-primary" />
        {t.catalog}
      </div>
      <CardContent className="p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.catalogSearchPlaceholder ?? "Search items…"}
            disabled={threeDActive}
            className="h-8 pl-7 pr-7 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground/70 hover:text-foreground"
              aria-label={lang === "de" ? "Suche löschen" : "Clear search"}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Tabs value={activeLayer} onValueChange={(v) => setActiveLayer(v as CatalogLayer)}>
          <TabsList className="grid w-full grid-cols-4">
            {LAYER_ORDER.map((layer) => (
              <TabsTrigger key={layer} value={layer} className="text-[11px]">
                {t.catalogLayers[layer] ?? layer}
              </TabsTrigger>
            ))}
          </TabsList>
          {LAYER_ORDER.map((layer) => (
            <TabsContent key={layer} value={layer} className="pt-1">
              <CatalogGrid
                t={t}
                lang={lang}
                threeDActive={threeDActive}
                categorized={filteredByLayer[layer]}
                addPreset={addPreset}
                isFiltering={query.trim().length > 0}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
