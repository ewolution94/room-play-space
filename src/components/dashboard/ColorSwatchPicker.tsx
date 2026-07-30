import { Label } from "@/components/ui/label";
import { SWATCHES } from "@/lib/swatches";
import type { Lang } from "@/types/planner";

interface ColorSwatchPickerProps {
  lang: Lang;
  value: string;
  onChange: (color: string) => void;
}

/**
 * The room-color picker shared by both dashboard creation flows
 * (CreateSingleRoomFlow's form and IkeaRoomWizard's final step), which
 * carried character-identical copies of this markup. The sidebar
 * Inspector's own swatch grids are deliberately NOT folded in here -- those
 * render different swatch sets with their own selected-state affordances.
 */
export function ColorSwatchPicker({ lang, value, onChange }: ColorSwatchPickerProps) {
  return (
    <div className="space-y-1.5">
      <Label>{lang === "de" ? "Farbe" : "Color"}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((sw) => (
          <button
            key={sw.value}
            type="button"
            onClick={() => onChange(sw.value)}
            className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 ${
              value.toLowerCase() === sw.value.toLowerCase()
                ? "ring-2 ring-primary ring-offset-1 border-transparent scale-110"
                : "border-border/60"
            }`}
            style={{ backgroundColor: sw.value }}
          />
        ))}
      </div>
    </div>
  );
}
