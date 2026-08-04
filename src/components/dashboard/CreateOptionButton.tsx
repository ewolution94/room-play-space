import type { LucideIcon } from "lucide-react";

/**
 * One "how do you want to start?" option on the dashboard.
 *
 * Shared by both creation cards because they sit side by side and any
 * difference between them reads as a mistake -- which it was: the
 * single-room card stacked its icon above a bare label (three tall,
 * description-less tiles, one of which wrapped onto three lines), while the
 * Home card used a wide icon-left row with a description. Same action, two
 * shapes, visibly different heights.
 *
 * One row shape for all of them: icon, title, one line of what it does.
 * Every option is now the same size in both cards regardless of how many
 * there are, and the single-room options gained the explanations they never
 * had. The lists stack (rather than sitting in columns) because a
 * description needs the width -- in a half-page card, three columns leave
 * room for about two words.
 */
export function CreateOptionButton({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:border-primary/40"
    >
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

/** The wrapper both cards put their options in, so the two stay in step. */
export const CREATE_OPTION_LIST_CLASS = "grid grid-cols-1 gap-3";
