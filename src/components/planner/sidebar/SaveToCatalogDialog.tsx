import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sliders, Ruler, Palette, BookmarkPlus, Save } from "lucide-react";
import type { CatalogSaveDraft } from "@/types/planner";

interface SaveToCatalogDialogProps {
  lang: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CatalogSaveDraft | null;
  onSave: (values: { name: string; w: number; l: number; color: string }) => void;
  swatches: Array<{ name: string; value: string }>;
}

export function SaveToCatalogDialog({
  lang,
  open,
  onOpenChange,
  draft,
  onSave,
  swatches,
}: SaveToCatalogDialogProps) {
  const [name, setName] = useState("");
  const [w, setW] = useState(50);
  const [l, setL] = useState(50);
  const [color, setColor] = useState("#5cbdb9");

  // Re-seed every time the dialog is (re)opened with a new draft -- e.g.
  // clicking "Add to My Catalog" on a different preset while it happens to
  // already be open, or opening it fresh each time (mirrors
  // ExportImportDialog.tsx's own "fresh start on open" effect).
  useEffect(() => {
    if (open && draft) {
      setName(draft.name);
      setW(draft.w);
      setL(draft.l);
      setColor(draft.color);
    }
  }, [open, draft]);

  const isEditing = Boolean(draft?.editingId);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), w, l, color });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            {isEditing ? (
              <Save className="h-5 w-5 text-primary" />
            ) : (
              <BookmarkPlus className="h-5 w-5 text-primary" />
            )}
            {isEditing
              ? lang === "de"
                ? "Katalogeintrag bearbeiten"
                : "Edit Catalog Item"
              : lang === "de"
                ? "Zu meinem Katalog hinzufügen"
                : "Add to My Catalog"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? lang === "de"
                ? "Passe Name, Maße oder Farbe dieses gespeicherten Elements an."
                : "Adjust this saved item's name, dimensions, or color."
              : lang === "de"
                ? "Speichere eine angepasste Version für die zukünftige Verwendung."
                : "Save a customized version for future use."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {lang === "de" ? "Name" : "Name"}
            </Label>
            <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
              <span className="pl-2.5 text-muted-foreground/75">
                <Sliders className="h-3.5 w-3.5" />
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 h-8 text-xs w-full bg-transparent"
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {lang === "de" ? "Breite" : "Width"}
              </Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Ruler className="h-3.5 w-3.5" />
                </span>
                <NumberField
                  min={1}
                  value={w}
                  onCommit={setW}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                />
                <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                  cm
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {lang === "de" ? "Länge" : "Length"}
              </Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Ruler className="h-3.5 w-3.5" />
                </span>
                <NumberField
                  min={1}
                  value={l}
                  onCommit={setL}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                />
                <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">
                  cm
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {lang === "de" ? "Farbe" : "Color"}
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {swatches.map((sw) => {
                const isSelected = color.toLowerCase() === sw.value.toLowerCase();
                return (
                  <button
                    key={sw.value}
                    type="button"
                    onClick={() => setColor(sw.value)}
                    className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 ${
                      isSelected
                        ? "ring-2 ring-primary ring-offset-1 border-transparent scale-110"
                        : "border-border/60"
                    }`}
                    style={{ backgroundColor: sw.value }}
                    title={lang === "de" ? `${sw.name} Farbton` : `${sw.name} finish`}
                  />
                );
              })}
              <div className="relative h-6 w-6 shrink-0 rounded-full border border-border/60 hover:scale-110 transition-all duration-200 overflow-hidden flex items-center justify-center bg-muted/40 cursor-pointer">
                <Palette className="h-3 w-3 text-muted-foreground pointer-events-none" />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title={lang === "de" ? "Farbe" : "Color"}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs"
          >
            {lang === "de" ? "Abbrechen" : "Cancel"}
          </Button>
          <Button type="button" onClick={handleSave} className="h-9 text-xs font-semibold">
            <BookmarkPlus className="mr-1.5 h-4 w-4" />
            {lang === "de" ? "Speichern" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
