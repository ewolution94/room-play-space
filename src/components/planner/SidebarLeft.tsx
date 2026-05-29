import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Square } from "lucide-react";
import { PRESETS, PRESET_ICON } from "@/lib/planner-presets";
import type { SidebarLeftProps } from "@/types/planner";

export function SidebarLeft({
  t,
  lang,
  addPreset,
  nName,
  setNName,
  nW,
  setNW,
  nL,
  setNL,
  nColor,
  setNColor,
  addCustomBox,
  oKind,
  setOKind,
  oWall,
  setOWall,
  oPos,
  setOPos,
  oWidth,
  setOWidth,
  addOpening,
  openings,
  updateOpening,
  removeOpening,
}: SidebarLeftProps) {
  // Group presets by category for catalog rendering
  const categorized = useMemo(() => {
    const map: Record<string, Preset[]> = {};
    for (const p of PRESETS) {
      (map[p.category] ||= []).push(p);
    }
    return map;
  }, []);

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.catalog}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(categorized).map(([cat, list]) => (
            <div key={cat}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.categories[cat] ?? cat}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {list.map((p) => {
                  const Icon = PRESET_ICON[p.key] ?? Square;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => addPreset(p)}
                      className="group flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border bg-card p-1 text-center transition hover:border-foreground hover:bg-accent"
                      title={`${lang === "de" ? p.nameDe : p.nameEn} (${p.w}×${p.l}cm)`}
                    >
                      <Icon className="h-5 w-5 text-foreground/80" strokeWidth={1.5} />
                      <span className="line-clamp-1 text-[9px] leading-tight text-muted-foreground">
                        {lang === "de" ? p.nameDe : p.nameEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.customBox}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t.name}</Label>
            <Input
              value={nName}
              onChange={(e) => setNName(e.target.value)}
              placeholder={t.namePlaceholder}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t.width}</Label>
              <Input type="number" value={nW} onChange={(e) => setNW(+e.target.value || 0)} />
            </div>
            <div>
              <Label>{t.length}</Label>
              <Input type="number" value={nL} onChange={(e) => setNL(+e.target.value || 0)} />
            </div>
          </div>
          <div>
            <Label>{t.color}</Label>
            <input
              type="color"
              value={nColor}
              onChange={(e) => setNColor(e.target.value)}
              className="h-9 w-full cursor-pointer rounded-md border bg-background"
            />
          </div>
          <Button onClick={addCustomBox} className="w-full" size="sm">
            <Plus className="mr-1 h-4 w-4" /> {t.addItem}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.openings}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t.type}</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={oKind}
                onChange={(e) => setOKind(e.target.value as "door" | "window")}
              >
                <option value="door">{t.door}</option>
                <option value="window">{t.window}</option>
              </select>
            </div>
            <div>
              <Label>{t.wall}</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={oWall}
                onChange={(e) => setOWall(e.target.value as Opening["wall"])}
              >
                <option value="top">{t.top}</option>
                <option value="bottom">{t.bottom}</option>
                <option value="left">{t.left}</option>
                <option value="right">{t.right}</option>
              </select>
            </div>
            <div>
              <Label>{t.position}</Label>
              <Input type="number" value={oPos} onChange={(e) => setOPos(+e.target.value || 0)} />
            </div>
            <div>
              <Label>{t.width}</Label>
              <Input
                type="number"
                value={oWidth}
                onChange={(e) => setOWidth(+e.target.value || 0)}
              />
            </div>
          </div>
          <Button onClick={addOpening} size="sm" className="w-full">
            <Plus className="mr-1 h-4 w-4" /> {t.addOpening}
          </Button>
          <Separator />
          <ul className="space-y-1 text-sm">
            {openings.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-1 rounded-md border px-2 py-1"
              >
                <span className="min-w-0 flex-1 truncate capitalize">
                  {o.kind === "door" ? t.door : t.window} · {t[o.wall]} · {Math.round(o.position)}cm
                  · {o.width}cm
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeOpening(o.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {openings.length === 0 && (
              <li className="text-xs text-muted-foreground">{t.noOpenings}</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </aside>
  );
}
