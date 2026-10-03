/**
 * Shared furniture color swatch palette -- used by every dialog/panel that
 * lets a user pick a color for an item (the Custom Item creator, the
 * Inspector's Color & Finish section, and the "Save to My Catalog" dialog).
 * Kept in one place so the palette can't quietly drift between them; each
 * caller can still fall back to the native color picker for anything outside
 * this set.
 */
export const SWATCHES = [
  { name: "Charcoal", value: "#343a40" },
  { name: "Slate", value: "#6c757d" },
  { name: "Walnut", value: "#5c4033" },
  { name: "Oak", value: "#c4a482" },
  { name: "Cream", value: "#f8f9fa" },
  { name: "Sage", value: "#87a987" },
  { name: "Steel", value: "#495057" },
  { name: "Coral", value: "#d9746c" },
];

/**
 * A room's own color, which is a different job from a piece of furniture's:
 * on a floor plan it identifies the room at a glance, so the set is vivid
 * and mutually distinguishable rather than the muted, material-like
 * SWATCHES above. Used by every room-creation surface -- the dashboard's
 * from-scratch dialog, the guided wizard, and the /rooms sidebar's own
 * add-room form, which is where these values started life (as a local
 * COLOR_PRESETS array) before the same three flows existed in two places.
 *
 * Order is load-bearing: the sidebar walks it to hand each newly added room
 * a different color from the last, so a floor plan doesn't come out all one
 * shade.
 */
export const ROOM_SWATCHES = [
  { name: "Sky Blue", value: "#3b82f6" },
  { name: "Emerald Green", value: "#10b981" },
  { name: "Warm Amber", value: "#f59e0b" },
  { name: "Soft Red", value: "#ef4444" },
  { name: "Lavender Purple", value: "#8b5cf6" },
  { name: "Cozy Pink", value: "#ec4899" },
  { name: "Mint Teal", value: "#14b8a6" },
  { name: "Cool Gray", value: "#6b7280" },
  { name: "Terracotta", value: "#b45309" },
];

/**
 * Wall paints for the material comparison (CompareMaterialsDialog.tsx): the light, muted shades
 * walls actually get painted, plus one dark accent. A different job again from SWATCHES (pieces
 * of furniture) and ROOM_SWATCHES (telling rooms apart); the inspector's colour picker still
 * takes any colour.
 */
export const WALL_SWATCHES = [
  { nameEn: "Pure White", nameDe: "Reinweiß", value: "#f7f7f4" },
  { nameEn: "Warm White", nameDe: "Warmweiß", value: "#f2ece0" },
  { nameEn: "Greige", nameDe: "Greige", value: "#d8d0c4" },
  { nameEn: "Light Gray", nameDe: "Hellgrau", value: "#d5d8dc" },
  { nameEn: "Sage", nameDe: "Salbei", value: "#b6c3ad" },
  { nameEn: "Dusty Blue", nameDe: "Taubenblau", value: "#a9b9c8" },
  { nameEn: "Blush", nameDe: "Altrosa", value: "#e3c6bf" },
  { nameEn: "Ochre", nameDe: "Ocker", value: "#d6ad66" },
  { nameEn: "Terracotta", nameDe: "Terrakotta", value: "#c07a5c" },
  { nameEn: "Anthracite", nameDe: "Anthrazit", value: "#4b4f55" },
];
