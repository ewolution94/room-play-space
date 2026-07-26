import { z } from "zod";

// Shared by every color field across both the single-room and multi-floor
// import schemas below -- also exported for lib/custom-catalog.ts's own
// import schema, so a color's valid-format definition can't quietly drift
// between the two.
export const COLOR_REGEX = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// Item/opening shapes are identical between the single-room import
// (importSchema below) and a room embedded in a multi-floor import
// (roomLayoutSchema further down) -- extracted once so the same bounds/caps
// can't quietly drift apart between the two paths.
const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().max(100).default("Item"),
  width: z.number().min(1).max(5000), // Max item size 50m
  length: z.number().min(1).max(5000),
  color: z.string().regex(COLOR_REGEX, "Invalid color format").default("#5cbdb9"),
  x: z.number().min(-10000).max(10000),
  y: z.number().min(-10000).max(10000),
  rotation: z.number().default(0),
  kind: z.enum(["furniture", "chair"]).default("furniture"),
  icon: z.string().optional(),
  height: z.number().optional(),
  elevation: z.number().optional(),
  layer: z.enum(["under", "main", "on-top", "wall"]).optional(),
  shape: z.enum(["rect", "circle"]).optional(),
});

const openingSchema = z.object({
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
});

export const importSchema = z.object({
  version: z.number().optional(),
  room: z.object({
    width: z.number().min(50).max(10000), // Min 50cm, Max 100m
    length: z.number().min(50).max(10000),
  }),
  openings: openingSchema.array().max(200), // Capped at 200 openings to prevent tab freezing
  items: itemSchema.array().max(1000), // Capped at 1000 items to prevent tab freezing
  corners: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  wallColors: z.record(z.string()).optional(),
  flooring: z
    .object({
      key: z.string(),
      color: z.string(),
    })
    .optional(),
});

// A single room embedded in a multi-floor (whole-building) import -- the
// multi-floor import path (parseImportedFloors in lib/floors.ts) used to
// only check `typeof id === "string" && "width" in r && "x" in r`, none of
// the bounds/caps/color-format rigor the single-room importSchema above has
// always had. That gap meant a corrupted or hostile multi-floor export
// could carry e.g. tens of thousands of items per room (tab freeze) or
// NaN/Infinity dimensions (broken rendering/collision math) with nothing to
// catch it. This mirrors importSchema's item/opening rules exactly, plus
// room-level bounds for width/length/color/position and the rest of
// RoomLayout's fields.
const roomLayoutSchema = z.object({
  // Required (not optional, unlike itemSchema/openingSchema's id) -- every
  // room read back out of an import is immediately referenced by id
  // elsewhere (React keys, selectedRoomIds, activeFloorId's rooms, ...), so
  // this matches the old shallow check's behavior of always requiring one.
  id: z.string(),
  name: z.string().max(100).default("Room"),
  width: z.number().min(50).max(10000),
  length: z.number().min(50).max(10000),
  x: z.number().min(-100000).max(100000),
  y: z.number().min(-100000).max(100000),
  rotation: z.number().default(0),
  color: z.string().regex(COLOR_REGEX, "Invalid color format").default("#5cbdb9"),
  items: itemSchema.array().max(1000),
  openings: openingSchema.array().max(200),
  corners: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .max(64)
    .optional(),
  wallColors: z.record(z.string()).optional(),
  flooring: z
    .object({
      key: z.string(),
      color: z.string(),
    })
    .optional(),
  roomKind: z.enum(["room", "hallway"]).optional(),
  wallOverrides: z.record(z.boolean()).optional(),
});

// A legacy flat export (pre-dating the floors feature) is just a bare
// RoomLayout[] -- parseImportedFloors wraps a validated array of these into
// a single un-named floor.
export const roomLayoutArrayImportSchema = roomLayoutSchema.array().max(500);

const floorSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  rooms: roomLayoutSchema.array().max(200),
});

// Capped at 100 floors -- generous for any real building, but still a hard
// ceiling against a hostile/corrupted file trying to force the app to
// render an unbounded number of floors at once.
export const floorsArrayImportSchema = floorSchema.array().min(1).max(100);

/** Turns a caught import error (a ZodError from a failed `.parse()`, a
 * plain Error, or anything else) into one readable string -- shared by
 * every import path (single-room, floor/building) so the export/import
 * dialog's error banner and the toast on a failed import always read the
 * same way. */
export function formatZodError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}
