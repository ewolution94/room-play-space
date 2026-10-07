import { Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationStrings } from "@/lib/planner-translations";

interface TourOfferProps {
  t: TranslationStrings;
  /** true: start the tour; false: not now. Either way it isn't offered again. */
  onAnswer: (start: boolean) => void;
}

/**
 * The first-visit tour, offered rather than opened: a small card in the
 * corner that leaves the room itself in view (useRoomPlanner decides when).
 * Not a toast, so it can't be swiped away unanswered or buried under the
 * editor's own messages.
 */
export function TourOffer({ t, onAnswer }: TourOfferProps) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-offer-title"
      className="fixed bottom-24 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border/60 bg-background/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-start gap-2.5">
        <Compass className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p id="tour-offer-title" className="text-sm font-semibold">
            {t.tourOfferTitle}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.tourOfferBody}</p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => onAnswer(true)}>
              {t.tourOfferStart}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => onAnswer(false)}
            >
              {t.tourOfferLater}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAnswer(false)}
          aria-label={t.tourOfferLater}
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
