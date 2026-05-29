import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Copy, RotateCw } from "lucide-react";
import type { SidebarRightProps } from "@/types/planner";

export function SidebarRight({
  t,
  items,
  selectedIds,
  setSelectedIds,
  duplicateSelected,
  removeSelected,
  removeItem,
  updateItem,
}: SidebarRightProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t.items}
            {selectedIds.size > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {t.selectedCount(selectedIds.size)}
              </span>
            )}
          </CardTitle>
          {selectedIds.size > 0 && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={duplicateSelected} title={t.duplicate}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={removeSelected}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-xs text-muted-foreground">{t.noItems}</p>}
          {items.map((it) => (
            <div
              key={it.id}
              data-item-row={it.id}
              className={
                "space-y-2 rounded-md border p-2 " +
                (selectedIds.has(it.id) ? "border-foreground" : "")
              }
              onClick={(e) => {
                if (e.shiftKey) {
                  setSelectedIds((s) => {
                    const n = new Set(s);
                    if (n.has(it.id)) n.delete(it.id);
                    else n.add(it.id);
                    return n;
                  });
                } else {
                  setSelectedIds(new Set([it.id]));
                }
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={it.color}
                  onChange={(e) => updateItem(it.id, { color: e.target.value })}
                  className="h-7 w-7 cursor-pointer rounded border"
                />
                <Input
                  value={it.name}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                  className="h-8"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="number"
                  value={it.width}
                  onChange={(e) => updateItem(it.id, { width: +e.target.value || 0 })}
                  className="h-8"
                />
                <Input
                  type="number"
                  value={it.length}
                  onChange={(e) => updateItem(it.id, { length: +e.target.value || 0 })}
                  className="h-8"
                />
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  value={Math.round(it.rotation)}
                  onChange={(e) =>
                    updateItem(it.id, {
                      rotation: (((+e.target.value || 0) % 360) + 360) % 360,
                    })
                  }
                  className="h-8 flex-1"
                  title={t.rotation}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => updateItem(it.id, { rotation: (it.rotation + 90) % 360 })}
                >
                  +90°
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
