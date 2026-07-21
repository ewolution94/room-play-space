# Ewolution Room Play Space - TODO

## Header & Navigation
- [x] Rework header for mobile (currently not ideal)
  - [x] Shorten the undo/redo buttons to icons only (e.g., `Undo` -> ↩️/⬅️, `Redo` -> ↪️/➡️)
  - [x] Optimize spacing and layout for smaller screens

## Inspector & UI
- [x] Rework the inspector window/area
  - [x] Improve usability and intuitiveness
  - [x] Streamline inspector controls, placement, and visual hierarchy

## Other
- [x] Pan camera in 3D view with arrow keys; add key shortcut to reset view
- [x] Multi room support
- [x] Colored walls and windows
- [x] Make mesh below room slightly bigger for aesthetics
- [x] Add smaller objects that belong into a room like an office, e.g. a monitor, pc, etc.

## Future Feature Ideas (Proposed)
- [x] **Interactive 3D Preview Mode**
  - [x] Implement a 3D view toggle (e.g., via React Three Fiber or CSS 3D) to view the room in 3D
  - [x] Render room boundaries, openings, and furniture presets as 3D block volumes
- [ ] **Smart Snapping & Collision System** *(see AUDIT.md section 6 "Medium" for detail)*
  - [ ] Implement magnetic snapping to grid lines, walls, and other placed elements
  - [ ] Add collision detection to highlight overlapping items or blocked doors/windows
- [ ] **Shareable Links & Blueprint Export** *(see AUDIT.md section 6 "Bigger swings" for detail)*
  - [ ] Support generating a PDF blueprint that includes the room canvas drawing and a furniture inventory list
  - [ ] Allow encoding the room configuration in a compressed URL hash for instant sharing
- [x] Add support for angled walls
  - [x] In the canvas, users should be able to drag a corner further in/out easily to account for more special room layouts

## Known Disabled Features (kept in code, not exposed in UI)
- **Corner Dragging** (single-room 2D canvas): the "Enable Corner Dragging" checkbox has been removed from the 2D View Options panel because it caused confusion and could break the app in some ways. The underlying implementation is still in `src/components/planner/canvas/CanvasArea.tsx` (`enableCornerDrag` state, `onCornerPointerDown`, the draggable corner-handle rendering, and `clampOpeningsToWalls`) -- it's just permanently off (`const [enableCornerDrag] = useState(false)`), with no UI control to turn it back on. Revisit this once it's more robust, then reintroduce the checkbox.

## From the codebase audit (July 2026) — see AUDIT.md for full reasoning on each

A full pass over the app (bugs, cross-view inconsistencies, UX ideas) was done and most of it fixed the same session — see `AUDIT.md` for the complete write-up, including what's already been resolved. Everything below is what's still open, consolidated here so this file stays the single actionable backlog; AUDIT.md keeps the "why" for each.

**Quick win still open**
- [ ] Surface the "3D model color overridden" reset affordance more — a small note in the catalog itself for kit-model items so people discover tinting works before they've already tinted something. (The one quick win from the audit that didn't get picked up in the follow-up fix session.)

**Medium**
- [ ] A lightweight measurements/shopping-list export — a plain list of every placed item with its dimensions (already computed for the export JSON's summary lines) as a printable/copyable list.
- [ ] Tablet support: the mobile "view-only" cutoff is a flat 1024px window width, which catches real tablets into the stripped-down look-only mode even though touch-drag already works elsewhere. Worth a middle tier (full editing tools, touch-sized hit targets) instead of collapsing straight to view-only.
- [ ] A "compare materials" side-by-side swatch preview for flooring/wall colors, showing the actual room thumbnail per option on hover.

**Bigger swings**
- [ ] Real point-in-polygon furniture clamping for hallway rooms — `clampPos()` currently clamps to the bounding box, not the actual L/T silhouette, so furniture can end up in a "notch" that isn't really floor.
- [ ] A basic "before you buy" cost estimate per catalog item, since presets already carry real-world dimensions.

**Other risks (lower priority, not user-facing bugs)**
- [ ] Unseeded texture noise in the 3D view — `ThreeDView.tsx`'s `createProceduralTexture` uses plain `Math.random()` with no caching for furniture materials, unlike the seeded/stable flooring patterns, so wood grain re-randomizes on every scene rebuild.
- [ ] `readableText()` (black/white swatch label text) only handles 6-digit hex; 3/4/8-digit hex colors (which the import schema explicitly allows) silently fall back to black regardless of actual brightness.
- [ ] History snapshots (both single-room and the newly-added multi-room undo) are full deep clones on every push — fine at normal scale, but worth revisiting if a very large hand-built layout makes dragging noticeably slower.
- [ ] A handful of `catch {}` blocks around `releasePointerCapture` calls swallow errors silently with no explanatory comment.

**Test coverage still open**
- [ ] `floor-pattern-svg.tsx`/`floor-textures.ts` (the actual 2D/3D renderers) have no tests, only the shared geometry they consume (`floor-pattern-geometry.ts`) does.
- [ ] No component or hook tests at all — `use-room-planner.ts` and every React component are only ever exercised by hand.

**Accessibility (not addressed yet)**
- [ ] `aria-label` on icon-only buttons app-wide (only ~4 of 25 planner components have any today).
- [ ] `aria-pressed`/`aria-checked` on toggle buttons that currently only communicate state via color.
- [ ] A keyboard-only path to reposition the floating Inspector panels (currently pointer-drag only).

