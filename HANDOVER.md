# Handover: 2026-09-21 (moving to a new MacBook)

A high-level snapshot for the next session. It's not a to-do list. Delete this file once you've read it.

## What this is

**PLANUM** (repo/package name: `room-play-space` / `room-planner`) is a browser floor planner for real homes.
You draw rooms on a 2D canvas and walk through them in a three.js 3D view. It supports sloped ceilings,
non-rectangular rooms, a furniture catalog (presets, IKEA, and the user's own saved items), and EN/DE.
**No backend:** everything is saved in the browser's localStorage, and JSON export/import is available.
The README gives the full feature list.

## Stack

- TanStack Start (React 19, Vite, TanStack Router with file-based routes) and TanStack Query
- Tailwind v4 and shadcn/Radix UI (`src/components/ui`), three.js (lazy-loaded)
- Tests use Node's built-in test runner (`node --test` with strip-types). There's no Jest or Vitest.
- There are two lockfiles, `bun.lock` (used by Docker) and `package-lock.json`. Keep both in sync when you change deps.

## Layout

```
src/
  routes/          file-based routes (routeTree.gen.ts is generated, don't edit)
                   /dashboard, /room/$roomId (standalone room),
                   /home/$homeId (multi-room overview), /home/$homeId/room/$roomId
                   rooms.* = older routes, still present
  components/
    dashboard/     landing page: create flows, homes + single-room lists
    planner/       RoomEditor (shared by both room routes), canvas/, sidebar/, ThreeDView, Header
    room-creation/ IkeaRoomWizard + shape canvas
    ui/            shadcn primitives
  lib/             pure logic: geometry, slopes, openings, catalogs, stores (homes.ts,
                   single-rooms.ts, floors.ts), schema, translations. Most of it is unit-tested.
  hooks/           use-room-planner, use-mobile-view-only, use-theme, ...
tests/             one *.test.ts per lib module
docs/              LEARNINGS.md, HOMES-PROPOSAL.md, SLOPED-WALLS-PROPOSAL.md
todo.md            long running changelog + backlog (see "Still open", near the end)
AUDIT.md           July 2026 codebase audit (ideas for snapping, sharing, PDF export)
NAS_DEPLOYMENT.md  how the Docker image gets run on the NAS
public/, brand/    3D models/textures (Kenney kit), logos
```

## Commands

```bash
npm install
npm run dev          # port 8080 (.claude/launch.json -> "room-planner-dev")
npm test             # 744 tests
npx tsc --noEmit
npm run lint         # has a pre-existing baseline of ~60 errors/38 warnings, not a regression signal
```

## Branches and deploy

- **Work happens on `release`**, not `main`. `release` is 5 commits ahead of `main`, which hasn't been
  updated recently.
- A push to `release` triggers GitHub Actions (`.github/workflows`), which builds a Docker image and pushes it to
  `ghcr.io/ewolution94/room-play-space`. The NAS pulls it (see NAS_DEPLOYMENT.md).
- `wrangler.jsonc` is leftover Cloudflare template config and isn't how the app is deployed.

## Where it's at (verified 2026-09-21)

- `release` @ `9208f05` matches `origin/release`, and the working tree is clean. `tsc` is clean and 744/744 tests pass.
- Recent work, all committed:
  - Homes model (home → floors → rooms) and home export/import
  - Measurements dialog
  - Sloped ceilings, phases 0–4
  - T/U room shapes
  - Mobile "view-only" gating: mobile is for viewing only. The one exception is "from example" create.
  - An SSR hydration fix in `use-theme.ts` and `__root.tsx`, plus a coordinated TanStack version bump
- Nothing is in progress. Open ideas and known issues are under **"Still open"** at the end of `todo.md`:
  roof windows on sloped walls, real ceiling lighting, whether the tour should auto-open for new users,
  the inspector overlapping the back pill at ~720px height. The bigger roadmap items (snapping/collision,
  shareable links, PDF blueprint) are in `todo.md` "Future Feature Ideas" and AUDIT.md.

## Migration notes (things git won't carry over)

- **Claude project memory** lives outside the repo at
  `~/.claude/projects/-Users-Eric-Wohlgethan-Documents-development-ewolution-io-room-play-space/memory/`.
  Copy it over. The folder name comes from the repo's absolute path, so rename it if the path is different on the new Mac.
- `.claude/settings.local.json` is ignored by the global gitignore. Copy it if you want to keep the permission allowlist.
- `resources/` (~20 MB, the raw Kenney furniture kit) is gitignored. The app doesn't need it; the files it
  actually uses are already in `public/`. You only need it to re-extract models.
- Local leftovers that are safe to drop rather than migrate:
  - `stash@{0}` is from Jul 26 and predates everything since.
  - The worktree `.claude/worktrees/admiring-elgamal-7361bb` and branch `claude/admiring-elgamal-7361bb` are
    an older copy of the hydration fix, which already landed on `release` as `9208f05`.
- The repo has no `CLAUDE.md`. Conventions live in memory, `docs/LEARNINGS.md` and `todo.md`.
