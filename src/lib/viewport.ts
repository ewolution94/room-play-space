/**
 * Below this many CSS pixels on its SHORT side, a viewport is a phone and gets the look-only
 * canvas (see hooks/use-mobile-view-only.tsx); anything bigger gets the full editor.
 *
 * Phones top out around 430-500px on their short side, and the smallest tablet (iPad mini) is
 * 744px, so 600 falls cleanly between them. Measured on the short side rather than the width,
 * so a phone turned to landscape (844-932px wide) is still a phone, while a tablet in portrait
 * (744-1023px wide) is not. The old rule, a flat 1024px width, put every portrait iPad into
 * look-only mode although touch editing already works.
 */
export const PHONE_SHORT_SIDE = 600;

export function isPhoneViewport(width: number, height: number): boolean {
  return Math.min(width, height) < PHONE_SHORT_SIDE;
}
