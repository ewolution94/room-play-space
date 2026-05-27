# Build plan — onboarding, ruler, AI furnish, reset, new default layout

All work lives in `src/routes/index.tsx` plus one new server function file and a couple of small assets. No new npm packages required.

## 1. Reset & "Furnish for me" — top toolbar group

Add a new button cluster in the header (next to Undo/Redo) with three actions, each opening a confirm dialog when destructive:

- **Reset (Items)** — clears items only, keeps room dimensions and openings.
- **Reset (All)** — clears items AND openings; keeps room dimensions.
- **Furnish for me** — opens a small popover with a "Room type" dropdown (Office, Bedroom, Living room, Kitchen, Studio, Dining, Kids room, Home gym). On Generate, calls the AI server function below, then **replaces all current items** with the result.

Both reset paths and the furnish action call `pushHistory()` first so they are undoable.

EN/DE strings: `resetItems`, `resetAll`, `furnishForMe`, `roomType`, `generate`, `confirmReset`, `confirmReplace`, plus the room-type labels.

## 2. AI "Furnish this room" — server function

New file `src/lib/furnish.functions.ts` exposing `furnishRoom` via `createServerFn`. It uses Lovable AI Gateway through `@/lib/ai-gateway.server.ts` (created if missing). Model: `google/gemini-3-flash-preview`. Uses **AI SDK `generateText` + `Output.object`** for structured output — no manual JSON parsing.

Input (validated with Zod): `{ roomW, roomL, roomType, openings: Opening[] }` so the model knows where doors/windows are and can avoid blocking them.

Output schema (Zod):
```ts
{ items: Array<{
    presetKey?: string,   // optional, one of the catalog preset keys
    name: string,
    width: number,        // cm
    length: number,       // cm
    color: string,        // hex
    x: number, y: number, // cm, top-left
    rotation: number,     // degrees, 0/90/180/270
  }>
}
```

Prompt strategy: system message tells the model it is a top-down room planner, lists the available preset keys (from the existing catalog), gives the room dimensions and openings (so it leaves clearance in front of doors), and asks for a layout appropriate to the chosen room type. Max items capped at ~12.

Client-side post-processing:
- Map `presetKey` to preset color/name when present.
- Clamp positions to room bounds and snap rotations to 0/90/180/270.
- Run collision pass: greedily drop any item that collides with a prior one or with a door's clearance arc.
- `setItems(result)` after a single `pushHistory()`.

Loading + error UX: button shows a spinner; surface 429 ("AI is busy — try again in a moment") and 402 ("Out of AI credits — add some in Workspace settings") as toasts.

## 3. Measurement tool (ruler)

New canvas mode toggle in the header: a small "Ruler" toggle button (icon: `Ruler` from lucide-react). When enabled:

- Cursor changes to crosshair on the canvas.
- First click sets point A; second click sets point B; a line is drawn between them with the distance label (e.g. `213 cm`) at the midpoint.
- Snapping: while hovering, snap to the nearest of (room corners, opening endpoints, item corners) within 8 px. Snap target shown as a small circle.
- Pressing `Esc` or toggling the button off clears the measurement.
- Only one active measurement at a time (clicking a new point A discards the old).

State lives in component (`rulerMode: boolean`, `rulerA / rulerB / rulerHover` in cm). Marquee select and item drag handlers check `rulerMode` and bail out if it's on, so the ruler doesn't fight existing interactions.

EN/DE strings: `ruler`, `rulerHint`.

## 4. Onboarding tour — first-time visitors

Lightweight custom solution, no library. Stored in `localStorage` as `planner-tour-v1-done`.

A `<Tour />` component renders a fixed full-page overlay with:
- A spotlight (a transparent hole over the target element computed from its bounding rect).
- A tooltip card positioned next to the spotlight with the step's title, body, **Skip**, **Back**, **Next** / **Done** buttons, and a step indicator (e.g. "3 / 6").
- Dark backdrop covering everything else.

Steps (selectors via `data-tour="..."` attributes added to the relevant elements):
1. **Welcome** — body of the planner area, "Welcome to Room Planner. Here's a 30-second tour."
2. **Catalog** — left column, "Drag from the catalog or click an item to add it."
3. **Canvas** — center stage, "Drag items, marquee-select, and use arrows or R to nudge/rotate."
4. **Doors & windows** — openings card, "Doors get a hinge & swing toggle. Drag along the wall to reposition."
5. **Ruler** — new ruler button, "Click two points to measure distance."
6. **Furnish for me** — new AI button, "Pick a room type and let AI lay it out."

A "Take the tour" button is added near the language toggle so users can replay it.

EN/DE strings for all step titles/bodies, plus `skip`, `back`, `next`, `done`, `takeTheTour`.

## 5. New default room layout

Replace the current demo state in `useState<Item[]>(...)` / `useState<Opening[]>(...)`:

- **Room**: 480 × 360 cm (slightly more compact, fits nicely on most screens).
- **Openings**:
  - Door on the bottom wall, position ≈ 80, width 90, hinge `start`, swing `in`.
  - Window on the top wall, position ≈ 60, width 140.
  - Window on the right wall, position ≈ 70, width 120.
- **Items** (cozy living room + work nook):
  - Sofa 220×90 centered against the right side facing the room.
  - Coffee table 100×55 in front of the sofa.
  - Two armchairs 80×80 flanking the coffee table.
  - Bookshelf 200×30 along the top wall (clear of the window).
  - Desk 140×60 in the top-left area with an office chair tucked in.
  - Round table 110×110 as a dining accent or large plant by the bottom-left.
  - Floor lamp 30×30 in a corner.
  - Plant 50×50 by the window.

Layout is hand-picked so the door's swing arc lands in clear floor space.

## 6. Door angle tweak

Change the hardcoded door panel angle from `75°` to **`35°`** in the SVG opening renderer. Single-line change. The dashed quarter-arc still shows the full possible swing range, but the wood panel now reads as "slightly ajar" and stops well short of the room interior.

## Out of scope

- No new dependencies.
- No changes to collision/drag/keyboard logic.
- No persistence of room state to a backend (kept in component state + import/export as today).
- No multi-room or saved-layouts feature.

## Order of implementation

1. New default room layout + door angle tweak (smallest, immediate visual win).
2. Reset buttons + dialogs.
3. Ruler tool.
4. AI furnish (server function + UI + post-processing).
5. Onboarding tour (depends on all the above so it can reference final selectors).
