# Room Planner

A multi-room floor-planner web app: lay out rooms and hallways, place furniture
from a built-in catalog or your own custom items, add doors/windows, and switch
between a 2D top-down canvas and a 3D walkthrough view. Supports English and
German.

Built with TanStack Start, React 19, Vite, Tailwind v4, and Three.js.

## Development

```bash
npm run dev      # dev server
npm test         # run the test suite (node:test, no framework dependency)
npm run lint     # eslint
npx tsc --noEmit -p tsconfig.json   # type-check
```

## Documentation

- [`docs/LEARNINGS.md`](docs/LEARNINGS.md) — the collision/geometry math, how
  2D and 3D placement relate, the trickiest canvas/rendering hacks, and the
  performance technique behind the floating Inspector panel. Read this before
  touching `planner-math.ts`, `hallway-shapes.ts`, `ThreeDView.tsx`, or
  `CanvasArea.tsx`.
- [`todo.md`](todo.md) — feature checklist / backlog.
- [`NAS_DEPLOYMENT.md`](NAS_DEPLOYMENT.md) — deploying this TanStack Start
  app to a self-hosted NAS/Docker instead of Cloudflare Pages.
