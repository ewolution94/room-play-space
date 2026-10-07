import React from "react";
import type { Item, Lang, Opening, Point } from "@/types/planner";
import type { WallSlopeMap } from "@/lib/wall-slopes";
import type { TranslationStrings } from "@/lib/planner-translations";
import { RoomPlanSvg } from "@/components/planner/RoomPlanSvg";
import { blueprintNumbers, floorAreaM2 } from "@/lib/blueprint";
import { polygonBoundingBox, wallLabel } from "@/lib/hallway-shapes";
import { openingKindLabel } from "@/lib/openings";
import { getDefaultHeight } from "@/lib/planner-presets";

interface RoomBlueprintProps {
  t: TranslationStrings;
  lang: Lang;
  name: string;
  corners: Point[];
  openings: Opening[];
  items: Item[];
  ceilingHeight: number;
  wallSlopes: WallSlopeMap;
}

const round = (n: number) => Math.round(n);

/**
 * The printed blueprint: the room's name and key figures, its plan with every item numbered and
 * the overall dimensions, and the numbered furniture list with sizes. Only ever on paper (or a
 * "Save as PDF"): RoomEditor renders it just for the print and hides everything else.
 */
export function RoomBlueprint({
  t,
  lang,
  name,
  corners,
  openings,
  items,
  ceilingHeight,
  wallSlopes,
}: RoomBlueprintProps) {
  const numbers = blueprintNumbers(items);
  const labels = new Map([...numbers].map(([id, n]) => [id, String(n)]));
  const listed = [...items].sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!);
  const bb = polygonBoundingBox(corners);
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const area = floorAreaM2(corners).toLocaleString(locale, { maximumFractionDigits: 1 });
  const date = new Date().toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="hidden print:block bg-white text-[11px] text-black [print-color-adjust:exact]">
      <header className="mb-3 flex items-baseline justify-between border-b border-black/30 pb-2">
        <div>
          <h1 className="text-lg font-semibold">{name}</h1>
          <p>
            {round(bb.width)} × {round(bb.height)} cm · {area} m² · {t.blueprintCeiling}{" "}
            {round(ceilingHeight)} cm
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">PLANUM</p>
          <p>{date}</p>
        </div>
      </header>

      <RoomPlanSvg
        corners={corners}
        openings={openings}
        items={items}
        labels={labels}
        title={name}
        dimensions
        wallSlopes={wallSlopes}
        ceilingHeight={ceilingHeight}
        className="mx-auto block max-h-[150mm] w-full text-black"
      />

      <section className="mt-4 grid grid-cols-[2fr_1fr] gap-x-8 break-inside-avoid">
        <div>
          <h2 className="mb-1 font-semibold">{t.blueprintFurniture}</h2>
          {listed.length === 0 ? (
            <p>{t.blueprintNoItems}</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-black/30 text-left">
                  <th className="w-8 py-0.5 font-medium">#</th>
                  <th className="py-0.5 font-medium" />
                  <th className="py-0.5 text-right font-medium">{t.dimsAxes} (cm)</th>
                </tr>
              </thead>
              <tbody>
                {listed.map((it) => (
                  <tr key={it.id} className="border-b border-black/10">
                    <td className="py-0.5 tabular-nums">{numbers.get(it.id)}</td>
                    <td className="py-0.5">{it.name}</td>
                    <td className="py-0.5 text-right tabular-nums">
                      {round(it.length)} × {round(it.width)} ×{" "}
                      {round(it.height ?? getDefaultHeight(it.icon, it.kind))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h2 className="mb-1 font-semibold">{t.blueprintOpenings}</h2>
          <ul className="space-y-0.5">
            {openings.map((o) => (
              <li key={o.id}>
                {openingKindLabel(o, t)} · {wallLabel(o.wall, t, lang)} · {round(o.width)} cm
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
