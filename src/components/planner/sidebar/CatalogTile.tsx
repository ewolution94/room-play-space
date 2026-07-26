import React from "react";
import type { LucideIcon } from "lucide-react";

interface CatalogTileProps {
  icon: LucideIcon;
  label: string;
  title: string;
  hasModel: boolean;
  disabled: boolean;
  onAdd: () => void;
}

/**
 * One square grid tile for "click to add this catalog item to the room" --
 * used by CatalogSection.tsx's main catalog grid, which renders both the
 * built-in presets AND the IKEA catalog (folded in as its own "IKEA"
 * section, see buildCatalogByLayer in lib/custom-catalog.ts) through this
 * exact same tile, so they're visually and behaviorally indistinguishable.
 *
 * Saving a customized item to "My Catalog" is deliberately NOT an action
 * here -- it lives only on the Inspector's selected-item panel
 * (InspectorSection.tsx's "Save to My Catalog"), so a user customizes an
 * already-placed item (color/dimensions) before saving it, rather than
 * every tile in this dense grid carrying its own extra button.
 */
export function CatalogTile({
  icon: Icon,
  label,
  title,
  hasModel,
  disabled,
  onAdd,
}: CatalogTileProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      className="group relative flex aspect-square w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border border-border/40 bg-background/50 p-1 text-center transition-all duration-200 hover:border-primary hover:bg-accent/50 disabled:opacity-50 disabled:pointer-events-none"
      title={title}
    >
      {hasModel && (
        // A small folded-corner "ribbon" flagging a real 3D model --
        // purely decorative (pointer-events-none), see CatalogSection.tsx's
        // original version of this tile for the same treatment.
        <span
          className="pointer-events-none absolute -right-2.5 -top-2.5 h-5 w-5 rotate-45 bg-primary/70 shadow-sm"
          aria-hidden="true"
        />
      )}
      <Icon
        className="h-4.5 w-4.5 text-foreground/85 transition group-hover:scale-105"
        strokeWidth={1.5}
      />
      <span className="line-clamp-1 text-[8.5px] font-medium leading-tight text-muted-foreground/90">
        {label}
      </span>
    </button>
  );
}
