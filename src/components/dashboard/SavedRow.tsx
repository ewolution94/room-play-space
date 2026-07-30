import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * The one row shape the dashboard uses for anything you can open -- the
 * resume card, saved single rooms, saved floor plans. Kept as loose parts
 * (a class + a body) rather than one wrapper component because each caller
 * needs its own `<Link>`: TanStack types `to` and `params` as a correlated
 * pair, so a generic `to` prop can't be threaded through without fighting
 * the router's types.
 */
export const SAVED_ROW_CLASS =
  "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent hover:border-primary/40";

export function SavedRowBody({
  leading,
  title,
  subtitle,
}: {
  leading: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
}) {
  return (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );
}
