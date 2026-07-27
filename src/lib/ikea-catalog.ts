import type { CustomCatalogItem } from "@/types/planner";

/**
 * Built-in "IKEA" catalog -- a curated set of common IKEA beds, shelving/
 * storage, tables, and seating with real published product dimensions, so
 * users who already own this furniture can drop an accurately-sized version
 * straight into their layout instead of eyeballing a generic preset's size.
 * Width/depth/height sourced from IKEA's own regional product pages
 * (2026-07 research pass); see each entry's colors for the finish that
 * dimensions were published for.
 *
 * Deliberately the exact same CustomCatalogItem shape "My Own Catalog"
 * (custom-catalog.ts) saves to localStorage -- both flow through the
 * identical customCatalogItemToPreset() adapter and addPreset() call. This
 * array itself is folded straight into the regular built-in catalog grid as
 * its own "IKEA" section (see buildCatalogByLayer() in custom-catalog.ts,
 * consumed by CatalogSection.tsx) rather than living in a separate UI --
 * once converted to a Preset it's genuinely indistinguishable from a
 * hand-authored one, so it just rides along with the existing category
 * grouping/search/grid rendering. There's no dedicated "add this IKEA item
 * to My Catalog" action either: placing one on the canvas and using the
 * Inspector's "Save to My Catalog" (InspectorSection.tsx) covers customizing
 * and saving a copy, exactly like it does for any other placed item.
 *
 * `sourceKey` maps each product to whichever existing Preset
 * (planner-presets.ts) is the closest real-world silhouette match, so its
 * kitModel/proceduralModel/material carry over via customCatalogItemToPreset.
 * Where a product's real dimensions drift too far from that preset's own
 * default size (see kit-models.ts's KIT_ENVELOPE_MIN/MAX, roughly 0.7x-1.5x
 * per axis), a kitModel-backed sourceKey falls back to a plain box
 * automatically -- fine for beds/tables/seating below, whose sourceKeys are
 * all real Kenney kitModels close enough in proportion to stay in-envelope.
 * Shelving/storage/wardrobes are different: those product lines span too
 * wide a size range for any single kitModel's envelope (a 42cm KALLAX 1x2 up
 * to a 150cm PAX), so they're routed at proceduralModel-backed presets
 * instead (`cube-shelf`/`ladder-bookcase`/`door-wardrobe`/`leg-cabinet`,
 * planner-presets.ts) -- those read each item's own current w/h/l live and
 * always render an exactly-fitting shape (open cube grid, open shelf boards,
 * hinged door leaves), with no envelope to fall out of. Bed heights below
 * deliberately
 * use each product's FOOTBOARD height (or, for NEIDEN's already-low-profile
 * headboard, its headboard height) rather than a tall headboard's height --
 * the built-in "bed-double"/"bed-single" presets themselves only model a
 * plain low frame (h: 45), with no tall-headboard geometry to compare
 * against, so a MALM/HEMNES entry using its ~100-120cm headboard height
 * would both blow the kit-model envelope AND make an IKEA bed read as
 * bizarrely taller than this app's own generic bed for a reason that's a
 * measurement-convention mismatch, not a real product difference.
 *
 * nameEn/nameDe are deliberately terse ("MALM Bed (Single)", not "MALM Bed
 * Frame, High (Single/Twin)") to match the rest of the catalog's naming
 * style -- these render as a tiny grid tile label (CatalogTile.tsx) same as
 * "Sofa" or "L-shaped desk", and a verbose product-page name reads as
 * cluttered/truncated there. `productLine` keeps the bare IKEA product name
 * (e.g. "MALM") separately for anything that wants just that.
 */
export interface IkeaCatalogEntry extends CustomCatalogItem {
  productLine: string;
  category: "bed" | "shelf" | "storage" | "table" | "seating";
}

function ikeaItem(
  entry: Omit<IkeaCatalogEntry, "id" | "createdAt"> & { id: string },
): IkeaCatalogEntry {
  return { ...entry, createdAt: 0 };
}

export const IKEA_CATALOG: IkeaCatalogEntry[] = [
  // ---------------------------------------------------------------------
  // Beds
  // ---------------------------------------------------------------------
  ikeaItem({
    id: "ikea-malm-bed-single",
    productLine: "MALM",
    category: "bed",
    nameEn: "MALM Bed (Single)",
    nameDe: "MALM Bett (Einzel)",
    w: 112,
    l: 199,
    h: 38, // footboard height -- see file header for why
    color: "#f0ece0",
    sourceKey: "bed-single",
  }),
  ikeaItem({
    id: "ikea-malm-bed-queen",
    productLine: "MALM",
    category: "bed",
    nameEn: "MALM Bed (Queen)",
    nameDe: "MALM Bett (Doppel)",
    w: 176,
    l: 209,
    h: 38, // footboard height -- see file header for why
    color: "#f0ece0",
    sourceKey: "bed-double",
  }),
  ikeaItem({
    id: "ikea-hemnes-bed-queen",
    productLine: "HEMNES",
    category: "bed",
    nameEn: "HEMNES Bed (Queen)",
    nameDe: "HEMNES Bett (Doppel)",
    w: 167,
    l: 213,
    h: 66, // footboard height -- see file header for why
    color: "#e3ded2",
    sourceKey: "bed-double",
  }),
  ikeaItem({
    id: "ikea-neiden-bed-single",
    productLine: "NEIDEN",
    category: "bed",
    nameEn: "NEIDEN Bed (Single)",
    nameDe: "NEIDEN Bett (Einzel)",
    w: 94,
    l: 205,
    h: 65, // already a low headboard -- see file header for why this one uses headboard, not footboard
    color: "#d9c39a",
    sourceKey: "bed-single",
  }),
  ikeaItem({
    id: "ikea-hemnes-daybed",
    productLine: "HEMNES",
    category: "bed",
    nameEn: "HEMNES Daybed",
    nameDe: "HEMNES Tagesbett",
    w: 105,
    l: 199,
    h: 83,
    color: "#eee8dc",
    sourceKey: "bed-single",
  }),

  // ---------------------------------------------------------------------
  // Shelving / storage
  // ---------------------------------------------------------------------
  // sourceKey routing below deliberately points at the dedicated
  // proceduralModel presets (cube-shelf/ladder-bookcase/door-wardrobe/
  // leg-cabinet in planner-presets.ts) rather than the older generic
  // bookshelf/wardrobe/sideboard kitModel presets these used to borrow --
  // those kitModels have a fixed stretch envelope a real product's actual
  // size often falls outside of (e.g. KALLAX 147cm wide vs. "bookshelf"'s
  // 80cm default), which silently fell back to a plain flat box. The
  // proceduralModel families instead read each item's own current
  // dimensions and always render an exactly-fitting, recognizable shape
  // (open cube grid / open shelf boards / hinged door leaves), so every
  // size in a product line looks right, including the ones added below.
  ikeaItem({
    id: "ikea-kallax-1x2",
    productLine: "KALLAX",
    category: "shelf",
    nameEn: "KALLAX Shelf (1x2)",
    nameDe: "KALLAX Regal (1x2)",
    w: 42,
    l: 39,
    h: 77,
    color: "#ffffff",
    sourceKey: "cube-shelf",
  }),
  ikeaItem({
    id: "ikea-kallax-2x2",
    productLine: "KALLAX",
    category: "shelf",
    nameEn: "KALLAX Shelf (2x2)",
    nameDe: "KALLAX Regal (2x2)",
    w: 77,
    l: 39,
    h: 77,
    color: "#2b2523",
    sourceKey: "cube-shelf",
  }),
  ikeaItem({
    id: "ikea-kallax-2x4",
    productLine: "KALLAX",
    category: "shelf",
    nameEn: "KALLAX Shelf (2x4)",
    nameDe: "KALLAX Regal (2x4)",
    w: 76.5,
    l: 39,
    h: 146.5,
    color: "#ffffff",
    sourceKey: "cube-shelf",
  }),
  ikeaItem({
    id: "ikea-kallax-4x2",
    productLine: "KALLAX",
    category: "shelf",
    nameEn: "KALLAX Shelf (4x2)",
    nameDe: "KALLAX Regal (4x2)",
    w: 147,
    l: 39,
    h: 77,
    color: "#ffffff",
    sourceKey: "cube-shelf",
  }),
  ikeaItem({
    id: "ikea-kallax-4x4",
    productLine: "KALLAX",
    category: "shelf",
    nameEn: "KALLAX Shelf (4x4)",
    nameDe: "KALLAX Regal (4x4)",
    w: 147,
    l: 39,
    h: 146,
    color: "#ffffff",
    sourceKey: "cube-shelf",
  }),
  ikeaItem({
    id: "ikea-eket-cabinet-2x2",
    productLine: "EKET",
    category: "shelf",
    nameEn: "EKET Cabinet (2x2)",
    nameDe: "EKET Schrank (2x2)",
    w: 70,
    l: 35,
    h: 70,
    color: "#8a9a8b",
    sourceKey: "cube-shelf",
  }),
  ikeaItem({
    id: "ikea-trofast-storage",
    productLine: "TROFAST",
    category: "storage",
    nameEn: "TROFAST Storage Combination",
    nameDe: "TROFAST Aufbewahrung",
    w: 99,
    l: 44,
    h: 94,
    color: "#eceae4",
    sourceKey: "cube-shelf",
  }),
  ikeaItem({
    id: "ikea-billy-bookcase-low",
    productLine: "BILLY",
    category: "shelf",
    nameEn: "BILLY Bookcase (Low)",
    nameDe: "BILLY Bücherregal (Niedrig)",
    w: 80,
    l: 28,
    h: 106,
    color: "#ffffff",
    sourceKey: "ladder-bookcase",
  }),
  ikeaItem({
    id: "ikea-billy-bookcase",
    productLine: "BILLY",
    category: "shelf",
    nameEn: "BILLY Bookcase",
    nameDe: "BILLY Bücherregal",
    w: 80,
    l: 28,
    h: 202,
    color: "#ffffff",
    sourceKey: "ladder-bookcase",
  }),
  ikeaItem({
    id: "ikea-ivar-shelving",
    productLine: "IVAR",
    category: "shelf",
    nameEn: "IVAR Shelf",
    nameDe: "IVAR Regal",
    w: 89,
    l: 30,
    h: 179,
    color: "#d9c39a",
    sourceKey: "ladder-bookcase",
  }),
  ikeaItem({
    id: "ikea-hemnes-bookcase",
    productLine: "HEMNES",
    category: "shelf",
    nameEn: "HEMNES Bookcase",
    nameDe: "HEMNES Bücherregal",
    w: 90,
    l: 37,
    h: 197,
    color: "#e3ded2",
    sourceKey: "ladder-bookcase",
  }),
  ikeaItem({
    id: "ikea-hemnes-glass-cabinet",
    productLine: "HEMNES",
    category: "storage",
    nameEn: "HEMNES Glass-Door Cabinet",
    nameDe: "HEMNES Vitrine",
    w: 90,
    l: 37,
    h: 197,
    color: "#2b2523",
    sourceKey: "door-wardrobe",
  }),
  ikeaItem({
    id: "ikea-besta-tv-storage",
    productLine: "BESTÅ",
    category: "storage",
    nameEn: "BESTÅ Storage",
    nameDe: "BESTÅ Aufbewahrung",
    w: 180,
    l: 42,
    h: 74,
    color: "#2b2523",
    sourceKey: "leg-cabinet",
  }),
  ikeaItem({
    id: "ikea-besta-tall-cabinet",
    productLine: "BESTÅ",
    category: "storage",
    nameEn: "BESTÅ Tall Cabinet",
    nameDe: "BESTÅ Hochschrank",
    w: 60,
    l: 42,
    h: 193,
    color: "#2b2523",
    sourceKey: "door-wardrobe",
  }),
  ikeaItem({
    id: "ikea-pax-wardrobe",
    productLine: "PAX",
    category: "storage",
    nameEn: "PAX Wardrobe",
    nameDe: "PAX Kleiderschrank",
    w: 100,
    l: 60,
    h: 236,
    color: "#ffffff",
    sourceKey: "door-wardrobe",
  }),
  ikeaItem({
    id: "ikea-pax-wardrobe-wide",
    productLine: "PAX",
    category: "storage",
    nameEn: "PAX Wardrobe (Wide)",
    nameDe: "PAX Kleiderschrank (Breit)",
    w: 150,
    l: 60,
    h: 236,
    color: "#ffffff",
    sourceKey: "door-wardrobe",
  }),
  ikeaItem({
    id: "ikea-brimnes-wardrobe",
    productLine: "BRIMNES",
    category: "storage",
    nameEn: "BRIMNES Wardrobe",
    nameDe: "BRIMNES Kleiderschrank",
    w: 117,
    l: 50,
    h: 190,
    color: "#9a9a94",
    sourceKey: "door-wardrobe",
  }),

  // ---------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------
  ikeaItem({
    id: "ikea-lack-side-table",
    productLine: "LACK",
    category: "table",
    nameEn: "LACK Side Table",
    nameDe: "LACK Beistelltisch",
    w: 55,
    l: 55,
    h: 45,
    color: "#ffffff",
    sourceKey: "side-table",
  }),
  ikeaItem({
    id: "ikea-lack-coffee-table",
    productLine: "LACK",
    category: "table",
    nameEn: "LACK Coffee Table",
    nameDe: "LACK Couchtisch",
    w: 90,
    l: 55,
    h: 45,
    color: "#ffffff",
    sourceKey: "coffee-table",
  }),
  ikeaItem({
    id: "ikea-ingo-dining-table",
    productLine: "INGO",
    category: "table",
    nameEn: "INGO Table",
    nameDe: "INGO Tisch",
    w: 120,
    l: 75,
    h: 73,
    color: "#d9c39a",
    sourceKey: "dining-table-rect",
  }),
  ikeaItem({
    id: "ikea-melltorp-table",
    productLine: "MELLTORP",
    category: "table",
    nameEn: "MELLTORP Table",
    nameDe: "MELLTORP Tisch",
    w: 125,
    l: 75,
    h: 74,
    color: "#ffffff",
    sourceKey: "dining-table-rect",
  }),
  ikeaItem({
    id: "ikea-bekant-desk",
    productLine: "BEKANT",
    category: "table",
    nameEn: "BEKANT Desk",
    nameDe: "BEKANT Schreibtisch",
    w: 160,
    l: 80,
    h: 73, // sit-height default; BEKANT's legs are height-adjustable 65-85cm
    color: "#e8e3d8",
    sourceKey: "desk",
  }),

  // ---------------------------------------------------------------------
  // Seating
  // ---------------------------------------------------------------------
  ikeaItem({
    id: "ikea-poang-armchair",
    productLine: "POÄNG",
    category: "seating",
    nameEn: "POÄNG Armchair",
    nameDe: "POÄNG Sessel",
    w: 68,
    l: 82,
    h: 100,
    color: "#c9a876",
    sourceKey: "armchair",
  }),
  ikeaItem({
    id: "ikea-ektorp-sofa",
    productLine: "EKTORP",
    category: "seating",
    nameEn: "EKTORP Sofa",
    nameDe: "EKTORP Sofa",
    w: 218,
    l: 88,
    h: 88,
    color: "#e5ddd0",
    sourceKey: "sofa",
  }),
  ikeaItem({
    id: "ikea-kivik-sofa",
    productLine: "KIVIK",
    category: "seating",
    nameEn: "KIVIK Sofa",
    nameDe: "KIVIK Sofa",
    w: 228,
    l: 95,
    h: 83,
    color: "#5b6470",
    sourceKey: "sofa",
  }),
  ikeaItem({
    id: "ikea-strandmon-armchair",
    productLine: "STRANDMON",
    category: "seating",
    nameEn: "STRANDMON Chair",
    nameDe: "STRANDMON Sessel",
    w: 82,
    l: 96,
    h: 101,
    color: "#d4a437",
    sourceKey: "recliner",
  }),
  ikeaItem({
    id: "ikea-markus-office-chair",
    productLine: "MARKUS",
    category: "seating",
    nameEn: "MARKUS Chair",
    nameDe: "MARKUS Bürostuhl",
    w: 62,
    l: 60,
    h: 135, // sensible fixed default; MARKUS's gas lift adjusts 129-140cm
    color: "#262626",
    sourceKey: "chair-office",
  }),
  ikeaItem({
    id: "ikea-odger-chair",
    productLine: "ODGER",
    category: "seating",
    nameEn: "ODGER Chair",
    nameDe: "ODGER Stuhl",
    w: 45,
    l: 51,
    h: 81,
    color: "#e8ddc9",
    sourceKey: "dining-chair",
  }),
];

export const IKEA_CATEGORY_ORDER: IkeaCatalogEntry["category"][] = [
  "bed",
  "shelf",
  "storage",
  "table",
  "seating",
];
