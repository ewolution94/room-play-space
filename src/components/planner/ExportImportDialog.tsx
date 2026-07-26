import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Download,
  Upload,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileJson,
} from "lucide-react";
import type {
  Lang,
  ExportImportScope,
  ExportPreviewData,
  ImportValidationResult,
} from "@/types/planner";
import { sanitizeFilenameForDownload } from "@/lib/export-filename";

interface ExportImportDialogProps {
  lang: Lang;
  mode: "export" | "import";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  scopeLabel?: string;
  scopes: ExportImportScope[];
  /** Required (and only used) when mode === "export". Called with the
   * currently-selected scope's id and the includeOption checkbox's current
   * state every time either changes, so the caller can build fresh preview
   * data (current items/openings/etc.) on demand rather than the dialog
   * caching anything stale. */
  buildExport?: (scopeId: string, includeExtra: boolean) => ExportPreviewData;
  /** Required (and only used) when mode === "import". Called with the raw
   * parsed JSON from the chosen file and the includeOption checkbox's
   * current state every time either changes, purely to compute the preview
   * -- must NOT mutate app state. */
  validateImport?: (scopeId: string, raw: unknown, includeExtra: boolean) => ImportValidationResult;
  /** Required (and only used) when mode === "import". Called once, on
   * confirm, with the same raw JSON that already passed validateImport plus
   * the includeOption checkbox's current state -- this is where the caller
   * actually re-parses/applies it to app state. */
  applyImport?: (scopeId: string, raw: unknown, includeExtra: boolean) => void;
  /** Optional secondary opt-out toggle shown in both export and import
   * modes (e.g. "Include My Catalog items") -- defaults to checked. Its
   * state is threaded through to buildExport/validateImport/applyImport as
   * their `includeExtra` argument; the dialog itself has no opinion on what
   * "include" actually means, that's entirely up to the caller. Omit this
   * prop for a dialog that has nothing extra to bundle -- buildExport/
   * validateImport/applyImport still receive `includeExtra`, always `true`
   * in that case, so callers that don't care can simply ignore the arg. */
  includeOption?: {
    label: string;
    /** Small muted line under the label -- e.g. a live item count on
     * export, or a static explanation on import. */
    hint?: string;
    disabled?: boolean;
  };
}

const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024; // 2MB, mirrors the previous inline check

function RawJsonPreview({
  json,
  show,
  onToggle,
  lang,
}: {
  json: unknown;
  show: boolean;
  onToggle: () => void;
  lang: Lang;
}) {
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {show ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <FileJson className="h-3.5 w-3.5" />
        {show
          ? lang === "de"
            ? "Rohes JSON ausblenden"
            : "Hide raw JSON"
          : lang === "de"
            ? "Rohes JSON anzeigen"
            : "Show raw JSON"}
      </button>
      {show && (
        <pre className="max-h-56 overflow-auto rounded-md border bg-muted/50 p-3 text-[11px] leading-relaxed">
          {JSON.stringify(json, null, 2)}
        </pre>
      )}
    </div>
  );
}

function SummaryCard({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <ul className="space-y-1 text-sm">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span className="break-words">{text}</span>
    </div>
  );
}

export function ExportImportDialog({
  lang,
  mode,
  open,
  onOpenChange,
  title,
  description,
  scopeLabel,
  scopes,
  buildExport,
  validateImport,
  applyImport,
  includeOption,
}: ExportImportDialogProps) {
  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "");
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJson, setRawJson] = useState<unknown>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  // Opt-out by design (see includeOption's own doc comment) -- starts
  // checked every time the dialog opens.
  const [includeChecked, setIncludeChecked] = useState(true);
  // The editable export filename -- seeded from buildExport's auto-
  // generated suggestion (see export-filename.ts's buildExportFilename)
  // every time that suggestion changes (fresh scope, freshly opened
  // dialog), but freely overwritten by the user from then on.
  const [exportFilename, setExportFilename] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fresh start every time the dialog is opened -- a stale scope, staged
  // file, or expanded JSON view from the last time it was open would be
  // confusing to land back on.
  useEffect(() => {
    if (open) {
      setScopeId(scopes[0]?.id ?? "");
      setShowRawJson(false);
      setRawJson(null);
      setFileName(null);
      setParseError(null);
      setDragActive(false);
      setExportFilename("");
      setIncludeChecked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const exportPreview = useMemo(() => {
    if (mode !== "export" || !open || !buildExport || !scopeId) return null;
    return buildExport(scopeId, includeChecked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open, scopeId, includeChecked]);

  // Re-seeds the editable filename field whenever a fresh suggestion comes
  // in (dialog just opened, or the scope changed) -- but typing in the
  // field itself never re-triggers this, since exportPreview.filename
  // doesn't change from that. Strips the .json extension for display/
  // editing -- it's re-appended by sanitizeFilenameForDownload on actual
  // download, and shown as a fixed suffix next to the input in the
  // meantime, so the user only ever edits the meaningful part of the name.
  useEffect(() => {
    if (exportPreview) setExportFilename(exportPreview.filename.replace(/\.json$/i, ""));
  }, [exportPreview]);

  const importValidation = useMemo(() => {
    if (mode !== "import" || rawJson === null || !validateImport) return null;
    return validateImport(scopeId, rawJson, includeChecked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rawJson, scopeId, includeChecked]);

  const handleFile = async (file: File) => {
    setParseError(null);
    setRawJson(null);
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setParseError(
        lang === "de" ? "Datei überschreitet die 2-MB-Grenze." : "File exceeds the 2MB limit.",
      );
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setRawJson(parsed);
      setFileName(file.name);
    } catch {
      setParseError(
        lang === "de"
          ? "Datei konnte nicht als JSON gelesen werden."
          : "Couldn't read the file as JSON.",
      );
    }
  };

  const handleDownload = () => {
    if (!exportPreview) return;
    const blob = new Blob([JSON.stringify(exportPreview.json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeFilenameForDownload(exportFilename || exportPreview.filename);
    a.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  const handleConfirmImport = () => {
    if (!importValidation?.ok || !applyImport) return;
    applyImport(scopeId, rawJson, includeChecked);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-md border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            {mode === "export" ? (
              <Download className="h-5 w-5 text-primary" />
            ) : (
              <Upload className="h-5 w-5 text-primary" />
            )}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-1">
          {scopes.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {scopeLabel ?? (lang === "de" ? "Umfang" : "Scope")}
              </Label>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${scopes.length}, 1fr)` }}
              >
                {scopes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScopeId(s.id)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      scopeId === s.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {includeOption && (
            <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 p-2.5">
              <Checkbox
                id="export-import-include-option"
                checked={includeChecked}
                onCheckedChange={(v) => setIncludeChecked(v === true)}
                disabled={includeOption.disabled}
                className="mt-0.5"
              />
              <label
                htmlFor="export-import-include-option"
                className={`text-xs leading-snug ${includeOption.disabled ? "text-muted-foreground" : "cursor-pointer select-none"}`}
              >
                <span className="font-medium">{includeOption.label}</span>
                {includeOption.hint && (
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    {includeOption.hint}
                  </span>
                )}
              </label>
            </div>
          )}

          {mode === "export" && exportPreview && (
            <>
              <div className="space-y-1.5">
                <Label
                  htmlFor="export-filename"
                  className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {lang === "de" ? "Dateiname" : "Filename"}
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="export-filename"
                    value={exportFilename}
                    onChange={(e) => setExportFilename(e.target.value)}
                    placeholder={exportPreview.filename.replace(/\.json$/i, "")}
                    className="font-mono text-xs"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">.json</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {lang === "de" ? "Vorschau" : "Preview"}
                </Label>
                <SummaryCard lines={exportPreview.summaryLines} />
              </div>
              <RawJsonPreview
                json={exportPreview.json}
                show={showRawJson}
                onToggle={() => setShowRawJson((v) => !v)}
                lang={lang}
              />
            </>
          )}

          {mode === "import" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleFile(file);
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/40"
                }`}
              >
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">
                  {fileName ? (
                    <span className="font-medium text-foreground">{fileName}</span>
                  ) : lang === "de" ? (
                    <>
                      JSON-Datei hierher ziehen oder{" "}
                      <span className="text-primary">klicken zum Auswählen</span>
                    </>
                  ) : (
                    <>
                      Drag & drop a JSON file, or{" "}
                      <span className="text-primary">click to browse</span>
                    </>
                  )}
                </div>
              </div>

              {parseError && <ErrorBanner text={parseError} />}

              {!parseError && importValidation && !importValidation.ok && (
                <ErrorBanner text={importValidation.error} />
              )}

              {!parseError && importValidation?.ok && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {lang === "de" ? "Vorschau" : "Preview"}
                    </Label>
                    <SummaryCard lines={importValidation.summaryLines} />
                  </div>
                  <RawJsonPreview
                    json={rawJson}
                    show={showRawJson}
                    onToggle={() => setShowRawJson((v) => !v)}
                    lang={lang}
                  />
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {lang === "de" ? "Abbrechen" : "Cancel"}
          </Button>
          {mode === "export" ? (
            <Button type="button" onClick={handleDownload} disabled={!exportPreview}>
              <Download className="mr-1.5 h-4 w-4" />
              {lang === "de" ? "Herunterladen" : "Download"}
            </Button>
          ) : (
            <Button type="button" onClick={handleConfirmImport} disabled={!importValidation?.ok}>
              <Upload className="mr-1.5 h-4 w-4" />
              {lang === "de" ? "Importieren" : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
