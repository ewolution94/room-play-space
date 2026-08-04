import { useRef, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * The one row shape the dashboard uses for anything you can open -- the
 * resume card, saved single rooms, saved homes. Kept as loose parts
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

/**
 * The same row, with its title swapped for an input -- what a dashboard row
 * renders while it's being renamed.
 *
 * Shared by both saved lists on purpose: a Home and a standalone room are
 * different documents in different stores, but "rename the thing in this
 * row" is one interaction, and the two lists sit side by side where any
 * difference in behaviour would be obvious. It keeps the same
 * commit-on-Enter-or-blur, revert-on-Escape convention the floor switcher's
 * rename already uses, so renaming feels identical everywhere in the app.
 *
 * The subtitle stays visible while editing so the row doesn't change shape
 * (and the list below it doesn't jump) the moment you click the pencil.
 */
export function SavedRowRename({
  leading,
  subtitle,
  label,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  leading: ReactNode;
  subtitle: ReactNode;
  /** Accessible name for the input -- these rows have no visible label. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  // Escape unmounts this input (the caller drops out of rename mode), and
  // an unmounting focused input still fires blur -- which would commit the
  // very edit Escape just discarded. This flag makes that one blur a no-op.
  const cancelledRef = useRef(false);

  return (
    <div className={`min-w-0 flex-1 ${SAVED_ROW_CLASS}`}>
      {leading}
      <div className="min-w-0 flex-1">
        <input
          autoFocus
          aria-label={label}
          value={value}
          // Whole name selected on focus, the way every rename field
          // behaves: renaming usually means replacing, and it also makes
          // "clear the field" (which resets a Home to its default name) one
          // keystroke instead of holding backspace.
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (cancelledRef.current) {
              cancelledRef.current = false;
              return;
            }
            onCommit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onCommit();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              cancelledRef.current = true;
              onCancel();
            }
          }}
          // h-5 + leading-5 exactly matches SavedRowBody's title line, so
          // the row keeps its height and the list below it doesn't jump the
          // moment you click the pencil.
          className="block h-5 w-full min-w-0 rounded-sm border border-input bg-background px-1 text-sm font-medium leading-5 outline-none focus:border-primary"
        />
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  );
}
