import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Item, Opening } from "@/types/planner";
import { wallLabel } from "@/lib/hallway-shapes";

interface ElementsListSectionProps {
  t: any;
  lang: string;
  threeDActive: boolean;
  items: Item[];
  openings: Opening[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedOpeningId?: string | null;
  setSelectedOpeningId?: (id: string | null) => void;
  removeItem: (id: string) => void;
  removeOpening: (id: string) => void;
}

export function ElementsListSection({
  t,
  lang,
  threeDActive,
  items,
  openings,
  selectedIds,
  setSelectedIds,
  selectedOpeningId,
  setSelectedOpeningId,
  removeItem,
  removeOpening,
}: ElementsListSectionProps) {
  return (
    <Card className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm flex-1">
      <div className="px-4 py-3 font-semibold text-sm border-b border-border/20">
        {lang === "de" ? "Elemente auf der Arbeitsfläche" : "Active Elements"}
      </div>
      <CardContent className="p-3 space-y-4">
        {/* Furniture List */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            {t.items} ({items.length})
          </h4>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-md">
              {t.noItems}
            </p>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
              {items.map((it) => {
                const isSelected = selectedIds.has(it.id);
                return (
                  <div
                    key={it.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Clear opening selection when furniture is selected
                      setSelectedOpeningId?.(null);
                      if (e.shiftKey) {
                        setSelectedIds((s) => {
                          const n = new Set(s);
                          if (n.has(it.id)) n.delete(it.id);
                          else n.add(it.id);
                          return n;
                        });
                      } else {
                        setSelectedIds(new Set([it.id]));
                      }
                    }}
                    className={`flex items-center justify-between gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "bg-primary/10 border-primary font-medium"
                        : "bg-background/40 hover:bg-accent/40 border-border/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-3.5 w-3.5 rounded border border-foreground/10 shrink-0"
                        style={{ background: it.color }}
                      />
                      <span className="truncate">{it.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {it.width}×{it.length}cm
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={threeDActive}
                        className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(it.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="bg-border/30" />

        {/* Openings List */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            {t.openings} ({openings.length})
          </h4>
          {openings.length === 0 ? (
            <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded-md">
              {t.noOpenings}
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
              {openings.map((o) => {
                const isSelected = selectedOpeningId === o.id;
                return (
                  <div
                    key={o.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Set selected opening and clear furniture selections
                      setSelectedOpeningId?.(o.id);
                      setSelectedIds(new Set());
                    }}
                    className={`flex items-center justify-between gap-1.5 p-1.5 rounded-md border text-xs cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "bg-primary/10 border-primary font-medium"
                        : "bg-background/40 hover:bg-accent/40 border-border/40"
                    }`}
                  >
                    <span className="truncate min-w-0 capitalize">
                      {o.kind === "door" ? t.door : t.window} · {wallLabel(o.wall, t, lang)} ·{" "}
                      {Math.round(o.position)}cm
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{o.width}cm</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={threeDActive}
                        className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeOpening(o.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
