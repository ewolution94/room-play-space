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
