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

### Deleting every floor is now allowed (2026-07-31)

User: *"The last floor can't be deleted -> i should be able to. same logic as with single room: users can always get back the example layout i provided via the path 'From example'."*

- [x] Removed the last-floor guard from `FloorPlansList`. The blocker was never the delete itself -- it was that `/rooms` re-seeded the **example apartment** whenever the store was empty, so deleting your only floor looked like it silently failed.
- [x] `/rooms` now seeds a **blank** floor instead of the example apartment when nothing is saved. The example only ever arrives when explicitly asked for, via the dashboard's "From example" -- which is exactly what makes deleting everything safe. An empty floor rather than zero floors because the whole route assumes an active floor exists, and a blank Ground Floor with the add-room sidebar is a usable starting point rather than a dead end.
- [x] The floor switcher *inside* `/rooms` keeps its own can't-delete-the-last-one rule -- deleting the floor you're currently standing on has nowhere to land. Consistent in intent: you can delete everything, just not while standing on it.
- [x] Verified the full round trip: delete the only floor -> empty state, single rooms untouched -> visit `/rooms` -> blank Ground Floor, example did **not** resurrect -> "From example" -> all 7 rooms restored to the ground floor.

### Sloped ceilings / "Schrägen" -- proposal + geometry layer (2026-07-31)

Design written up in **`docs/SLOPED-WALLS-PROPOSAL.md`** -- read that first. Summary:

- [x] **Geometry layer built and unit-tested** (`src/lib/wall-slopes.ts`, 25 tests). Deliberately **not wired into any UI** -- zero behaviour change, so it's safe to review and refine before anything depends on it.
- Model: a slope belongs to a **wall**, described as `{ kneeHeight, run }` -- the low knee wall ("Kniestock") and how far into the room the ceiling takes to reach full height. Height at a point is the **minimum** over all sloped walls, so a gabled attic (two opposite slopes meeting at a ridge) composes for free. Keyed exactly like `wallColors`, so the existing per-wall UI pattern transfers.
- The point of the whole feature is answering "how tall can something be here?" -- so `checkItemFitsUnderSlopes()` returns the shortfall in cm, not just a boolean.
- [ ] **Prerequisite found: rooms have no height at all today.** `ThreeDView.tsx:780` hardcodes `const wallHeight = 240`, and the `roomHeight: "Wall Height (cm)"` translation string is wired to nothing. Slopes can't be expressed against a constant -- giving `RoomLayout` a real `ceilingHeight` is Phase 0 and is worth doing regardless.
- [ ] Phases 2-5 (2D slope band + standing-height line, Inspector editing, furniture fit toast, 3D geometry, wizard step) -- see the proposal's phasing table. Phases 0-3 deliver the whole planning value without touching the 3D renderer.
- [ ] Six open questions for the user in the proposal: block vs. warn on too-tall furniture; whether single/gable is enough (dormers scoped out); per-room vs. per-floor roofs; where slope editing lives; ceiling default on/off; per-room vs. per-floor ceiling height.

**Extended 2026-07-31 with configurable wall height + a real ceiling** (user request). Findings that changed the plan:

- Configurable wall height is **small and mechanical**: `wallHeight` occurs 7 times in `ThreeDView.tsx`, all inside one wall-building function, so it becomes `room.ceilingHeight ?? 240` at the top of the per-room loop. Everything else is the same set of seams `flooring` was added through (types, 2 room-instance construction sites, use-room-planner state + save-back + `Snapshot` for undo, schema, one Inspector field). Translation string already exists in both languages.
- A ceiling is **easier than it sounds in two of three parts**: the mesh is literally the floor's `Shape`+`ShapeGeometry` code at `y = ceilingHeight` (polygon rooms included, free), and "how do you see in?" is already solved -- `ThreeDView` has a camera-aware fade system with hysteresis and a user-facing opacity control, so a ceiling registers with the same mechanism under a simpler predicate (camera above -> fade, camera inside -> solid). **The real risk is lighting**: the scene is currently lit through an open top, and the lamp fixtures were tuned that way.
- **The ceiling should be built with the slopes, not after.** Without a ceiling surface a Dachschräge renders as "one wall is oddly short" -- it reads as a bug, not a roof. And a flat ceiling and a slanted one are one mesh family differing only in vertex heights, wanting the same fade and the same lighting fix. Doing slopes alone first means shipping a broken-looking 3D view and then redoing the same code. Phasing table updated accordingly (4a flat ceiling / 4b lighting / 4c slope surface -- one piece of work, split to show where the risk is).

### Fixed: `/rooms` kept resurrecting a deleted floor (2026-07-31)

User: *"the deleting of the default rooms entry works now but when i reload the page it is there again."*

Reproduced exactly: delete every floor -> dashboard correctly shows "No floors yet" -> visit `/rooms` (or land there via the resume card / quick entry, since `lastActive` is `{type:"floor"}`) -> a floor silently reappears in the list.

Root cause was my own previous fix being half a fix. `/rooms` auto-seeded on an empty store -- originally the whole example apartment, then (after that made deleting impossible) a *blank* floor. Both are the same bug: **visiting a page silently wrote data**, so the delete looked like it had failed either way.

- [x] `/rooms` now creates **nothing** when there's nothing saved. Zero floors is a real, persisted state.
- [x] Added an explicit empty state on `/rooms` -- "No floors yet", with a "Create a floor" button and a link back to the dashboard. Offers the action instead of performing it behind your back.
- [x] Added a `hydrated` flag: the persist effect was guarded on `floors.length === 0` (to stop the pre-load placeholder clobbering saved data), which also made an empty building unsavable. Gating on `hydrated` instead expresses the real intent and lets "no floors" persist.
- [x] Verified: delete all -> stays deleted across repeated reloads *and* route switches between `/rooms` and `/dashboard`; store stays `[]`; "Create a floor" then works and persists normally.

### Sloped ceilings: Phases 0-3 shipped (2026-07-31)

Design in `docs/SLOPED-WALLS-PROPOSAL.md`. Phases 0-3 deliver the whole planning value without touching the 3D renderer; phase 4 (ceiling mesh + 3D slope surfaces) is deliberately not started.

- [x] **Phase 0 -- rooms have a real height.** `RoomLayout.ceilingHeight` (optional, defaults to 240 = the value `ThreeDView` used to hardcode, so every existing room is byte-identical). `wallHeight` in `ThreeDView.tsx` went from a module-level `const` to a per-room read inside the room loop -- all 7 uses (wall segments + door/window lintel maths) follow automatically because `buildWallSegments` is defined inside that loop and closes over it. Threaded through `RoomInstance3D` and both construction sites, use-room-planner state/save-back/`Snapshot`/export/import, `planner-schema` (bounded, it's the user-supplied-file path), and a new Inspector field using the `roomHeight` string that had been sitting unused in both languages.
- [x] **Phase 2a -- slopes are authored and persisted.** `RoomLayout.wallSlopes`, keyed exactly like `wallColors`. New `RoomHeightSection.tsx` in the Inspector (split out rather than growing the 1000-line `InspectorSection`): per-wall add/remove, knee-wall + depth fields, and a derived readout -- *"Stand upright from 92 cm in · 41° pitch"*, which matched the unit test's 92.3cm exactly on first run.
- [x] **Phase 2b -- the 2D overlay** (`CanvasSlopes.tsx`): gradient band `run` cm deep and darkest at the wall, dashed inner edge, contour lines at 100/150/**190**/220 with the standing-height line emphasised, and a "110 → 240 cm" range label. Clipped to the room polygon, so L-shaped rooms trim correctly for free. Contour labels are distributed *along* the wall, not stacked at its midpoint -- verified zero overlap by measuring the rendered text boxes.
- [x] **Phase 3 -- fit feedback, warn-never-block.** Items too tall for the ceiling above them get a dashed amber outline + tooltip on the canvas, a live "113 cm · −87 cm" badge while selected/dragged (tracks continuously because `items` updates live), and a matching amber warning in the Elements list. Computed once in `useRoomPlanner` and shared, so the plan and the list can't disagree.
- [x] **Bug found and fixed by the geometry, not by eye**: the band first drew *outside* the room. `resolveWallSegment` deliberately walks "bottom" and "left" in reverse winding order (kept that way so existing rooms render identically), which silently inverts any normal derived from `a`→`b`. New `inwardNormal()` probes the polygon with `pointInPolygon` instead of trusting winding. Locked down with 5 regression tests covering all four named walls plus an L-shaped polygon's numeric walls.
- [x] Verified end-to-end in the browser against `localStorage`: 200cm wardrobe at x=3 against a 110cm knee wall -> flagged "Needs 200 cm, only 113 cm available here" (110 + 130×3/150 = 112.6, correct); moved to x=243, clear of the 150cm run -> all warnings gone. 538 tests, tsc clean, lint 18 errors/19 warnings against a 36/19 baseline.

### Fixed: deleted floors resurrected from the LEGACY storage key (2026-07-31)

User, after the previous fix: *"the rooms entry still reappears after a hard reload."* They were right, and my earlier verification was worthless because I had tested on a `localStorage.clear()`ed profile -- which wipes the very key that causes it.

Root cause was not in the delete path at all. `isFloorArray()` in `lib/floors.ts` required `v.length > 0`, so a deliberately-saved **empty** building was judged *invalid*, `loadFloors()` fell through to its legacy `planner-multi-rooms` migration branch, and **re-saved the pre-floors rooms on every single load**. Anyone carrying that old key could never make a delete stick.

- [x] `isFloorArray` now accepts `[]` -- an empty building is a real saved state, distinct from "nothing ever saved". The legacy migration is now only reachable when the new key is genuinely absent or unparseable.
- [x] Two regression tests, including one that plants a legacy save alongside an empty building and asserts the ghost stays dead.
- [x] Reproduced first (planted a legacy key + empty floors -> "Ghost Room" came back on a plain dashboard load), then verified fixed with the legacy key still present.
- **Lesson**: testing storage-migration behaviour on a cleared profile proves nothing about users carrying legacy keys. Plant the old key explicitly.

### Item labels now show L×W×H (2026-07-31)

- [x] Canvas boxes and the Elements list both show `length×width×height` instead of `width×length`, with a translated `dimsLWH` tooltip ("Length × Width × Height (cm)" / "Länge × Breite × Höhe (cm)") since three bare numbers are ambiguous. Height comes from `item.height ?? getDefaultHeight(...)` -- the same value the 3D view and the slope fit-check use, so all three agree. **Note this reorders the first two numbers** from what was there before.

### Sloped ceilings: Phase 4 (3D) shipped (2026-07-31)

- [x] **Flat ceiling mesh**, built from the same polygon as the floor, so polygon/hallway rooms work for free. Unlike the floor it is not a rotated flat plane -- vertex heights vary, so it is built directly in (x, height, z) with no rotation.
- [x] **Camera-aware fade**, on its own registry beside the walls': a wall asks "is the camera outside my plane", a ceiling only asks "is the camera above me", over a 40cm band. Solid standing inside, dissolved looking down from outside -- so the familiar floor-plan view still works with the ceiling on.
- [x] **"Show Ceiling" checkbox** in the 3D control overlay, **off by default** -- which is what kept a lighting overhaul off the critical path. Ambient light gets a 1.45x boost when it's on, since a closed room loses the sky contribution.
- [x] **Slanted ceiling surface**: `buildCeilingSurface()` triangulates the polygon, subdivides midpoint-only until edges are ~15cm so the fold where slope meets flat ceiling is legible, and samples `availableHeightAt` per vertex. Midpoint-only subdivision keeps the room outline exact. A room with no slopes skips subdivision entirely and stays 2 triangles.
- [x] **Knee walls**: a wall carrying a slope now stops at its `kneeHeight` instead of running to the ceiling. Without this the wall shot straight past the slanted ceiling, reading as clipping rather than a roof.
- [x] **Bug found in the browser, not by tests**: `THREE.ShapeGeometry` is *indexed*, so reading its `position` attribute in threes ran off the end of a 4-corner rectangle and produced NaN vertices -- surfaced by three.js only much later as an opaque "computeBoundingSphere(): Computed radius is NaN". Fixed to walk the index buffer, plus `buildCeilingSurface` now drops non-finite triangles defensively so a bad triangulator can never poison a mesh again. 6 new tests.

### Feedback round on slopes/ceilings (2026-07-31)

- [x] **Ceiling rendered at ~10% opacity from every angle.** Root cause of both "the slant is barely visible" and "Show Ceiling does nothing in a flat room": the ceiling faded to `wallFadeOpacity * 0.4` (= 0.1) whenever the camera was above it *at all*, which is essentially always. It now uses the **exact same rule as the walls** -- same `fadeFactor` (solid looking straight down, fading toward horizontal), same `wallFadeOpacity` target, same hysteresis -- and the same base colour `#f1f5f9`, so it reads as part of the same shell.
- [x] **Openings on sloped walls are refused.** `addOpening` rejects a sloped wall with a toast; adding a slope to a wall that already has doors/windows asks first (`AlertDialog`) and deletes them on confirm. Deliberately not half-supported: an opening in a knee wall needs its own height validation, and one in the slope itself is really a roof window.
- [x] **Inspector wheel-scroll no longer zooms the canvas.** The panel lives *inside* the stage, so its wheel events bubbled to the stage's zoom handler -- which meant the panel could never be scrolled once it outgrew the viewport (a room with several sloped walls). Panels now carry `data-stage-overlay` and the stage handler ignores wheel events from inside them. The panel is also capped to the stage height and its body scrolls.
- [x] **Wizard: dimension labels drifted off the walls.** They were positioned by naive viewBox percentage, which ignores that an SVG *letterboxes* its viewBox when the element's aspect ratio differs. Now mapped exactly (measured element size -> scale + centring offsets), so a label stays pinned to its wall regardless of shape.
- [x] **Wizard: walls can no longer be dragged out of view.** A drag frame that would push any corner outside the (fixed) viewBox is refused, so the wall stops at the edge instead of escaping the canvas.
- [x] **Wizard: dimension labels are directly editable.** Click a label, type a length. Offered only on 4-corner shapes, where a wall's length unambiguously *is* one side of the bounding box -- so it reuses the existing resize rather than inventing a second geometry path. On L/cut-corner shapes several shapes satisfy a given wall length, so the label stays read-only rather than guessing.

### Rebrand: PLANUM (2026-07-31)

Name chosen by the user from the shortlist. Applied everywhere the old brand lived:

- [x] `title`/`subtitle` in both languages (`planner-translations.ts`), plus the tour's welcome step. New tagline: *"Plan the space you actually have."* / *"Plane den Raum, den du wirklich hast."* -- it names the attic/slope problem the app now actually solves rather than describing a generic planner.
- [x] Document `<title>`, `og:`/`twitter:` meta and the description in `__root.tsx`; README.
- [x] Three stale `alt="Büro Planner Logo"` / `"Room Planner Logo"` strings, and the Dashboard's hardcoded heading.
- [x] **New mark**: `public/logo.svg` -- a floor plan reduced to essentials (room outline with a doorway gap, an interior partition, and a diagonal for the Dachschräge). Vector, so it doubles as the favicon and scales cleanly; replaces `logo.png`/`favicon.png` everywhere.
- **Two SVG gotchas hit while doing it**, both worth remembering: an SVG referenced from `<img>` needs explicit `width`/`height` (a bare `viewBox` gives it no intrinsic size and it renders as *nothing*), and XML comments may not contain a double hyphen -- one in the first draft made the whole file fail to parse, which presents identically to "the file is missing".

### Wizard openings step, reworked (2026-07-31)

Was: flat coloured bars, click-to-delete, no feedback before committing.

- [x] **Real floor-plan symbols.** Doors draw a leaf plus a swing arc (so you can see which way it opens and how much floor it eats); windows draw the conventional inset double line. Both knock a gap in the wall underneath, so an opening reads as a hole rather than a sticker.
- [x] **Ghost preview.** A dashed symbol follows the pointer along whichever wall it's over -- you see the actual door land before clicking.
- [x] **Snap to wall centre** within 18cm, with the placement committing exactly where the ghost showed (rather than re-deriving a slightly different position from the raw click).
- [x] **Click selects, drag repositions.** Click-to-delete is gone -- it made every mis-click destructive. Dragging slides an opening along its wall and stops against its neighbours instead of jumping through them.
- [x] **Contextual toolbar** for the selected opening: width presets (70/80/90/100 for doors, 60/90/120/160 for windows) and an explicit Remove. Resizing keeps the opening on its wall and clear of neighbours, so no preset can produce an invalid layout.
- [x] **Hint line** that changes with state: "Click a wall to place one. It snaps to the wall's centre." -> "Drag to reposition, click to edit."

### Wizard follow-ups (2026-07-31)

- [x] **Bigger window.** Dialog `sm:max-w-2xl` -> `sm:max-w-4xl`, canvas 320px -> 440px. The shape step was the one screen where cramped space actually cost precision.
- [x] **Wall-length editing works on every shape, not just rectangles.** The first version mapped a wall's length onto the bounding box, which only holds for a 4-corner room -- so L and cut-corner shapes got a read-only label. New `setWallLength()` (`room-shapes.ts`) generalises it: a wall's length isn't its own property, it's the distance between the two walls it runs between, so this moves the wall's NEXT neighbour through `dragWallEdge` -- meaning every existing guard (minimum size, neighbour inversion, 2-decimal rounding) still applies and a typed length can't produce a shape a drag couldn't. Iterates with a direction probe, because the relationship is only exactly linear when the moved neighbour is perpendicular (it isn't, on a cut corner). 6 new tests.
- [x] **Labels sat on top of their walls.** Fixing the earlier drift moved the offset into correct SVG-unit space -- but an SVG-unit offset scales with the viewBox, so on a wide-but-short room it collapsed to a few pixels. Now a fixed *screen-pixel* gap, so every label clears its wall by the same readable amount at any zoom.
- [x] **Labels at an L's inner corner overprinted each other** into unreadable mush -- two short walls meet there and their midpoints are close enough that a uniform offset isn't enough. Added a short relaxation pass that pushes overlapping pairs apart. Verified on the L-shape: all six labels legible (240 / 140 / 160 / 210 / 400 / 350).

### The same three creation flows inside `/rooms` (2026-08-03)

The floor sidebar's bare name+size form is now the *first of three* options --
From scratch / From example / Guided -- matching what the dashboard offers for
a standalone room. The Room|Hallway mode toggle is unchanged; hallways are a
floor-only concept and stay their own mode.

- [x] **`MultiRoomSidebar` restructured.** Room mode gained a three-way picker
      (same icons and labels as the dashboard's cards) with a body under it.
      "From scratch" keeps the inline form -- adding rooms is the repeated
      action here, and a dialog would make the common case slower -- now with
      a colour picker it never had. "From example" and "Guided" each show one
      line of what they'll do plus a button, rather than firing on a stray
      click in a narrow column.
- [x] **One `addToFloor(room)` helper** all three (and the hallway form) go
      through: push undo history, append, select. Deliberately does *not*
      navigate or touch the single-room store -- a room made here belongs to
      a floor. Same reasoning as `useCreateSingleRoom` on the dashboard side.
- [x] **`IkeaRoomWizard` is now destination-agnostic** -- an `onCreate(room)`
      prop instead of calling `useCreateSingleRoom()` itself, plus optional
      `siblings` for free-spot placement. Nothing in it infers which store the
      room belongs to; the caller decides, which is the same rule
      `useRoomPlanner(roomId, source)` follows.
- [x] **Shared components moved out of `components/dashboard/`** into a new
      `components/room-creation/` (`IkeaRoomWizard`, `RoomShapeCanvas`,
      `ColorSwatchPicker`), and `lib/single-room-templates.ts` →
      `lib/room-templates.ts` -- both were being imported from `/rooms`, where
      the old names were simply wrong. `buildHomeOfficeRoom(lang, siblings?)`
      now serves both destinations.
- [x] **One room palette everywhere.** `ROOM_SWATCHES` in `lib/swatches.ts`,
      promoted from the sidebar's local `COLOR_PRESETS`. Room creation used to
      pull from the *furniture* palette on the dashboard (`SWATCHES`, muted
      material tones) and the vivid one here, so the same action gave
      different colours in the two halves of the app. Note this changes the
      dashboard's default new-room colour from Charcoal to Sky Blue. The
      sidebar's colour-cycling (each new room a different shade) is preserved.
- [x] **Bug found and fixed: wizard corners weren't anchored to the room
      origin.** `dragWallEdge` translates the wall you grab, so pulling a left
      or top wall outward leaves negative corner coordinates (measured: a
      cut-corner room came out spanning x −184.43…400). Every other room in
      the app satisfies "local `corners` span exactly (0,0)-(width,length)",
      which is what makes `globalCorners()` (add x/y) agree with collision and
      `findFreeRoomSpot` (a width x length box at x,y). Invisible for a
      standalone room; on a floor it puts a room's real shape somewhere other
      than where placement thinks it is. `createRoomLayoutWithCorners` now
      normalises, and rounds `width`/`length` to 2dp for the same reason
      `dragWallEdge` rounds corners. 8 new tests.
- [x] **Bug found in the browser: the wizard's last step was unreachable at
      720px.** `DialogContent` is centred with no max-height and no scrolling,
      and the openings step (440px canvas + toolbar + hint + name + swatches +
      footer) is ~820px tall -- so "Create Room" sat below the fold and a
      click aimed at it hit the overlay and *dismissed the wizard instead*.
      Capped to `92dvh` with `overflow-y-auto` on the wizard's own dialog, not
      the shared component. This was live on the dashboard too.
- [x] Rooms-list rows round their footprint (`Math.round`), like every other
      size readout -- a dragged room printed `584.430000000001x350` in a 320px
      column.
- [x] Verified live in the browser against `localStorage`, not the UI: all
      three flows on a floor land in `planner-multi-floors` and leave
      `planner-single-rooms` untouched, at non-overlapping free spots
      (400x300 at 50,50 → furnished Home Office at 551,50 → 5-corner
      cut-corner at 1220,50), with local corners starting at (0,0) in every
      case and the door on numeric wall 3 for the polygon. Both dashboard
      flows re-checked afterwards: still `/room/$id`, still the single-room
      store, floors untouched. 560 tests, tsc clean, lint 18/19 (baseline).

### T and U shapes, and a canvas pass against IKEA's (2026-08-03)

User asked for IKEA's T-Form and U-Form, and for the drag canvas to take more
inspiration from theirs. Their room builder was opened and worked through
first, rather than guessing: their shape set is Rechteckig / L-Form /
Angeschnitten / T-Form / U-Form / Trapezförmig, and their step 2 is a proper
CAD drawing -- thick walls, ringed corner handles, and every wall segment
carrying its own dimension line with extension ticks (a U's bottom reads
"200 | 200 | 200", not one number).

- [x] **`buildTShapeCorners` / `buildUShapeCorners`** (`room-shapes.ts`),
      8-corner rectilinear, wound clockwise like every other polygon here. T
      is a full-width bar with a centred stem (equivalently a rectangle with
      a notch out of *each* bottom corner); U is a rectangle with a centred
      bite out of its bottom wall -- the orientation IKEA's own plan view
      shows, which is 180 degrees from the letter. The U is the first
      template with *two* reflex corners.
- [x] Templates use literal whole-centimetre parameters (134, not
      `DEFAULT_W / 3`). Only *dragged* corners get rounded, so a template
      built from 400/3 puts `266.6666666666667` straight into the saved room
      for any wall the user never touched. Locked down by a test asserting
      every template's corners are integers.
- [x] **Real bug the new shapes exposed: `dragWallEdge`'s guards were all
      local.** Its three checks -- dragged wall still long enough, neither
      neighbour inverted, bounding box not collapsed -- are every one of them
      satisfiable by a polygon that has folded through itself. Pushing a U's
      notch ceiling far enough sends it clean out through the opposite wall:
      the notch wall's own length is unchanged, both its side walls merely
      get *longer*, and the bounding box *grows*. Nothing before the T/U
      templates could reach that state. New `polygonSelfIntersects` /
      `segmentsProperlyIntersect` in `hallway-shapes.ts` (proper crossings
      only, so shared endpoints and collinear walls don't self-report), run
      as a fourth guard. Reproduced live in the browser before and after.
- [x] **Walls are drawn as walls**, 7px instead of 3, and as one stroked
      polygon rather than per-segment lines so miter joins close the corners
      -- at 7px, per-segment round caps leave a visible notch at each of a
      T's four 270-degree corners.
- [x] **Hover and drag highlight.** A wall lights up under the pointer and
      stays lit through the drag. Previously a wall gave no sign it was
      draggable until you were already dragging it, which is the clearest
      thing IKEA's does better.
- [x] **CAD dimension lines**: extension line plus perpendicular end ticks
      per wall, drawn in the container's *pixel* space rather than SVG user
      space -- the only way ticks stay a constant on-screen length and stay
      aligned with labels the separation pass may have nudged. A label that
      did get nudged now draws a dashed leader back to its own line, which
      an 8-corner shape needs routinely. Labels gained a `bg-background`
      chip so they knock a gap in their line, as a drawing does.
- [x] **Corner handles** are white-fill/dark-ring markers in drag mode (they
      stay plain dots in the openings step, where they'd compete with the
      door and window symbols).
- [x] **`computeStableViewBox` padding 1.3x -> 1.0x.** The old value drew
      every shape at under 40% of the canvas. That was invisible until three
      dimension labels had to fit around a U's small notch -- label size is
      fixed in screen pixels while the shape was being drawn tiny. The room
      can still grow to twice its starting span before the drag guard stops
      it at the edge.
- [x] **Fixed: short walls were unhittable.** A wall's grab band is a fat
      stroke whose width is a fraction of the whole canvas, so at every
      corner two neighbours' bands overlap in a blob. On a long wall that's a
      sliver; on a U's 105cm notch wall it's most of the wall, and grabbing
      the notch ceiling silently gave you a side wall instead (measured: a
      click 6px in from the end of a 133cm wall resolved to its neighbour).
      Each band is now inset from its own ends by half its width, capped at a
      quarter of the wall, so every wall owns at least its middle half.
- [x] Verified live: all five shapes render in the gallery; the U's notch
      drags and every other wall stays put; pushing it through the far wall
      is refused; a U room created from `/rooms` lands on the floor with 8
      corners, local bbox (0,0)-(400,350) and its door on numeric wall 0. 587
      tests, tsc clean, lint 18/19 (baseline).
- [ ] Not done: IKEA also offers a **Trapezoid** (Trapezförmig) shape, and a
      **feet/centimetres** unit toggle. Neither was asked for; both are small
      if wanted.

### Wall-length floor, door swing, and an app-wide cursor fix (2026-08-03)

- [x] **No wall can be dragged below 15cm any more** (`MIN_ANY_WALL_LENGTH`).
      `dragWallEdge`'s guards only ever looked at the wall under the cursor
      (min 60cm), its two neighbours (inversion) and the bounding box --
      nothing checked the walls a drag *resizes indirectly*. On a T or U
      that's routine: pushing the stem's side wall outward eats the shoulder
      beside it, and the inversion check only stops it at zero, so you could
      leave a 0.4cm sliver behind that was then impossible to grab again.
      15cm rather than 60 because short connecting walls are legitimate (a
      shallow alcove, a boxed-in pipe) -- this is a floor against degeneracy,
      not a design opinion. `setWallLength` inherits it for free by going
      through `dragWallEdge`. Covered by an exhaustive sweep: every wall of
      every template x 16 drag vectors, asserting no result is ever
      sub-minimum or self-intersecting.
- [x] **Door swing is consistent across all three renderers.** Reported: a
      door set in the wizard showed inward there, outward in the room's 2D
      canvas, inward again in 3D. Measured on a square room with an
      identical `swing: "in"` door on each wall -- the 2D canvas drew it
      OUTSIDE the room on `top` and `right`, inside on `bottom` and `left`.
      - Root cause is the documented reversed-winding quirk, one level
        further on than where it had been chased before: `CanvasOpenings`
        rotates each opening to `atan2(ptB - ptA)` and draws "in" toward the
        local -y side, which is only genuinely inward when the segment runs
        forward -- and `resolveWallSegment` walks "bottom"/"left" backwards.
        3D never had the bug because it builds every wall forward-wound
        (`buildWallSegments("bottom", corners[2], corners[3])`) and remaps
        the opening into that frame; the wizard never had it because it
        draws straight along `inwardNormal()`.
      - **The stored data was always right** -- every creation site already
        writes `swing: "in"`. Nothing needed migrating; only one renderer
        was lying.
      - Fixed in new `lib/opening-geometry.ts` (`wallFrameIsMirrored` /
        `effectiveSwing`), which corrects the *input* to the four
        hinge x swing SVG path cases rather than rewriting them -- those
        arc sweep flags are noted in LEARNINGS as not derivable by pattern.
      - 14 new tests asserting the real contract (the direction the leaf
        ends up drawn in, vs. the polygon) rather than the returned string,
        across rectangle/T/U and both swing values. Worth noting the first
        draft of those tests asserted the string and was wrong: *every*
        forward-wound wall is mirrored, so all numeric polygon walls report
        mirrored and it's the two reversed named walls that don't.
- [x] **App-wide `cursor: pointer`.** Tailwind v3's preflight set
      `button, [role="button"] { cursor: pointer }`; v4 dropped it to match
      the browser default of `cursor: default`. This app was written against
      v3, so the upgrade quietly left most of the UI showing an arrow --
      measured in the room editor, **192 of 218** interactive elements. Only
      the few carrying an explicit class (the shared `Button`, checkbox,
      switch, tabs, select, toggle primitives) still looked clickable, which
      is why it read as inconsistent rather than as one uniform change.
      Restored centrally in `styles.css`'s `@layer base` rather than adding
      a class to ~190 elements, so it can't be forgotten on the next button.
      Disabled controls keep `not-allowed`; because the rule sits in the
      base layer, every Tailwind utility still wins, so `cursor-grab` on a
      drag handle, `cursor-crosshair` for wall placement, `cursor-text` on an
      editable label and `cursor-move` on an opening are all untouched --
      verified live (8 wizard walls still `grab`, 8 labels still `text`).
      A source scan for clickable non-button elements turned up only 3
      candidates, all false positives (panel containers whose `onClick` is
      just `stopPropagation`, deliberately `default`).
- [x] Verified live on `/dashboard` (15/15), `/rooms` (32/35, the 3 being
      genuinely disabled buttons), the room editor (215/218, same 3) and the
      wizard (21/21). 604 tests, tsc clean, lint 18/19 (baseline).

### Slope-adjacent walls are cut to the roof line in 3D (2026-08-03)

The last piece of the Dachschrägen 3D geometry. A wall running *into* a
slope was still a full-height rectangle, so its top corner poked straight up
through the slanted ceiling -- the knee wall and the ceiling surface were
already right, which is what made the leftover box so obvious.

- [x] **`ceilingProfileAlongWall()`** (`wall-slopes.ts`) samples
      `availableHeightAt` along a stretch of wall and returns the ceiling
      height at each point. Sampled every ~15cm rather than solved
      analytically: the true profile is piecewise linear, so exact
      breakpoints would mean intersecting every pair of slope planes, while
      15cm (the same step `buildCeilingSurface` uses) puts any kink within
      15cm of where it belongs -- invisible at furniture scale. Endpoints
      are always exact, so a wall meets its neighbours at the right height.
      It takes a start/end distance, so the same call profiles a wall chunk
      between openings or the strip above a door.
- [x] **`ThreeDView` builds those walls as `THREE.Shape` + `ExtrudeGeometry`**
      instead of `BoxGeometry` -- a trapezoid for a single slope, a gable
      pentagon where two opposing slopes meet (`availableHeightAt` takes the
      minimum, so that composes for free).
- [x] **Door and window lintels get the same cut.** Otherwise the slope is
      honoured across the wall but a square block survives over each
      opening. A lintel whose whole span is already above the ceiling is
      omitted rather than added degenerate.
- [x] **Strictly additive.** Profiling is skipped for a wall that carries a
      slope of its own (a knee wall is deliberately flat at `kneeHeight`)
      and for any wall whose profile is flat at the ceiling
      (`profileIsFlatAtCeiling`), so an unsloped room -- and every wall of a
      sloped room that sits beyond the run -- keeps the original box path
      and byte-identical geometry.
- [x] Verified against the live scene graph, not by eye (a screenshot can't
      settle whether a wall is 2cm proud of a ceiling). On a 400x300 room
      with a 110cm knee / 150cm run on `top`: the sloped wall stays a
      `BoxGeometry` 110cm tall; the far parallel wall stays a `BoxGeometry`
      at the full 240; both perpendicular walls become `ExtrudeGeometry`
      whose top edge rises **112.6 -> 240 over ~147cm and then runs flat** --
      i.e. exactly the 150cm run, with the 112.6 accounted for by the wall's
      miter offset past the slope's line. The door's lintel is a separate
      profiled slab from 200 to the ceiling. 613 tests (9 new), tsc clean,
      lint 18/19 (baseline).

### Inspector: collapsible groups + a bottom safe zone (2026-08-03)

The floating Room Inspector was overlapping the canvas's bottom-left back
button. Per the user's call, the fix keeps everything **in** the Inspector
rather than moving room settings to the sidebar -- it just stops rendering
all of it at once.

- [x] **New `InspectorGroup`** -- one collapsible block, with a `summary`
      shown on the header while collapsed. The summary is what makes
      collapsing-by-default acceptable: you still read the room's whole
      setup at a glance ("400 × 350 cm", "240 cm · 1 slope", the wall
      colours as dots, the flooring swatch and its name) and only expand the
      one thing you came to change.
- [x] **Seven groups**, four for room settings (Dimensions / Height &
      Slopes / Wall Colors / Flooring) and three for a selected item (Color
      & Finish / Dimensions & Position / Rotation). Only Dimensions starts
      open in each mode. The item's name + quick actions and both Apply
      buttons stay outside any group -- they're the primary actions, not
      settings.
- [x] **`useInspectorGroups`** persists which are open to
      `planner-inspector-groups-v1`, merging over the defaults so a group
      added later picks up its default rather than being undefined for
      anyone who already has the key. Read in an effect, not during render
      (the hydration trap in LEARNINGS).
- [x] **New `lib/canvas-layout.ts`** -- `STAGE_BOTTOM_SAFE_ZONE` (64px) plus
      `clampInspectorPos` and `inspectorMaxHeight`, shared by both canvases
      and unit-tested. A uniform reserved strip rather than a cut-out around
      the pill's exact rectangle: the bottom toolbar and scale bar live in
      the same band, so one rule fixes all three.
- [x] **The max-height is the half that actually fixes it.** Clamping the
      drag alone wouldn't have: the panel was never *dragged* over the back
      button, it *grew* over it as sections expanded. `maxHeight` is now
      derived from the panel's own `y`, so its bottom edge always stops
      short of the strip and the body scrolls instead.
- [x] Verified live at 1440x820 on a T-shaped room with two slopes (the
      exact case that was open when the build broke): default state 391px
      tall, no overlap; **all four groups expanded** -> capped with a 65px
      reserved strip, 1243px of content scrolling inside 573px, still no
      overlap; dragged hard to the bottom -> stops at a 66px strip. Group
      state survives a reload. 620 tests (8 new), tsc clean, lint 18/19
      (baseline).
- **Note on the build error seen mid-session**
      (`Expected corresponding JSX closing tag for <InspectorGroup>`): that
      was Vite hot-reloading this file between an opening tag being written
      and its closing tag -- not a data-dependent crash, and nothing to do
      with the T-shape or its slopes. A syntax error can't be caught by a
      React error boundary; Vite's overlay *is* the graceful failure. Worth
      knowing that editing a large JSX file in several passes will do this
      to a running dev server.

### Homes: floors need an owner -- proposal + Phase 0 (2026-08-03)

**Plan written, store built, not yet wired.** See
**`docs/HOMES-PROPOSAL.md`** -- read that first. (Phase 1 shipped the next
day; its own entry is at the bottom of this file.)

User-reported: creating a second "floor plan" from the dashboard adds a
*storey to the first one* instead of making an independent plan. Root cause
is that `planner-multi-floors` is a flat `Floor[]` that **is** the one
implicit building, and the dashboard lists its floors as if each were a
separate document. The tell is `LastActiveTarget`'s `{ type: "floor" }`
carrying no id, because there's only ever one thing it could point at.

Wanted: these behave like single rooms -- N independent documents, one
dashboard row each, and 1..N floors *inside* one. The proposal covers the
model, a three-generation storage migration (`planner-homes-v1` <-
`planner-multi-floors` <- `planner-multi-rooms`), routing (`/home/$homeId`),
all 13 seams, phasing, and what's still open.

**Decided with the user**: the concept is called a **"Home"** (covers a flat
*and* a house with storeys, where "apartment" would be wrong for the
latter); a new Home starts with **one empty Ground Floor**; `/rooms` URLs
**redirect** rather than being removed.

Two things flagged in it that matter more than the rest:

- The migration is the same class of change that caused the
  deleted-floor-resurrection bug **twice**. `isHomeArray` must accept `[]`,
  and it has to be tested with the old keys *planted*, not on a cleared
  profile. The single most important test: an empty `planner-homes-v1`
  alongside a populated `planner-multi-floors` must stay empty.
- Phase 1 (wiring the store) is atomic -- dashboard, routes and editor have
  to move together. Phase 0 (the store + migration + tests, unwired) is
  worth landing on its own, since that's where the risk lives, and it's the
  natural stopping point for one session.

### Reset everything, from Settings (2026-08-03)

- [x] **New `lib/app-reset.ts`** + a destructive entry at the bottom of the
      Settings dialog, behind its own confirm. Wipes every saved room, Home,
      floor, custom-catalog item and setting, then does a **full page load**
      -- not a client-side navigation, because theme/language/settings/
      catalog/inspector state are each seeded from localStorage exactly once
      (the hydration-gate note in LEARNINGS), so a soft navigation would
      leave half the app still holding the deleted profile's values.
- [x] **A prefix sweep, not a hand-maintained key list.** All 14 keys this
      app writes are `planner-`-prefixed, so the reset collects and removes
      by prefix -- a list would silently go stale the first time someone
      added a key and forgot to register it, and nobody notices a "clean
      slate" that wasn't clean. A test asserts every known key matches the
      prefix, so adding a non-prefixed one fails loudly with the reason.
- [x] **Never `localStorage.clear()`**, which would also destroy every other
      app on the same origin -- on a dev machine that's everything else on
      localhost. Verified live: a planted `some-other-app:token` survived.
- [x] **Never called automatically.** Nothing in this codebase deletes a
      user's saved rooms on their behalf -- not on upgrade, not on
      migration, not on a parse failure. Only this explicit confirm does.
- [x] Verified end-to-end in the browser: 8 planner keys + 1 foreign key ->
      confirm -> 0 planner keys, foreign key intact, landed on a virgin
      `/dashboard` with both empty states. (`planner-theme` reappears
      immediately afterwards because `useTheme` re-persists a default on
      mount -- a fresh default, not a survivor.) 19 new tests.
- Used this to give the user their requested clean slate, rather than
  hand-clearing storage -- same outcome, and now it's a feature.

### Homes: Phase 1 -- the store is wired in (2026-08-04)

The bug is fixed: creating a second plan from the dashboard now makes a
second **Home**, not another storey of the first. Phase 1 is atomic by
nature (dashboard, routes and editor have to move together), so it landed in
one piece. Design + phasing in `docs/HOMES-PROPOSAL.md`.

- [x] **New routes**: `/home/$homeId` (a home's floor plan -- the old
      `/rooms`, keyed by an id from the URL instead of reading the one
      global array) and `/home/$homeId/room/$roomId`. The home id is in the
      room URL deliberately: searching every home for a room id is the
      "look it up and guess" pattern LEARNINGS warns against, and the back
      pill needs the id anyway to know where to return to.
- [x] **`/rooms` and `/rooms/$roomId` redirect** rather than 404 --
      bookmarks and any `lastActive` written before the change still land
      somewhere real. `/rooms/$roomId` is the one place a room id *is*
      resolved by searching, because the incoming URL genuinely predates
      homes existing. Both create nothing; with no homes they go to the
      dashboard. Pulled forward from Phase 3: leaving `/rooms` alive on the
      old store would have been a broken half-state, not a smaller change.
- [x] **`lib/floors.ts` stopped being a store.** `loadFloors`/`saveFloors`/
      `loadActiveFloorId`/`saveActiveFloorId` are gone; what stayed is what
      is genuinely *about a floor* -- `defaultFloorName`/`floorDisplayName`,
      `createFloor`, `parseImportedFloors`. The two old keys stay exported
      as read-only history (a migration source for homes.ts, and still
      swept by "Reset everything").
- [x] **`useRoomPlanner(roomId, source, homeId)`** -- both the initial read
      and the save-back effect go through `findHome`/`updateHome`, so a room
      edit rewrites one home's floors and never even reads another's.
      `updateHome` no-ops on an unknown id, so a home deleted in another tab
      can't be resurrected by the next keystroke. `RoomEditor`'s props are a
      discriminated union: a floor room cannot be opened without a homeId.
- [x] **Dashboard**: `FloorPlansList` → `HomesList` (one row per *home*,
      `N floors · N rooms · N items`, delete takes the whole home),
      `CreateFloorFlow` → `CreateHomeFlow` (both paths create a new,
      independent home). Card copy is now "Create a Home" / "Your Homes".
- [x] **The "Replace the ground floor?" dialog is deleted, not ported.** It
      existed only because there was one shared building to collide with.
      "From example" now lands in a brand-new home's ground floor -- nothing
      to overwrite, nothing to confirm. Same for the whole
      write-to-floor-index-0 dance around it.
- [x] **`lastActive` carries every id its route needs**:
      `{type:"home",homeId}` and `{type:"room",roomId,homeId}` replace the
      id-less `{type:"floor"}`. `settings.ts` upgrades both pre-Home shapes
      on read (a `"floor"` resolves to the active home; a `"room"` without a
      homeId is resolved by finding it once), so nothing downstream has a
      legacy branch. 15 new tests.
- [x] **The active floor is per-home** (`planner-active-floor-by-home-v1`, a
      `{homeId: floorId}` map) instead of one global pointer -- switching
      floors in one home can't move another's.
- [x] `FloorSwitcher` is **unchanged**: it was already prop-driven, so
      scoping it to one home's floors needed no code, which is the clearest
      sign the seam was in the right place.
- [x] Verified in the browser **with the old keys planted, not on a cleared
      profile** (the lesson from the two resurrection bugs), reading
      `localStorage` at each step rather than trusting the UI:
      a 2-floor `planner-multi-floors` → exactly **one** home with both
      floors and one dashboard row; a `planner-multi-rooms`-only profile →
      one home, one floor, both rooms with their items; **an empty
      `planner-homes-v1` alongside both legacy keys stayed empty** across
      reloads, with the ghosts never rendering and the legacy keys left
      intact. Then the actual bug: two clicks → two homes (one empty, one
      with the 7-room example), adding a floor to one left the other at
      1 floor/0 rooms, editing a room (420 → 555) wrote only to its own
      home's ground floor, `/rooms/room-14` redirected into the right home,
      a stale `/home/<bogus>` bounced to the dashboard without creating
      anything or recording the dead id, quick entry resolved a legacy
      `{type:"floor"}` and rewrote it to `{type:"home"}`, and deleting the
      last home stuck across a reload with both legacy keys still present.
- [x] 677 tests (15 new), tsc clean, lint 18/19 (baseline).
- Not done, deliberately: **Phase 2** (home-level export/import -- the
  existing floor export/import still works, now scoped to the home you're
  standing in) and **Phase 3** (copy pass). Renaming a Home has no UI at
  all yet, which is now the most obvious gap.

### Homes follow-ups: renaming, one button shape, im/export audit (2026-08-04)

Four things off the back of Phase 1.

- [x] **Renaming, for Homes *and* standalone rooms.** A Home had no rename
      surface at all (floors rename in the switcher, Homes have no
      switcher), and -- as the user spotted -- neither did a standalone
      room: a room inside a home renames in the multi-room inspector, but a
      single room's name was fixed at whatever it was created as. Both now
      rename from their dashboard row, through one shared `SavedRowRename`
      so the two lists sitting side by side can't behave differently. Same
      convention as the floor switcher's rename: commit on Enter or blur,
      revert on Escape, whole name selected on focus.
      - **Clearing a Home's name resets it to the positional default**
        (`name: null` → "My Home"/"Home 2"), which is the only way back to
        a translated, auto-renumbering name once one has been typed over. A
        room's name has no such default, so an empty value is simply not a
        rename there.
      - Escape unmounts the input, and an unmounting focused input still
        fires `blur` -- which would commit the edit Escape just discarded.
        A ref flag makes that one blur a no-op.
      - The input is `h-5 leading-5` and keeps the subtitle visible, so the
        row stays exactly 62px and the list doesn't jump when you click the
        pencil. Verified live: 62px before and during a rename.
- [x] **German plural fixed**: "Deine geplanten Zuhause" (*Zuhause* is its
      own plural), plus the two "Zuhauses" in the Settings dialog's reset
      copy. The genitive singular ("alle Geschosse dieses Zuhauses") is
      correct German and stayed.
- [x] **One button shape on the dashboard.** The single-room card stacked
      its icon above a bare label -- three tall tiles, one of which wrapped
      "Guided (Pick a Shape)" onto three lines -- while the Home card used a
      wide icon-left row with a description. Same action, two shapes,
      visibly different heights. New shared `CreateOptionButton` (icon,
      title, one line of what it does) and one list class for both cards;
      the single-room options gained the descriptions they never had, and
      "Guided (Pick a Shape)" became "Guided" + "Pick a shape, drag the
      walls" (matching the sidebar's own label). Stacked rather than in
      columns because a description needs the width. Measured live: all five
      buttons are exactly 62 x 370 in both cards -- and the saved rows below
      are 62px too, so the page is one rhythm.
      - **Found while checking it in German**: equal-sized buttons still sat
        20px out of line across the two cards, because the Home card's
        description wraps to two lines in German and one in English. Every
        card description now reserves two lines (`min-h-10`), so a
        translation that wraps can't shift its card's contents. Both cards'
        first buttons now start at exactly the same y in both languages.
- [x] **Export/import audited end-to-end after the Homes move**, since it
      was the seam most likely to have been broken quietly. All of it works,
      no code changes needed:
      - Home export, scope "current floor": correct preview (7 rooms / 59
        items / 14 openings), filename `ground-floor-2026-08-04`, and the
        raw JSON is the documented `{ floors, customCatalog }` wrapper.
      - Home import, "current floor": replaces that floor's rooms and keeps
        the floor's own id; "all floors" replaces **only the home you're
        standing in** -- checked against a second home holding the same
        content, which came through byte-identical.
      - Round trip: export → import restores all 7 rooms and all 59 items,
        and the bundled catalog item does **not** duplicate (deduped by id).
      - Single-room export/import: full shape (`version`/`room`/`openings`/
        `items`/`corners`/`wallColors`/`flooring`/`ceilingHeight`/
        `wallSlopes` + bundled catalog), and importing a modified file
        applies to the single-room store while both homes stay untouched.
- [x] 679 tests (2 new, covering the rename-to-null reset and that renaming
      one home touches nothing else), tsc clean, lint 18/19 (baseline).

### Terrace doors, a clickable logo, explicit L×W×H (2026-08-04)

- [x] **The mark and the PLANUM wordmark link to the dashboard**, the way a
      site's logo goes to its home page -- on the dashboard itself too
      (a logo that stops being clickable on one page is the sort of small
      inconsistency people notice without being able to name). On a home's
      floor plan only the *mark* links: the heading there is the home's own
      name, page content rather than the wordmark, so navigating away from
      it would be a trap.
- [x] **Item dimensions now say what they are**: `120×60×75 L×W×H` on the
      2D canvas, translated (`L×B×H` in German, since the initials follow
      Länge/Breite/Höhe). The tooltip stays for the full wording and the
      unit. Three bare numbers were ambiguous -- especially after the
      earlier change reordered the first two -- and a tooltip only answers
      the question once you think to hover.
- [x] **Terrace doors**, one- and two-leaf ("1-/2-flügelig"). A third
      `Opening.kind` rather than a wide window, because what defines one is
      that it's **bodentief**: it starts at the floor instead of on a 90cm
      sill, and you walk through it, so it swings and eats floor space.
      - **New `lib/openings.ts` is the single source of truth** for what
        each kind is dimensionally (window 90→210, door 0→200, terrace door
        0→210), which kinds swing, which are glazed, and the real-world
        widths. Those three heights used to be `const`s inside ThreeDView's
        per-wall loop, which was fine only while the 3D view was the only
        thing that knew an opening had a height -- now the 2D canvas, the
        dialog and the wizard all have to agree with it.
      - **2D**: glazing plus a door's leaf + swing arc; two mirrored arcs
        and a centre mullion when it has two leaves. The four hinge × swing
        arc cases were *parameterised by radius*, not re-derived -- their
        sweep flags are noted in LEARNINGS as not reasonable-out-able.
      - **3D**: the window branch was generalised rather than copied --
        with `sill: 0` there is simply no wall built under the pane, which
        is precisely what "bodentief" means. Plus a centre mullion for two
        leaves.
      - **Both creation surfaces**: the sidebar's Add Door/Window dialog
        (kind select → leaves toggle → width presets that change with the
        leaf count) and the guided wizard's openings step (third button,
        leaves toggle, ghost preview, per-opening presets).
      - `leaves` is optional and absent means one, so every room and every
        exported file that predates this keeps its exact meaning.
      - Verified live: all three symbols side by side in 2D (single arc vs.
        two mirrored ones), and in 3D the terrace doors' glazing reaching
        the floor with a visible mullion on the two-leaf one while the
        window sits up on its sill. Dialog checked end to end -- picking
        2 leaves swaps the presets 80/90/100 → 160/180/200 and sets the
        width to 180. 690 tests (13 new), tsc clean, lint 18/19 (baseline).
- [ ] Not done: terrace doors are refused on sloped walls like every other
      opening, and their height isn't validated against a low ceiling --
      same open item as the one below.

### Fixed: you could see straight through the walls when looking in through glass (2026-08-04)

User: *"when looking from the outside through a window or glass pane... the
walls inside the room in that direction of view do not display. Instead, you
look directly onto the endless grid lines void."* Long-standing, and the big
terrace-door glazing made it impossible to ignore.

- [x] **Root cause was a flag on the walls, not anything about the glass.**
      three.js builds the refraction seen through a `transmission` material
      from a render pass containing only the **opaque** list -- every
      transparent object is excluded by construction. The wall-fade loop set
      `mat.transparent = true` on every wall material on every frame,
      regardless of opacity, so *no wall existed at all* as far as any glass
      in the scene was concerned. What showed through a window was whatever
      was genuinely opaque behind it: the ground grid.
- [x] Walls (and ceilings) are now flagged transparent only while actually
      translucent. The glass pane itself stays transparent -- flipping it
      opaque would make windows solid.
- [x] **A second, hidden half of the same bug**: the opacity lerp only ever
      *approaches* its target, so a wall returning to solid sat at 0.997 for
      the best part of a second -- still counted translucent, still missing
      from every window. `settleOpacity` snaps the last few thousandths, so
      the transition actually ends.
- [x] Faded walls also stop writing depth now (`depthWrite = !translucent`),
      the same rule the ceiling already used -- writing depth while
      translucent hides whatever is behind instead of letting it show through.
- [x] New `lib/three-materials.ts` holds the two rules with the reasoning,
      so this can't be re-broken by someone "simplifying" a flag assignment
      in a render loop. 10 new tests, including one that runs the real lerp
      to completion and asserts it reaches exactly solid.
- [x] Verified against the **live scene graph**, not screenshots: 19 wall
      materials genuinely opaque where previously every one was transparent,
      glass still transparent, and the loop restoring correct values frame by
      frame (it undid a manual override). Then confirmed in a rendered frame
      from a viewpoint high enough that walls don't fade at all -- so
      anything visible inside a pane got there *through the glass* -- where
      the terrace door now shows the room's floor rather than the void.
      700 tests, tsc clean, lint 18/19 (baseline).
- **Worth knowing for next time**: the Browser pane here only paints
      intermittently, and two screenshots taken while it wasn't painting
      showed a stale pre-fix frame that looked like the fix had done
      nothing. The scene-graph query was what settled it -- exactly the
      "verify 3D against the scene graph, not a screenshot" rule already in
      LEARNINGS.

### An opening must fit its wall, + Homes phases 2 and 3 (2026-08-05)

**1. An opening that doesn't fit can't be built.** Terrace doors are 210cm
and wall height is user-editable down to 50, so nothing stopped a door
poking through the ceiling -- it renders as glazing floating above the wall
with no lintel over it. Blocked rather than warned (which is what too-tall
*furniture* gets): furniture merely stands in a room, an opening is a hole
in a wall.

- [x] One rule in `lib/openings.ts` (`openingFitsWall`, `requiredWallHeight`),
      enforced at all three places state can change: adding an opening,
      editing one, and lowering the wall height under existing ones. Each
      refusal names the numbers -- "needs 210 cm of wall — these walls are
      200 cm" -- because "doesn't fit" alone doesn't say what to change.
- [x] **Closed a bypass found while doing it**: `updateOpening` re-validated
      bounds and overlap when the wall changed but never re-checked whether
      the *new* wall was sloped, so the wall picker could move a door onto a
      knee wall that `addOpening` would have refused outright.
- [x] Only the user-facing setter is guarded. Undo/redo restore and file
      import call the raw setState: they replay a state that existed as a
      whole, and validating one field of it in isolation would corrupt
      history. The 3D view clamps defensively instead, so an imported file
      (which never passes through the UI) can't render a floating pane.
- [x] **Fixed a lie the new refusal exposed, in a shared primitive**:
      `NumberField` keeps a local draft and only re-synced it when `value`
      *changed* -- so a rejected (or clamped-to-the-same-number) commit left
      the field displaying what you typed while the app held something else.
      It now re-syncs after every commit, which fixes it for every numeric
      field in the app, not just this one.

**2. Homes Phase 2 -- home-level export/import.** Export/import was
floor-scoped inside a home; a whole home couldn't leave the app.

- [x] New "This home" scope exports `{ name, floors }` -- the one shape that
      round-trips a home somewhere else. No id in the file: an imported home
      either replaces one (which keeps its own id) or becomes a new one.
- [x] New `parseImportedHome` accepts **four** generations, so nothing
      anyone ever exported stops working: a home export, a `{floors, ...}`
      bundle, a bare `Floor[]`, and a pre-floors `RoomLayout[]`. Only the
      first carries a name; the rest become un-named homes.
- [x] **"From a file" on the dashboard** creates a *new* home from any of
      those, with `withFreshIds` re-minting floor and room ids -- without it,
      importing the same file twice leaves two homes sharing room ids and
      anything resolving a room id across homes lands on whichever it finds
      first.
- [x] Importing "This home" over an existing home replaces its floors *and*
      its name; a file with no name of its own leaves the current name alone
      rather than blanking it.

**3. Homes Phase 3 -- copy pass.** Export/import dialogs now say "Export
from this home" / "Import into this home" (they offer three scopes, not just
floors), with a scope-aware success toast. Removed the header's dead
"Floor Plans" button -- `roomsUrl` had not been passed since the back-pill
replaced it, so its stale wording never rendered -- plus its now-unused
imports and the orphaned `backToRooms` string.

- [x] Verified live: adding a terrace door to a 200cm room is refused with
      the exact message and saves nothing; lowering a 240cm room with a
      210cm terrace door in it is refused, the field snaps back to 240, and
      a *valid* change to 260 still commits. Home export produces
      `{name, floors}` named "Ferienhaus" as `ferienhaus-2026-08-05.json`;
      importing it from the dashboard creates a second home with the name
      preserved, **fresh ids (no collision)** and the original untouched;
      importing a renamed copy over a home renames it live. 717 tests
      (23 new), tsc clean, lint 18/19 (baseline).

### My Catalog now saves height and elevation (2026-08-05)

User: *"When saving custom items to your catalog, it doesn't save the value
for the height... there are actually four key values: width, length, height,
and elevation."* Correct, and the cause ran deeper than the dialog: **four
separate links in the chain dropped the value**, so fixing only the dialog
would have looked fixed and still come back wrong.

- [x] **The dialog** only ever collected name/width/length/color. It now
      shows all four measurements, pre-filled from the item -- the user's
      option 2, chosen because it subsumes option 1 (just pressing Save
      stores all four) while making visible what's about to be baked in.
      That matters most for height, which is usually *inherited* from the
      source preset rather than set explicitly.
- [x] **The seeding**: the draft carries the item's *effective* height and
      elevation -- the same two numbers the Inspector displays, resolved
      defaults and `resolveEffectiveElevation` included -- so an item whose
      height comes from its preset can't open the dialog with a blank field.
- [x] **The stored shape**: `CustomCatalogItem.h` existed but was documented
      and used as IKEA-only; `elevation` didn't exist at all. Added, bounded
      in the schema like every other user-supplied dimension (My Catalog has
      its own JSON import), both optional so every entry saved before this
      behaves exactly as it did.
- [x] **The converter**: `customCatalogItemToPreset` read `elevation` *only*
      from the base preset, so a saved value would have been ignored even
      once stored. Now `item.elevation ?? base?.elevation`, matching how `h`
      already worked -- the saved entry outranks the preset it started from.
- [x] **The drop path**: `addPreset` derived elevation purely from the layer,
      consulting `preset.elevation` for wall items only -- so the saved
      number was read out of storage and then discarded at the very last
      step. Now `preset.elevation ?? <layer default>`. Zero change for
      built-ins: all 23 presets that set an elevation are wall items, which
      already took that path.
- [x] Verified end to end in the browser, against `localStorage` at each
      step: a sconce customised to 44 cm tall at 205 cm elevation (its preset
      says **18 / 160**) opened the dialog pre-filled with 140/90/44/205,
      saved as `h: 44, elevation: 205`, and dropped back into the room as a
      44 cm item at 205 cm rather than reverting to the preset's numbers.
      722 tests (5 new), tsc clean, lint 18/19 (baseline).

### Fixed: a resized kit model turned into a cube (2026-08-05)

User: *"I changed the height [of a HEMNES Bed Queen] from the 'real' 66cm to
112cm, it showed a cube in 3d instead. couldn't the model scale properly?"*
Two independent defects, and it took both to produce that cube.

- [x] **The rule conflated "big" with "distorted".** `resolveRenderMode`
      checked each axis's absolute drift from the preset default against
      [0.7, 1.5] and fell back to a box if any one was outside. But scaling
      all three axes by 1.7 doesn't distort a mesh at all -- it's the same
      bed, larger. What actually looks wrong is one axis stretched while
      another isn't: the pinched-oval round table the fallback was written
      for. Now it measures **disproportion** (`max(ratio)/min(ratio) < 2`),
      so a uniform scale always renders and a single axis may stretch to
      just under double. A 1.5x-wide/0.7x-deep table is 2.14 and still falls
      back, so the case the guard exists for is untouched.
- [x] **The drift was measured against the wrong yardstick.** An IKEA entry
      and the generic preset it borrows its mesh from share an `icon`, so a
      HEMNES Queen (167x213x**66**) was judged against `bed-double`
      (160x200x**45**) -- putting it at **1.47x on height the moment it was
      placed**, one hundredth under the old 1.5 cap, for a reason invisible
      to the user. Any nudge upward tipped it over. Items now record the
      size they came out of the catalog at (`Item.catalogDims`, optional,
      set in `addPreset`, bounded in the import schema).
- [x] **Items placed before this** carry no such record and it can't be
      recovered (the icon is shared), so rather than measure them against a
      yardstick known to be wrong for exactly the items this hurts, they get
      the benefit of the doubt and render their model. A stretched model
      still shows what the thing is; a box shows nothing.
- [x] **Found while checking the blast radius**: two IKEA entries were
      falling back to a box *at their own shipped size* for the same reason
      -- **HEMNES Daybed** and **MARKUS Chair** now render their real models
      without anyone touching them.
- [x] Verified against the live scene graph (a screenshot can't tell a
      stretched bed from a box): three beds side by side -- the reported
      112cm case, an untouched 66cm control, and a legacy item with no
      recorded size -- all render 7 real model meshes and **zero**
      `BoxGeometry`, at measured heights of 112 / 66 / 112 cm. 724 tests
      (5 new), tsc clean, lint 18/19 (baseline).

### Fixed: the three tasks planned in HANDOVER.md (2026-08-21)

HANDOVER.md is now deleted per its own instructions; this is the durable
record. All three were grounded in code that already existed, as the
handover said.

- [x] **Point-in-polygon furniture clamping.** `clampPos`
      (`planner-math.ts`) keeps the exact old bounding-box formula as a
      fast path for every 4-corner room (asserted byte-identical against
      the pre-fix formula for every rotation/position, not just spot
      checked). For a polygon room (L/T/U), it now insets the polygon by
      half the wall thickness and accepts a position if the item's rotated
      AABB has all four corners on that inset floor -- deliberately a
      "corners on floor" test rather than "fits inside one decomposed
      rectangle", so an item spanning two arms of an L legitimately places.
      Otherwise it clamps into the nearest-fitting rectangle from a new
      `rectilinearPolygonSpanRects` (merges adjacent grid cells into
      *maximal* rectangles, so a 150cm sofa fits into a T-room's bar even
      though the stem's walls slice that bar into ~133cm cells), falling
      back to the old bounding-box result if the item fits nowhere at all
      -- a drag that silently does nothing reads as a broken app. 9 new
      tests (byte-identical rectangle behavior, L/U-notch ejection,
      cross-cell spanning, the fits-nowhere fallback, and the documented
      corner-test permissiveness); 733 tests total, tsc clean, lint at
      baseline (18/19 in `src/`).
- [x] **Measurements / shopping-list export.** New `lib/measurements.ts`
      (`measureItems`/`measureRoom`/`measureHome`), pure and DOM-free,
      groups items by name + dimensions rounded to whole cm (matching the
      Elements list's own display precision) and reuses
      `item.height ?? getDefaultHeight(...)` -- the same fallback the
      canvas, Elements list, 3D view and slope check already use, so this
      is a fifth reading of "how tall is this" that cannot disagree with
      the other four. New `MeasurementsDialog` (on-screen table, copy as
      text, download CSV) reachable from the room editor's More menu (this
      room) and the home page's More menu (every room across every floor,
      headed by room name, floor-qualified only when a home has more than
      one floor -- so two same-named rooms on different floors can't get
      silently merged). Caught and fixed a real bug while verifying in the
      browser: the copy button had no try/catch around
      `navigator.clipboard.writeText`, so a denied clipboard permission
      failed silently (an uncaught promise rejection, no feedback) instead
      of telling the user it didn't work -- now shows an error toast.
      11 new tests; 744 tests total.
- [x] **Unseeded texture noise.** Both generators in `ThreeDView.tsx` (the
      256x256 side texture and the inline aspect-sized top-face one) now
      draw from `mulberry32` seeded by `type`+`color` -- a small FNV-1a
      `hashSeed` turns that string key into the numeric seed mulberry32
      needs -- instead of `Math.random()`, so grain no longer reshuffles on
      a rebuild and two identical items share one pattern. The side texture
      is cached by `${type}|${color}` (never disposed, same precedent as
      `tintedMaterialCache`: a small, bounded, session-lifetime set, and
      nothing in this file's cleanup ever calls `.map.dispose()` on a
      material's texture anyway). One thing the handover didn't flag:
      the call site sets `.repeat` from the item's own width/length, which
      varies between items that share a cache key (a 160cm oak desk and a
      40cm oak side table) -- mutating the shared texture's `.repeat`
      directly would have made whichever item rendered last win for every
      other item on screen. Fixed by returning a `.clone()` of the cached
      texture (cheap: shares the already-drawn canvas image, no redraw) so
      `.repeat` stays per-item while the expensive/nondeterministic canvas
      drawing itself is genuinely shared. Verified against the live scene
      graph, not a screenshot (per LEARNINGS): patched the page's
      `HTMLCanvasElement.prototype.getContext` to prove zero new 256x256
      canvases get drawn across a full scene rebuild triggered by an
      unrelated state change (toggling name labels) -- every item's side
      texture came from the cache, so there was no `Math.random()` call
      left to reshuffle anything. tsc clean, lint at baseline; no unit test
      added (no helper in this file has ever had one -- see
      `darkenColor`/`lightenColor`/`subtractOpenSpans` -- the codebase's
      convention is browser/scene-graph verification for this file, lib
      unit tests for `lib/*.ts`).

### Still open
- [ ] Roof windows (*Dachfenster*) -- openings on a sloped wall remain unsupported entirely, now enforced on both the add and the edit path rather than just the add.
- [ ] Lighting with the ceiling on is a flat ambient boost, not a real relight. Fine as a toggle; worth revisiting if the ceiling ever becomes the default.
- [ ] **Product call on the tour's auto-open**: every dashboard creation path marks `TOUR_KEY` seen at creation time (deliberately -- it used to ambush freshly-created rooms), so a brand-new user who creates a room from the dashboard now *never* sees the tour automatically. It only auto-fires for someone who reaches a room without creating it. Reachable on demand from the Header's More menu and both Settings dialogs. Worth deciding whether new users should get it another way -- e.g. offering it once on the dashboard itself rather than inside a room.
- [ ] The canvas's floating Room Inspector can overlap the bottom-left back pill at shorter viewport heights (~720px). Pre-existing on both room routes -- not introduced by any recent change, but now more visible since the back pill is a single room's main way out.
- [ ] Pre-existing duplicate apartment floors from before the placement fix aren't cleaned up retroactively -- they're just ordinary floors inside the migrated home now, deletable from the floor switcher.
