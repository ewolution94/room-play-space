export type Lang = "en" | "de";

export type ItemKind = "furniture" | "chair";

export interface Item {
  id: string;
  name: string;
  width: number; // cm
  length: number; // cm
  color: string;
  x: number; // cm from left
  y: number; // cm from top
  rotation: number; // degrees, rotated around center
  kind: ItemKind;
  icon?: string; // preset key, optional
}

export interface Preset {
  key: string;
  category: string;
  nameEn: string;
  nameDe: string;
  w: number;
  l: number;
  color: string;
  iconUrl?: string;
}

export interface Opening {
  id: string;
  wall: "top" | "bottom" | "left" | "right";
  position: number;
  width: number;
  kind: "door" | "window";
  hinge?: "start" | "end"; // doors only
  swing?: "in" | "out"; // doors only
}

export interface Snapshot {
  items: Item[];
  openings: Opening[];
  roomW: number;
  roomL: number;
}
