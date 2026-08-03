import React from "react";
import { ChevronDown } from "lucide-react";

interface InspectorGroupProps {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /**
   * A compact read-only reading of this group's current value, shown on the
   * header while it's collapsed -- "400 × 300 cm", the four wall colours as
   * dots, the flooring swatch. This is what makes collapsing-by-default
   * acceptable: you can still see the whole room's setup at a glance and
   * only expand the one thing you came to change.
   */
  summary?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * One collapsible block inside the floating Inspector.
 *
 * The panel had grown to render everything at once -- room size, presets,
 * wall height, sloped ceilings, four wall colours and the flooring grid --
 * which made it tall enough to reach the canvas's bottom-left back button
 * at ordinary viewport heights. Rather than move those controls somewhere
 * else, each is now a group that remembers whether it's open, so the panel's
 * resting height is a few rows instead of the full stack.
 */
export function InspectorGroup({
  title,
  icon,
  open,
  onToggle,
  summary,
  children,
}: InspectorGroupProps) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-accent/40"
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          {!open && summary}
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>
      {open && <div className="border-t border-border/30 p-2">{children}</div>}
    </div>
  );
}
