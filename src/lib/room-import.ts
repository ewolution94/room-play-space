import type { z } from "zod";
import type { Item, Opening, Point, RoomFlooring } from "@/types/planner";
import type { importSchema } from "@/lib/planner-schema";
import { DEFAULT_FLOORING } from "@/lib/floor-materials";
import { DEFAULT_CEILING_HEIGHT, type WallSlopeMap } from "@/lib/wall-slopes";
import { isSwingingOpening } from "@/lib/openings";

/** A single-room import (an exported room file, or a shared link) after importSchema.parse. */
export type RoomImport = z.infer<typeof importSchema>;

export interface ImportedRoomContents {
  width: number;
  length: number;
  corners: Point[];
  wallColors: Record<string, string>;
  flooring: RoomFlooring;
  ceilingHeight: number;
  wallSlopes: WallSlopeMap;
  openings: Opening[];
  items: Item[];
}

/**
 * A parsed room import turned into what the editor holds, with every default filled in: the
 * one place this happens, for importing into the open room (applyRoomImport) and for opening a
 * shared link as a new room. Everything the file carries comes through: until 2026-10-03 a
 * terrace door lost its hinge, swing and second leaf here, and items lost `catalogDims` and the
 * item they sit on (`placedOnId`).
 */
export function importedRoomContents(
  data: RoomImport,
  newId: () => string = () => crypto.randomUUID(),
): ImportedRoomContents {
  const width = Math.max(50, Math.round(data.room.width));
  const length = Math.max(50, Math.round(data.room.length));
  return {
    width,
    length,
    // >= 3 (not === 4) so a hallway's L/T-shaped polygon isn't flattened to a rectangle.
    corners:
      data.corners && data.corners.length >= 3
        ? data.corners
        : [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: length },
            { x: 0, y: length },
          ],
    wallColors: data.wallColors ?? {
      top: "#f1f5f9",
      right: "#f1f5f9",
      bottom: "#f1f5f9",
      left: "#f1f5f9",
    },
    flooring: data.flooring ?? { ...DEFAULT_FLOORING },
    ceilingHeight: data.ceilingHeight ?? DEFAULT_CEILING_HEIGHT,
    wallSlopes: data.wallSlopes ?? {},
    openings: data.openings.map((o) => ({
      id: o.id || newId(),
      wall: o.wall,
      position: o.position,
      width: o.width,
      kind: o.kind,
      // Doors and terrace doors both swing (isSwingingOpening).
      ...(isSwingingOpening(o.kind)
        ? {
            hinge: o.hinge === "end" ? ("end" as const) : ("start" as const),
            swing: o.swing === "out" ? ("out" as const) : ("in" as const),
          }
        : {}),
      ...(o.kind === "terrace-door" && o.leaves ? { leaves: o.leaves } : {}),
      color: o.color,
    })),
    items: data.items.map((i) => ({
      id: i.id || newId(),
      name: i.name,
      width: i.width,
      length: i.length,
      color: i.color,
      x: i.x,
      y: i.y,
      rotation: i.rotation,
      kind: i.kind,
      icon: i.icon,
      height: i.height,
      elevation: i.elevation,
      layer: i.layer,
      shape: i.shape,
      catalogDims: i.catalogDims,
      placedOnId: i.placedOnId,
    })),
  };
}
