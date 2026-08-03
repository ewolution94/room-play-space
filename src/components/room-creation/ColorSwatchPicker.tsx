import { Label } from "@/components/ui/label";
import { ROOM_SWATCHES } from "@/lib/swatches";
import type { Lang } from "@/types/planner";

interface ColorSwatchPickerProps {
  lang: Lang;
  value: string;
  onChange: (color: string) => void;
  /** Tighter spacing for the /rooms sidebar's 320px column. */
  compact?: boolean;
}

/**
 * The room-color picker shared by every room-creation flow --
 * CreateSingleRoomFlow's form, IkeaRoomWizard's final step, and the /rooms
 * sidebar's own add-room form -- which between them carried three copies of
 * this markup and two different palettes.
 *
 * It renders ROOM_SWATCHES, not the furniture SWATCHES: a room's color is a
 * floor-plan identifier, not a material. The sidebar Inspector's own swatch
 * grids are deliberately NOT folded in here -- those render furniture swatch
 * sets with their own selected-state affordances.
 */
export function ColorSwatchPicker({ lang, value, onChange, compact }: ColorSwatchPickerProps) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <Label className={compact ? "text-xs" : undefined}>{lang === "de" ? "Farbe" : "Color"}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {ROOM_SWATCHES.map((sw) => (
          <button
            key={sw.value}
            type="button"
            onClick={() => onChange(sw.value)}
            aria-label={sw.name}
            className={`rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 ${
              compact ? "h-5 w-5" : "h-6 w-6"
            } ${
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
