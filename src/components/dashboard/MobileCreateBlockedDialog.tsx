import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Lang } from "@/types/planner";

interface MobileCreateBlockedDialogProps {
  lang: Lang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shown when a mobile visitor taps a creation flow that needs precise
 * dragging or typing (a room from scratch, the guided wizard, a new home, or
 * a file import) -- explains why the button didn't do the usual thing rather
 * than just disabling it with no context. "From example" actions never show
 * this: they only ever open something already-built to look at, which works
 * fine on a phone (see the room/view-only treatment this mirrors in
 * RoomEditor.tsx and home.$homeId.index.tsx).
 */
export function MobileCreateBlockedDialog({
  lang,
  open,
  onOpenChange,
}: MobileCreateBlockedDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {lang === "de" ? "Auf dem Handy nicht verfügbar" : "Not available on mobile"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {lang === "de"
              ? "Etwas Neues einzurichten braucht mehr Platz zum Ziehen und Eintippen, als ein Handybildschirm bietet. Öffne PLANUM auf einem größeren Bildschirm, um zu erstellen -- zum Ansehen und Stöbern funktioniert das Handy weiterhin."
              : "Setting something new up needs more room to drag and type than a phone screen gives you. Open PLANUM on a larger screen to create -- browsing and viewing what's already there still works fine on mobile."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            {lang === "de" ? "Verstanden" : "Got it"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
