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
 * The single-room "from example" content: the hand-tuned home office that
 * used to be what `/` rendered directly, before the dashboard existed (see
 * buildDefaultOfficeItems/buildDefaultOfficeOpenings in use-room-planner.ts
 * -- that's the user's own exported layout, re-imported verbatim).
 *
 * "From example" deliberately builds this one room and opens it, with no
 * template picker in between: this layout *is* the app's example, and a
 * gallery of alternatives (an earlier version offered six, adapted from
 * default-apartment.ts's per-room builders) only put a decision between the
 * user and the thing they asked to see. The apartment rooms are still
 * reachable as an example -- as the apartment, via the multi-room card's
 * own "from example".
 */
export function buildHomeOfficeRoom(lang: Lang): RoomLayout {
  const base = createRoomLayout([], {
    name: lang === "de" ? "Home-Office" : "Home Office",
    width: DEFAULT_ROOM_W,
    length: DEFAULT_ROOM_L,
    color: HOME_OFFICE_COLOR,
    x: 0,
    y: 0,
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
