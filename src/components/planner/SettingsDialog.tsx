import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/ui/number-field";
import { Separator } from "@/components/ui/separator";
import type { PlannerSettings, PlannerView } from "@/types/planner";
import type { Theme } from "@/hooks/use-theme";
import { RotateCcw, HelpCircle, Moon, Sun } from "lucide-react";
import { resetApp } from "@/lib/app-reset";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PlannerSettings;
  updateSettings: (patch: Partial<PlannerSettings>) => void;
  theme: Theme;
  toggleTheme: () => void;
  // Both omitted when opened from the dashboard (no sidebar exists there
  // yet) -- see Dashboard.tsx / rooms.$roomId.tsx for who supplies them.
  sidebarCollapsed?: boolean;
  onToggleSidebarCollapsed?: () => void;
  // Omitted from the dashboard -- the tour overlay only exists inside a
  // room (see Header.tsx's own "Take the tour" entry, which this
  // complements rather than replaces).
  onTakeTour?: () => void;
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center rounded-md border overflow-hidden">
      {options.map((opt, i) => (
        <Button
          key={opt.value}
          type="button"
          variant={value === opt.value ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onChange(opt.value)}
          className={`rounded-none px-3 ${i > 0 ? "border-l" : ""}`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  updateSettings,
  theme,
  toggleTheme,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
  onTakeTour,
}: SettingsDialogProps) {
  const lang = settings.lang;
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lang === "de" ? "Einstellungen" : "Settings"}</DialogTitle>
          <DialogDescription>
            {lang === "de"
              ? "Passe den Planer an deine Vorlieben an."
              : "Tune the planner to your preferences."}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y">
          <SettingsRow label={lang === "de" ? "Design" : "Theme"}>
            <SegmentedToggle
              value={theme}
              onChange={(t) => t !== theme && toggleTheme()}
              options={[
                { value: "light", label: <Sun className="h-4 w-4" /> },
                { value: "dark", label: <Moon className="h-4 w-4" /> },
              ]}
            />
          </SettingsRow>

          <SettingsRow label={lang === "de" ? "Sprache" : "Language"}>
            <SegmentedToggle
              value={lang}
              onChange={(l) => updateSettings({ lang: l })}
              options={[
                { value: "en", label: "EN" },
                { value: "de", label: "DE" },
              ]}
            />
          </SettingsRow>

          <SettingsRow
            label={lang === "de" ? "Standardansicht" : "Default view"}
            hint={
              lang === "de" ? "Ansicht, mit der ein Raum geöffnet wird" : "View a room opens in"
            }
          >
            <SegmentedToggle<PlannerView>
              value={settings.defaultView}
              onChange={(v) => updateSettings({ defaultView: v })}
              options={[
                { value: "2d", label: "2D" },
                { value: "3d", label: "3D" },
              ]}
            />
          </SettingsRow>

          <SettingsRow
            label={lang === "de" ? "Standard-Zoom" : "Default zoom"}
            hint={lang === "de" ? "Anfangs-Zoomstufe für neue Ansichten" : "Starting zoom level"}
          >
            <NumberField
              min={0.1}
              max={2}
              value={settings.defaultZoom}
              onCommit={(v) => updateSettings({ defaultZoom: v })}
              className="w-20 h-8 text-xs"
            />
          </SettingsRow>

          <SettingsRow
            label={lang === "de" ? "Kollisionserkennung" : "Collision detection"}
            hint={
              lang === "de"
                ? "Standardmäßig aktiv beim Öffnen eines Raums"
                : "On by default when opening a room"
            }
          >
            <Switch
              checked={settings.collisionDefault}
              onCheckedChange={(v) => updateSettings({ collisionDefault: v })}
            />
          </SettingsRow>

          {onToggleSidebarCollapsed && (
            <SettingsRow
              label={lang === "de" ? "Seitenleiste eingeklappt" : "Sidebar collapsed"}
              hint={
                lang === "de" ? "Standardzustand der Seitenleiste" : "Default state of the sidebar"
              }
            >
              <Switch checked={!!sidebarCollapsed} onCheckedChange={onToggleSidebarCollapsed} />
            </SettingsRow>
          )}

          <SettingsRow
            label={lang === "de" ? "Direkteinstieg" : "Quick entry"}
            hint={
              lang === "de"
                ? "Dashboard überspringen, direkt zum letzten Raum"
                : "Skip the dashboard, jump straight to your last room"
            }
          >
            <Switch
              checked={settings.quickEntry}
              onCheckedChange={(v) => updateSettings({ quickEntry: v })}
            />
          </SettingsRow>

          {onTakeTour && (
            <>
              <Separator className="my-1" />
              <div className="py-2.5">
                <Button variant="outline" size="sm" onClick={onTakeTour} className="w-full">
                  <HelpCircle className="h-4 w-4" />
                  {lang === "de" ? "Tour erneut starten" : "Take the tour again"}
                </Button>
              </div>
            </>
          )}

          {/* Destructive, so it sits last, behind its own confirm, and is
              the only thing in the app that ever deletes saved rooms. */}
          <Separator className="my-1" />
          <div className="py-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetConfirmOpen(true)}
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              {lang === "de" ? "Alles zurücksetzen" : "Reset everything"}
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              {lang === "de"
                ? "Löscht alle Räume, Zuhauses, eigenen Katalog-Objekte und Einstellungen."
                : "Deletes every room, home, custom catalog item and setting."}
            </p>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "de" ? "Wirklich alles zurücksetzen?" : "Reset everything?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "de"
                ? "Alle einzelnen Räume, alle Zuhauses mit ihren Etagen, dein eigener Katalog und sämtliche Einstellungen werden gelöscht. Die App startet danach wie beim allerersten Besuch. Das lässt sich nicht rückgängig machen."
                : "Every single room, every home and its floors, your own catalog and all settings will be deleted. The app restarts as if you'd never used it. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "de" ? "Abbrechen" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetApp()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {lang === "de" ? "Alles löschen" : "Delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
