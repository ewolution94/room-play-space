import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Undo2,
  Redo2,
  Languages,
  Download,
  Upload,
  Eraser,
  Trash2,
  HelpCircle,
  MoreHorizontal,
  FileStack,
  Sun,
  Moon,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import type { HeaderProps } from "@/types/planner";
import { Link } from "@tanstack/react-router";
import { ExportImportDialog } from "./ExportImportDialog";
import { HoverTooltip } from "@/components/ui/hover-tooltip";

export function Header({
  t,
  lang,
  setLang,
  canUndo,
  canRedo,
  undo,
  redo,
  items,
  openings,
  buildRoomExportPreview,
  validateRoomImport,
  applyRoomImport,
  customCatalogCount,
  setResetMode,
  setTourOpen,
  setTourStep,
  theme,
  toggleTheme,
  onOpenSettings,
  viewOnly,
}: HeaderProps) {
  const [exportOpen, setExportOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const roomScopes = [{ id: "room", label: lang === "de" ? "Dieser Raum" : "This room" }];
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3">
        <div id="tour-header" className="flex min-w-0 items-center gap-3">
          {/* Mark + wordmark go to the dashboard, the way a site's logo goes
              to its home page -- and the room editor's only always-visible
              way back to the hub. Going back to the room's own home is the
              canvas's bottom-left pill instead (CanvasArea's backUrl), which
              is where the old icon-only "back to floor plan" button in this
              slot ended up: easy to miss here, self-explanatory there. */}
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
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-sky-400">
                {t.title}
              </h1>
              <p className="hidden sm:block truncate text-xs text-muted-foreground">{t.subtitle}</p>
            </div>
          </Link>
        </div>
        {/* Mobile view-only mode: every editing action below (undo/redo/
            import/export/reset/tour) is meaningless with no sidebar or
            tools to act on -- keep just navigation + theme/language. */}
        {viewOnly ? (
          <div className="flex items-center gap-2">
            <HoverTooltip content={lang === "en" ? "Deutsch" : "English"}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLang(lang === "en" ? "de" : "en")}
                className="h-9 w-9 p-0 flex items-center justify-center"
              >
                <Languages className="h-4 w-4" />
              </Button>
            </HoverTooltip>
            <HoverTooltip
              content={
                theme === "light"
                  ? lang === "de"
                    ? "Dunkelmodus aktivieren"
                    : "Switch to Dark Mode"
                  : lang === "de"
                    ? "Hellmodus aktivieren"
                    : "Switch to Light Mode"
              }
            >
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="h-9 w-9 p-0 flex items-center justify-center"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                )}
              </Button>
            </HoverTooltip>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {/* History: a single segmented control reads as one unit rather
                than two separate buttons, and is the most frequently used
                pair here -- kept unconditionally visible, unlike everything
                past it. */}
            <div className="flex items-center rounded-md border overflow-hidden shrink-0">
              <HoverTooltip content="Ctrl+Z">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={!canUndo}
                  className="rounded-none px-2 sm:px-3"
                >
                  <Undo2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t.undo}</span>
                </Button>
              </HoverTooltip>
              <div className="h-5 w-px bg-border" />
              <HoverTooltip content="Ctrl+Shift+Z">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={!canRedo}
                  className="rounded-none px-2 sm:px-3"
                >
                  <Redo2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t.redo}</span>
                </Button>
              </HoverTooltip>
            </div>

            <HoverTooltip
              content={
                theme === "light"
                  ? lang === "de"
                    ? "Dunkelmodus aktivieren"
                    : "Switch to Dark Mode"
                  : lang === "de"
                    ? "Hellmodus aktivieren"
                    : "Switch to Light Mode"
              }
            >
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="h-9 w-9 p-0 flex items-center justify-center shrink-0"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                )}
              </Button>
            </HoverTooltip>

            {/* File operations grouped behind one menu instead of two
                standalone buttons -- export/import are related actions,
                reached about equally often, neither urgent enough to need
                one-click access. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                  <FileStack className="h-4 w-4" />
                  <span className="hidden sm:inline">{lang === "de" ? "Datei" : "File"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setExportOpen(true)}>
                  <Download className="mr-2 h-4 w-4" /> {t.export}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" /> {t.import}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Everything else -- the tour prompt, language, and the two
                destructive reset actions -- lives behind one "More" menu.
                None of these are reached for on every visit, and tucking
                Clear items/Clear all behind a menu (rather than standalone
                buttons at the top level) also makes them harder to hit by
                accident. */}
            <DropdownMenu>
              <HoverTooltip content="More">
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </HoverTooltip>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    setTourStep(0);
                    setTourOpen(true);
                  }}
                >
                  <HelpCircle className="mr-2 h-4 w-4" /> {t.takeTheTour}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  {lang === "de" ? "Einstellungen" : "Settings"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang(lang === "en" ? "de" : "en")}>
                  <Languages className="mr-2 h-4 w-4" />
                  {lang === "en" ? "Deutsch" : "English"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setResetMode("items")}
                  disabled={items.length === 0}
                  className="text-rose-500 focus:text-rose-600"
                >
                  <Eraser className="mr-2 h-4 w-4" /> {t.resetItems}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setResetMode("all")}
                  disabled={items.length === 0 && openings.length === 0}
                  className="text-rose-500 focus:text-rose-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> {t.resetAll}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <ExportImportDialog
        lang={lang}
        mode="export"
        open={exportOpen}
        onOpenChange={setExportOpen}
        title={lang === "de" ? "Raum exportieren" : "Export Room"}
        description={
          lang === "de"
            ? "Speichert den aktuellen Raum als JSON-Datei."
            : "Saves the current room as a JSON file."
        }
        scopes={roomScopes}
        buildExport={(_scopeId, includeCatalog) => buildRoomExportPreview(includeCatalog)}
        includeOption={{
          label: lang === "de" ? "Meine Katalog-Elemente einschließen" : "Include My Catalog items",
          hint:
            customCatalogCount > 0
              ? lang === "de"
                ? `${customCatalogCount} gespeicherte(s) Element(e) werden in diese Datei gebündelt.`
                : `${customCatalogCount} saved item(s) will be bundled into this file.`
              : lang === "de"
                ? "Du hast noch keine gespeicherten Katalog-Elemente."
                : "You have no saved catalog items yet.",
          disabled: customCatalogCount === 0,
        }}
      />
      <ExportImportDialog
        lang={lang}
        mode="import"
        open={importOpen}
        onOpenChange={setImportOpen}
        title={lang === "de" ? "Raum importieren" : "Import Room"}
        description={
          lang === "de"
            ? "Ersetzt den aktuellen Raum durch den Inhalt einer JSON-Datei."
            : "Replaces the current room with the contents of a JSON file."
        }
        scopes={roomScopes}
        validateImport={(_scopeId, raw, includeCatalog) => validateRoomImport(raw, includeCatalog)}
        applyImport={(_scopeId, raw, includeCatalog) => applyRoomImport(raw, includeCatalog)}
        includeOption={{
          label:
            lang === "de" ? "Auch Katalog-Elemente importieren" : "Also import My Catalog items",
          hint:
            lang === "de"
              ? "Falls diese Datei gespeicherte Katalog-Elemente enthält, werden neue zu Meinem Katalog hinzugefügt."
              : "If this file includes saved catalog items, any new ones are added to My Catalog.",
        }}
      />
    </header>
  );
}
