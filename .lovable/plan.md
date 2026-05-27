# Better door & window visuals

All changes are visual additions to `src/routes/index.tsx`. No new dependencies.

## 1. Extend the `Opening` type

Add two optional fields so the existing JSON import keeps working:

- `hinge?: "start" | "end"` — which end of the opening the door is hinged on along its wall. Default `"start"`.
- `swing?: "in" | "out"` — whether the door swings into the room or out of it. Default `"in"`.

Default both fields when missing in the importer and in the initial demo state.

## 2. New canvas rendering for openings

Replace the current single `<div>` (the blank strip) with an SVG overlay per opening, sized to the opening's bounding box and rotated to match its wall. The SVG is positioned the same way as today (along the wall, half-overlapping the wall line), but rendered with `overflow: visible` so the door arc can extend into the room.

### Door — "hinged panel with knob" (top-down)

Drawn inside an SVG whose width = opening width (in px) and whose height = ~ opening width (so the arc has room). Coordinates expressed for a "bottom wall, hinge on left, swings into room" canonical case, then mirrored via SVG transforms for other walls / hinge / swing combos.

Elements:

1. **Wall gap**: a background-colored rectangle that hides the wall stroke across the opening (so the doorway reads as an actual cut in the wall).
2. **Jambs**: two short ticks (3–4 px) at each end of the opening, in `foreground/70`.
3. **Door panel**: a 3-px-thick rounded rectangle of length = opening width, rotated 15° from the wall around the hinge point. Fill: a warm wood tone (`#8a5a2b` for doors, semantically themed via CSS var so it works in dark mode). Slight drop shadow via SVG `filter`.
4. **Knob**: a 2-px circle near the free end of the panel.
5. **Swing arc**: a quarter-circle `path` (radius = opening width) from the unhinged jamb sweeping to the tip of the panel, stroked 1 px `foreground/40`, dashed.

### Window — "double-pane glazing" (top-down)

SVG with width = opening width, height = wall thickness + small frame margin.

1. **Frame**: outer rectangle stroked 1.5 px `#3b82f6` (matches current accent), filled with the room background.
2. **Two parallel glazing lines**: two thin horizontal lines running the full opening width, evenly spaced (the classic plan-drawing convention for glass), stroked `#3b82f6`.
3. **Mullion ticks**: optional 2 px ticks at each jamb, same blue.

## 3. Orientation handling

A small helper `wallTransform(o)` returns the SVG container's `left`/`top`/`width`/`height`/`transform` so the same SVG drawing code works on all four walls:

- top wall → SVG sits above the wall line, rotated 180° so the door swings down into the room.
- bottom wall → canonical orientation.
- left wall → rotated 90° CW.
- right wall → rotated 90° CCW.

`hinge: "end"` flips horizontally (scaleX(-1)); `swing: "out"` flips vertically (scaleY(-1)). This keeps one SVG template and four lines of transform logic.

## 4. Per-opening swing/hinge toggle in the sidebar

In the openings list (currently shows `door · top · 50cm · 160cm` + trash button), add two compact icon buttons for door rows (no toggles on windows):

- **Hinge toggle**: small button labeled `⇋` (title: "Flip hinge"). Cycles `hinge` between `start` and `end`.
- **Swing toggle**: small button labeled `⇵` (title: "Flip swing in/out"). Cycles `swing` between `in` and `out`.

Both call `pushHistory()` then `setOpenings(...)`. Add English/German strings (`flipHinge`, `flipSwing`).

## 5. Keep drag-along-wall behavior

The existing pointerdown drag handler on the opening element keeps working — it now lives on the SVG container `<g>` (or the outer `<svg>` element). Cursor stays `ew-resize` / `ns-resize` based on wall. Bounds clamping unchanged.

## 6. Migration & defaults

- Initial demo openings: add `hinge: "start"`, `swing: "in"` for the door; window unchanged.
- `importJSON`: when an opening is missing `hinge`/`swing`, default to `"start"`/`"in"`.

## Out of scope

- No new icons added to `lucide-react` beyond what's already imported (we'll reuse existing icons or use simple unicode glyphs for the toggle buttons).
- No changes to collision logic, no changes to items rendering, no changes to the catalog.
