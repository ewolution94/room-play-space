---
description: Check every factual claim in README.md against the actual code
---

`README.md` was written to be *falsifiable* — it quotes counts, storage keys,
commands, file paths and deliberate non-features instead of vague copy. That
only stays worth having if it's re-checked when the code moves. That is this
command's job.

Argument (optional): `$ARGUMENTS`. If it contains `report`, only report — do
not edit the README.

## What to do

1. Read `README.md` in full.
2. Build a **claim inventory**: every statement a reader could act on and be
   wrong about — numbers, commands, paths, keys, defaults, version claims,
   and the "deliberately doesn't do" items.
3. Verify each claim by **running or reading the thing**, never from memory
   or from this file's summary below. Prefer the cheapest reliable check.
4. Report a table: claim → `OK` / `STALE` / `UNVERIFIABLE`, with the evidence
   (a count, a path, a command's output) for anything not `OK`.
5. Unless the argument says `report`: fix the claims that are objectively
   wrong. For anything requiring a judgment call — a feature description
   that's now arguably misleading, a section that should be added because a
   major capability landed — describe the options and ask instead of
   rewriting.

## Known checkable claims

Non-exhaustive, and possibly itself stale — treat it as a starting set, not
the definition of done. Re-derive anything that looks suspicious.

| Claim in README | How to check |
| --- | --- |
| `npm run dev` / `build` / `test` / `lint` exist | `package.json` scripts |
| Test suite passes and is `node:test`, no framework | `npm test` |
| Type-checks clean | `npx tsc --noEmit -p tsconfig.json` |
| "208 furniture presets" | `grep -c '^\s*key: "' src/lib/planner-presets.ts` |
| "across 18 categories" | `grep -oE 'category: "[a-z]+"' src/lib/planner-presets.ts \| sort -u \| wc -l` |
| "114 render as real 3D models" | `grep -c 'kitModel:' src/lib/planner-presets.ts` |
| "33 real IKEA items" | `grep -c 'id: "ikea-' src/lib/ikea-catalog.ts` |
| "26 test files" | `ls tests/*.test.ts \| wc -l` |
| localStorage key table | the `*_KEY` consts in `src/lib/{homes,single-rooms,custom-catalog,settings}.ts` and `src/hooks/use-theme.ts` |
| Legacy keys still read as migration sources | `src/lib/homes.ts` — the three storage generations |
| Room shapes: rectangle / L / T / U / cut-corner | `RoomShapeKind` in `src/lib/room-shapes.ts` |
| Hallway shapes: straight / L / T | `src/lib/hallway-shapes.ts` |
| Item layers: under / main / on-top / wall, only `main` collides | `ItemLayer` in `src/types/planner.ts`, `collidesWithOthers` in `src/lib/planner-math.ts` |
| Opening heights (window on a 90 cm sill, terrace door floor-length) | `src/lib/openings.ts` |
| Slope model is `{ kneeHeight, run }` attached to a wall | `src/lib/wall-slopes.ts` |
| `checkItemFitsUnderSlopes` flags items that don't fit | same file; confirm it's still exported and used |
| Adjacent rooms open per-interval, not per-wall | `src/lib/room-adjacency.ts` |
| Docker: build/run command is correct | there is **no** `docker-compose.yml` here — confirm that's still true before recommending compose |
| CI publishes on the `release` branch to `ghcr.io/ewolution94/room-play-space` | `.github/workflows/docker-publish.yml` |
| `entry.js` is a `Bun.serve` shim, container port 3000 | `entry.js`, `Dockerfile` |
| Stack versions (React 19, Vite 7, Tailwind v4, TanStack Start, Three.js, Zod) | `package.json` |
| Every path in the project-structure tree exists | check each one |
| Doc links resolve: `docs/LEARNINGS.md`, `NAS_DEPLOYMENT.md`, `todo.md` | filesystem |
| `brand/banner.svg` exists and is valid | `xmllint --noout brand/banner.svg` |

## The "deliberately doesn't do" section needs the most care

These are the claims most likely to rot silently, because they go stale when
a feature is *added*:

- **"No magnetic snapping yet"** and **"no PDF blueprint or shareable-link
  export"** — both are cited as backlog. Check `todo.md` for whether those
  boxes are now ticked, and check the code before believing either way.
- **"Furniture clamps to the room's bounding box, not the concave outline"** —
  verify against `clampPos` in `src/lib/planner-math.ts`.
- **"Mobile is view-only for multi-room overviews"** — verify against
  `src/hooks/use-mobile-view-only.tsx` and its callers.
- **"No account, no backend, no sync"** — verify nothing has started talking
  to a server: check `src/routes/` and `src/server.ts` for new endpoints.

If a limitation is no longer true, that's a feature to promote into the
Features list, not just a line to delete.

## Rules

- Run the commands; don't infer. A claim you cannot check is `UNVERIFIABLE`,
  and say why — do not quietly call it `OK`.
- Match the README's existing voice if you edit it: `**Bold lead-in** — plain
  explanation`, specific over promotional, limits stated plainly.
- Don't add badges, emoji headers, or a features table. The house style is
  the banner, prose, and annotated trees.
- Leave `brand/` alone unless an asset is actually broken.
