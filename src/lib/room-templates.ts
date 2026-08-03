import type { Lang, RoomLayout } from "@/types/planner";
import {
  buildDefaultOfficeItems,
  buildDefaultOfficeOpenings,
  DEFAULT_ROOM_W,
  DEFAULT_ROOM_L,
} from "@/hooks/use-room-planner";
import { createRoomLayout } from "@/lib/multi-room-actions";

const HOME_OFFICE_COLOR = "#14b8a6";

/**
 * The "from example" room: the hand-tuned home office that used to be what
 * `/` rendered directly, before the dashboard existed (see
 * buildDefaultOfficeItems/buildDefaultOfficeOpenings in use-room-planner.ts
 * -- that's the user's own exported layout, re-imported verbatim).
 *
 * "From example" deliberately builds this one room, with no template picker
 * in between: this layout *is* the app's example room, and a gallery of
 * alternatives (an earlier version offered six, adapted from
 * default-apartment.ts's per-room builders) only put a decision between the
 * user and the thing they asked to see. The whole apartment is still
 * reachable as an example -- as an apartment, via the floor card's own
 * "from example".
 *
 * The same room serves both destinations, which is the point: the dashboard
 * makes it a standalone room, the /rooms sidebar adds it to the active
 * floor. `siblings` is what tells the two apart -- pass the floor's existing
 * rooms and it lands in a free spot beside them; leave it empty (the
 * default) for a standalone room, whose overview coordinates addSingleRoom
 * pins to 0 anyway.
 */
export function buildHomeOfficeRoom(lang: Lang, siblings: RoomLayout[] = []): RoomLayout {
  const base = createRoomLayout(siblings, {
    name: lang === "de" ? "Home-Office" : "Home Office",
    width: DEFAULT_ROOM_W,
    length: DEFAULT_ROOM_L,
    color: HOME_OFFICE_COLOR,
  });
  // createRoomLayout seeds a bare room with one generic door; this example
  // brings its own openings (two windows and an off-center door), so they
  // replace that default rather than adding to it.
  return {
    ...base,
    items: buildDefaultOfficeItems(),
    openings: buildDefaultOfficeOpenings(),
  };
}
