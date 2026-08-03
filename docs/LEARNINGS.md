# Engineering learnings

Working notes on the trickiest parts of this codebase: the collision/geometry math,
how 2D and 3D placement relate to each other, the canvas rendering hacks that
weren't obvious the first time, and the one performance fix that mattered most.
Written so a future session (human or Claude) doesn't have to re-derive any of
this from scratch.

For "what exists and where," read the code — it's commented in-place and the
file/component names are descriptive. This doc is for the _why_, especially the
parts where the obvious approach doesn't work.

## Coordinate systems

Everything in `types/planner.ts`, `planner-math.ts`, and the 2D canvas works in
plain **room-centimeters**: `x`/`y` with the origin at the room's top-left
corner, `y` growing downward, matching screen coordinates. Room polygons are
just an ordered `Point[]` of corners. A rectangular room is `corners = [top-left,
top-right, bottom-right, bottom-left]`, always wound clockwise on screen — every
later generalization to non-rectangular rooms (see "Polygon rooms" below)
depends on that winding direction staying consistent.

The 2D canvas (`CanvasArea.tsx`) converts room-cm to screen pixels with a single
`cm(value) => value * scale` function threaded through as a prop, so zooming is
just changing `scale` — none of the geometry math ever needs to know about
pixels.

The 3D view (`ThreeDView.tsx`) uses a **different, Three.js-native coordinate
system**: X/Z is the ground plane (Y is up), and the room is centered on the
origin rather than starting at (0,0). Every conversion from a room-cm point
looks like `x - roomW / 2`, `z = y - roomL / 2` (note: room-cm `y` becomes
Three.js `z`). This center-based coordinate choice is what makes `OrbitControls`
orbit around the room's actual middle instead of one corner.

## Item layers and elevation

Items have a `layer: "under" | "main" | "on-top"` and an `elevation` (cm above
the floor). This is a purely additive system layered on top of ordinary
`x`/`y`/`width`/`length`/`rotation` — nothing about placement changes, only how
an item interacts with collision and z-order:

- **Collision** (`collidesWithOthers` in `planner-math.ts`) only ever considers
  `main`-layer items, on both sides of the comparison. `under` items (rugs) and
  `on-top` items (lamps, TVs) never block anything and are never blocked.
- **2D stacking order** (`CanvasItems.tsx`) is `under` (opacity 0.55) → `main`
  (opacity 1) → `on-top` (opacity 0.92), with the selected item always boosted
  above all three tiers so it's never hidden mid-drag.
- **3D placement** uses `elevation` directly as the mesh's base Y position
  (`itemMesh.position.y = itElev + itHeight / 2`), so an on-top item just floats
  at the right height — no special-casing needed once elevation is correct.
- **Auto-elevation on drop** (`findOnTopHost` / `computeOnTopElevation`): when
  an on-top item is dropped, its footprint is tested against every `main` item
  it now overlaps, and it snaps to the _highest_ top surface among them (`host.
elevation + host.height`), so it visually rests on whatever it was dropped
  onto instead of keeping a stale/arbitrary elevation.

`shape: "rect" | "circle"` follows the identical pattern — it's a rendering
choice only (inscribed ellipse in 2D, `CylinderGeometry` in 3D). Collision
always uses the rectangular OBB footprint regardless of visual shape; adding
true circle-vs-circle or circle-vs-rect collision was never worth the
complexity for a floor planner.

### `placedOnId`: an explicit, ID-based alternative to auto-elevation-on-drop

The auto-elevation-on-drop mechanism above (`findOnTopHost`/`computeOnTopElevation`)
is purely geometric and one-shot: it only fires for `on-top`-layer items at the
moment they're dropped, and it never stores *which* item they landed on — so
if the host is dragged away afterward, whatever was "resting" on it just stays
behind at a now-stale elevation. `Item.placedOnId?: string` (added 2026-07)
is a deliberately separate, complementary mechanism for the case that gap
leaves open: any item, regardless of its own layer, explicitly pinned to
another item by id, that keeps tracking it afterward. Two are allowed to
coexist because they don't actually fight — `placedOnId` wins outright at
render time (see below), and the auto-settle logic simply never touches an
item outside the `on-top` layer.

- **Elevation is derived, never stored, while attached.** `resolveEffectiveElevation(item,
  allItems)` (`lib/planner-presets.ts`, re-exported from `ThreeDView.tsx`
  alongside `getDefaultHeight`) recomputes `host.elevation + host.height` fresh
  on every call rather than writing it back onto the attached item. This is
  the whole reason resizing a host doesn't require any sync step elsewhere —
  there's nothing to keep in sync. The item's own `elevation` field is simply
  ignored for rendering as long as `placedOnId` resolves to a real item; it's
  only read again if the host is later removed (at which point `removeItem`/
  `removeSelected` in `use-room-planner.ts` reset it to `0` on detach).
- **Position, unlike elevation, IS written directly.** `onItemPointerDown`
  widens the set of dragged ids to include anything whose `placedOnId` points
  at an item already being dragged, right before capturing each one's
  `startPos` — the existing per-id move loop in `onStagePointerMove` needed no
  changes at all to pick this up, since it was already generic over "whichever
  ids are in this drag batch."
- **Collision exemption is symmetric.** `collidesWithOthers` skips a
  candidate/other pair if *either* one's `placedOnId` points at the other —
  checked both directions, since the same function is used both to test a
  child's candidate position against its host and (via the widened drag
  batch above) a host's candidate position against its already-placed child.
- **No rotation-following.** Dragging a host moves its attached children by
  the same position delta; rotating a host does not rotate what's attached to
  it. A deliberate scope cut, not an oversight — revisit only if actually
  requested, since correct rotation-around-host-center math is real
  additional complexity for a feature nobody's asked to extend yet.

## Collision detection (SAT/OBB)

`obbCorners` rotates an item's four corners by its `rotation` about its own
center. `obbOverlap`/`obbOverlapDepth` then run the **Separating Axis Theorem**
against both shapes' edge normals (only 4 axes total, since both shapes are
rectangles — this does _not_ generalize to arbitrary polygons, see below): if
there's a gap along any axis, the shapes don't overlap; if there's no gap along
any of the 4 axes, they do. `obbOverlapDepth` additionally tracks the smallest
overlap across all axes, which is the minimum-translation-vector depth (used
nowhere yet, but there for anything that wants to push-apart rather than
block-and-report).

This is the standard 2D SAT algorithm, but the one thing worth remembering:
**it only needs 4 axes because both shapes are rectangles.** If this ever needs
to collide against a true N-gon (e.g. the exact concave outline of an L-shaped
hallway, not its bounding box), the axis loop has to run over _all_ of both
polygons' edges, not just 4.

### Why polygon rooms use a bounding-box approximation, on purpose

Hallway rooms (see "Polygon rooms" below) have a genuinely concave outline, but
`clampPos` and `findFreeSpot` in `planner-math.ts` both clamp furniture to the
room polygon's **bounding box**, not its exact shape. For a plain rectangle this
is exact (a rectangle's bounding box _is_ the rectangle). For an L or T shape,
it means it's technically possible to drag an item into the notch — the empty
corner that isn't actually part of the hallway's floor. This was a deliberate
scope decision, not an oversight: real point-in-polygon clamping (projecting a
clamped position back onto the nearest point _inside_ a concave polygon) is
meaningfully harder, and hallways are narrow enough in practice that the notch
case rarely comes up. If it ever needs fixing, `insetRectilinearPolygon` (see
below) already contains the per-corner inward/outward normal math that a real
fix would build on.

### Swept collision resolution (no tunneling)

Room dragging in the multi-room overview doesn't just clamp+collide the final
pointer position — it uses `resolveSweptMove` in `planner-math.ts`, which
**binary-searches along the straight-line path** from the drag's last known-good
position to the new target. This exists because a single `pointermove` event can
carry a large delta (fast mouse movement, or a low zoom level where a few
screen pixels are many room-cm) — testing only the endpoint would let a room
"tunnel" straight through a thin obstacle between the two points. If the direct
target is blocked, it falls back to sliding along a single axis (still swept the
same way), so a diagonal drag toward a neighboring room slides flush along its
face instead of stopping dead the instant either axis touches something.

### The stale-closure trap in drag handlers

The multi-room drag handler (`onRoomPointerMove` in `MultiRoomCanvas.tsx`) does
all of its collision reads _and_ writes inside a single `setRooms(prev => ...)`
functional updater, never against the `rooms` value captured in the component's
closure. This mattered because React 18 batches pointer events: several
`pointermove` handler invocations can fire before a re-render happens, and if
each one reads the same stale `rooms` closure, they all resolve their collision
independently against the same starting snapshot instead of each one building
on the last — visually this showed up as room drags "skipping" or ignoring
newly-moved obstacles mid-drag. Reading and writing through the updater
function fixes it because each call in the batch sees the previous call's
result. The single-item drag path in `use-room-planner.ts` follows the exact
same rule for the same reason. Anywhere a drag handler needs to read
possibly-just-mutated state to decide what to do next, prefer the functional
updater over the closed-over prop/state value.

## Polygon rooms (hallways)

Added to support L/T-shaped hallways (`src/lib/hallway-shapes.ts`). The
implementation is a **true single polygon** — a hallway room is just a
`RoomLayout` with `corners.length > 4` instead of a special-cased shape type —
which is what allows every existing rectangular-room code path (item placement,
2D rendering, 3D extrusion, multi-room thumbnails) to be _generalized_ into a
shared loop instead of forked into a parallel implementation. The rectangular
(4-corner) path is left completely untouched everywhere; polygon rooms are
purely additive branches.

**Wall indexing.** Wall `i` is the segment from `corners[i]` to
`corners[(i+1) % corners.length]`, always walked forward (the same clockwise
winding the corners themselves are authored in). This is deliberately
_different_ from the legacy named-wall convention, where `"bottom"` and
`"left"` happen to be measured in the _reverse_ of forward-winding order (an
old quirk, preserved as-is in `resolveWallSegment`'s string branch rather than
"fixed," since fixing it would require migrating every already-saved
rectangular room's data). Numbered walls never have this problem because
they're a new convention introduced alongside the hallway feature, so they
could be defined cleanly from the start.

**Rotation.** `rotatePolygonCorners` rotates every corner 90° about the
polygon's own bounding-box center. This is provably identical, for a rectangle,
to the legacy "swap width and length" rotation — both produce a new bounding
box with width/height swapped, still centered at the same point, which is true
of _any_ point set under an exact 90° rotation about its own bounding-box
center, not just rectangles. That's what makes it safe to generalize: rotating
any polygon this way keeps wall index `i` referring to the same logical wall
(just moved), so openings never need their `wall`/`position` remapped when a
room rotates — only the corner coordinates change.

**Miter joints reduce to a constant.** The precise wall-corner miter formula is
`halfThickness / sin(interior angle)` (still used as-is for rectangular rooms
in `ThreeDView.tsx`, since a rectangle's corners can, in principle, be dragged
to non-right angles via corner-dragging). Hallway shapes are built exclusively
from 90°/270° corners by construction, and `sin(90°) = 1`, `|sin(270°)| = 1` —
so the general formula always reduces to exactly `halfThickness` for every
corner in a hallway, convex or reflex. That means a flat "extend every wall by
`halfThickness` at both ends" is _exact_ for these shapes, not an
approximation, and sidesteps needing a convex/concave sign convention for an
arbitrary N-gon.

**Insetting a concave outline.** `insetRectilinearPolygon` draws the "thick
wall" outline for a hallway's thumbnail by, at each corner, summing the two
adjacent walls' inward unit normals. For a convex corner this pushes the point
diagonally into the solid; for a reflex (notch) corner the same formula pushes
it diagonally _outward_, correctly "opening up" the notch instead of collapsing
it. It only works because every corner is 90°/270° — general polygon insetting
(mitered offsetting) needs to know the corner angle to get the right magnitude,
which this deliberately avoids by only ever supporting rectilinear shapes.

**Camera fade for polygon walls.** The 3D view fades out walls between the
camera and the room interior so the camera doesn't feel boxed in. For
rectangular rooms this is 4 hardcoded axis-aligned checks (`side === "top" &&
camZ < -roomL * 0.1`, etc.). Polygon rooms instead use a generic per-wall test:
each wall's outward normal (`{x: dz/length, z: -dx/length}`, derived from the
forward-winding convention) dotted against the vector from the wall's midpoint
to the camera. A positive dot product means the camera is on the outward side
of that wall, i.e. it's between the camera and the room — fade it. This
generalizes to any number of walls without hardcoding names.

## The toughest canvas/rendering hacks

**Door swing SVG paths.** A door's swing arc in the 2D canvas
(`CanvasOpenings.tsx`) depends on two independent booleans — `hinge: "start" |
"end"` and `swing: "in" | "out"` — giving 4 combinations, each needing a
different SVG `M`/`L` (door leaf) and `A` (arc) path in the opening's own
_local, rotated_ coordinate frame (the whole opening `<div>` is rotated to the
wall's angle via CSS `transform`, so the SVG paths themselves only ever need to
handle "wall running left-to-right locally"). Getting the arc's sweep-flag
(`0` vs `1` in the `A` command) right for all 4 hinge×swing combinations was
the fiddliest part — it's not derivable by pattern, it had to be worked out
case by case and is now hardcoded as an explicit 4-way branch rather than
computed, because computing it generically was more error-prone than just
enumerating the 4 cases.

**Three.js material face-index mapping (box vs. cylinder).** Item meshes in 3D
carry a name/dimensions label texture on their _top_ face only, via a material
array. `BoxGeometry`'s default material groups are `[+x, -x, +y(top), -y
(bottom), +z, -z]` — the top face is **index 2**. `CylinderGeometry`'s groups
are `[side, top, bottom]` — the top face is **index 1**. These two orderings
don't line up, so the code branches on `isCircle` to build the material array
in the right order for whichever geometry the item is using
(`[sideMat, topMat, sideMat]` vs. `[sideMat, sideMat, topMat, sideMat, sideMat,
sideMat]`). Get this wrong and the label silently ends up on a side face or the
bottom instead of erroring — worth remembering next time a new geometry type is
added here.

**Procedural canvas textures.** Materials for wood/fabric/plant/rug surfaces
are generated at runtime by drawing directly onto an off-screen `<canvas>` with
2D canvas APIs (wavy `lineTo` strokes for wood grain, a cross-hatch grid for
fabric weave, randomized speckles for plant/rug), then wrapped as a
`THREE.CanvasTexture`. No texture image assets exist anywhere in the project —
every material's visual detail is code. This keeps the app dependency- and
asset-free, at the cost of the texture logic itself being the "asset" that has
to be tuned by eye (line spacing, wave amplitude, speckle density) rather than
swapped out.

**Named vs. numbered wall lookups, centralized.** Before hallways existed, four
separate places (`CanvasArea.tsx`, `CanvasOpenings.tsx`, `MultiRoomCanvas.tsx`,
and `ThreeDView.tsx`) each had their own hand-copied 4-branch if/else chain
mapping a wall name to its two corner points. Adding numbered walls meant
either copying a 5th branch into all four places or centralizing — chose the
latter (`resolveWallSegment` in `hallway-shapes.ts`), which is also what made
it easy to preserve the "bottom/left are reversed" quirk in exactly one place
instead of four.

## Performance: the floating Inspector panel drag

The Inspector (`CanvasArea.tsx`, `onInspectorHeaderPointerDown`) is a
draggable, floating panel positioned via React state (`inspectorPos`). The
naive approach — call `setInspectorPos({x, y})` on every `pointermove` — was
visibly laggy: every state update triggers a full React re-render of the
component (and everything under it, since `inspectorPos` was read in the JSX
`style` prop), and pointer events can fire faster than the browser's paint
cycle, so renders piled up behind the mouse.

The fix moves the _visual_ update off React's render cycle entirely during the
drag:

- On `pointermove`, the raw DOM element's `style.transform =
translate3d(x, y, 0)` is mutated **directly** — no `setState`, no re-render.
- `translate3d` (not `left`/`top`) is used specifically because it's
  GPU-composited and doesn't trigger layout/reflow.
- Writes are batched to at most one per animation frame via a `rafId` guard: a
  new `requestAnimationFrame` is only scheduled if one isn't already pending,
  so a burst of `pointermove` events collapses to one DOM write per frame
  instead of one per event.
- `panel.style.transition = "none"` is set for the duration of the drag so the
  panel's normal CSS transition doesn't fight the per-frame transform writes
  (animating toward a target that's still moving looks like stutter).
- `document.body.style.cursor = "grabbing"` / `userSelect = "none"` are set
  globally for the drag's duration, restored on release, for standard
  drag-affordance UX (prevents text selection while dragging, keeps the cursor
  consistent even if the pointer momentarily leaves the panel).
- React state (`setInspectorPos`) is only written **once**, on `pointerup` —
  so React's render tree stays in sync with the final position without ever
  being asked to keep up with the drag in real time.

This pattern — direct DOM mutation + rAF batching during a drag, single state
commit on release — generalizes to any UI element that needs to visually track
the pointer at 60fps but doesn't need React to know about every intermediate
position. It's _not_ used for item/room dragging on the canvas, because those
already read/write position through refs and only commit through history on
release in a similar way, and their visual update is a `style.left`/`top` on a
much simpler absolutely-positioned `<div>` without the panel's transition/
cursor/userSelect side effects to manage.

## UI pattern: draft-string number inputs

`components/ui/number-field.tsx`'s `NumberField` exists because a plain
`<input type="number">` bound directly to a clamped numeric value (`value={w}
onChange={e => setW(Math.max(50, parseInt(e.target.value) || 0))}`) fights the
user on every keystroke: clearing the field to retype re-parses the empty
string as `0`/`NaN` and immediately snaps back to the minimum, so the field can
never actually be emptied. `NumberField` keeps the in-progress text as local
`draft` state (a string, so it can be empty or `"12."` mid-type) and only
parses/clamps/commits on blur or Enter. Used everywhere a numeric field needs
free typing — room width/length, item dimensions, opening position/width.

## Testing and verification, in this environment

This sandbox has no working dev server (native binaries in `node_modules` are
built for a different platform than the sandbox runs), so there is **no visual
verification available** — no screenshots, no browser. Every change is verified
three ways instead:

1. `npm test` — a dependency-free Node test harness (`node
--experimental-strip-types`, `tests/support/register.mjs` as a custom ESM
   loader) covering the math/geometry modules directly (`planner-math.ts`,
   `hallway-shapes.ts`, `multi-room-actions.ts`, etc.) with plain `node:test` +
   `node:assert/strict` — no test framework dependency.
2. `npx tsc --noEmit -p tsconfig.json` for type-checking.
3. `npx eslint <changed files> | grep -v "prettier/prettier"` — the repo has
   several hundred pre-existing prettier-only formatting violations that are
   out of scope to fix opportunistically, so every lint pass filters those out
   and, when in doubt, diffs the remaining (non-prettier) error count/locations
   against a `git stash`'d baseline to prove a change introduced zero new
   issues.

Given no visual verification is possible, be conservative about touching
rendering code that "should" be equivalent — prefer additive branches (`if
(isPolygonRoom) { ...new path... } else { ...untouched original... }`) over
rewriting an existing, working rendering path, so a mistake in new code can't
silently break the common case.

**This constraint is specific to a locked-down cloud sandbox, not universal.**
Confirmed 2026-07-26 running via Claude Code directly on a developer's own
Mac: `npm run dev` (Vite) works normally, and the Browser tool
(`mcp__Claude_Browser__*`) can drive a real instance of the app — screenshots,
console/network inspection, viewport resizing (e.g. to check the mobile
`useMobileViewOnly` breakpoint), the works. Check which environment you're
actually in before assuming visual verification is off the table; when it
isn't, use it — it caught things the three checks above can't (e.g. confirming
a double-click handler's mobile-only guard actually left the user on the
right screen, not just that it compiled).

### When the browser _is_ available, four things that cost real time

- **Test first-run flows against a genuinely empty browser profile.** Existing
  localStorage masks exactly the bugs that only bite new users. Verifying an
  onboarding change against a profile that already had data hid a tour that
  ambushed freshly-created rooms, a floor that never got selected, and the
  hydration bug described above — all of which showed up immediately on a
  cleared profile.
- **Assert against `localStorage`, not the UI.** For anything about *where data
  landed*, read the actual keys via `javascript_tool`. That's what proved the
  single-room flows create zero floors, and what caught the example apartment
  stacking itself onto an upper storey while the screen looked perfectly fine.
- **`screenshot` returns a scaled image** (e.g. 800×450 for a 1280×720
  viewport) that does not map 1:1 to click coordinates. For anything needing
  precision, query the DOM (`element.getBoundingClientRect()`) instead of
  eyeballing pixels. Cached element refs also go stale after a layout shift —
  re-read the page rather than trusting the last set.
- **A drag that "does nothing" may be a guard doing its job.** Check
  before/after DOM state before concluding an interaction is broken; a
  wall-drag that was being correctly rejected for shrinking the room below the
  minimum looked identical to a click that never registered. Similarly, a
  long-lived tab's console history isn't evidence of current state — HMR leaves
  stale errors for identifiers deleted two edits ago. Hard-reload before
  believing one.

## A room persists two different ways, and which one is never guessed

A `RoomLayout` lives in one of two entirely separate stores:

- **Inside a `Floor`** — `lib/floors.ts`, key `planner-multi-floors`, edited at
  `/rooms/$roomId`, aware of its sibling rooms for wall-adjacency purposes.
- **Standalone** — `lib/single-rooms.ts`, key `planner-single-rooms`, a bare
  `RoomLayout[]` with no `Floor` wrapper, edited at `/room/$roomId` (singular).

This split exists because for a while it didn't. Every "single room" the
dashboard created was quietly wrapped in a one-room `Floor` and appended to the
multi-floor array, which meant a standalone room showed up in the floor
switcher as its own storey, got a "Back to Overview" button into the multi-room
UI, and added another floor to the list every time someone made one. The two
concepts were the same data and the same route, and users felt it.

The load-bearing decision is that **nothing infers which store a room is in.**
An explicit `RoomSource` ("floor" | "single") is threaded through
`useRoomPlanner(roomId, source)`, `RoomEditor`'s prop, and `LastActiveTarget`'s
`"room"` vs `"single-room"` variants. The tempting alternative — look the id up
in one store and fall back to the other — silently picks the wrong backend the
moment the two disagree, and the route always knows the answer for certain
anyway. Don't add a "search both stores" helper; that's the conflation coming
back.

Two consequences worth knowing before touching this:

- **Both routes render the same `components/planner/RoomEditor.tsx`.** The
  routes are ~8 lines each and differ only in `source`; everything that varies
  with it (which store, which `lastActive` variant, where the back pill points
  and what it says) is derived *inside* the editor, so a route can't
  accidentally pair one system's storage with the other's navigation. Edit the
  editor, not the routes.
- **New standalone-room entry points must go through `useCreateSingleRoom()`.**
  It saves to the right store, marks the onboarding tour seen, and navigates to
  `/room/$roomId`. The three creation flows each did this inline once and had
  already drifted apart — only one of them also set an active floor — which is
  exactly the class of bug a shared hook prevents.

A related placement rule: **the apartment example is a *ground floor*, not "a
floor."** `CreateFloorFlow`'s example path writes into floor index 0 (confirming
first if that floor already has rooms); only "from scratch" appends. When it
appended, the example arrived as "1st Floor"/"2nd Floor" and two clicks left
duplicate apartments stacked on different storeys. Relatedly, don't treat
`lib/default-apartment.ts`'s long decimal coordinates as arbitrary noise to
tidy up — they're the user's own hand-dragged positions, re-imported verbatim.

## One-shot state seeded from localStorage needs a hydration gate

`useSettings()` starts at `DEFAULT_SETTINGS` (an SSR-safe placeholder) and only
reflects the real stored value after its own effect fires. Anything that seeds
*other* state from a setting exactly once — `use-room-planner.ts` applying
`defaultView`/`defaultZoom`/`collisionDefault`, say — has to wait for the
`hydrated` flag to flip true rather than reading `settings` directly. A
`useState` initializer or one-shot effect runs once and only once, so reading
too early bakes in the placeholder permanently and the setting appears to do
nothing at all. This was a real bug, found only because a fresh browser profile
was used for testing.

The same "first mount is special" trap applies to the onboarding tour:
`useRoomPlanner` auto-opens it the first time it ever mounts, regardless of how
the user got there. Every deliberate room-creation path therefore marks
`TOUR_KEY` as seen at creation time, or the tour covers the very room the user
just asked to build.

## Live-editable shapes in an SVG viewBox

Two non-obvious rules, both learned by shipping the violation first, in the
guided room-shape wizard (`RoomShapeCanvas.tsx`, `lib/room-shapes.ts`):

1. **Never derive the `viewBox` from the shape being edited.** Recomputing it
   from the live corners on every drag frame makes the whole canvas visibly
   rescale in lockstep with the drag, because the rendered size is fixed while
   the coordinate space moves. `computeStableViewBox()` is computed once, from
   the *starting* shape, generously padded, and held fixed for the rest of the
   session.
2. **Stabilizing the viewBox doesn't stabilize anything sized from the live
   shape.** `vector-effect="non-scaling-stroke"` keeps stroke widths constant
   at any viewBox scale, but there is **no SVG equivalent for `font-size`** —
   dimension labels kept growing and shrinking during drags even after fix (1),
   because their `fontSize` was expressed in viewBox units derived from the
   live bounding box. Text that must stay a constant on-screen size has to be
   plain HTML, absolutely positioned and percentage-mapped into the stable
   viewBox, not SVG `<text>`.

Two more, learned when the 8-corner T and U shapes arrived (2026-08-03):

3. **Local drag guards do not add up to a valid polygon.** `dragWallEdge`
   checked three things, all local: the dragged wall is still long enough,
   neither neighbour inverted, the bounding box didn't collapse. A U-shape's
   notch ceiling pushed far enough satisfies all three while the polygon folds
   through itself — its own length never changes, both its side walls merely
   get *longer*, and the bounding box *grows*. Nothing with fewer corners
   could reach that state, which is exactly why the cheap guards survived so
   long. `polygonSelfIntersects` (`hallway-shapes.ts`) is now the fourth
   guard; at 4–8 corners it's a handful of comparisons per frame.
4. **A wall's grab band is a fat stroke, and at every corner two of them
   overlap.** The band width is a fraction of the whole canvas, so the overlap
   is a fixed-size blob regardless of how short the wall is: a sliver on a
   400cm wall, most of a 105cm notch wall. Grabbing a small notch's ceiling
   silently handed you one of its side walls. Insetting each band from its own
   ends by half its width (capped at a quarter of the wall) gives every wall an
   unambiguous span. The same applies to any "click the edge" interaction on a
   polygon — the fix belongs on the hit geometry, not on hit-test priority.

Related, and the reason both took a while to see: **dimension labels are
fixed-size in screen pixels while the shape is drawn at whatever scale the
viewBox implies.** A generous viewBox that looks merely roomy with a rectangle
becomes unreadable once a shape has three short walls meeting near each other,
because the labels don't shrink with it. Padding is a legibility decision, not
just a headroom one.

The drag itself (`dragWallEdge()`) is "constrained whole-wall parallel
translation": project the drag delta onto the dragged wall's own outward normal
(an along-wall component is a no-op), translate that wall, then re-intersect it
with each *unchanged* neighbouring wall's line (`lineIntersection`,
`lib/hallway-shapes.ts`) to get the two new corner positions — rejecting the
whole drag if it would invert a neighbour or shrink the bounding box below
~60cm. It deliberately rounds every committed corner to 2 decimals: the
intersection math produces values like `501.60711669921875`, which surfaced as
15-digit dimension labels. That rounding is a fix, not a style choice.

Note this is *not* the old `enableCornerDrag` code in `CanvasArea.tsx` (still
hardcoded off) — that is genuinely unconstrained per-vertex dragging with no
guards. The wizard has its own small, isolated canvas with no
furniture/collision/opening-clamping concerns, so don't assume `dragWallEdge`
can be dropped into the real editor as-is; "reshape a room that's already
furnished" is a materially harder problem.

## Persisted state: "empty" and "never saved" are different things

`loadFloors()` once treated a saved empty array as invalid — `isFloorArray()`
required `length > 0` — and fell through to its legacy-key migration branch,
which **re-saved a pre-floors backup on every single load.** Anyone still
carrying the old `planner-multi-rooms` key could therefore never delete their
last floor: it came back on the next page load, looking exactly like the delete
had silently failed.

Two general rules fall out of it:

- **An empty collection is a legitimate saved state.** If your validity check
  rejects it, every "the user deleted everything" path silently becomes "fall
  back to whatever else you can find."
- **Verifying storage/migration behaviour on a cleared browser profile proves
  nothing**, because clearing wipes the legacy key too. Plant the old key
  explicitly. This one was "fixed" twice against a cleared profile before the
  real cause turned up.

The same distinction shows up one level higher: `/rooms` used to *auto-create*
a floor whenever the store was empty (first the showcase apartment, later a
blank floor). Both were the same mistake — visiting a page silently wrote data
— and both made deleting the last floor impossible to accomplish. A route
should offer the action in an empty state, not perform it.

## Wall lengths are a property of a wall's *neighbours*

Letting someone type a wall's length looks like it should set a field on that
wall. It can't: a wall's length is the distance between the two walls it runs
between, so changing it means moving one of those.

`setWallLength()` (`lib/room-shapes.ts`) therefore moves the wall's *next*
neighbour, and does it by calling `dragWallEdge()` rather than editing corners
directly — which means every guard a manual drag already enforces (minimum
size, neighbour inversion, 2-decimal rounding) applies automatically, and a
typed length can never produce a shape a drag couldn't.

It iterates with a direction probe rather than solving in one step, because the
relationship is only exactly linear when the moved neighbour is perpendicular
to the target wall. On a cut-corner shape it isn't, and "which way is outward"
depends on the polygon's winding at that corner — cheaper to probe once than to
reason about.

The first version sidestepped all this by mapping a wall's length onto the
bounding box, which is only valid for a 4-corner room and left every polygon
shape read-only.

## A room's local corners must start at its own origin

Two descriptions of the same room have to agree, and nothing checks that they
do:

- `globalCorners()` (`room-adjacency.ts`) places a room by adding its `x`/`y`
  to **every local corner**, and that's the shape walls, adjacency and exact
  room-vs-room collision use.
- `findFreeRoomSpot`, `clampRoomResize` and the overview grid treat the same
  room as a **`width` x `length` box at `(x, y)`**.

Those only describe the same rectangle if `corners` spans exactly
`(0,0)-(width,length)`. Every builder satisfied that by construction until
`dragWallEdge` (the guided wizard) arrived: it *translates* the wall you grab,
so pulling a left or top wall outward leaves negative coordinates, and
`resizeRoomShape` scales from `bb.minX` and preserves the offset. A room built
that way renders offset from wherever placement believes it is — invisible for
a standalone room with nothing to collide against, wrong the moment the same
room goes on a floor.

`createRoomLayoutWithCorners` therefore normalises (`normalizeCornersToOrigin`)
rather than trusting its caller. Pure translation, so it can't change the
shape: wall lengths, wall indices and every opening's `position` along its wall
are unaffected. If another corners-first builder ever appears, it owes the same
normalisation — and note the invariant is about the *bounding box*, not any
particular corner, since a polygon's first corner needn't be its top-left.

## Two surfaces creating the same kind of thing want one component, not one store

The dashboard and the `/rooms` sidebar both create rooms, into **different
stores** (see "A room persists two different ways" above). The instinct after
that split is to keep their UIs apart too. That's the wrong seam: it's what
left the sidebar on a bare name+size form while the dashboard grew three
flows.

What actually has to stay separate is the *destination*, and that is one
callback. `IkeaRoomWizard` takes `onCreate(room)` and knows nothing about
either store; the dashboard passes `useCreateSingleRoom`, the sidebar passes
its own `addToFloor`. Same rule as `useRoomPlanner(roomId, source)` — the
caller always knows the answer, so nothing downstream has to infer it. A
component in `components/dashboard/` that a route imports is a sign the seam is
in the wrong place; that's why the shared ones live in
`components/room-creation/` now.

The corollary worth remembering: what *does* need to be shared per-destination
is the commit step. `addToFloor` exists for the same reason
`useCreateSingleRoom` does — three flows each doing "push history, append,
select" inline is three chances to forget one.

## Three.js and SVG gotchas that surface far from their cause

- **`THREE.ShapeGeometry` is indexed.** Its `position` attribute holds each
  unique corner once; `index` is what groups them into triangles. Walking
  `position` in threes runs off the end of a 4-corner polygon and produces
  NaN vertices — reported by three.js much later, and very unhelpfully, as
  `computeBoundingSphere(): Computed radius is NaN`. Any geometry builder
  taking triangles from outside should also drop non-finite vertices
  defensively; a single NaN poisons a whole mesh's bounds.
- **An SVG referenced from `<img>` needs explicit `width`/`height`.** With only
  a `viewBox` it has no intrinsic size and renders as *nothing* — no error, no
  broken-image icon, just the alt text.
- **XML comments may not contain a double hyphen.** One in a hand-written SVG
  makes the entire file fail to parse, which presents identically to the file
  being missing or the path being wrong.
- **Overlay UI positioned in percentages of an SVG's container will drift**,
  because an SVG letterboxes its viewBox (`xMidYMid meet`) whenever the
  element's aspect ratio differs from the viewBox's. Map through the measured
  element size instead. And offsets meant to be *visual* (a label's gap from
  its wall) belong in screen pixels, not SVG units — a viewBox-space offset
  shrinks with the scale until the label sits on top of the thing it labels.

## Reusing the whole rendering/collision pipeline for a "variant" catalog item

"My Own Catalog" and the built-in IKEA catalog (`lib/custom-catalog.ts`,
`lib/ikea-catalog.ts`) both need a customized-dimension/color furniture item
to place into a room, render in 2D/3D exactly like a normal preset (icon,
kitModel scale-envelope, material, collision layer), and behave identically to
every other catalog item for the chair-office `kind: "chair"` special case,
elevation defaults, etc. The temptation is to give this its own parallel
add-to-room code path. Instead, `customCatalogItemToPreset()` converts a
`CustomCatalogItem` into a real `Preset` object — `key` set to the item's
`sourceKey` (a real `PRESET_BY_KEY` entry) when present, so every existing
`icon`-keyed lookup (kitModel, material, `getDefaultHeight`, the Inspector's
kit-tint-override banner) resolves through the SAME preset the item is
visually based on — and hands that straight to the existing `addPreset()`
(use-room-planner.ts) completely unmodified. A boxless entry (no `sourceKey`)
falls back to a synthetic `custom:<id>` key that deliberately matches nothing
in `PRESET_BY_KEY`, so it degrades to exactly the same "flat box" path the
pre-existing standalone Custom Item creator already used. This is the reason
`addPreset` also gained one small additive change — `height: preset.h` set
explicitly on the draft item, rather than left for `getDefaultHeight`'s lazy
`PRESET_BY_KEY[icon]?.h` fallback to resolve later — identical result for
every ordinary preset (same lookup, just done eagerly), but it's what lets an
IKEA entry's own real product height override its `sourceKey`'s generic
height instead of silently inheriting it. The general pattern — build a
`Preset`-shaped adapter rather than forking the add/render logic — is worth
reaching for again any time a new "variant of an existing catalog item"
feature comes up.
