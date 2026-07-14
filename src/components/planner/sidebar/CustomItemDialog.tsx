import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { Button } from "@/components/ui/button";
import { Sliders, Ruler, Palette, Plus } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CustomItemDialogProps {
  t: any;
  lang: string;
  threeDActive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nName: string;
  setNName: (val: string) => void;
  nW: number;
  setNW: (val: number) => void;
  nL: number;
  setNL: (val: number) => void;
  nColor: string;
  setNColor: (val: string) => void;
  addCustomBox: () => void;
  swatches: Array<{ name: string; value: string }>;
}

export function CustomItemDialog({
  t,
  lang,
  threeDActive,
  open,
  onOpenChange,
  nName,
  setNName,
  nW,
  setNW,
  nL,
  setNL,
  nColor,
  setNColor,
  addCustomBox,
  swatches,
}: CustomItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={threeDActive}
          className="h-9 text-xs font-semibold w-full hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 border-dashed"
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
          {lang === "de" ? "Möbel-Ersteller" : "Custom Item"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Plus className="h-5 w-5 text-primary" />
            {t.customBox}
          </DialogTitle>
          <DialogDescription>
            {lang === "de" ? "Erstellen Sie ein maßgeschneidertes Möbelstück für Ihre Raumplanung." : "Create a customized furniture item for your room layout."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.name}</Label>
            <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
              <span className="pl-2.5 text-muted-foreground/75">
                <Sliders className="h-3.5 w-3.5" />
              </span>
              <Input
                value={nName}
                onChange={(e) => setNName(e.target.value)}
                placeholder={t.namePlaceholder}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 h-8 text-xs w-full bg-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.width}</Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Ruler className="h-3.5 w-3.5" />
                </span>
                <NumberField
                  min={1}
                  value={nW}
                  onCommit={setNW}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                />
                <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.length}</Label>
              <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
                <span className="pl-2.5 text-muted-foreground/75">
                  <Ruler className="h-3.5 w-3.5" />
                </span>
                <NumberField
                  min={1}
                  value={nL}
                  onCommit={setNL}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-1.5 pr-7 h-8 text-xs w-full bg-transparent"
                />
                <span className="absolute right-2 text-[10px] font-medium text-muted-foreground/60 select-none">cm</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.color}</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {swatches.map((sw) => {
                const isSelected = nColor.toLowerCase() === sw.value.toLowerCase();
                return (
                  <button
                    key={sw.value}
                    type="button"
                    onClick={() => setNColor(sw.value)}
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
                  value={nColor}
                  onChange={(e) => setNColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title={t.color}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              addCustomBox();
              onOpenChange(false);
            }}
            className="w-full sm:w-auto h-9 text-xs font-semibold"
          >
            <Plus className="mr-1 h-4 w-4" /> {t.addItem}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
