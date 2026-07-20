/**
 * Turns a human-readable label (a room name, a floor's display name, ...)
 * into a filename-safe slug: lowercase, spaces/underscores collapsed to
 * single hyphens, anything that isn't a-z/0-9/hyphen stripped outright (so
 * umlauts, punctuation, emoji, etc. never end up in a downloaded filename).
 * Falls back to "layout" if the label has nothing slug-worthy in it at all
 * (an empty string, or one made entirely of stripped characters).
 */
export function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents (e.g. é -> e)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "layout";
}

/** Today's date as YYYY-MM-DD, used to suffix auto-generated filenames. */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Builds a "fitting" default export filename from a label (room type,
 * floor name, ...) and today's date, e.g. slugify("Home Office") ->
 * "home-office-2026-07-20.json". This is only ever the STARTING point
 * shown in the export dialog's filename field -- the user can freely edit
 * it before downloading (see ExportImportDialog.tsx).
 */
export function buildExportFilename(label: string): string {
  return `${slugify(label)}-${todayStamp()}.json`;
}

/**
 * Sanitizes a user-edited filename right before triggering the download:
 * trims whitespace, strips characters that are invalid (or just awkward)
 * in a filename on common filesystems, and guarantees a ".json" extension
 * -- swapping it in if missing, or if the user typed a different one.
 */
export function sanitizeFilenameForDownload(raw: string): string {
  const trimmed = raw.trim();
  const withoutIllegalChars = trimmed.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-");
  const base = withoutIllegalChars.replace(/\.json$/i, "");
  return `${base || "layout"}.json`;
}
