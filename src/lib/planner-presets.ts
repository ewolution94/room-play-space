import {
  Armchair,
  Sofa,
  BedDouble,
  BedSingle,
  LampDesk,
  Circle,
  RectangleHorizontal,
  Square,
  BookOpen,
  Archive,
  Files,
  CookingPot,
  Droplets,
  Refrigerator,
  Bath,
  Sprout,
  Lamp,
  type LucideIcon,
} from "lucide-react";
import chairBaseUrl from "@/assets/chair-base.png";
import sofaUrl from "@/assets/presets/sofa.png";
import armchairUrl from "@/assets/presets/armchair.png";
import bedUrl from "@/assets/presets/bed.png";
import roundTableUrl from "@/assets/presets/round-table.png";
import plantUrl from "@/assets/presets/plant.png";
import toiletUrl from "@/assets/presets/toilet.png";
import bathtubUrl from "@/assets/presets/bathtub.png";
import stoveUrl from "@/assets/presets/stove.png";
import sinkUrl from "@/assets/presets/sink.png";
import fridgeUrl from "@/assets/presets/fridge.png";
import type { Preset, Item } from "@/types/planner";

export const PRESETS: Preset[] = [
  // Seating
  {
    key: "chair-office",
    category: "seating",
    nameEn: "Office chair",
    nameDe: "Bürostuhl",
    w: 60,
    l: 60,
    color: "#556270",
    iconUrl: chairBaseUrl,
  },
  {
    key: "armchair",
    category: "seating",
    nameEn: "Armchair",
    nameDe: "Sessel",
    w: 90,
    l: 90,
    color: "#d97706",
    iconUrl: armchairUrl,
  },
  {
    key: "sofa",
    category: "seating",
    nameEn: "Sofa",
    nameDe: "Sofa",
    w: 220,
    l: 95,
    color: "#cbd5e1",
    iconUrl: sofaUrl,
  },
  // Sleeping
  {
    key: "bed-double",
    category: "sleeping",
    nameEn: "Double bed",
    nameDe: "Doppelbett",
    w: 160,
    l: 200,
    color: "#f5f5f5",
    iconUrl: bedUrl,
  },
  {
    key: "bed-single",
    category: "sleeping",
    nameEn: "Single bed",
    nameDe: "Einzelbett",
    w: 90,
    l: 200,
    color: "#f5f5f5",
    iconUrl: bedUrl,
  },
  // Tables
  {
    key: "desk",
    category: "tables",
    nameEn: "Desk",
    nameDe: "Schreibtisch",
    w: 160,
    l: 75,
    color: "#c28a5e",
  },
  {
    key: "round-table",
    category: "tables",
    nameEn: "Round table",
    nameDe: "Runder Tisch",
    w: 110,
    l: 110,
    color: "#d4a574",
    iconUrl: roundTableUrl,
  },
  {
    key: "coffee-table",
    category: "tables",
    nameEn: "Coffee table",
    nameDe: "Couchtisch",
    w: 100,
    l: 55,
    color: "#c28a5e",
  },
  {
    key: "side-table",
    category: "tables",
    nameEn: "Side table",
    nameDe: "Beistelltisch",
    w: 45,
    l: 45,
    color: "#c9a86a",
  },
  // Storage
  {
    key: "bookshelf",
    category: "storage",
    nameEn: "Bookshelf",
    nameDe: "Bücherregal",
    w: 80,
    l: 30,
    color: "#a07855",
  },
  {
    key: "wardrobe",
    category: "storage",
    nameEn: "Wardrobe",
    nameDe: "Kleiderschrank",
    w: 150,
    l: 60,
    color: "#b5835a",
  },
  {
    key: "filing-cabinet",
    category: "storage",
    nameEn: "Filing cabinet",
    nameDe: "Aktenschrank",
    w: 60,
    l: 45,
    color: "#cfd8dc",
  },
  // Kitchen
  {
    key: "stove",
    category: "kitchen",
    nameEn: "Stove",
    nameDe: "Herd",
    w: 60,
    l: 60,
    color: "#c0c0c0",
    iconUrl: stoveUrl,
  },
  {
    key: "sink",
    category: "kitchen",
    nameEn: "Sink",
    nameDe: "Spüle",
    w: 60,
    l: 50,
    color: "#c0c0c0",
    iconUrl: sinkUrl,
  },
  {
    key: "fridge",
    category: "kitchen",
    nameEn: "Fridge",
    nameDe: "Kühlschrank",
    w: 70,
    l: 70,
    color: "#e8e8e8",
    iconUrl: fridgeUrl,
  },
  // Bathroom
  {
    key: "toilet",
    category: "bathroom",
    nameEn: "Toilet",
    nameDe: "Toilette",
    w: 40,
    l: 70,
    color: "#ffffff",
    iconUrl: toiletUrl,
  },
  {
    key: "bathtub",
    category: "bathroom",
    nameEn: "Bathtub",
    nameDe: "Badewanne",
    w: 80,
    l: 170,
    color: "#ffffff",
    iconUrl: bathtubUrl,
  },
  // Decor
  {
    key: "plant",
    category: "decor",
    nameEn: "Plant",
    nameDe: "Pflanze",
    w: 50,
    l: 50,
    color: "#4ade80",
    iconUrl: plantUrl,
  },
  {
    key: "floor-lamp",
    category: "decor",
    nameEn: "Floor lamp",
    nameDe: "Stehlampe",
    w: 30,
    l: 30,
    color: "#e8c97c",
  },
  {
    key: "rug",
    category: "decor",
    nameEn: "Rug",
    nameDe: "Teppich",
    w: 200,
    l: 140,
    color: "#b7806f",
  },
];

export const PRESET_BY_KEY = Object.fromEntries(PRESETS.map((p) => [p.key, p]));

// Lucide icon per preset key (catalog + item rendering)
export const PRESET_ICON: Record<string, LucideIcon> = {
  "chair-office": Armchair,
  armchair: Armchair,
  sofa: Sofa,
  "bed-double": BedDouble,
  "bed-single": BedSingle,
  desk: LampDesk,
  "round-table": Circle,
  "coffee-table": RectangleHorizontal,
  "side-table": Square,
  bookshelf: BookOpen,
  wardrobe: Archive,
  "filing-cabinet": Files,
  stove: CookingPot,
  sink: Droplets,
  fridge: Refrigerator,
  toilet: Bath,
  bathtub: Bath,
  plant: Sprout,
  "floor-lamp": Lamp,
  rug: Square,
};

export function iconUrlForItem(it: Item): string | undefined {
  if (it.icon && PRESET_BY_KEY[it.icon]) return PRESET_BY_KEY[it.icon].iconUrl;
  // legacy back-compat
  if (it.kind === "chair") return chairBaseUrl;
  return undefined;
}
