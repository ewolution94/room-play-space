/**
 * "Reset everything" -- wipe this app's entire saved state and start over.
 *
 * Every key this app writes is `planner-`-prefixed (single rooms, homes,
 * floors, both legacy generations, the custom catalog, settings, theme,
 * language, the tour flag, sidebar and inspector UI state). So the reset is
 * a prefix sweep rather than a hand-maintained list of keys -- a list would
 * silently go stale the first time someone adds a new key and forgets to
 * add it here, which is exactly the kind of thing nobody notices until a
 * "clean slate" turns out not to be clean.
 *
 * Two things it deliberately does NOT do:
 *
 * - **It never calls `localStorage.clear()`.** That would also destroy
 *   anything else served from the same origin, which on a dev machine is
 *   every other app on localhost.
 * - **It is never called automatically.** Nothing in this codebase deletes a
 *   user's saved rooms on their behalf -- not on upgrade, not on migration,
 *   not on a parse failure. This runs only when someone explicitly confirms
 *   it in Settings. (Contrast lib/homes.ts's migration, which writes the new
 *   key and leaves the old ones alone precisely so a rollback can't lose
 *   data.)
 */

export const APP_STORAGE_PREFIX = "planner-";

/**
 * Every `planner-`-prefixed key currently in localStorage.
 *
 * Collected first, then deleted in a second pass: mutating the store while
 * iterating it by index makes the indices shift under you and silently skips
 * every other key.
 */
export function collectAppStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(APP_STORAGE_PREFIX)) keys.push(key);
  }
  return keys;
}

/**
 * Removes all of it. Returns how many keys went, which the caller can
 * report -- "reset 7 items" is a much better confirmation than silence.
 */
export function resetAppStorage(storage: Storage): number {
  const keys = collectAppStorageKeys(storage);
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}

/**
 * The real entry point. Wipes storage and then does a **full page load**
 * rather than a client-side navigation.
 *
 * That's not laziness -- a lot of state is seeded from localStorage exactly
 * once (see the hydration-gate note in docs/LEARNINGS.md): the theme, the
 * language, `useSettings`, the custom catalog, the inspector's open groups.
 * A soft navigation would leave every one of those still holding the values
 * of the profile that was just deleted, so the app would look reset in some
 * places and not others until the next manual refresh.
 */
export function resetApp(): number {
  if (typeof window === "undefined") return 0;
  const removed = resetAppStorage(window.localStorage);
  window.location.href = "/";
  return removed;
}
