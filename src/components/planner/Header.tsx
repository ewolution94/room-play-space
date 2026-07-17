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
  Sun,
  Moon,
  ArrowLeft,
  LayoutGrid,
} from "lucide-react";
import type { HeaderProps } from "@/types/planner";
import { Link } from "@tanstack/react-router";
import { useMobileViewOnly } from "@/hooks/use-mobile-view-only";

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
  exportJSON,
  fileInputRef,
  onImportFile,
  setResetMode,
  setTourOpen,
  setTourStep,
  theme,
  toggleTheme,
  backUrl,
  roomsUrl,
  viewOnly,
}: HeaderProps) {
  // Drives the roomsUrl cross-navigation link below: a wide labeled button
  // when there's enough room (landscape, at any width -- including
  // desktop), an icon-only button on the right when there isn't (portrait).
  // Previously this was decided by two independent, mismatched thresholds
  // (a `hidden md:flex` CSS breakpoint at 768px for the wide button, and
  // the JS-driven `viewOnly` prop, itself gated at 1024px) which could both
  // evaluate true at once -- e.g. a landscape phone at ~900px wide is under
  // 1024 (so viewOnly's icon button rendered) but over 768 (so the wide
  // button's CSS also matched), showing both simultaneously. Using a
  // single `isPortrait` boolean for both instead guarantees exactly one
  // ever renders.
  const { isPortrait } = useMobileViewOnly();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3">
        <div id="tour-header" className="flex min-w-0 items-center gap-3">
          {backUrl ? (
            <Button variant="ghost" size="sm" asChild className="h-9 w-9 p-0 shrink-0">
              <Link
                to={backUrl}
                title={lang === "de" ? "Zurück zum Grundriss" : "Back to Floor Plan"}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <img
              src="/logo.png"
              alt="Büro Planner Logo"
              className="h-10 w-10 shrink-0 object-contain rounded-md shadow-sm border border-border/20 bg-background/50 p-1"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-sky-400">
              {t.title}
            </h1>
            <p className="hidden sm:block truncate text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
          {roomsUrl && !isPortrait && (
            <Button variant="outline" size="sm" asChild className="ml-2 gap-1.5 shrink-0">
              <Link to={roomsUrl}>
                <LayoutGrid className="h-4 w-4" />
                <span>{lang === "de" ? "Grundrisse" : "Floor Plans"}</span>
              </Link>
            </Button>
          )}
        </div>
        {/* Mobile view-only mode: every editing action below (undo/redo/
            import/export/reset/tour) is meaningless with no sidebar or
            tools to act on -- keep just navigation + theme/language. */}
        {viewOnly ? (
          <div className="flex items-center gap-2">
            {roomsUrl && isPortrait && (
              <Button variant="outline" size="sm" asChild className="h-9 w-9 p-0">
                <Link to={roomsUrl} title={lang === "de" ? "Grundrisse" : "Floor Plans"}>
                  <LayoutGrid className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLang(lang === "en" ? "de" : "en")}
              className="h-9 w-9 p-0 flex items-center justify-center"
              title={lang === "en" ? "Deutsch" : "English"}
            >
              <Languages className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={
                theme === "light"
                  ? lang === "de"
                    ? "Dunkelmodus aktivieren"
                    : "Switch to Dark Mode"
                  : lang === "de"
                    ? "Hellmodus aktivieren"
                    : "Switch to Light Mode"
              }
              className="h-9 w-9 p-0 flex items-center justify-center"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {roomsUrl && isPortrait && (
              <Button variant="outline" size="sm" asChild className="h-9 w-9 p-0">
                <Link to={roomsUrl} title={lang === "de" ? "Grundrisse" : "Floor Plans"}>
                  <LayoutGrid className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              title="Ctrl+Z"
              className="px-2 sm:px-3"
            >
              <Undo2 className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{t.undo}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
              title="Ctrl+Shift+Z"
              className="px-2 sm:px-3"
            >
              <Redo2 className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{t.redo}</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={
                theme === "light"
                  ? lang === "de"
                    ? "Dunkelmodus aktivieren"
                    : "Switch to Dark Mode"
                  : lang === "de"
                    ? "Hellmodus aktivieren"
                    : "Switch to Light Mode"
              }
              className="h-9 w-9 p-0 flex items-center justify-center"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              )}
            </Button>
            {/* Inline on desktop -- only collapses into the "More" menu below
              the lg breakpoint, once there's genuinely not enough header
              width for these as standalone buttons. */}
            <div className="hidden lg:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTourStep(0);
                  setTourOpen(true);
                }}
                className="gap-1.5"
              >
                <HelpCircle className="h-4 w-4" />
                <span>{t.takeTheTour}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLang(lang === "en" ? "de" : "en")}
                className="gap-1.5"
              >
                <Languages className="h-4 w-4" />
                <span>{lang === "en" ? "Deutsch" : "English"}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportJSON} className="gap-1.5">
                <Download className="h-4 w-4" />
                <span>{t.export}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                <span>{t.import}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetMode("items")}
                disabled={items.length === 0}
                className="gap-1.5"
              >
                <Eraser className="h-4 w-4" />
                <span>{t.resetItems}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetMode("all")}
                disabled={items.length === 0 && openings.length === 0}
                className="gap-1.5 text-rose-500 hover:text-rose-600 border-rose-200/60 hover:border-rose-300 dark:border-rose-900/40"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t.resetAll}</span>
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" title="More" className="lg:hidden">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    setTourStep(0);
                    setTourOpen(true);
                  }}
                >
                  <HelpCircle className="mr-2 h-4 w-4" /> {t.takeTheTour}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLang(lang === "en" ? "de" : "en")}>
                  <Languages className="mr-2 h-4 w-4" />
                  {lang === "en" ? "Deutsch" : "English"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportJSON}>
                  <Download className="mr-2 h-4 w-4" /> {t.export}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> {t.import}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setResetMode("items")}
                  disabled={items.length === 0}
                >
                  <Eraser className="mr-2 h-4 w-4" /> {t.resetItems}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setResetMode("all")}
                  disabled={items.length === 0 && openings.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> {t.resetAll}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
