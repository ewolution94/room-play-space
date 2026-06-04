import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Square } from "lucide-react";
import type { Preset } from "@/types/planner";
import { PRESET_ICON } from "@/lib/planner-presets";

interface CatalogSectionProps {
  t: any;
  lang: string;
  threeDActive: boolean;
  categorized: Record<string, Preset[]>;
  addPreset: (preset: Preset) => void;
}

export function CatalogSection({
  t,
  lang,
  threeDActive,
  categorized,
  addPreset,
}: CatalogSectionProps) {
  return (
    <Card id="tour-catalog" className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
      <div className="px-4 py-3 font-semibold text-sm border-b border-border/20 flex items-center gap-1.5">
        <Package className="h-4 w-4 text-primary" />
        {t.catalog}
      </div>
      <CardContent className="p-3 space-y-3">
        {Object.entries(categorized).map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              {t.categories[cat] ?? cat}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {list.map((p) => {
                const Icon = PRESET_ICON[p.key] ?? Square;
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={threeDActive}
                    onClick={() => addPreset(p)}
                    className="group flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border border-border/40 bg-background/50 p-1 text-center transition-all duration-200 hover:border-primary hover:bg-accent/50 disabled:opacity-50 disabled:pointer-events-none"
                    title={`${lang === "de" ? p.nameDe : p.nameEn} (${p.w}×${p.l}cm)`}
                  >
                    <Icon
                      className="h-4.5 w-4.5 text-foreground/85 transition group-hover:scale-105"
                      strokeWidth={1.5}
                    />
                    <span className="line-clamp-1 text-[8.5px] font-medium leading-tight text-muted-foreground/90">
                      {lang === "de" ? p.nameDe : p.nameEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
