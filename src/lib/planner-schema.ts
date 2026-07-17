import { z } from "zod";

export const importSchema = z.object({
  version: z.number().optional(),
  room: z.object({
    width: z.number().min(50).max(10000), // Min 50cm, Max 100m
    length: z.number().min(50).max(10000),
  }),
  openings: z
    .array(
      z.object({
        id: z.string().optional(),
        // Plain rectangular rooms address a wall by name (unchanged).
        // Polygon rooms (L/T-shaped hallways) address a wall by its numeric
        // index into `corners` -- see src/lib/hallway-shapes.ts.
        wall: z.union([z.enum(["top", "bottom", "left", "right"]), z.number().int().min(0)]),
        position: z.number().min(0).max(10000),
        width: z.number().min(0).max(5000),
        kind: z.enum(["door", "window"]),
        hinge: z.enum(["start", "end"]).optional(),
        swing: z.enum(["in", "out"]).optional(),
        color: z.string().optional(),
      }),
    )
    .max(200), // Capped at 200 openings to prevent tab freezing
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().max(100).default("Item"),
        width: z.number().min(1).max(5000), // Max item size 50m
        length: z.number().min(1).max(5000),
        color: z
          .string()
          .regex(/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Invalid color format")
          .default("#5cbdb9"),
        x: z.number().min(-10000).max(10000),
        y: z.number().min(-10000).max(10000),
        rotation: z.number().default(0),
        kind: z.enum(["furniture", "chair"]).default("furniture"),
        icon: z.string().optional(),
        height: z.number().optional(),
        elevation: z.number().optional(),
        layer: z.enum(["under", "main", "on-top", "wall"]).optional(),
        shape: z.enum(["rect", "circle"]).optional(),
      }),
    )
    .max(1000), // Capped at 1000 items to prevent tab freezing
  corners: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  wallColors: z.record(z.string()).optional(),
});
