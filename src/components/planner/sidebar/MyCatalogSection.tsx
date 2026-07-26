import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookmarkPlus, Download, Pencil, Trash2, Upload } from "lucide-react";
import type { Preset, CatalogSaveDraft, UseCustomCatalogReturn } from "@/types/planner";
import { customCatalogItemToPreset, customCatalogArraySchema } from "@/lib/custom-catalog";
import { buildExportFilename } from "@/lib/export-filename";
import { ExportImportDialog } from "@/components/planner/ExportImportDialog";
import { toast } from "sonner";

interface MyCatalogSectionProps {
  lang: string;
  threeDActive: boolean;
  addPreset: (preset: Preset) => void;
  customCatalog: UseCustomCatalogReturn;
  openSaveDialog: (draft: CatalogSaveDraft) => void;
}

/**
 * "My Catalog" tab: just the user's own saved items (see InspectorSection.tsx's
 * "Save to My Catalog" for the only way to add one). The built-in IKEA
 * catalog lives in the regular Add-tab catalog instead, as its own "IKEA"
 * section (see buildCatalogByLayer in lib/custom-catalog.ts) -- per feedback,
 * a separate IKEA sub-tab here was one extra click away from where users
 * actually go to browse/add furniture, for no real benefit.
 */
export function MyCatalogSection({
  lang,
  threeDActive,
  addPreset,
  customCatalog,
  openSaveDialog,
}: MyCatalogSectionProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const catalogScopes = [{ id: "catalog", label: lang === "de" ? "Mein Katalog" : "My Catalog" }];

  const buildCatalogExportPreview = () => ({
    summaryLines: [
      lang === "de"
        ? `${customCatalog.items.length} Elemente`
        : `${customCatalog.items.length} items`,
    ],
    filename: buildExportFilename(lang === "de" ? "mein-katalog" : "my-catalog"),
    json: customCatalog.items,
  });

  const validateCatalogImport = (_scopeId: string, raw: unknown) => {
    const parsed = customCatalogArraySchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false as const,
        error:
          lang === "de"
            ? "Ungültiges Format — diese Datei sieht nicht wie ein exportierter Katalog aus."
            : "Invalid format — this file doesn't look like an exported catalog.",
      };
    }
    return {
      ok: true as const,
      summaryLines: [
        lang === "de" ? `${parsed.data.length} Elemente` : `${parsed.data.length} items`,
      ],
    };
  };

  const applyCatalogImport = (_scopeId: string, raw: unknown) => {
    const parsed = customCatalogArraySchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(lang === "de" ? "Fehler beim Importieren" : "Failed to import file");
      return;
    }
    customCatalog.replaceAll(parsed.data);
    toast.success(
      lang === "de" ? "Katalog erfolgreich importiert" : "Catalog imported successfully",
    );
  };

  return (
    <Card id="tour-my-catalog" className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
      <div className="px-4 py-3 font-semibold text-sm border-b border-border/20 flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5">
          <BookmarkPlus className="h-4 w-4 text-primary" />
          {lang === "de" ? "Mein Katalog" : "My Catalog"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={lang === "de" ? "Katalog exportieren" : "Export catalog"}
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={lang === "de" ? "Katalog importieren" : "Import catalog"}
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ExportImportDialog
        lang={lang as "en" | "de"}
        mode="export"
        open={exportOpen}
        onOpenChange={setExportOpen}
        title={lang === "de" ? "Katalog exportieren" : "Export My Catalog"}
        description={
          lang === "de"
            ? "Speichert deine gespeicherten Katalog-Elemente als JSON-Datei."
            : "Saves your saved custom catalog items as a JSON file."
        }
        scopes={catalogScopes}
        buildExport={buildCatalogExportPreview}
      />
      <ExportImportDialog
        lang={lang as "en" | "de"}
        mode="import"
        open={importOpen}
        onOpenChange={setImportOpen}
        title={lang === "de" ? "Katalog importieren" : "Import My Catalog"}
        description={
          lang === "de"
            ? "Ersetzt deinen gespeicherten Katalog durch den Inhalt einer JSON-Datei."
            : "Replaces your saved catalog with the contents of a JSON file."
        }
        scopes={catalogScopes}
        validateImport={validateCatalogImport}
        applyImport={applyCatalogImport}
      />

      <CardContent className="p-3">
        {customCatalog.items.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4 px-2 leading-relaxed">
            {lang === "de"
              ? "Noch keine gespeicherten Elemente. Wähle ein platziertes Möbelstück aus und nutze „Zu meinem Katalog speichern“ im Eigenschaften-Editor."
              : "No saved items yet. Select a placed item on the canvas and use “Save to My Catalog” in the Inspector."}
          </p>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
            {[...customCatalog.items]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((item) => {
                const label = lang === "de" ? item.nameDe : item.nameEn;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (threeDActive) return;
                      addPreset(customCatalogItemToPreset(item));
                    }}
                    className={`flex items-center justify-between gap-2 p-1.5 rounded-md border text-xs transition-all duration-200 bg-background/40 border-border/40 ${
                      threeDActive
                        ? "opacity-50 pointer-events-none"
                        : "cursor-pointer hover:bg-accent/40 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded border border-foreground/10"
                        style={{ background: item.color }}
                      />
                      <span className="truncate">{label}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {item.w}×{item.l}cm
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={threeDActive}
                        className="h-5 w-5 hover:bg-primary/10 hover:text-primary disabled:opacity-40 disabled:pointer-events-none"
                        title={lang === "de" ? "Bearbeiten" : "Edit"}
                        onClick={(e) => {
                          e.stopPropagation();
                          openSaveDialog({
                            editingId: item.id,
                            name: label,
                            w: item.w,
                            l: item.l,
                            color: item.color,
                            sourceKey: item.sourceKey,
                            layer: item.layer,
                            shape: item.shape,
                          });
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={threeDActive}
                        className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:pointer-events-none"
                        title={lang === "de" ? "Löschen" : "Delete"}
                        onClick={(e) => {
                          e.stopPropagation();
                          customCatalog.removeItem(item.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
