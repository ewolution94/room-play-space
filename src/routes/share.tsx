import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/use-settings";
import { useCreateSingleRoom } from "@/hooks/use-create-single-room";
import { STRINGS } from "@/lib/planner-translations";
import { decodeShare, ShareLinkError } from "@/lib/share";
import { COLOR_REGEX, formatZodError, importSchema } from "@/lib/planner-schema";
import { importedRoomContents, type ImportedRoomContents } from "@/lib/room-import";
import { createRoomLayout } from "@/lib/multi-room-actions";
import { RoomPlanSvg } from "@/components/planner/RoomPlanSvg";

export const Route = createFileRoute("/share")({
  component: ShareRoute,
});

/** A shared room's dot on the dashboard when its link carries no colour of its own. */
const FALLBACK_COLOR = "#14b8a6";

type ShareState =
  | { status: "loading" }
  | { status: "broken"; reason?: string }
  | { status: "ready"; name: string | null; color: string; room: ImportedRoomContents };

/**
 * Where a share link lands (lib/share.ts). The room is read from the URL's fragment, which the
 * browser never sends to a server, so it only exists here, in this tab, until "Open as a new
 * room" saves a copy. Visiting the page writes nothing on its own.
 */
function ShareRoute() {
  const { settings } = useSettings();
  const lang = settings.lang;
  const t = STRINGS[lang];
  const createSingleRoom = useCreateSingleRoom();
  const [state, setState] = useState<ShareState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let next: ShareState;
      try {
        const raw = await decodeShare(window.location.hash);
        const parsed = importSchema.safeParse(raw);
        if (!parsed.success) {
          next = { status: "broken", reason: formatZodError(parsed.error) };
        } else {
          // Name and colour aren't part of a room file, so the schema ignores them; checked here.
          const meta = (raw ?? {}) as { name?: unknown; color?: unknown };
          const name =
            typeof meta.name === "string" && meta.name.trim()
              ? meta.name.trim().slice(0, 100)
              : null;
          const color =
            typeof meta.color === "string" && COLOR_REGEX.test(meta.color)
              ? meta.color
              : FALLBACK_COLOR;
          next = { status: "ready", name, color, room: importedRoomContents(parsed.data) };
        }
      } catch (err) {
        next = {
          status: "broken",
          reason: err instanceof ShareLinkError ? err.message : undefined,
        };
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCopy = () => {
    if (state.status !== "ready") return;
    const { room } = state;
    createSingleRoom({
      ...createRoomLayout([], {
        name: state.name ?? t.sharedRoom,
        width: room.width,
        length: room.length,
        color: state.color,
      }),
      corners: room.corners,
      wallColors: room.wallColors,
      flooring: room.flooring,
      ceilingHeight: room.ceilingHeight,
      wallSlopes: room.wallSlopes,
      openings: room.openings,
      items: room.items,
    });
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
          <Link
            to="/dashboard"
            aria-label="PLANUM — Dashboard"
            className="flex min-w-0 items-center gap-3 rounded-md transition-opacity hover:opacity-80"
          >
            <img
              src="/logo.svg"
              alt="PLANUM"
              className="h-10 w-10 shrink-0 object-contain rounded-md shadow-sm border border-border/20 bg-background/50 p-1"
            />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-sky-400">
              PLANUM
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        {state.status === "loading" && <p className="text-sm text-muted-foreground">…</p>}

        {state.status === "broken" && (
          <div className="space-y-4">
            <p className="text-base font-medium">{t.sharedRoomBroken}</p>
            {state.reason && <p className="text-xs text-muted-foreground">{state.reason}</p>}
            <Button asChild variant="outline">
              <Link to="/dashboard">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {t.backToDashboard}
              </Link>
            </Button>
          </div>
        )}

        {state.status === "ready" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.sharedRoom}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {state.name ?? t.sharedRoom}
              </h1>
              <p className="text-sm text-muted-foreground">
                {state.room.width} × {state.room.length} cm ·{" "}
                {lang === "de"
                  ? `${state.room.items.length} Objekte · ${state.room.openings.length} Öffnungen`
                  : `${state.room.items.length} items · ${state.room.openings.length} openings`}
              </p>
            </div>
            <RoomPlanSvg
              corners={state.room.corners}
              openings={state.room.openings}
              items={state.room.items}
              wallSlopes={state.room.wallSlopes}
              ceilingHeight={state.room.ceilingHeight}
              title={state.name ?? t.sharedRoom}
              className="w-full max-h-[60vh] rounded-lg border bg-muted/30 text-foreground"
            />
            <p className="text-xs text-muted-foreground">{t.sharedRoomNote}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={openCopy}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t.sharedRoomOpen}
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  {t.backToDashboard}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
