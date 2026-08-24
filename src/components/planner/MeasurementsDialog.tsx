import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardCopy, Download } from "lucide-react";
import { toast } from "sonner";
import type { TranslationStrings } from "@/lib/planner-translations";
import type { RoomMeasurements } from "@/lib/measurements";

interface MeasurementsDialogProps {
  t: TranslationStrings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already-grouped rows, one entry per non-empty room (see
   * measureRoom/measureHome in lib/measurements.ts) -- this component only
   * renders, it never groups. */
  rooms: RoomMeasurements[];
  /** Base filename (no extension) for the CSV download. */
  filenameBase: string;
  /** "room" hides the per-room heading (there's only ever one section, so
   * it would just repeat the dialog title); "home" shows one heading per
   * room so a multi-room list stays legible. */
  scope: "room" | "home";
}

function sanitizeForFilename(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-");
  return trimmed || "measurements";
}

function toPlainText(rooms: RoomMeasurements[], scope: "room" | "home"): string {
  const lines: string[] = [];
  rooms.forEach((room, i) => {
    if (i > 0) lines.push("");
    if (scope === "home") lines.push(room.roomName);
    for (const row of room.rows) {
      lines.push(`${row.count}× ${row.name} — ${row.length}×${row.width}×${row.height}cm`);
    }
  });
  return lines.join("\n");
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rooms: RoomMeasurements[], scope: "room" | "home"): string {
  const header =
    scope === "home"
      ? ["Room", "Name", "Length (cm)", "Width (cm)", "Height (cm)", "Count"]
      : ["Name", "Length (cm)", "Width (cm)", "Height (cm)", "Count"];
  const lines = [header.join(",")];
  for (const room of rooms) {
    for (const row of room.rows) {
      const fields =
        scope === "home"
          ? [room.roomName, row.name, row.length, row.width, row.height, row.count]
          : [row.name, row.length, row.width, row.height, row.count];
      lines.push(fields.map(csvEscape).join(","));
    }
  }
  return lines.join("\n");
}

export function MeasurementsDialog({
  t,
  open,
  onOpenChange,
  rooms,
  filenameBase,
  scope,
}: MeasurementsDialogProps) {
  const isEmpty = rooms.every((r) => r.rows.length === 0);

  const handleCopy = async () => {
    // The Clipboard API can reject for reasons entirely outside this app's
    // control -- no permission granted, an insecure context, a permissions
    // policy blocking it in an embedded frame -- so an uncaught rejection
    // here would fail silently (a console error, no feedback) instead of
    // telling the user to select-and-copy the table by hand instead.
    try {
      await navigator.clipboard.writeText(toPlainText(rooms, scope));
      toast.success(t.measurementsCopied);
    } catch {
      toast.error(t.measurementsCopyFailed);
    }
  };

  const handleDownloadCsv = () => {
    const blob = new Blob([toCsv(rooms, scope)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeForFilename(filenameBase)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.measurementsTitle}</DialogTitle>
          <DialogDescription>
            {scope === "home" ? t.measurementsDescriptionHome : t.measurementsDescriptionRoom}
          </DialogDescription>
        </DialogHeader>

        {isEmpty ? (
          <p className="text-sm text-muted-foreground italic p-2">{t.measurementsEmpty}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-4 -mx-1 px-1">
            {rooms.map((room) => (
              <div key={room.roomId}>
                {scope === "home" && (
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {room.roomName}
                  </h4>
                )}
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-1 pr-2 font-medium">{t.measurementsColName}</th>
                      <th className="py-1 pr-2 font-medium">{t.measurementsColDims}</th>
                      <th className="py-1 font-medium text-right">{t.measurementsColCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0">
                        <td className="py-1 pr-2">{row.name}</td>
                        <td className="py-1 pr-2 text-muted-foreground">
                          {row.length}×{row.width}×{row.height}
                        </td>
                        <td className="py-1 text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={isEmpty}>
            <ClipboardCopy className="h-4 w-4 mr-1.5" /> {t.measurementsCopy}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadCsv} disabled={isEmpty}>
            <Download className="h-4 w-4 mr-1.5" /> {t.measurementsDownloadCsv}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
