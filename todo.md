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
- Slanted walls (how could this be tackled?)

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

## Onboarding Dashboard -- Phase 1 (2026-07-28)

`/` no longer renders the room planner directly -- it's a landing dashboard, since the app outgrew "start straight in one canvas" (multi-room floors, custom/IKEA catalog, 200+ presets). Scoped into two phases; this is Phase 1 only. Phase 2 (an IKEA-inspired room-shape wizard with constrained whole-wall dragging) is a separate future effort, not started.

- [x] New `src/hooks/use-settings.ts` (+ `src/lib/settings.ts`) -- one consolidated `planner-settings-v1` localStorage blob (`lang`, `quickEntry`, `defaultView`, `defaultZoom`, `collisionDefault`, `lastActive`), replacing the two independently-duplicated inline `lang` `useState`s in `use-room-planner.ts` and `rooms.index.tsx`. Migrates a returning user's old standalone `planner-lang` value forward on first read.
- [x] New `src/components/dashboard/` -- `Dashboard.tsx`, `CreateSingleRoomFlow.tsx` (from-scratch form + from-example gallery), `CreateFloorFlow.tsx` (from-scratch / from-example, no form needed for either), `RecentlyOpened.tsx`.
- [x] New `src/lib/single-room-templates.ts` -- 6 single-room "from example" templates (Living Room/Kitchen/Bathroom/Bedroom/Dining Room reuse `default-apartment.ts`'s now-exported per-room builders; Home Office reuses the richer, purpose-built `buildDefaultOfficeItems()`/`buildDefaultOfficeOpenings()` standalone demo content instead of default-apartment's smaller version of the same room, so that hand-tuned content stays in use now that `/` doesn't render it directly anymore).
- [x] New `src/components/planner/SettingsDialog.tsx` -- theme, language, default view (2D/3D), default zoom, collision-detection default, quick entry toggle, sidebar-collapsed default, "take the tour again"; the last two props are optional and only supplied when opened from inside a room (`rooms.$roomId.tsx`'s Header), not from the dashboard (no sidebar/tour there). Reachable from the dashboard and from `Header.tsx`'s "More" dropdown (new entry, next to "Take the tour").
- [x] `routes/index.tsx` renders `Dashboard`, or redirects straight to `settings.lastActive` when `quickEntry` is on. `lastActive` is recorded on mount by `rooms.$roomId.tsx` and on floor-switch by `rooms.index.tsx`.
- [x] Bug found and fixed while verifying: `rooms.index.tsx` had an unconditional "regenerate the default apartment" call the first time `/rooms` mounted in a given page session (a stale `hasGeneratedRoomsThisSession` module flag, skipping the existing-data check entirely) -- harmless when `/rooms` was rarely the first stop, but every new "Create a Floor" flow now navigates there right after saving, so it was silently discarding the floor just created. Fixed by always checking `loadFloors()` first and only generating the default apartment when truly nothing is saved; the flag was removed entirely (verified nothing else read it).
- [x] Verified end-to-end in-browser on the real dev profile: dashboard renders with real saved data, all four creation flows (single room from-scratch/from-example incl. Home Office, floor from-scratch/from-example) produce correct rooms and persist across navigation, Settings dialog fields all persist across reload, quick-entry redirect works both directions, Header's More -> Settings opens from inside a room and its "take the tour again" correctly hands off to the existing tour overlay, existing pre-existing floor/room data is untouched. tsc/lint clean on all changed files, 474/474 tests pass.

### Follow-up fixes -- routing + defaults (2026-07-30)

User-reported the dashboard rollout broke navigation and a settings toggle in real use. Root-caused and fixed all of it:

- [x] **Dashboard split into its own stable route.** `/` conflated two jobs -- "the dashboard" and "quick-entry redirect gate" -- so any explicit "go to the dashboard" link was silently subject to the redirect too. New `src/routes/dashboard.tsx` always renders the dashboard, never redirects; `routes/index.tsx` is now a pure entry gate that always redirects (to `/dashboard` or to `lastActive`, gated on `useSettings()`'s new `hydrated` flag so it doesn't fire on the SSR-safe placeholder value).
- [x] **Multi-room view's back button fixed.** `rooms.index.tsx` had three leftover `<Link to="/">` labeled "Single Room Planner" from when `/` *was* the single-room canvas -- now semantically wrong. Relabeled to "Dashboard" (`LayoutDashboard` icon), pointed at `/dashboard`. Also added a "Dashboard" entry to the single-room `Header.tsx`'s "More" menu, so both Single Room and Multi-Room have an explicit way back to the hub.
- [x] **New floor wasn't visible after creation.** `CreateFloorFlow`'s from-scratch/from-example both saved the new floor but never called `saveActiveFloorId`, so `/rooms` kept showing whichever floor was already active -- looked exactly like "the example didn't load." Fixed by activating the new floor before navigating.
- [x] **First-visit tour was ambushing freshly created content.** `useRoomPlanner` auto-opens a full-screen "Welcome to Room Planner" tour the first time it ever mounts, regardless of how you got there -- previously harmless (that was always `/`'s first paint), now it pops up right after a user deliberately builds something from the dashboard, hiding it entirely. Exported `TOUR_KEY` from `use-room-planner.ts`; all four dashboard creation paths mark the tour done at creation time (still reachable anytime via Header's "Take the tour").
- [x] **Default view/zoom/collision settings were never actually applied.** `threeDActive`/`zoomFactor`/`collisionEnabled` were hardcoded `useState` literals in `use-room-planner.ts`, never reading `settings.defaultView/defaultZoom/collisionDefault` at all. Fixed with a one-time apply-on-hydration effect, gated on `useSettings()`'s new `hydrated` flag (applying from the pre-hydration placeholder would have permanently baked in the wrong value, since these only seed a `useState` once).
- [x] Verified on a genuinely fresh browser profile (matching what the user would have hit): every fix confirmed live -- `/` redirects correctly both ways, `/dashboard` is stable, floor-from-example is immediately visible and selected, single-room-from-example shows content immediately with no tour interruption, Settings' Default View: 3D actually opens rooms in 3D (both newly created and pre-existing ones). tsc/474 tests/lint clean (lint baseline unchanged -- zero new issues).

## Onboarding Dashboard -- Phase 2: IKEA-Style Room Wizard (2026-07-30)

Built autonomously per the user's request ("work in auto mode... leave most of the visual and ux testing to me"). A third "Guided (Pick a Shape)" option alongside "From scratch"/"From example" on the dashboard's "Create a Single Room" card -- pick a shape, drag its walls to size it, add doors/windows, matching the flow observed on IKEA's own room planner during Phase 1 planning.

- [x] New `src/lib/room-shapes.ts` -- standalone-room shape templates (Rectangle, L-Shape, Cut Corner; deliberately separate from `hallway-shapes.ts`'s own L/T builders, which are a different shape family: one shared armWidth for a thin bending corridor, not a rectangle with a notch/chamfer) plus `dragWallEdge()`, the constrained "whole wall moves together" drag interaction the user asked for in the original Phase 2 scoping conversation.
- [x] `dragWallEdge` implements "constrained whole-wall parallel translation": only the drag's component along the wall's own outward normal is used (an along-wall drag is a no-op), the wall's translated line is re-intersected with each *unchanged* neighboring wall's line (`lineIntersection`, new in `hallway-shapes.ts` -- the missing primitive flagged during Phase 1 planning) to get the two new corner positions, and the result is rejected (falls back to unchanged corners) if it would invert a neighboring wall or collapse the room's bounding box below a sane minimum. Verified both via 16 unit tests (rectangle/L/cut-corner, including the non-axis-aligned diagonal wall) and live in-browser with real pointer drags.
- [x] New `src/components/dashboard/RoomShapeCanvas.tsx` -- small standalone interactive SVG (not a reuse of `CanvasArea.tsx`'s full 2D canvas, which carries furniture/collision/openings-clamping concerns this step doesn't have) rendering the room's live polygon with draggable walls and live dimension labels. Uses the room's own cm coordinates directly as the SVG `viewBox`, so the browser handles cm-to-screen scaling with no manual pixel math.
- [x] New `src/components/dashboard/IkeaRoomWizard.tsx` -- the 3-step dialog (shape gallery -> drag-to-resize + numeric width/length fallback -> name/color/openings). The openings step reuses the existing `OpeningsDialog` component as-is (per the user's own stated preference from Phase 1 planning -- no new visual wall-placement UI) plus a local openings list matching `ElementsListSection`'s existing display pattern.
- [x] New `createRoomLayoutWithCorners()` in `multi-room-actions.ts` -- generalizes `createHallwayLayout`'s corners-to-RoomLayout pattern (bounding box for width/length, explicit `corners`, free-spot placement) for a plain polygon room with no auto-placed doors and no `roomKind`.
- [x] Deliberately does not touch `CanvasArea.tsx`'s existing (disabled) `onCornerPointerDown`/`enableCornerDrag` corner-dragging code at all -- that free-form, unconstrained per-vertex dragging (no line-intersection, a single corner can move anywhere) is exactly what caused the original problems and stays off; this wizard's wall-dragging is a new, isolated, purpose-built system that only exists inside its own small canvas, with no interaction with the main room editor's furniture/collision/openings-clamping logic at all.
- [x] Verified live in-browser (not just unit tests): shape gallery renders all three previews correctly; dragging a wall on an L-shape moves only that wall while every other wall (and the notch) stays exactly put; the same works for the Cut Corner shape's one diagonal wall (confirmed the algorithm doesn't assume axis alignment); a full wizard run (L-Shape -> drag to resize -> add a door -> name it -> Create Room) produces a real, correctly-shaped room that renders properly in both 2D and 3D, with the door in the right place. 495/495 tests pass (16 new), tsc/lint clean on all changed files.
- [ ] Not done (deliberately out of scope for this pass, left for the user's own visual/UX review): polish on the wizard's visual design, drag-sensitivity tuning (a moderate drag on a shallow diagonal wall can hit the minimum-size rejection sooner than on an axis-aligned wall -- correct behavior, just worth a closer look at the guard's thresholds once there's real usage feedback), mobile/touch support for the wall-drag canvas, and the 4th "wall/floor style" step IKEA's own flow has (not needed as a separate step here since the full room editor already has complete wall-color/flooring controls once the wizard hands off to it).

### Follow-up fixes after user review (2026-07-30, same day)

Real feedback after trying it: the canvas visibly zoomed while dragging, the dropdown-based openings step was confirmed as bad UX, and dimension displays showed ~15 decimal digits. Fixed all three:

- [x] **Canvas was rescaling ("zooming") during wall drags.** `RoomShapeCanvas` recomputed its SVG `viewBox` from the LIVE corners on every drag frame -- since the on-screen canvas size is fixed, a viewBox that tracks the shrinking/growing bounding box makes everything inside visibly rescale in lockstep with the drag. Fixed with new `computeStableViewBox()` in `room-shapes.ts`: computed once when a shape is picked (generous 1.3x padding so the room can roughly triple in size before approaching the edge), passed down as a prop, never recomputed from live corners. Verified in-browser: wall midpoint screen coordinates for UNCHANGED walls are pixel-identical before/after a large drag.
- [x] **Openings dropdown replaced with click-to-place.** Removed `OpeningsDialog` from the wizard entirely per explicit feedback ("too hard to guess how it will look"). `RoomShapeCanvas` gained an `"openings"` mode: a Door/Window toggle above the canvas picks what clicking places; clicking empty wall space projects the click onto that wall and places a centered, default-90cm opening there (same bounds/overlap validation as before); clicking an already-placed opening's own colored mark (amber for doors, sky blue for windows) removes it. The final step is now just this canvas + Name + Color + Create Room, no separate modal. Exported `NAMED_WALLS` from `hallway-shapes.ts` so wall keys still match the app's established convention (named for a 4-corner room, numeric otherwise).
- [x] **Dimension displays showing ~15 decimal digits.** Root cause: `dragWallEdge`'s line-intersection math produces long floats (e.g. `501.60711669921875`), which `RoomDimensionBadge.tsx` (the real room editor's top-left "W x L cm" label -- pre-existing code that never needed to handle such precision before this wizard existed) interpolated with zero formatting. Fixed at the source: `dragWallEdge`/`resizeRoomShape` now round every committed corner to 2 decimal places, plus defensively rounded `RoomDimensionBadge.tsx`'s own display as a second layer.
- [x] Verified live in-browser end-to-end (not just unit tests): repeated wall drags on an L-shape confirmed pixel-stable view; door then window placed by clicking two different walls, each rendered as a distinct colored mark; clicking the door's own mark removed it without also placing a new one underneath; the finished room's real editor shows "400 x 678.25 cm" (not 15 digits) and the placed window renders correctly in the 3D view. 496/496 tests pass (1 new, regression-testing the rounding), tsc/lint clean.

### Second follow-up round (2026-07-30, same day): canvas polish

- [x] **Removed the redundant in-canvas hint text** ("Drag a wall to resize" / "Click a wall to place...") -- it duplicated the `DialogDescription` already shown right above the canvas.
- [x] **Dimension label font size no longer scales during a drag.** The labels were SVG `<text>` with `fontSize` expressed in viewBox units derived from the room's LIVE bounding box -- so even after the viewBox itself was stabilized (previous round), the text's on-screen size still grew/shrank as a drag changed that live box. Rewrote the labels as plain HTML overlay `<div>`s (fixed `text-sm font-medium`, 14px) positioned by percentage within the stable viewBox, layered over the SVG -- position tracks the live wall, size never changes. Hit-area width and corner-dot radius were also switched from the live bounding box to the stable viewBox for the same reason (consistency, no more per-element size drift).
- [x] Verified live in-browser: computed `font-size` on every label reads a constant 14px both before and after a large drag (350cm -> 678cm), and the hint text is confirmed absent from the DOM. 496/496 tests, tsc/lint clean.

## Separate single-room and multi-room, for real (2026-07-30) -- DONE

User-reported, high priority: single-room and multi-room were the same data structure (every "single room" was secretly a one-room `Floor` in `planner-multi-floors`) and the same route (`/rooms/$roomId` for both), which is why finishing the wizard/from-scratch/from-example flow showed a nonsensical "Back to Overview" button and littered the multi-room floor list with one-room floors. Now genuinely separated in both storage and routing, per the user's explicit "two very distinct areas... separated both in the UI and in the data structure."

- [x] **New store, no `Floor` wrapper**: `src/lib/single-rooms.ts` (`planner-single-rooms`, a bare `RoomLayout[]`) with load/save/find/add/update/remove. `addSingleRoom` pins `x`/`y`/`rotation` to 0 -- the overview-grid coordinates a standalone room has no use for -- rather than trusting each call site. 12 new unit tests (`tests/single-rooms.test.ts`), including an explicit isolation suite asserting neither store can ever see the other's content.
- [x] **New route**: `/room/$roomId` (singular), `src/routes/room.$roomId.tsx`. `/rooms` and `/rooms/$roomId` are behaviorally untouched.
- [x] **Shared editor extracted**: rather than copy ~300 lines of prop threading into the new route, `rooms.$roomId.tsx`'s whole body moved to `src/components/planner/RoomEditor.tsx`; both routes are now ~8 lines that differ only in `source="floor"` vs `source="single"`. Everything that varies with source (which store, which `lastActive` variant, where the back pill goes) is derived inside the component, so a route can't pair one system's storage with the other's navigation.
- [x] **`useRoomPlanner(roomId, source)`**: new explicit `RoomSource` param ("floor" | "single") branching both the initial read and the save-back effect -- deliberately explicit rather than "look the id up in both stores and guess." A single room reports no siblings (nothing can be adjacent to it), so `openWalls` is empty by construction.
- [x] **All three creation paths rewired** through one new shared hook, `useCreateSingleRoom()` -- they each did this inline before and had already drifted (only the wizard also set an active floor). Saves to the single-room store, marks `TOUR_KEY`, opens `/room/$roomId`.
- [x] **Back pill**: new `backLabel` prop on `CanvasArea` (the `backUrl`-only version had "Back to Overview" hardcoded). Single rooms get "Back to Dashboard" -> `/dashboard`; floor rooms keep "Back to Overview" -> `/rooms`, unchanged.
- [x] **`lastActive` split**: new `{type:"single-room"}` variant alongside `{type:"room"}`, handled in `settings.ts`'s normalizer, the `/` quick-entry gate, and `RecentlyOpened`. Old `"room"` values still mean "a room inside a floor" and keep resolving to `/rooms/$roomId` -- nothing to migrate.
- [x] **Dashboard UI split**: the single "Load Saved Rooms" card became two side-by-side cards, "Your Single Rooms" (new `SingleRoomsList.tsx`, with per-row delete + confirm -- the dashboard is the only place standalone rooms are listed, so it has to be the only place they can be removed) and "Your Floor Plans". Saved single rooms would otherwise be unreachable once created.
- [x] **Stale-id guard**: `/room/<unknown-id>` redirects to `/dashboard` instead of silently opening the default-office fallback and discarding every edit (`updateSingleRoom` no-ops on an unknown id). It also doesn't record the dead id as `lastActive` on the way out.
- [x] **"From example" (single room) now goes straight to the Home Office**, per user decision -- no 6-template picker in between. `single-room-templates.ts` reduced to one `buildHomeOfficeRoom(lang)` that wraps the user's own hand-tuned office export (`buildDefaultOfficeItems`/`buildDefaultOfficeOpenings`), confirmed still wired verbatim.
- [x] **Multi-room "from example"** confirmed correct as-is (`generateDefaultApartmentLayout`) per user; no JSON file exists in the repo to re-derive it from.
- [x] **Multi-room "from scratch" re-verified unchanged**: creates a second empty floor, sets it active, lands on `/rooms` with the add-room/add-hallway sidebar, and does not wipe the existing floor.
- [x] Verified live in-browser on a cleared profile, checking `localStorage` directly at each step rather than trusting the UI: all three single-room paths create zero floors (`planner-multi-floors` stayed `null` through all of them), land on `/room/<uuid>`, and expose exactly one link on the whole page -- `/dashboard`. Edits save back to the single-room store (width 500 -> 555 confirmed persisted). Multi-room example floor shows 1 floor / 7 rooms with the 3 standalone rooms nowhere in it -- including a floor room *also* named "Home Office", proving the stores are independent. Delete removes only the named room. Quick entry with a single-room `lastActive` jumps straight to `/room/<id>`. 508/508 tests, tsc clean, lint unchanged from baseline (6 remaining errors all verified identical in `HEAD`).

### Apartment example: make it the ground floor, not another storey (2026-07-30)

User: *"fix the fully furnished apartment room example. the way it was/should be was only the ground floor setup i had provided."*

**The content was never wrong** -- verified before changing anything, rather than assuming. `generateDefaultApartmentLayout()`'s room set (Living Room, Kitchen, Bathroom, Bedroom, Home Office, Dining Room, Hallway) has been identical since the file was created (`ccb5077`), and commit `5e94d83` (the user's own, 2026-07-21) replaced the agent-authored round coordinates with hand-dragged ones in **every one of the 7 rooms** -- Bathroom 6/6 items, Bedroom 9/9, Kitchen 9/9, Office 11/11, Living Room 9/10, Hallway 6/7, Dining Room 1/7 (they simply moved less in there). You cannot hand-tune a room that isn't in your layout, so all 7 were in the supplied ground floor. The only change since was `410906d` adding five `export` keywords -- confirmed via `git show`, zero content lines touched.

**What was actually broken was placement.** `CreateFloorFlow`'s example path did `saveFloors([...floors, floor])` -- it *appended*. So the example only ever landed on the ground floor when nothing else existed; otherwise it arrived as "1st Floor"/"2nd Floor". Reproduced live: two clicks produced 3 floors with the same apartment duplicated on Ground Floor **and** 2nd Floor. That is nonsense for a layout that is by definition a building's ground level.

- [x] "From example" now targets **floor index 0** instead of appending, reusing that floor's existing id and name so the active-floor pointer and `lastActive` aren't broken by swapping its contents, and leaving any floors above it untouched.
- [x] Replacing an *occupied* ground floor asks first (`AlertDialog`) -- it's destructive. An absent or empty ground floor is filled silently.
- [x] "From scratch" still appends, unchanged -- adding a storey on top of what you have is exactly what that button is for.
- [x] Card/toast copy now says "ground floor" rather than the vaguer "example apartment".
- [x] Un-exported the 5 room builders in `default-apartment.ts`, restoring it to its exact pre-dashboard state -- they were only exported for the 6-item single-room gallery, which no longer exists.
- [x] Verified live across all four cases, reading `localStorage` each time: empty store -> 1 floor / 7 rooms / 59 items / active index 0, no dialog; occupied ground floor -> dialog, Cancel is a true no-op (still 1 floor, stays on `/dashboard`), Replace keeps it at 1 floor; **empty** ground floor -> filled silently, no dialog; "From scratch" after an example -> 2 floors with the ground floor's 7 rooms intact. 508/508 tests (35 of them `default-apartment.test.ts`), tsc + lint clean on touched files.

### Dashboard polish + tour audit (2026-07-31)

- [x] **Resume entry moved to the very top and made explicit.** It sat below the creation cards, reading as an afterthought, and only said "Continue where you left off" without naming its target. Now the first thing on the page, with an eyebrow ("Continue where you left off"), the actual name of what opens, what kind of thing it is (`Single room · 400×350 cm` / `Floor plan · 7 rooms` / `Room in Ground Floor`), and an explicit "Open →" affordance instead of a bare arrow. The floor variant now names the real active floor rather than saying "your floor plan".
- [x] **Floor plans got the same saved-list + delete as single rooms** (`FloorPlansList.tsx`). Each floor shows its display name and `N rooms · N items`; clicking opens `/rooms` *with that floor selected* (it sets the active floor first, since `/rooms` renders whichever floor is active rather than taking one in the URL); per-row delete with a confirm that names the floor and how many rooms go with it. The last remaining floor can't be deleted -- mirrors `deleteFloor`'s existing rule in `rooms.index.tsx`, and without it `/rooms` would just re-seed the example apartment and look like the deleted floor came back. Deleting re-points the active floor via `loadActiveFloorId`'s existing fallback.
- [x] Row markup shared between both lists (`SavedRow.tsx`) rather than copy-pasted a third time.
- [x] **Tour: verified all 7 steps against the live DOM** -- every spotlight anchor (`#tour-catalog`, `#tour-canvas`, `#tour-inspector`, `#tour-ruler`, `#tour-3d-toggle`, `#tour-sidebar`) resolves and the highlight rect lands on its target to within the 6px padding, 3D activates for steps 6-7, Done/Skip closes and sets `TOUR_KEY`. Two false alarms worth noting for next time: anchors read as "missing" at a collapsed viewport (mobile view-only genuinely hides the ruler and inspector), and the spotlight rect reads as misaligned if measured during its own 300ms CSS transition -- both looked like bugs and were not.
- [x] **Real bug found and fixed: the tour left you stranded in 3D.** It switches to 3D for its last two steps but never handed the view back, so finishing (or skipping from) those steps dumped you into a mode you never chose -- and silently overrode the `defaultView` setting for the rest of the session. `TourOverlay` now captures the view mode when the tour opens and restores it when it closes.
- [x] **Fixed: the tour was unreachable from the dashboard.** The same Settings dialog shows "Take the tour again" inside a room but hid it on the dashboard, because `onTakeTour` was never passed. The dashboard now clears `TOUR_KEY` and opens a room, letting `useRoomPlanner`'s existing first-mount auto-open run the tour -- no duplicated tour machinery. Hidden when there's no room to tour yet.

### Still open

- [ ] **Product call on the tour's auto-open**: every dashboard creation path marks `TOUR_KEY` seen at creation time (deliberately -- it used to ambush freshly-created rooms), so a brand-new user who creates a room from the dashboard now *never* sees the tour automatically. It only auto-fires for someone who reaches a room without creating it (e.g. `/rooms` → open a room from the auto-seeded apartment). Reachable on demand from the Header's More menu and both Settings dialogs. Worth deciding whether new users should get it another way -- e.g. offering it once on the dashboard itself rather than inside a room.
- [ ] The canvas's floating Room Inspector can overlap the bottom-left back pill at shorter viewport heights (~720px). Pre-existing and identical on `/rooms/$roomId` -- not introduced by this change, but now more visible since the back pill is a single room's main way out.
- [ ] Pre-existing duplicate apartment floors from before the placement fix aren't cleaned up retroactively -- they're just ordinary floors now, deletable from the floor switcher (or now from the dashboard).
