import type { Item, Lang, Opening, RoomFlooring, RoomLayout } from "@/types/planner";
import {
  buildBathroom,
  buildBedroom,
  buildDiningRoom,
  buildKitchen,
  buildLivingRoom,
} from "@/lib/default-apartment";
import {
  buildDefaultOfficeItems,
  buildDefaultOfficeOpenings,
  DEFAULT_ROOM_W,
  DEFAULT_ROOM_L,
} from "@/hooks/use-room-planner";
import { DEFAULT_FLOORING } from "@/lib/floor-materials";

export interface SingleRoomSeed {
  name: string;
  width: number;
  length: number;
  color: string;
  items: Item[];
  openings: Opening[];
  flooring: RoomFlooring;
}

export interface SingleRoomTemplate {
  key: string;
  nameEn: string;
  nameDe: string;
  color: string;
  width: number;
  length: number;
  build: (lang: Lang) => SingleRoomSeed;
}

// Adapts one of default-apartment.ts's per-room builders (each returns a
// full RoomLayout meant for a spot inside the apartment cluster) into a
// standalone single-room seed -- id/x/y/corners/wallColors are dropped
// since createRoomLayout (multi-room-actions.ts) generates fresh ones for
// wherever this room actually lands.
function fromApartmentRoom(
  key: string,
  nameEn: string,
  nameDe: string,
  color: string,
  width: number,
  length: number,
  builder: (lang: Lang) => RoomLayout,
): SingleRoomTemplate {
  return {
    key,
    nameEn,
    nameDe,
    color,
    width,
    length,
    build: (lang) => {
      const room = builder(lang);
      return {
        name: room.name,
        width: room.width,
        length: room.length,
        color: room.color,
        items: room.items,
        openings: room.openings,
        flooring: room.flooring ?? { ...DEFAULT_FLOORING },
      };
    },
  };
}

// The richer, purpose-built home-office demo (see buildDefaultOfficeItems in
// use-room-planner.ts) is used here instead of default-apartment.ts's own
// smaller "Home Office" apartment room -- it's the more detailed of the two
// and was already the app's flagship single-room showcase, so reusing it
// here means every hand-tuned piece of that content still gets seen instead
// of sitting unused once `/` no longer renders a bare demo room.
const HOME_OFFICE_COLOR = "#14b8a6";

export const SINGLE_ROOM_TEMPLATES: SingleRoomTemplate[] = [
  fromApartmentRoom(
    "living-room",
    "Living Room",
    "Wohnzimmer",
    "#3b82f6",
    420,
    380,
    buildLivingRoom,
  ),
  fromApartmentRoom("kitchen", "Kitchen", "Küche", "#f59e0b", 320, 300, buildKitchen),
  fromApartmentRoom("bathroom", "Bathroom", "Badezimmer", "#06b6d4", 220, 240, buildBathroom),
  fromApartmentRoom("bedroom", "Bedroom", "Schlafzimmer", "#8b5cf6", 380, 340, buildBedroom),
  {
    key: "home-office",
    nameEn: "Home Office",
    nameDe: "Home-Office",
    color: HOME_OFFICE_COLOR,
    width: DEFAULT_ROOM_W,
    length: DEFAULT_ROOM_L,
    build: (lang) => ({
      name: lang === "de" ? "Home-Office" : "Home Office",
      width: DEFAULT_ROOM_W,
      length: DEFAULT_ROOM_L,
      color: HOME_OFFICE_COLOR,
      items: buildDefaultOfficeItems(),
      openings: buildDefaultOfficeOpenings(),
      flooring: { ...DEFAULT_FLOORING },
    }),
  },
  fromApartmentRoom(
    "dining-room",
    "Dining Room",
    "Esszimmer",
    "#ef4444",
    340,
    300,
    buildDiningRoom,
  ),
];
