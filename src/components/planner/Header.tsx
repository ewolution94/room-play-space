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
} from "lucide-react";
import type { HeaderProps } from "@/types/planner";

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
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/logo.png"
            alt="Büro Planner Logo"
            className="h-10 w-10 shrink-0 object-contain rounded-md shadow-sm border border-border/20 bg-background/50 p-1"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-sky-400">
              {t.title}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} title="Ctrl+Z">
            <Undo2 className="mr-1 h-4 w-4" /> {t.undo}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            title="Ctrl+Shift+Z"
          >
            <Redo2 className="mr-1 h-4 w-4" /> {t.redo}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" title="More">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTourStep(0);
              setTourOpen(true);
            }}
            title={t.takeTheTour}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
