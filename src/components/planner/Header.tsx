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
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3">
        <div id="tour-header" className="flex min-w-0 items-center gap-3">
          {backUrl ? (
            <Button variant="ghost" size="sm" asChild className="h-9 w-9 p-0 shrink-0">
              <Link to={backUrl} title={lang === "de" ? "Zurück zum Grundriss" : "Back to Floor Plan"}>
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
          {roomsUrl && (
            <Button variant="outline" size="sm" asChild className="ml-2 gap-1.5 hidden md:flex">
              <Link to={roomsUrl}>
                <LayoutGrid className="h-4 w-4" />
                <span>{lang === "de" ? "Grundrisse" : "Floor Plans"}</span>
              </Link>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {roomsUrl && (
            <Button variant="outline" size="sm" asChild className="md:hidden h-9 w-9 p-0">
              <Link to={roomsUrl} title={lang === "de" ? "Grundrisse" : "Floor Plans"}>
                <LayoutGrid className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} title="Ctrl+Z" className="px-2 sm:px-3">
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
            title={theme === "light" ? (lang === "de" ? "Dunkelmodus aktivieren" : "Switch to Dark Mode") : (lang === "de" ? "Hellmodus aktivieren" : "Switch to Light Mode")}
            className="h-9 w-9 p-0 flex items-center justify-center"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" title="More">
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
              <DropdownMenuItem onClick={() => setResetMode("items")} disabled={items.length === 0}>
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
      </div>
    </header>
  );
}
