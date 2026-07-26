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
- [ ] **Smart Snapping & Collision System** _(see AUDIT.md section 6 "Medium" for detail)_
  - [ ] Implement magnetic snapping to grid lines, walls, and other placed elements
  - [ ] Add collision detection to highlight overlapping items or blocked doors/windows
- [ ] **Shareable Links & Blueprint Export** _(see AUDIT.md section 6 "Bigger swings" for detail)_
  - [ ] Support generating a PDF blueprint that includes the room canvas drawing and a furniture inventory list
  - [ ] Allow encoding the room configuration in a compressed URL hash for instant sharing
- [x] Add support for angled walls
  - [x] In the canvas, users should be able to drag a corner further in/out easily to account for more special room layouts

## Custom Catalog & IKEA Integration (2026-07-26)

- [x] "My Own Catalog" -- save a color/dimension-customized version of any catalog item for reuse, via a new "My Catalog" tab next to Add/Elements
  - [x] "Save to My Catalog" lives on the Inspector's selected-item panel only (not a button on every catalog tile, per follow-up feedback) -- customize an already-placed item's color/dimensions first, then save it
  - [x] Edit/delete saved items; click to drop one into the room
  - [x] Persisted to localStorage (`planner-custom-catalog-v1`), plus its own dedicated export/import (JSON) so it survives a browser/device switch
  - [x] Also bundleable into the regular room export/import (single room `/` and `/rooms/$roomId`) AND the floor/building export/import (`/rooms`), via an opt-out "Include My Catalog items" checkbox on each of those dialogs -- re-importing the same file (or the same room/floor) twice never creates duplicates, deduped by item id
- [x] Built-in IKEA catalog -- curated real-world dimensions (sourced from IKEA's own product pages) for ~22 common beds/shelving/storage/tables/seating
  - [x] Lives in the regular built-in catalog (the "Add" tab) as its own trailing "IKEA" section, alongside Seating/Bedroom/Tables/etc. -- not a separate tab (moved there per follow-up feedback)
  - [x] One-click add to room at real dimensions; from there, use the same Inspector "Save to My Catalog" action to fork a customized copy
  - [x] Shares the exact same underlying data shape and add-to-room path as My Own Catalog (see `customCatalogItemToPreset` / `buildCatalogByLayer` in `src/lib/custom-catalog.ts`) -- kit-model 3D rendering, collision, material, and catalog search all come along for free
- [x] Bug fix: double-clicking a room in the mobile multi-room overview no longer navigates into the (not-mobile-aware) single-room route and strands the user without a visible canvas -- the double-click is now a no-op in mobile view-only mode, same as room drag/select already was

## Follow-up Polish Batch (2026-07-26, same night)

- [x] 3D view: windows now fade in step with their wall (glass `transmission` scaled alongside `opacity` in `ThreeDView.tsx`'s fade loop -- transmission barely responds to opacity alone)
- [x] Collapsible sidebar (`useSidebarCollapsed`) -- manual toggle to a ~64px icon rail, independent of the existing auto mobile view-only cutoff, on all three routes
- [x] Header actions regrouped on both headers -- Undo/Redo segment, theme toggle, "File" dropdown (Export/Import), "More" dropdown (tour/language + destructive Clear actions); removed the old duplicated desktop-row/mobile-dropdown split
- [x] Custom "premium" tooltip (`components/ui/hover-tooltip.tsx` + restyled `components/ui/tooltip.tsx`, 150ms delay) replacing native `title=` attributes app-wide
- [x] New catalog items: small/large trash bin + recycling box (kitchen), baby gate "Babygitter" (kids, border-only `railGate` procedural family), ball pit "Bällebad" (kids, `ballPit` procedural family) -- a "Wickeltisch" already existed as `changing-table`, no new preset needed there

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
