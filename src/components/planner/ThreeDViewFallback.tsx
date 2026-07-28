/** Suspense fallback for the lazy-loaded ThreeDView (see MultiRoomCanvas.tsx
 * and canvas/CanvasArea.tsx) -- `three` plus its loaders/controls is a large
 * dependency only 3D mode actually needs, so ThreeDView is code-split into
 * its own chunk rather than shipped in every route's initial bundle. This
 * only shows for however long that chunk takes to fetch/parse (typically
 * near-instant on a warm cache), same ring-spinner look as
 * canvas/CanvasLoadingOverlay.tsx for visual consistency. */
export function ThreeDViewFallback() {
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center rounded-lg bg-background/70 backdrop-blur-md">
      <div className="relative h-11 w-11">
        <div className="absolute inset-0 rounded-full border-2 border-border/40" />
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "var(--color-primary, #0d9488)",
            borderRightColor: "var(--color-secondary-foreground, #0284c7)",
            animationDuration: "700ms",
          }}
        />
      </div>
    </div>
  );
}
