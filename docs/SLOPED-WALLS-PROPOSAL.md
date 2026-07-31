# Sloped ceilings ("Dachschrägen") — a proposal

Written 2026-07-31.

**Status: Phases 0-3 are built and verified. Phase 4 (the 3D half) is not
started.** So the model, the Inspector editing, the 2D overlay and the
furniture-fit feedback below all describe shipped code; the 3D sections are
still a plan. See `todo.md` for the build notes and what each phase actually
touched.

One correction worth carrying forward from the build: the 2D band initially
drew *outside* the room, because `resolveWallSegment` deliberately walks
"bottom" and "left" in reverse winding order, which inverts any normal derived
from `a`→`b`. Anything that needs a genuinely inward direction must use
`inwardNormal()`, which probes the polygon instead of trusting winding.

## What we're actually solving

An attic room isn't a box. The ceiling drops toward the eaves, so usable height
varies across the floor — and that variation *is* the planning problem. A 200cm
wardrobe cannot go where the ceiling is 120cm. Floor area alone tells you
nothing about that, which is exactly why people planning a converted attic need
a tool and people planning a rectangular box mostly don't.

So the feature's real job isn't "draw a slanted wall". It's **answer "how tall
can something be here?" everywhere on the floor, and stop you putting the
wardrobe somewhere it can't stand.**

## Two companion features: configurable wall height, and a ceiling

Both were raised after the first draft. Short answer: **the first is easy and
unavoidable, the second is easy geometry with one genuine risk (lighting) — and
doing the ceiling *together with* slopes is cheaper than doing slopes first and
retrofitting it.**

### 1. Configurable wall height — easy, and a hard prerequisite

`ThreeDView.tsx` line 780 is the only room height in the entire app:

```ts
const wallHeight = 240; // cm
```

A local constant in the 3D renderer. `RoomLayout` has no height field, and the
`roomHeight: "Wall Height (cm)"` string in `planner-translations.ts` (both
languages, already written) is wired to nothing.

You can't express "the ceiling is lower over there" against a constant, so this
has to happen first regardless. The good news is it's almost entirely
mechanical — `wallHeight` appears **7 times, all inside the one wall-building
function**, so it becomes `room.ceilingHeight ?? 240` at the top of the
per-room loop and every downstream use (opening lintels, wall segments) follows
automatically.

Full extent of the change:

| Where | What |
|---|---|
| `types/planner.ts` | `RoomLayout.ceilingHeight?: number`, `RoomInstance3D.ceilingHeight` |
| `ThreeDView.tsx` | one `const` becomes a per-room read |
| `CanvasArea.tsx:173`, `MultiRoomCanvas.tsx:252` | pass it through when building room instances (1 line each) |
| `use-room-planner.ts` | state + save-back + `Snapshot` for undo/redo + export payload |
| `planner-schema.ts` | one bounds-checked number, for the import path |
| Room Inspector | one `NumberField` next to Width/Length — the label string already exists |

No new concepts, and `flooring` was added through this exact same set of seams
recently, so there's a worked example to copy. Optional field, so every saved
room and exported file stays valid with no migration. The only bits needing care
are undo/redo and export round-trip, both mechanical.

**Verdict: low effort, low risk, do it first.**

### 2. A ceiling — easy geometry, easy fade, the risk is lighting

There is no ceiling geometry today at all; you look down into an open-topped
room. Adding one breaks into three parts, and the first two are much easier than
they sound:

**Geometry — near-free.** The floor mesh is already built as
`new THREE.Shape(room.corners)` → `ShapeGeometry` → rotated flat. A ceiling is
*the same code* at `y = ceilingHeight`, flipped. It works for polygon rooms
(hallways) for free, exactly as the floor does. ~20 lines.

**Seeing into the room — the mechanism already exists.** The obvious objection
is "a ceiling hides everything". But `ThreeDView` already has a camera-aware
fade system for walls: each wall is registered with a normal, a midpoint and a
`fadeThreshold`, and the animation loop lerps its opacity with a hysteresis band
so walls between you and the room fade out (there's a user-facing "wall fading"
opacity control in the 3D overlay already). A ceiling plugs into the same
pattern — it just needs a simpler predicate than the wall dot-product test:
fade out when the camera is above it, be solid when the camera is inside the
room. That's the difference between "looking at a floor plan" and "standing in
the room", which is exactly the distinction you'd want anyway. ~30 lines,
plus one more toggle in the 3D control overlay that already hosts labels /
sunlight / wall-fade.

**Lighting — mostly defused by making the ceiling a checkbox.** Right now the
room is lit from above through an open top; closing it will darken interiors,
and the existing lamp fixtures (spotlights, a RectAreaLight ceiling wash) were
tuned against an open room.

*Decision (2026-07-31): the ceiling is a show/hide checkbox in the 3D control
overlay, alongside the existing labels / sunlight / wall-fade toggles.* That
changes the risk a lot. The bar stops being "must look great and must not
regress the default view" and becomes "must look acceptable when deliberately
switched on" — which is a normal iteration, not a blocker. Concretely:

- Ceiling **off** by default → today's lighting is untouched, zero regression
  risk for every existing room.
- Ceiling **on** → bump ambient/hemisphere light to compensate, and let the
  camera-fade still dissolve it when looking down from outside. Good enough
  immediately, tunable later without blocking anything.

So the toggle isn't just an escape hatch — it's what lets this ship without a
lighting overhaul first.

### Why the ceiling belongs *with* slopes, not after

For a sloped room the ceiling isn't cosmetic. Without a ceiling surface, a
Dachschräge renders as "one wall is oddly short", which reads as a bug rather
than a roof. **The slope only becomes legible once there's a surface slanting
down to meet that short wall.**

And mechanically they're the same object: a flat ceiling and a slanted ceiling
are one mesh family differing only in vertex heights, both wanting the same
fade treatment and the same lighting fix. Building the flat one first and the
slanted one immediately after means writing that mesh/fade/lighting code once.
Doing slopes alone first means shipping a 3D view that looks broken, then
redoing the same area.

So I'd fold the ceiling into the slope work rather than treating it as a
separate follow-up.

## The model

A slope belongs to a **wall**, and is described the way people actually describe
attics — not as roof geometry:

```ts
interface WallSlope {
  kneeHeight: number; // cm — ceiling height where it meets this wall ("Kniestock")
  run: number;        // cm — horizontal distance into the room to reach full height
}
type WallSlopeMap = Record<string, WallSlope>; // keyed exactly like wallColors
```

Height at any floor point = the **minimum** over every sloped wall of

```
d >= run          ->  ceilingHeight
d <  run          ->  kneeHeight + (ceilingHeight - kneeHeight) * d / run
```

where `d` is the perpendicular distance to that wall's line.

Two numbers per wall, both measurable with a tape measure. Builders quote a
pitch angle instead, so `runFromPitch()`/`pitchFromRun()` convert either way and
the UI can offer both inputs.

### Why wall-attached rather than modelling a roof

- **Nothing existing has to change to stay correct.** The floor polygon
  (`corners`) is untouched, so collision, `findFreeSpot`, room adjacency, wall
  openings, the overview grid and every export all keep working as-is. A slope
  is purely additive metadata.
- **It composes.** The classic gabled attic is just two opposite walls sloping
  toward a ridge; taking the minimum makes overlaps resolve themselves with no
  special case. Verified by test.
- **It degrades.** No slopes = a plain box, byte-identical to today.
- **It's keyed like `wallColors`**, so the existing per-wall UI pattern (the
  Inspector's wall picker, `wallColorKey()`) transfers directly — named walls
  for 4-corner rooms, numeric indices for polygon rooms, already handled.

### What it deliberately can't express

Dormers (*Gauben*), hipped ends over a non-parallel wall, curved or multi-pitch
roofs, and a ridge that isn't parallel to a wall. Those need real roof geometry
and a much bigger editor. I'd argue they're out of scope until someone actually
asks: the two-slope gable plus single-slope case covers the overwhelming
majority of converted attics.

If we ever do want them, this model is a clean subset — a dormer would become a
second, *positive* volume carved back out of the slope, not a redesign.

## What each surface needs

### 2D canvas — the one that actually matters

**This is where the planning happens, and it's the priority.** 3D is where a
slope looks impressive; 2D is where someone works out whether the wardrobe
fits. A slope that's only visible in 3D would be decoration.

The goal is that a user can look at the floor plan and *plan around the
restriction* without doing arithmetic. Four layers, roughly in order of value:

**1. The slope band.** A hatched/gradient band along each sloped wall, `run` cm
wide, darkest at the wall and fading inward. Labelled with both ends of the
range — "110 → 240 cm". Reads instantly as "the roof comes down here", and the
gradient encodes "and it gets worse this way".

**2. Height contour lines.** Thin labelled lines at meaningful heights across
the band, with the **standing-height line (190cm) emphasised** — the line past
which an adult stands upright, computed by `distanceToClearHeight()`. On real
attic plans this is the single most-drawn annotation. Useful defaults: 100 /
150 / **190** / 220.

**3. A live height readout while dragging.** While an item is being moved,
show the available height under it — "max 168 cm here" — updating as it moves,
turning red when it's below what the item needs. This is the feature that
actually makes planning feel solved rather than guessed, and it's cheap:
`minHeightOverFootprint()` already computes it, called from the existing drag
handler.

**4. A persistent marker on items that don't fit.** Not just a toast at drop
time — an item that's too tall for where it sits should stay visibly flagged
(amber outline + a tooltip saying "needs 200cm, 140cm available here"), so a
layout you come back to still tells you what's wrong with it. The Elements list
in the sidebar should carry the same badge.

Note the 2D canvas already renders per-wall colour, polygon rooms and openings
in this coordinate space, so the band and contours are a clipped SVG overlay
using machinery that exists — not a new rendering path.

### Furniture fit — the payoff

`checkItemFitsUnderSlopes()` already returns `{ fits, availableHeight,
shortfallCm }`. Wiring it into `use-room-planner.ts`'s existing drop/update
guards mirrors what collision already does:

- On drop/nudge/inspector-edit, reject with a toast that says *how much* too
  tall: "Doesn't fit — 90cm too tall for the 110cm ceiling there."
- Required height = `item.height ?? getDefaultHeight(...)` plus its `elevation`,
  so something on a desk correctly needs the desk's height too
  (`computeOnTopElevation` already computes that).

**Decided: warn, don't block.** Unlike overlapping furniture, a too-tall item
isn't physically impossible — you might be planning to cut the wardrobe down.
The user gets told clearly and *persistently* (live readout while dragging, a
marker on the item, a badge in the Elements list) rather than having the
placement refused. Same call site either way, so this stays cheap to revisit.

### 3D — the visible payoff, the most work

Currently every wall is `new THREE.BoxGeometry(segLen, wallHeight, wallThickness)`.
With slopes, three things change:

1. **The sloped wall itself** just gets shorter — `kneeHeight` instead of
   `wallHeight`. Trivial.
2. **Its two perpendicular neighbours** stop being rectangles: each becomes a
   trapezoid-plus-rectangle profile, low at the sloped end and rising over
   `run`. Needs a `THREE.Shape` + `ExtrudeGeometry` instead of a box. This is
   the real geometry work, and it's contained — one function, per wall.
3. **The slope surface itself has to be drawn**, or the room just looks like it
   has one short wall. This is the same mesh as the flat ceiling above, with
   the vertices along the sloped wall pulled down to `kneeHeight` — which is
   why the two should be built together (see "Why the ceiling belongs *with*
   slopes").

### Openings

A window's height is capped by the wall height where it sits, so a sloped
(shortened) wall needs the existing opening validation to know about
`kneeHeight`. A window *in the slope* is a roof window (*Dachfenster*) — a
genuinely different object, and I'd defer it rather than half-model it.

### Persistence, import/export, wizard

- `RoomLayout` gains two optional fields; `planner-schema.ts` needs matching
  bounds-checked entries (`kneeHeight` 0..ceiling, `run` 0..room extent) since
  that's the user-supplied-file path.
- Both optional and absent-by-default, so **every existing saved room and
  exported file stays valid with no migration.**
- The guided wizard could gain an optional "Any sloped ceilings?" step after
  dimensions — its `RoomShapeCanvas` is already a purpose-built editable canvas
  and a slope band is a natural thing to drag there.

## Suggested phasing

| Phase | Scope | Risk |
|---|---|---|
| **0** | `RoomLayout.ceilingHeight`, replace the hardcoded 240, wire the orphaned "Wall Height" string, Inspector field | Low — mechanical, `flooring` is the worked example |
| **1** | ✅ geometry module + tests *(done)* | None — pure, unwired |
| **2** | 2D slope band + standing-height line + Inspector slope editing | Low — additive drawing |
| **3** | Furniture fit checking + toast | Low — mirrors collision |
| **4a** | **Flat ceiling**: mesh + camera-aware fade + show/hide checkbox | Low-medium — geometry mirrors the floor, fade mirrors the walls |
| **4b** | Ambient-light compensation when the ceiling is on | Low — the checkbox defuses this; off by default means no regression |
| **4c** | Sloped wall profiles + slanted ceiling surface | Medium — extrusion work, but reuses 4a's mesh + fade |
| **5** | Wizard step, roof windows, dormers | Deferred |

Two things worth noting about this ordering:

- **Phases 0→3 deliver the entire planning value** — see the slope, edit it,
  get told what doesn't fit — *without touching the 3D renderer at all.* If you
  want the feature useful fast, stop after 3.
- **4a/4b/4c are one piece of work, not three.** They're split out to show
  where the risk sits (4b), not because they'd ship separately. 4a is worth
  doing on its own merits even with no slopes in sight — a closed room is
  simply a better 3D view — and once it exists, 4c is mostly vertex maths.

## Decided (2026-07-31)

- **Ceiling is a show/hide checkbox**, off by default, in the existing 3D
  control overlay. This is what removes the lighting overhaul from the critical
  path.
- **2D is the priority.** The slope's restrictions have to be legible and
  planable on the floor plan, not just visible in 3D — see the four layers
  above.
- **Too-tall furniture warns, it does not block.** Following from "so they can
  really plan around any restrictions": you get told clearly and persistently
  (readout while dragging, marker on the item, badge in the list), but the app
  doesn't refuse the placement. Unlike overlapping furniture, a too-tall item
  isn't impossible — you might be planning to cut it down, and it's your room.
- **Per-room `ceilingHeight` and per-room slopes**, matching how `flooring` and
  `wallColors` already work. A floor-level default with per-room overrides is a
  reasonable later addition; starting per-room doesn't foreclose it.
- **Slope editing lives in the Inspector**, next to wall colours, reusing the
  existing wall-picker pattern.
- **Dormers, hipped ends and multi-pitch roofs stay out of scope.**

## Things I'd still want your call on

Nothing blocking — the list above covers everything needed to start. These are
refinements best judged against something on screen:

1. **Contour line heights.** I've assumed 100 / 150 / **190** / 220 cm with the
   standing line emphasised. Easy to change once you see it on a real plan.
2. **How loud the too-tall marker should be.** Amber outline + tooltip is my
   default; it could be subtler (a corner dot) or louder (hatched fill).
3. **Whether the wizard gets a slope step** (Phase 5) or slopes stay
   Inspector-only for now. I'd leave the wizard alone until the Inspector
   version has been used in anger.
