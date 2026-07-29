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
- [x] Inspector: "Place on top of" -- attach any item to ride on any other placed item regardless of layer (`Item.placedOnId`). Position follows the host on drag, elevation auto-derives from the host's current height (`resolveEffectiveElevation`), collision is exempted between a host/child pair specifically. No rotation-following. Detaches (doesn't cascade-delete) if the host is removed.

## Bug Fixes (2026-07-27)

- [x] Duplicate React keys on IKEA catalog tiles -- `CatalogGrid` (`CatalogSection.tsx`) was using the Preset's `key` field (deliberately shared by several `IKEA_CATALOG` entries) as the React list key. Fixed by keying on `${cat}-${i}` instead.
- [x] Custom item colors looked unchanged in 3D (reported: Tower PC) -- not actually a color-propagation bug, the color data was correct (verified against the live Three.js material). The `"metal"` material preset (`getMaterialParams` in `ThreeDView.tsx`) used `metalness: 0.88` with no environment/reflection map anywhere in the scene, and PBR metal surfaces get almost all their visible color from reflected environment light -- at that metalness, ANY base color rendered as near-black. Affects all 36 presets with `material: "metal"` that render via the box/procedural path (kit-model items are untouched -- their metalness comes from the Kenney-authored glb, not this function). Dialed back to `metalness: 0.4, roughness: 0.35`, a "brushed metal" compromise that still reads as metal while keeping custom colors visible. Verified against both the Tower PC (procedural) and the Filing cabinet (also procedural, light color) with no regression.

## IKEA Catalog Expansion (2026-07-27)

- [x] Three new proceduralModel families (`src/lib/procedural-models.ts`), each deriving its shape from the item's own current dimensions rather than a fixed param -- so one generator fits every size in a product line and never falls back to a plain box for being outside a kitModel's stretch envelope:
  - `cubeGridShelf` -- open cube-grid lattice (back panel + horizontal/vertical dividers), grid size derived from w/h against a `cellSize` (~38cm, matching real module sizes). KALLAX/EKET/TROFAST-style.
  - `ladderShelf` -- open bookcase (two side panels, a back panel, evenly spaced shelf boards), shelf count derived from height against `shelfGap` (~34cm). BILLY/IVAR/HEMNES-style.
  - `doorWardrobe` -- tall cabinet on four short legs with vertical door-seam lines and handle accents, door count derived from width against `doorWidth` (~55cm). PAX/BRIMNES-style.
  - `cabinetBox` gained an optional `legs` param (off by default, zero behavior change for existing users) for low sideboard-style cabinets on visible feet.
- [x] Four new dedicated presets in `planner-presets.ts` (`cube-shelf`, `ladder-bookcase`, `door-wardrobe`, `leg-cabinet`) wiring the families above into the regular catalog/IKEA pipeline.
- [x] Existing KALLAX/BILLY/IVAR/PAX/BESTÅ entries repointed from the generic kitModel `bookshelf`/`wardrobe`/`sideboard` presets to these new proceduralModel ones -- fixes the pre-existing "falls back to a plain box" gap for anything outside the kitModel's envelope (e.g. KALLAX 4x4's 147cm width vs. `bookshelf`'s 80cm default).
- [x] 11 new IKEA products added, dimensions sourced from IKEA's own product pages: KALLAX (1x2, 2x2, 4x2), EKET Cabinet (2x2), TROFAST Storage Combination, BILLY Bookcase (Low), HEMNES Bookcase, HEMNES Glass-Door Cabinet, PAX Wardrobe (Wide), BRIMNES Wardrobe, BESTÅ Tall Cabinet. IKEA_CATALOG shelf/storage count: 6 → 17.
- [x] Verified in-browser (KALLAX cube grid, BILLY open shelving, PAX door seams + legs, BESTÅ legs all visually confirmed; PAX cross-checked against the live Three.js scene graph's exact part count) and via the full suite (455/455, tsc clean, lint clean).

## Dev/Build Performance Investigation (2026-07-28)

- [x] **Real bug found and fixed**: `three` (plus `GLTFLoader`/`OrbitControls`) was being statically bundled into the app's core route chunk instead of code-split. Root cause was two-fold: (1) `InspectorSection.tsx` (rendered on nearly every route) imported `getDefaultHeight`/`resolveEffectiveElevation` from `../ThreeDView` instead of their actual home, `@/lib/planner-presets` -- re-fixed to import from the real source, since those two functions never touched `three` at all; (2) `ThreeDView` itself was a static `import` in its two real consumers (`canvas/CanvasArea.tsx`, `MultiRoomCanvas.tsx`) even though it only ever renders once a user clicks "3D Mode" -- converted both to `React.lazy()` + `Suspense` (new shared `ThreeDViewFallback.tsx` for the loading state). Result: the `alert-dialog` chunk that was accidentally carrying all of `three` with it shrank from 2.3MB → 550KB (SSR) / 1.2MB → 281KB (client gzip), and `three` now lives in its own on-demand chunk (~940KB) that most users (who never open 3D mode) never download at all. Verified: tsc/lint/474 tests clean, 3D mode manually re-tested working in both the single-room and whole-apartment views, no console errors.
- [x] `@lovable.dev/vite-tanstack-config`'s forced 1s `server.watch.awaitWriteFinish` debounce -- resolved by removing the wrapper entirely, see the "Lovable Removal" entry below. Re-measured post-fix: HMR now fires in the same second as the save (previously ~1-2s later).
- [x] `ai`/`@ai-sdk/openai-compatible` dead dependencies -- removed as part of the same Lovable-removal pass below (turned out to be more than just dead weight, see that entry).

## Lovable Removal (2026-07-28)

The app started life scaffolded via Lovable; asked to fully remove that dependency (tooling, config, branding) now that it's self-hosted (see `NAS_DEPLOYMENT.md`).

- [x] Replaced `@lovable.dev/vite-tanstack-config` (the wrapped `vite.config.ts`) with a plain, direct config importing every underlying plugin itself (`@tailwindcss/vite`, `vite-tsconfig-paths`, `@tanstack/react-start/plugin/vite`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin` at build time only) -- faithfully reproduces the real (non-sandbox) behavior of the old wrapper (path alias, dedupe list, `VITE_*` env define, host/port defaults, plugin ordering) while dropping the Lovable-platform-only pieces: `componentTagger` (JSX tagging for Lovable's visual editor), the sandbox-only `hmr-gate`/`dev-server-bridge` plugins, sandbox env detection/config validation, and -- deliberately -- the forced 1s watch debounce from the item above.
- [x] Ported the wrapper's two genuinely useful, Lovable-branding-free dev plugins (`devServerFnErrorLogger`, `devSsrErrorLogger` -- surface TanStack server-function/SSR errors that h3 otherwise swallows) into a new local `vite-dev-error-plugins.ts` instead of dropping the functionality.
- [x] Discovered `ai`/`@ai-sdk/openai-compatible` (already-flagged-unused) were pinned in `bun.lock` to install from **Lovable's own private npm registry mirror** (`europe-west1-npm.pkg.dev/lovable-core-prod/...`), not the public registry -- a live infrastructure dependency, not just branding. Removed both from `package.json`; regenerated `package-lock.json` and `bun.lock` clean of any Lovable reference.
- [x] Deleted `.lovable/` (Lovable platform project metadata + a stale, never-implemented feature-planning doc) and the `bunfig.toml` release-age-guard exclusion entry that existed only for the removed wrapper package.
- [x] Removed Lovable branding from `src/routes/__root.tsx`'s `<head>` meta (`author: Lovable`, `twitter:site: @Lovable`, and two `og:image`/`twitter:image` tags pointing at a Lovable-hosted preview screenshot -- dropped rather than replaced with a placeholder).
- [x] Renamed `LOVABLE_NAS_DEPLOYMENT.md` → `NAS_DEPLOYMENT.md`, reworded the "Lovable-exported project" framing to describe this repo's actual current (already-de-Lovable'd) setup, updated its embedded `vite.config.ts` snippet to point at the real file instead of a stale wrapper-based example; updated `README.md`'s link.
- [x] Verified: `grep -ri lovable` across the repo (excluding `node_modules`/`.git`) returns zero hits. tsc/lint/474 tests clean. Dev server confirmed working with the new config (first-request time also dropped ~3.0s → ~1.95s, likely `componentTagger`'s per-file AST transform going away). Production build re-verified to still produce the same Cloudflare Worker bundle shape `entry.js`/`Dockerfile` depend on.

## Catalog Content Expansion (2026-07-28)

Full content-audit pass over the built-in (non-IKEA) catalog, cross-referenced against comparable tools (Planner 5D, RoomSketcher, Sweet Home 3D) to find genuine gaps rather than guessing. 164 → 208 presets (44 new).

- [x] Four brand-new categories, previously absent entirely:
  - **Laundry** -- washing-machine/laundry-basket moved here from Bathroom (now has a real home); added Dryer and Stacked washer/dryer (both real, previously-unused Kenney meshes -- `dryer.glb`/`washerDryerStacked.glb`, copied into `public/models/kenney/`), Folding table, Ironing board (reuses `legFrame`), Drying rack, Utility sink (reuses the kitchen sink mesh), Detergent shelf.
  - **Garage / Utility** -- Workbench, Pegboard, Tool chest, Wire shelving unit, Ladder, Water heater, Storage bin. No matching Kenney mesh exists for any of these (home-furniture-only kit), so all-procedural.
  - **Home Gym** -- Treadmill, Exercise bike, Weight bench, Dumbbell rack, Yoga mat, Squat rack, Pull-up bar, Gym mirror. Same as Garage, all-procedural.
  - **Pets** -- Dog bed (reuses `tubShape`), Cat tree, Litter box (reuses `tubShape`), Pet crate, Pet food/water station. All-procedural except the two `tubShape` reuses.
- [x] Depth additions to four existing thin categories: **Outdoor** (Outdoor sofa via `loungeSofaLong.glb`, Fire pit, Hammock, Outdoor storage box, Garden bench via `bench.glb`), **Living/media** (Gaming chair via `chairModernFrameCushion.glb`, Soundbar, Projector, Projector screen), **Kids** (Crib, Glider chair via the `rocking-chair`'s own mesh, High chair, Kids bookshelf via `cubeGridShelf`), **Seating** (Chaise lounge via `loungerShape`, Bean bag chair, Futon, Sectional sofa via `loungeSofaLong.glb`).
- [x] 4 new real Kenney meshes wired up (previously sitting unused in `resources/kenney_furniture-kit/`): `dryer.glb`, `washerDryerStacked.glb`, `chairModernFrameCushion.glb`, `loungeSofaLong.glb`.
- [x] 19 new procedural generator families in `procedural-models.ts` (`postShelfUnit`, `pegGridPanel`, `ladderShape`, `cylinderTank`, `lidBox`, `treadmillShape`, `exerciseBikeShape`, `dumbbellRackShape`, `squatRackShape`, `wallBarShape`, `catTreeShape`, `crateShape`, `bowlStation`, `firePitShape`, `hammockShape`, `cribShape`, `highChairShape`, `beanBagShape`, `paddedBaseShape`) -- same conventions as the IKEA batch's families (dimension-driven, no rotation support, cylinders always Y-axis). Reused 7 existing families/meshes where a genuinely close match already existed (`legFrame` x2, `cabinetBox` x2, `tubShape` x2, `loungerShape`, `cubeGridShelf`) rather than building near-duplicates.
- [x] New `laundry`/`garage`/`gym`/`pets` category translations (en+de) in `planner-translations.ts`.
- [x] Verified: 474/474 tests pass (was 455), tsc clean, lint clean (one pre-existing, unrelated `Function`-type warning in `planner-translations.ts` untouched by this batch). Browser-verified a representative sample (Treadmill, Cat tree, Fire pit, Dryer) in a real room -- correct dimensions confirmed via the Inspector for all four, and the Fire pit/Treadmill visually confirmed in 3D (rim+bowl+flame; deck+console+display, exactly as designed).

## Known Disabled Features (kept in code, not exposed in UI)

- **Corner Dragging** (single-room 2D canvas): the "Enable Corner Dragging" checkbox has been removed from the 2D View Options panel because it caused confusion and could break the app in some ways. The underlying implementation is still in `src/components/planner/canvas/CanvasArea.tsx` (`enableCornerDrag` state, `onCornerPointerDown`, the draggable corner-handle rendering, and `clampOpeningsToWalls`) -- it's just permanently off (`const [enableCornerDrag] = useState(false)`), with no UI control to turn it back on. Revisit this once it's more robust, then reintroduce the checkbox.

## From the codebase audit (July 2026) — see AUDIT.md for full reasoning on each

A full pass over the app (bugs, cross-view inconsistencies, UX ideas) was done and most of it fixed the same session — see `AUDIT.md` for the complete write-up, including what's already been resolved. Everything below is what's still open, consolidated here so this file stays the single actionable backlog; AUDIT.md keeps the "why" for each.

**Quick win still open**

- [x] Surface the "3D model color overridden" reset affordance more — decided against (2026-07-27): the existing Inspector banner + one-click Reset (shown after tinting) is enough; a pre-tint catalog hint isn't worth the added clutter.
- [x] Decide "place on top of" host-deletion behavior — confirmed 2026-07-27: detach (keep the riding item, reset its elevation to 0) is the wanted behavior, not cascade-delete. Already implemented this way in `removeItem`/`removeSelected` (`use-room-planner.ts`); no code change needed, just confirmed.
- [x] Fix duplicate React keys for IKEA catalog tiles — `CatalogGrid` in `CatalogSection.tsx` was using `p.key` (the Preset's functional source key, deliberately shared by several `IKEA_CATALOG` entries) as the React list `key`. Fixed by keying on `${cat}-${i}` (list index within its category) instead, which doesn't touch `customCatalogItemToPreset()`'s `key` field at all since that field is still needed for `resolveRenderMode`'s dimension lookup.

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
