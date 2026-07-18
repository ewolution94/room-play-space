import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { Item, KitModel, Opening, Point, PresetMaterial } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";
import { readableText } from "@/lib/planner-math";
import { getDefaultHeight, PRESET_BY_KEY } from "@/lib/planner-presets";
import { resolveRenderMode, computeModelScale, KIT_MODEL_UNIT_SCALE } from "@/lib/kit-models";
import { generateProceduralParts, type ProceduralPart } from "@/lib/procedural-models";
import { wallSegments } from "@/lib/hallway-shapes";
import { closedSubIntervals, type WallOpenInterval } from "@/lib/room-adjacency";
import { useMobileViewOnly } from "@/hooks/use-mobile-view-only";
import { SlidersHorizontal } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

// Module-level (not per-component-instance) cache of parsed Kenney Furniture
// Kit models, keyed by filename -- shared across every ThreeDView mount and
// every rebuild of the big scene-building effect below, which tears down
// and rebuilds the whole scene from scratch on almost any state change
// (item add/move/select, ...). Without this cache, that rebuild cadence
// would mean re-fetching and re-parsing the same .glb over and over.
// Cloning a cached THREE.Group (see the render loop below) is cheap and
// synchronous; only the FIRST time a given file is needed does an actual
// async load happen. A cloned instance's meshes still share the cached
// template's geometry/material objects (THREE.Object3D.clone() is a
// shallow clone), so they're tagged via userData.sharedFromKitCache and
// deliberately never disposed in this component's per-rebuild cleanup --
// only the box/cylinder path's genuinely-per-rebuild resources are.
const kitModelCache = new Map<string, THREE.Group>();
const kitModelLoading = new Set<string>();
const kitGltfLoader = new GLTFLoader();

// RectAreaLight needs its LTC (linearly transformed cosine) lookup tables
// registered once before any RectAreaLight is used, per the three.js manual
// (https://threejs.org/manual/#en/lights) -- done once at module load
// rather than inside the per-mount scene effect below, since it's global,
// idempotent shader setup rather than per-scene state.
RectAreaLightUniformsLib.init();

function loadKitModelIntoCache(file: string, onLoaded: () => void) {
  if (kitModelCache.has(file) || kitModelLoading.has(file)) return;
  kitModelLoading.add(file);
  kitGltfLoader.load(
    `/models/kenney/${file}`,
    (gltf) => {
      kitModelCache.set(file, gltf.scene);
      kitModelLoading.delete(file);
      onLoaded();
    },
    undefined,
    (err) => {
      console.error(`Failed to load Kenney kit model "${file}"`, err);
      kitModelLoading.delete(file);
    },
  );
}

// Re-exported for existing consumers (e.g. InspectorSection.tsx imports
// this from "../ThreeDView") -- the implementation now lives in
// planner-presets.ts, next to the catalog data it reads from, so it can be
// unit-tested without needing to load this file's Three.js/JSX code.
export { getDefaultHeight };

/**
 * One room/hallway's worth of geometry to render, in the SAME shared
 * floor-plan coordinate space room-adjacency.ts's globalCorners() and the
 * multi-room overview already use: `corners` are LOCAL (0..width x
 * 0..length, rotation already baked in -- see rotateRoomLayout), and `x`/`y`
 * is that room's own offset into the shared space. A lone single-room view
 * (CanvasArea.tsx) just passes one instance with x=0, y=0, which makes every
 * position/offset calculation below collapse back to exactly the original
 * single-room math -- this is what lets one code path serve both the
 * single-room 3D view and the whole-apartment 3D view (see
 * MultiRoomCanvas.tsx) without duplicating any Three.js scene-building
 * logic.
 */
export interface RoomInstance3D {
  id: string;
  x: number; // cm, offset into the shared floor-plan space (0 for a standalone single room)
  y: number;
  width: number; // cm -- this instance's own local bounding-box width
  length: number; // cm -- this instance's own local bounding-box length
  corners: Point[]; // LOCAL corners (0..width, 0..length frame)
  items: Item[];
  openings: Opening[];
  wallColors: Record<string, string>;
  // Open interval(s) per wall (wallColorKey() format) -- see
  // room-adjacency.ts. The span(s) covered get no geometry at all (not
  // even a wide doorway), a true archway through to whatever is on the
  // other side; the rest of that same wall still extrudes normally.
  openWalls: Map<string, WallOpenInterval[]>;
}

interface ThreeDViewProps {
  t: TranslationStrings;
  rooms: RoomInstance3D[];
  selectedIds: Set<string>;
  isDark?: boolean;
}

function parseColor(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  const num = parseInt(cleanHex, 16) || 0;
  return {
    r: num >> 16,
    g: (num >> 8) & 0x00ff,
    b: num & 0x0000ff,
  };
}

function darkenColor(hex: string, percent: number): string {
  const { r, g, b } = parseColor(hex);
  const factor = 1 - percent;
  const R = Math.round(r * factor);
  const G = Math.round(g * factor);
  const B = Math.round(b * factor);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

function lightenColor(hex: string, percent: number): string {
  const { r, g, b } = parseColor(hex);
  const R = Math.round(r + (255 - r) * percent);
  const G = Math.round(g + (255 - g) * percent);
  const B = Math.round(b + (255 - b) * percent);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

/**
 * Subtracts a list of "open" spans (auto-detected touching-neighbor
 * archways -- see room-adjacency.ts) from a list of wall-chunk segments,
 * splitting any segment an open span crosses into the parts that survive.
 * Deliberately separate from closedSubIntervals (hallway-shapes.ts's
 * counterpart, which starts from a single 0..length span): here the input
 * segments are already whatever's left after door/window carving, each
 * with its own start/end, not necessarily contiguous or zero-based.
 */
function subtractOpenSpans(
  segments: { start: number; end: number }[],
  openSpans: { start: number; end: number }[],
): { start: number; end: number }[] {
  if (openSpans.length === 0) return segments;
  const result: { start: number; end: number }[] = [];
  for (const seg of segments) {
    let cursor = seg.start;
    const relevant = openSpans
      .filter((o) => o.end > seg.start && o.start < seg.end)
      .sort((a, b) => a.start - b.start);
    for (const o of relevant) {
      const s = Math.max(seg.start, o.start);
      const e = Math.min(seg.end, o.end);
      if (s > cursor) result.push({ start: cursor, end: s });
      cursor = Math.max(cursor, e);
    }
    if (cursor < seg.end) result.push({ start: cursor, end: seg.end });
  }
  return result;
}

// Which procedural canvas pattern (if any) a material gets, applied on top
// of the item's own base color. Plain PBR-only materials (metal, ceramic,
// glass, plastic) intentionally have no entry here -- their premium look
// comes entirely from the metalness/roughness/transparency tuning in
// getMaterialParams below, not a drawn texture.
type TextureType = "wood" | "fabric" | "leather" | "plant" | "rug" | "stone";

function createProceduralTexture(type: TextureType, baseColor: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);

  if (type === "wood") {
    // Warm, organic wood grain lines
    ctx.strokeStyle = darkenColor(baseColor, 0.12);
    ctx.lineWidth = 2.5;
    for (let i = -20; i < 276; i += 12) {
      ctx.beginPath();
      for (let y = 0; y <= 256; y += 8) {
        const wave = Math.sin(y * 0.03 + i * 0.05) * 5 + Math.cos(y * 0.01) * 2;
        const x = i + wave + (Math.random() - 0.5) * 0.5;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (type === "fabric") {
    // Cross-weave textile texture
    ctx.strokeStyle = darkenColor(baseColor, 0.08);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 256; i += 6) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
  } else if (type === "plant") {
    // Speckled leafy structure
    ctx.fillStyle = darkenColor(baseColor, 0.15);
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      const rSize = 3 + Math.random() * 8;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rSize, rSize / 2, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === "rug") {
    // Dotted rug fibers
    for (let i = 0; i < 4000; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      ctx.fillStyle =
        Math.random() > 0.5 ? darkenColor(baseColor, 0.07) : lightenColor(baseColor, 0.07);
      ctx.fillRect(rx, ry, 2, 2);
    }
  } else if (type === "leather") {
    // Soft mottled hide grain -- low-contrast blotches plus a fine scatter
    // of tiny creases, unlike fabric's uniform crosshatch weave.
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = darkenColor(baseColor, 0.1);
    for (let i = 0; i < 90; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      const rSize = 10 + Math.random() * 22;
      ctx.beginPath();
      ctx.ellipse(
        rx,
        ry,
        rSize,
        rSize * (0.6 + Math.random() * 0.4),
        Math.random() * Math.PI,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = darkenColor(baseColor, 0.2);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 140; i++) {
      const rx = Math.random() * 256;
      const ry = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + (Math.random() - 0.5) * 6, ry + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }
  } else if (type === "stone") {
    // Marble-style veining -- a handful of long, thin, softly wandering
    // light/dark streaks over the base color.
    for (let i = 0; i < 6; i++) {
      let x = Math.random() * 256;
      let y = Math.random() * 256;
      ctx.strokeStyle =
        Math.random() > 0.5 ? lightenColor(baseColor, 0.25) : darkenColor(baseColor, 0.2);
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let seg = 0; seg < 8; seg++) {
        x += (Math.random() - 0.5) * 60;
        y += (Math.random() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Maps a preset's explicit `material` hint (see Preset.material in
 * types/planner.ts) to concrete PBR parameters for the item's 3D mesh --
 * this replaces an earlier version that *guessed* a material from keywords
 * in the item's icon key/name (which had real gaps: several wood/fabric/
 * metal pieces fell through to a flat generic material, and a "bed"
 * keyword match on "bunk-bed" wrongly applied an upholstery fabric
 * texture). `undefined` (legacy custom boxes with no catalog key at all)
 * falls back to the same plain default the old heuristic used when nothing
 * matched.
 */
function getMaterialParams(material?: PresetMaterial): {
  textureType: TextureType | null;
  metalness: number;
  roughness: number;
  transparent?: boolean;
  opacity?: number;
} {
  switch (material) {
    case "wood":
      return { textureType: "wood", metalness: 0, roughness: 0.7 };
    case "fabric":
      return { textureType: "fabric", metalness: 0.05, roughness: 0.95 };
    case "leather":
      return { textureType: "leather", metalness: 0.08, roughness: 0.55 };
    case "metal":
      return { textureType: null, metalness: 0.88, roughness: 0.22 };
    case "ceramic":
      // Glossy porcelain -- very low roughness for a wet-look sheen
      // instead of the flat matte white boxes toilets/tubs/vases used to
      // render as.
      return { textureType: null, metalness: 0.05, roughness: 0.12 };
    case "stone":
      return { textureType: "stone", metalness: 0.05, roughness: 0.3 };
    case "glass":
      return {
        textureType: null,
        metalness: 0.1,
        roughness: 0.05,
        transparent: true,
        opacity: 0.55,
      };
    case "plant":
      return { textureType: "plant", metalness: 0, roughness: 0.6 };
    case "rug":
      return { textureType: "rug", metalness: 0, roughness: 0.95 };
    case "plastic":
      return { textureType: null, metalness: 0.05, roughness: 0.5 };
    default:
      return { textureType: null, metalness: 0.1, roughness: 0.5 };
  }
}

/** Shifts `hex` toward black (negative) or white (positive) by |offset| (0..1). 0 returns hex unchanged. */
function shadeColor(hex: string, offset: number): string {
  if (offset === 0) return hex;
  return offset < 0 ? darkenColor(hex, -offset) : lightenColor(hex, offset);
}

const UNIT_CYLINDER_GEO = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const UNIT_CONE_GEO = new THREE.ConeGeometry(0.5, 1, 16);
const UNIT_SPHERE_GEO = new THREE.SphereGeometry(0.5, 12, 10);

/**
 * Builds a THREE.Group from a preset's procedural part list (see
 * src/lib/procedural-models.ts) -- one Mesh per part, each with its own
 * (never shared/cached) geometry and material so the existing per-rebuild
 * scene.traverse() disposal in this component's cleanup handles them
 * exactly like the plain box path already does, with no special-casing
 * needed (unlike the Kenney kit-model path, which shares cached geometry
 * across instances and must opt out of that same disposal via
 * userData.sharedFromKitCache).
 */
function buildProceduralGroup(
  parts: ProceduralPart[],
  baseColor: string,
  materialParams: ReturnType<typeof getMaterialParams>,
): THREE.Group {
  const group = new THREE.Group();
  for (const part of parts) {
    const geometry =
      part.shape === "box"
        ? new THREE.BoxGeometry(part.sx, part.sy, part.sz)
        : part.shape === "cylinder"
          ? UNIT_CYLINDER_GEO.clone()
          : part.shape === "cone"
            ? UNIT_CONE_GEO.clone()
            : UNIT_SPHERE_GEO.clone();
    if (part.shape !== "box") {
      geometry.scale(part.sx, part.sy, part.sz);
    }
    const color = shadeColor(baseColor, part.colorOffset ?? 0);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: materialParams.roughness,
      metalness: materialParams.metalness,
      transparent: materialParams.transparent ?? false,
      opacity: materialParams.opacity ?? 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(part.x, part.y, part.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function ThreeDView({ t, rooms, selectedIds, isDark = false }: ThreeDViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // View settings state
  const [showNames, setShowNames] = useState(true);
  const [wallFadeOpacity, setWallFadeOpacity] = useState(0.25);
  const [sunlightEnabled, setSunlightEnabled] = useState(true);
  const [sunlightAngle, setSunlightAngle] = useState(45);

  // Toggleable "mood lighting" for lamp/ceiling-light/sconce-style items
  // (see Preset.isLightSource) -- an opt-in accent on top of the ambient/
  // sun/hemisphere fill lighting above, off by default like the other
  // additive view toggles in this panel. Deliberately session-only state
  // (not persisted onto Item/localStorage): which lamps are lit is a mood
  // you set while looking at the 3D view, not room layout data. `lightsOff`
  // tracks exceptions to "every light source is on" -- an item id in the
  // set means that one specific fixture has been switched off.
  const [lightingEnabled, setLightingEnabled] = useState(false);
  const [lightsOff, setLightsOff] = useState<Set<string>>(new Set());
  const toggleItemLight = (id: string) => {
    setLightsOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Every currently-placed light-fixture item, across every room instance
  // (a lone single-room view's `rooms` is just a one-element list -- see
  // RoomInstance3D's doc comment) -- drives the per-item toggle list below.
  const lightSourceItems = useMemo(
    () =>
      rooms.flatMap((room) =>
        room.items
          .filter((it) => it.icon && PRESET_BY_KEY[it.icon]?.isLightSource)
          .map((it) => ({ id: it.id, name: it.name })),
      ),
    [rooms],
  );

  // Mobile "view only" mode (see useMobileViewOnly): the always-visible "3D
  // View Controls" panel becomes a togglable bottom sheet. Every toggle in
  // it is a genuine view option (labels, sunlight, wall opacity), not an
  // editing tool, so unlike CanvasArea's 2D panel nothing needs to be
  // dropped for mobile -- just the presentation changes.
  const { isMobileViewOnly } = useMobileViewOnly();
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);

  // Bumped whenever a Kenney kit model this render needed wasn't cached yet
  // finishes loading, so the main scene-building effect below reruns and
  // picks it up from kitModelCache -- see loadKitModelIntoCache above.
  const [kitModelVersion, setKitModelVersion] = useState(0);

  // References for live updates without scene rebuilds
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wallFadeOpacityRef = useRef<number>(0.25);
  // Lets the separate "Toggleable Light Sources" effect below reuse the
  // exact same THREE.Scene the main effect built, instead of needing its
  // own -- see that effect's doc comment for why this exists.
  const sceneRef = useRef<THREE.Scene | null>(null);

  // The overall bounding box of every room instance's real placed shape
  // (each instance's LOCAL corners translated by its own x/y, exactly like
  // globalCorners() in room-adjacency.ts), which the whole scene is
  // centered and sized against instead of a single room's own width/length.
  // For the single-room call site (one instance at x=0,y=0) this reduces
  // to exactly [0,width] x [0,length] -- i.e. centerX/centerZ come out to
  // roomW/2 and roomL/2 and totalW/totalL come out to roomW/roomL, so every
  // camera/light/fade calculation below behaves identically to before.
  const sceneBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const room of rooms) {
      if (!room.corners || room.corners.length < 3) continue;
      for (const c of room.corners) {
        const gx = room.x + c.x;
        const gz = room.y + c.y;
        if (gx < minX) minX = gx;
        if (gx > maxX) maxX = gx;
        if (gz < minZ) minZ = gz;
        if (gz > maxZ) maxZ = gz;
      }
    }
    if (!isFinite(minX)) {
      return { centerX: 0, centerZ: 0, totalW: 100, totalL: 100 };
    }
    return {
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
      totalW: Math.max(1, maxX - minX),
      totalL: Math.max(1, maxZ - minZ),
    };
  }, [rooms]);

  // Sync state values with refs for animation loop / effects
  useEffect(() => {
    wallFadeOpacityRef.current = wallFadeOpacity;
  }, [wallFadeOpacity]);

  useEffect(() => {
    if (dirLightRef.current) {
      dirLightRef.current.visible = sunlightEnabled;
      const rad = (sunlightAngle * Math.PI) / 180;
      dirLightRef.current.position.set(
        Math.cos(rad) * sceneBounds.totalW,
        350,
        Math.sin(rad) * sceneBounds.totalL,
      );
    }
  }, [sunlightEnabled, sunlightAngle, sceneBounds]);

  // Reset Camera View Helper
  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(
        sceneBounds.totalW * 0.8,
        Math.max(sceneBounds.totalW, sceneBounds.totalL) * 1.2,
        sceneBounds.totalL * 1.2,
      );
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Keyboard controls listener (Arrow panning & Esc/0 reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cameraRef.current || !controlsRef.current) return;

      const camera = cameraRef.current;
      const controls = controlsRef.current;

      // Check for arrow keys (panning camera target in X-Z space)
      const speed = e.shiftKey ? 30 : 10; // Pan faster with shift key

      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0; // lock to horizontal plane
      forward.normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up);
      right.y = 0;
      right.normalize();

      const moveDir = new THREE.Vector3();

      if (e.key === "ArrowUp") {
        moveDir.addScaledVector(forward, speed);
      } else if (e.key === "ArrowDown") {
        moveDir.addScaledVector(forward, -speed);
      } else if (e.key === "ArrowLeft") {
        moveDir.addScaledVector(right, -speed);
      } else if (e.key === "ArrowRight") {
        moveDir.addScaledVector(right, speed);
      } else if (e.key === "Escape" || e.key === "0") {
        resetCamera();
        e.preventDefault();
        return;
      } else {
        return; // ignore other keys
      }

      e.preventDefault();

      // Translate camera position and controls target coordinates together
      camera.position.add(moveDir);
      controls.target.add(moveDir);
      controls.update();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneBounds]);

  // Main Three.js Scene Setup Effect
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || rooms.length === 0) return;

    const { centerX, centerZ, totalW, totalL } = sceneBounds;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(isDark ? "#0f172a" : "#f8fafc"); // slate-900 vs slate-50

    // --- Camera Setup ---
    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 5000);
    camera.position.set(totalW * 0.8, Math.max(totalW, totalL) * 1.2, totalL * 1.2);
    cameraRef.current = camera;

    // --- Renderer Setup ---
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- Controls Setup ---
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor level
    controls.minDistance = 50;
    controls.maxDistance = 1500;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight("#ffffff", isDark ? 0.45 : 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#ffffff", 0.85);
    const rad = (sunlightAngle * Math.PI) / 180;
    dirLight.position.set(Math.cos(rad) * totalW, 350, Math.sin(rad) * totalL);
    dirLight.visible = sunlightEnabled;
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 1000;

    // Dynamic shadow camera boundaries based on overall scene size
    const d = Math.max(totalW, totalL) * 0.8;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Soft sky light to simulate indirect daylight
    const hemiLight = new THREE.HemisphereLight(
      isDark ? "#1e1b4b" : "#bae6fd", // indigo-950 vs sky-200
      isDark ? "#0f172a" : "#fed7aa", // slate-900 vs orange-200
      isDark ? 0.15 : 0.25,
    );
    scene.add(hemiLight);

    // Floor plane geometry removed as requested to leave only the grid helper
    // Grid helper (extended to cover a massive 80x80m layout space)
    const maxDim = 8000;
    const gridColor1 = isDark ? "#475569" : "#94a3b8"; // slate-600 vs slate-400
    const gridColor2 = isDark ? "#1e293b" : "#cbd5e1"; // slate-800 vs slate-200
    const gridHelper = new THREE.GridHelper(
      maxDim,
      Math.round(maxDim / 50),
      gridColor1,
      gridColor2,
    );
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // --- Draw segmented walls with door/window openings ---
    const wallHeight = 240; // cm
    const wallThickness = 6; // cm
    const wallMat = new THREE.MeshStandardMaterial({
      color: "#f1f5f9", // slate-100
      roughness: 0.9,
      metalness: 0.05,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#0ea5e9", // sky-500 tint
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      transmission: 0.6,
      thickness: 1.5,
    });

    const woodMat = new THREE.MeshStandardMaterial({
      color: "#a16207", // yellow-700
      roughness: 0.6,
    });

    // Calculate wall directions and intersection angles to get clean joint offsets
    const getUnitVector = (p1: Point, p2: Point) => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len <= 0.1) return { x: 1, y: 0 };
      return { x: dx / len, y: dy / len };
    };

    const halfThick = wallThickness / 2;

    const walls: {
      group: THREE.Group;
      currentOpacity: number;
      normal: { x: number; z: number };
      mid: { x: number; z: number };
      // Camera-fade blocking threshold, scaled to THIS instance's own size
      // (not the whole scene) -- see the generic fade test in the
      // animation loop below.
      fadeThreshold: number;
      // Sticky "is this wall currently faded" state, used to add
      // hysteresis around fadeThreshold in the animation loop below --
      // without it, a camera sitting almost exactly on the threshold
      // (e.g. orbiting near a wall, or two coincident walls whose
      // thresholds differ by a hair) flips this every frame, and the
      // opacity lerp below just chases a target that's itself flickering.
      isBlockingState: boolean;
    }[] = [];

    // Every room/hallway instance builds its own walls independently, each
    // offset by its own x/y into the shared scene (0 for a standalone
    // single-room view) and centered against the OVERALL scene bounds
    // rather than its own half-width/half-length -- this is the only real
    // change from the single-room version of this function: every other
    // wall-building/opening-carving/mitre-joint calculation below is
    // untouched.
    for (const [roomIndex, room] of rooms.entries()) {
      const isPolygonRoom = room.corners.length !== 4;

      // Rectangular rooms (the overwhelming common case) keep the exact
      // original precise-miter math: each corner's offset is
      // halfThick/sin(interior angle), which produces a clean mitered joint
      // at any angle. Polygon rooms (L/T-shaped hallways) are, by
      // construction (see hallway-shapes.ts), built entirely from 90/270
      // degree corners -- sin(90)=1 and |sin(270)|=1, so the precise formula
      // reduces to exactly halfThick at every corner regardless of convex vs.
      // concave. That means a flat "extend every wall by halfThick at both
      // ends" is not an approximation here, it's the same math simplified for
      // the one corner-angle family these shapes ever use, and it sidesteps
      // needing a general convex/concave sign convention for an N-gon.
      let wallOffsets: Record<string, { start: number; end: number }> = {};
      if (!isPolygonRoom) {
        const w0 = getUnitVector(room.corners[0], room.corners[1]); // top
        const w1 = getUnitVector(room.corners[1], room.corners[2]); // right
        const w2 = getUnitVector(room.corners[2], room.corners[3]); // bottom
        const w3 = getUnitVector(room.corners[3], room.corners[0]); // left

        const getSinTheta = (v1: { x: number; y: number }, v2: { x: number; y: number }) => {
          return Math.max(0.1, Math.abs(v1.x * v2.y - v1.y * v2.x));
        };

        const sin0 = getSinTheta(w3, w0); // corner 0 (left-top)
        const sin1 = getSinTheta(w0, w1); // corner 1 (top-right)
        const sin2 = getSinTheta(w1, w2); // corner 2 (right-bottom)
        const sin3 = getSinTheta(w2, w3); // corner 3 (bottom-left)

        wallOffsets = {
          top: { start: -halfThick / sin0, end: halfThick / sin1 },
          right: { start: halfThick / sin1, end: -halfThick / sin2 },
          bottom: { start: -halfThick / sin2, end: halfThick / sin3 },
          left: { start: halfThick / sin3, end: -halfThick / sin0 },
        };
      }

      // Helper function to build segments for a single wall of THIS instance
      const buildWallSegments = (wallSide: string | number, ptA: Point, ptB: Point) => {
        const ax = room.x + ptA.x - centerX;
        const az = room.y + ptA.y - centerZ;
        const bx = room.x + ptB.x - centerX;
        const bz = room.y + ptB.y - centerZ;

        const dx = bx - ax;
        const dz = bz - az;
        const length = Math.sqrt(dx * dx + dz * dz);
        if (length <= 0.1) return;

        const wallCenterX = (ax + bx) / 2;
        const wallCenterZ = (az + bz) / 2;
        const rotationY = -Math.atan2(dz, dx);

        const wallGroup = new THREE.Group();
        wallGroup.position.set(wallCenterX, 0, wallCenterZ);
        wallGroup.rotation.y = rotationY;

        // Clone base materials to fade each wall group independently
        const colorKey = typeof wallSide === "string" ? wallSide : String(wallSide);
        const localWallMat = wallMat.clone();
        localWallMat.color.set(room.wallColors[colorKey] || "#f1f5f9");

        const localGlassMat = glassMat.clone();
        const localWoodMat = woodMat.clone();

        // Adjacent rooms are placed exactly flush against each other (0cm
        // gap -- required for the door/connectivity detection in
        // room-adjacency.ts to work), so every shared boundary between two
        // room instances has each side independently drawing its own solid
        // wall geometry sitting in the literal same 3D location outside a
        // door's own carved span. Two coincident semi-transparent surfaces
        // in the same spot is a textbook z-fighting setup: the GPU's depth
        // test has no reliable winner, so it flips per pixel/per frame as
        // the camera moves -- exactly the flicker reported around inner
        // walls near hallway junctions. `polygonOffset` gives each ROOM
        // INSTANCE (not each wall) a small, consistent depth bias so any
        // two coincident walls from different instances always resolve to
        // the same winner instead of fighting; it doesn't measurably shift
        // where anything visually appears.
        for (const mat of [localWallMat, localGlassMat, localWoodMat]) {
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = roomIndex * 0.5;
          mat.polygonOffsetUnits = roomIndex * 0.5;
        }

        // "bottom"/"left" are walked in reverse of forward-winding order in
        // the legacy named convention (see hallway-shapes.ts), so their
        // opening positions need flipping to a start-from-ptA measurement.
        // Numeric (polygon-room) walls are always forward-winding already.
        const isReversedNamedWall =
          typeof wallSide === "string" && (wallSide === "bottom" || wallSide === "left");

        // This wall's auto/manually open span(s) -- see room-adjacency.ts.
        // Computed in the exact same forward-winding (ptA-relative)
        // coordinate frame buildWallSegments itself uses for every named
        // wall (verified against every one of the 4 named-wall call sites
        // below: each passes ptA/ptB in the same order wallSegments(corners)
        // would for that wall's index), so it can be used directly here with
        // no isReversedNamedWall-style flip.
        const wallOpenSpans = room.openWalls.get(colorKey) ?? [];

        const wallOpenings = room.openings
          .filter((o) => o.wall === wallSide)
          .map((o) => {
            if (isReversedNamedWall) {
              return {
                ...o,
                position: length - o.position - o.width,
              };
            }
            return o;
          })
          // An opening that now falls inside an open span has no wall left
          // to sit in -- skip it (not delete it; see MultiRoomInspector.tsx
          // for why auto-detected opens deliberately never touch saved
          // opening data).
          .filter(
            (o) => !wallOpenSpans.some((s) => o.position < s.end && o.position + o.width > s.start),
          )
          .sort((a, b) => a.position - b.position);

        const offsets =
          typeof wallSide === "string"
            ? wallOffsets[wallSide]
            : { start: -halfThick, end: halfThick };
        const startOffset = offsets.start;
        const endOffset = offsets.end;

        const segments: { start: number; end: number }[] = [];
        let lastPos = startOffset;

        for (const o of wallOpenings) {
          if (o.position > lastPos) {
            segments.push({ start: lastPos, end: o.position });
          }

          const opStart = o.position;
          const opEnd = o.position + o.width;
          const opCenterLocal = (opStart + opEnd) / 2 - length / 2;
          const sillHeight = 90;
          const windowHeight = 120;
          const doorHeight = 200;

          if (o.kind === "window") {
            const sillGeo = new THREE.BoxGeometry(o.width, sillHeight, wallThickness);
            const sillMesh = new THREE.Mesh(sillGeo, localWallMat);
            sillMesh.position.set(opCenterLocal, sillHeight / 2, 0);
            sillMesh.castShadow = true;
            sillMesh.receiveShadow = true;
            wallGroup.add(sillMesh);

            const lintelH = wallHeight - (sillHeight + windowHeight);
            if (lintelH > 0) {
              const lintelGeo = new THREE.BoxGeometry(o.width, lintelH, wallThickness);
              const lintelMesh = new THREE.Mesh(lintelGeo, localWallMat);
              lintelMesh.position.set(opCenterLocal, wallHeight - lintelH / 2, 0);
              lintelMesh.castShadow = true;
              lintelMesh.receiveShadow = true;
              wallGroup.add(lintelMesh);
            }

            // Glass pane (rendered in the middle, slightly smaller to fit inside frame border)
            const glassGeo = new THREE.BoxGeometry(o.width - 8, windowHeight - 8, 4);
            const glassMesh = new THREE.Mesh(glassGeo, localGlassMat);
            glassMesh.position.set(opCenterLocal, sillHeight + windowHeight / 2, 0);
            wallGroup.add(glassMesh);

            // Solid Frame for high visibility and color reflection
            const frameMat = new THREE.MeshStandardMaterial({
              color: o.color || "#475569",
              roughness: 0.7,
              metalness: 0.15,
            });
            const frameThickness = wallThickness - 1; // Slightly inset to prevent z-fighting
            const frameBorder = 4; // 4cm border width

            // Top frame rail
            const topRailGeo = new THREE.BoxGeometry(o.width, frameBorder, frameThickness);
            const topRail = new THREE.Mesh(topRailGeo, frameMat);
            topRail.position.set(opCenterLocal, sillHeight + windowHeight - frameBorder / 2, 0);
            topRail.castShadow = true;
            topRail.receiveShadow = true;
            wallGroup.add(topRail);

            // Bottom frame rail
            const botRailGeo = new THREE.BoxGeometry(o.width, frameBorder, frameThickness);
            const botRail = new THREE.Mesh(botRailGeo, frameMat);
            botRail.position.set(opCenterLocal, sillHeight + frameBorder / 2, 0);
            botRail.castShadow = true;
            botRail.receiveShadow = true;
            wallGroup.add(botRail);

            // Left frame post
            const leftPostGeo = new THREE.BoxGeometry(
              frameBorder,
              windowHeight - frameBorder * 2,
              frameThickness,
            );
            const leftPost = new THREE.Mesh(leftPostGeo, frameMat);
            leftPost.position.set(
              opCenterLocal - o.width / 2 + frameBorder / 2,
              sillHeight + windowHeight / 2,
              0,
            );
            leftPost.castShadow = true;
            leftPost.receiveShadow = true;
            wallGroup.add(leftPost);

            // Right frame post
            const rightPostGeo = new THREE.BoxGeometry(
              frameBorder,
              windowHeight - frameBorder * 2,
              frameThickness,
            );
            const rightPost = new THREE.Mesh(rightPostGeo, frameMat);
            rightPost.position.set(
              opCenterLocal + o.width / 2 - frameBorder / 2,
              sillHeight + windowHeight / 2,
              0,
            );
            rightPost.castShadow = true;
            rightPost.receiveShadow = true;
            wallGroup.add(rightPost);
          } else if (o.kind === "door") {
            const lintelH = wallHeight - doorHeight;
            if (lintelH > 0) {
              const lintelGeo = new THREE.BoxGeometry(o.width, lintelH, wallThickness);
              const lintelMesh = new THREE.Mesh(lintelGeo, localWallMat);
              lintelMesh.position.set(opCenterLocal, wallHeight - lintelH / 2, 0);
              lintelMesh.castShadow = true;
              lintelMesh.receiveShadow = true;
              wallGroup.add(lintelMesh);
            }

            const doorThick = 4;
            const doorWidth = o.width - 4;
            const leafGeo = new THREE.BoxGeometry(doorWidth, doorHeight - 2, doorThick);
            const localDoorLeafMat = localWoodMat.clone();
            if (o.color) {
              localDoorLeafMat.color.set(o.color);
            }
            const leafMesh = new THREE.Mesh(leafGeo, localDoorLeafMat);

            const isStart = (o.hinge || "start") === "start";
            const isStart3D = isReversedNamedWall ? !isStart : isStart;

            if (isStart3D) {
              leafMesh.geometry.translate(doorWidth / 2, 0, 0);
              leafMesh.position.set(opStart - length / 2 + 2, (doorHeight - 2) / 2, 0);
              const angle = o.swing === "out" ? Math.PI / 4 : -Math.PI / 4;
              leafMesh.rotation.y = angle;
            } else {
              leafMesh.geometry.translate(-doorWidth / 2, 0, 0);
              leafMesh.position.set(opStart + o.width - length / 2 - 2, (doorHeight - 2) / 2, 0);
              const angle = o.swing === "out" ? -Math.PI / 4 : Math.PI / 4;
              leafMesh.rotation.y = angle;
            }
            leafMesh.castShadow = true;
            wallGroup.add(leafMesh);

            const frameGeo = new THREE.BoxGeometry(o.width, doorHeight, wallThickness - 2);
            const edges = new THREE.EdgesGeometry(frameGeo);
            const frameEdge = new THREE.LineSegments(
              edges,
              new THREE.LineBasicMaterial({ color: o.color || "#475569" }),
            );
            frameEdge.position.set(opCenterLocal, doorHeight / 2, 0);
            wallGroup.add(frameEdge);
          }

          lastPos = Math.min(length + endOffset, o.position + o.width);
        }

        if (length + endOffset > lastPos) {
          segments.push({ start: lastPos, end: length + endOffset });
        }

        // Carve out the auto/manually open span(s) -- a true archway (no
        // geometry at all), unlike a door/window's carve above which still
        // leaves a lintel/sill/frame. Applied after door/window carving
        // since a real opening should never legitimately land inside an
        // open span (filtered out above), so this only ever further splits
        // the plain wall-chunk segments.
        const finalSegments = subtractOpenSpans(segments, wallOpenSpans);

        for (const seg of finalSegments) {
          const segLen = seg.end - seg.start;
          if (segLen <= 0.1) continue;
          const segGeo = new THREE.BoxGeometry(segLen, wallHeight, wallThickness);
          const segMesh = new THREE.Mesh(segGeo, localWallMat);
          const localCenter = (seg.start + seg.end) / 2 - length / 2;
          segMesh.position.set(localCenter, wallHeight / 2, 0);
          segMesh.castShadow = true;
          segMesh.receiveShadow = true;
          wallGroup.add(segMesh);
        }

        scene.add(wallGroup);
        // Outward-facing normal of this wall segment, used by the generic
        // camera-fade test in the animation loop below (every wall, of
        // every instance, uses this same normal+midpoint test -- see that
        // loop for why this generalizes correctly to a rectangular room's
        // axis-aligned walls too). corners are wound clockwise on screen --
        // (dz,-dx) is that winding's outward normal in the room's centered
        // (x,z) plane, verified against known wall directions in
        // hallway-shapes.ts.
        const normal = { x: dz / length, z: -dx / length };
        walls.push({
          group: wallGroup,
          currentOpacity: 1.0,
          normal,
          mid: { x: wallCenterX, z: wallCenterZ },
          fadeThreshold: Math.max(room.width, room.length) * 0.1,
          isBlockingState: false,
        });
      };

      // Every wall is always built now -- buildWallSegments itself carves out
      // whichever span(s) of it are open (the "0-4 walls" feature -- see
      // room-adjacency.ts and subtractOpenSpans above) as a true archway
      // through to whatever's on the other side, leaving the rest of that
      // same wall standing. A wall that's 100% open just ends up with zero
      // wall-chunk segments, equivalent to skipping it entirely.
      if (!isPolygonRoom) {
        buildWallSegments("top", room.corners[0], room.corners[1]);
        buildWallSegments("right", room.corners[1], room.corners[2]);
        buildWallSegments("bottom", room.corners[2], room.corners[3]);
        buildWallSegments("left", room.corners[3], room.corners[0]);
      } else {
        for (const seg of wallSegments(room.corners)) {
          buildWallSegments(seg.index, seg.a, seg.b);
        }
      }
    }

    // --- Render Placed Items (every instance's furniture, offset the same
    // way its walls were above) ---
    const activeItemMeshes = new Map<string, THREE.Object3D>();

    for (const room of rooms) {
      for (const it of room.items) {
        const itHeight = it.height ?? getDefaultHeight(it.icon, it.kind);
        const itElev = it.elevation ?? 0;
        const isCircle = (it.shape ?? "rect") === "circle";
        const preset = it.icon ? PRESET_BY_KEY[it.icon] : undefined;

        // --- Kenney kit model path -------------------------------------
        // If this preset has a mapped kit model AND it's already loaded AND
        // the item's current size hasn't drifted too far from the preset's
        // own default (see resolveRenderMode/kit-models.ts), render the
        // real model instead of a box. Otherwise fall through to the
        // existing box/cylinder path below exactly as before -- including
        // the very first frame a not-yet-cached model is needed, while its
        // async load (kicked off here) is in flight.
        const kitModel: KitModel | undefined = preset?.kitModel;
        let renderedWithKitModel = false;

        if (kitModel) {
          const cachedTemplate = kitModelCache.get(kitModel.file);
          if (cachedTemplate) {
            const currentDims = { w: it.width, h: itHeight, l: it.length };
            const defaultDims = { w: preset!.w, h: preset!.h ?? itHeight, l: preset!.l };
            const mode = resolveRenderMode(currentDims, defaultDims);
            if (mode === "model") {
              const scaleVec = computeModelScale(currentDims, kitModel);

              const outerGroup = new THREE.Group();
              outerGroup.position.set(
                room.x + it.x + it.width / 2 - centerX,
                itElev,
                room.y + it.y + it.length / 2 - centerZ,
              );
              outerGroup.rotation.y = -(it.rotation * Math.PI) / 180;

              const instance = cachedTemplate.clone(true);
              // The kit model's own local origin sits at (or near) its
              // floor-contact corner, NOT centered (see KitModel's doc
              // comment in types/planner.ts) -- offsetting by its own
              // min*scale alongside the item's own half-width/half-length
              // is what lines its actual geometry up with the same
              // footprint rectangle and floor elevation the box path uses,
              // regardless of which corner any individual kit file happens
              // to be authored around.
              instance.position.set(
                -it.width / 2 - kitModel.minX * scaleVec.x,
                -kitModel.minY * scaleVec.y,
                -it.length / 2 - kitModel.minZ * scaleVec.z,
              );
              // scaleVec is a cm/cm ratio (correct for the position offset
              // above, since kitModel.minX/etc. are already stored in cm).
              // But the mesh's raw local vertex data, as left by GLTFLoader,
              // is in meters (glTF's authoring unit) -- Three.js's
              // instance.scale is applied directly to that raw data, so it
              // needs the additional meters->cm conversion factor here, or
              // the model renders roughly 100x too small (in practice,
              // collapses to a few cm and is invisible). See kit-models.ts's
              // KIT_MODEL_UNIT_SCALE doc comment for the full derivation.
              instance.scale.set(
                scaleVec.x * KIT_MODEL_UNIT_SCALE,
                scaleVec.y * KIT_MODEL_UNIT_SCALE,
                scaleVec.z * KIT_MODEL_UNIT_SCALE,
              );
              instance.traverse((node) => {
                if ((node as THREE.Mesh).isMesh) {
                  const mesh = node as THREE.Mesh;
                  mesh.castShadow = true;
                  mesh.receiveShadow = true;
                  // Never disposed by this component's cleanup below --
                  // geometry/material are owned by kitModelCache, shared
                  // with every other instance and every future rebuild.
                  mesh.userData.sharedFromKitCache = true;
                }
              });
              outerGroup.add(instance);
              scene.add(outerGroup);
              activeItemMeshes.set(it.id, outerGroup);

              if (selectedIds.has(it.id)) {
                const highlightGeo = new THREE.BoxGeometry(
                  it.width + 1.5,
                  itHeight + 1.5,
                  it.length + 1.5,
                );
                const highlightMat = new THREE.MeshBasicMaterial({
                  color: "#a855f7",
                  wireframe: true,
                  transparent: true,
                  opacity: 0.6,
                });
                const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
                highlightMesh.position.set(0, itHeight / 2, 0);
                outerGroup.add(highlightMesh);
              }

              renderedWithKitModel = true;
            }
          } else {
            loadKitModelIntoCache(kitModel.file, () => setKitModelVersion((v) => v + 1));
          }
        }

        if (renderedWithKitModel) continue;

        // --- Procedural low-poly model path ------------------------------
        // One step below the Kenney kit model: for presets with no matching
        // .glb (see Preset.proceduralModel in types/planner.ts), build a
        // small group of primitive shapes (box/cylinder/cone/sphere) that
        // at least suggests the real silhouette -- legs on a table, a
        // pedestal+bowl for a toilet, a base+pole+shade for a lamp -- rather
        // than falling all the way back to a single flat box. Always
        // available synchronously (no async load, unlike kit models), and
        // reshapes live with the item's current width/height/length exactly
        // like the box path below.
        if (preset?.proceduralModel) {
          const dims = { w: it.width, h: itHeight, l: it.length };
          const parts = generateProceduralParts(preset.proceduralModel, dims);
          if (parts.length > 0) {
            const presetMaterial = preset.material;
            const materialParams = getMaterialParams(presetMaterial);

            const outerGroup = new THREE.Group();
            outerGroup.position.set(
              room.x + it.x + it.width / 2 - centerX,
              itElev,
              room.y + it.y + it.length / 2 - centerZ,
            );
            outerGroup.rotation.y = -(it.rotation * Math.PI) / 180;

            const partsGroup = buildProceduralGroup(parts, it.color, materialParams);
            outerGroup.add(partsGroup);
            scene.add(outerGroup);
            activeItemMeshes.set(it.id, outerGroup);

            if (selectedIds.has(it.id)) {
              const highlightGeo = new THREE.BoxGeometry(
                it.width + 1.5,
                itHeight + 1.5,
                it.length + 1.5,
              );
              const highlightMat = new THREE.MeshBasicMaterial({
                color: "#a855f7",
                wireframe: true,
                transparent: true,
                opacity: 0.6,
              });
              const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
              highlightMesh.position.set(0, itHeight / 2, 0);
              outerGroup.add(highlightMesh);
            }

            continue;
          }
        }

        // A circular preset (round table, round rug, vase, ...) gets a unit
        // cylinder scaled to its width/length/height footprint instead of a
        // box -- purely visual, matching the 2D canvas's inscribed-ellipse
        // treatment. Collision never considers shape (see planner-math.ts),
        // so this has no effect beyond how the item looks in 3D.
        const itemGeo: THREE.BufferGeometry = isCircle
          ? new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
          : new THREE.BoxGeometry(it.width, itHeight, it.length);
        if (isCircle) {
          (itemGeo as THREE.CylinderGeometry).scale(it.width, itHeight, it.length);
        }

        // Explicit material hint from the catalog (see Preset.material in
        // types/planner.ts) -- undefined for a legacy custom box with no
        // catalog key, which falls back to a plain generic material via
        // getMaterialParams's default case.
        const presetMaterial = preset?.material;
        const { textureType, metalness, roughness, transparent, opacity } =
          getMaterialParams(presetMaterial);

        // Base side material
        const sideMat = new THREE.MeshStandardMaterial({
          color: it.color,
          roughness,
          metalness,
          transparent: transparent ?? false,
          opacity: opacity ?? 1,
        });

        if (textureType) {
          const tex = createProceduralTexture(textureType, it.color);
          sideMat.map = tex;
          tex.repeat.set(it.width / 40, it.length / 40);
        }

        // Top face material -- a canvas-textured material carrying the
        // item's color, procedural detail, selection border and name/dims
        // label. Built once and then dropped into the right material slot
        // for whichever geometry this item uses: index 2 of 6 for a box
        // (+x,-x,+y,-y,+z,-z groups), or index 1 of 3 for a cylinder
        // (side, top, bottom groups) -- see THREE.CylinderGeometry's default
        // material grouping.
        const textCol = readableText(it.color);
        const topMat = new THREE.MeshStandardMaterial({
          roughness,
          metalness,
          transparent: transparent ?? false,
          opacity: opacity ?? 1,
        });

        // Calculate ideal aspect-ratio canvas dimensions to prevent texture squishing/stretching
        const aspect = it.width / it.length;
        let canvasW = 512;
        let canvasH = 512;
        if (aspect > 1) {
          canvasH = Math.round(512 / aspect);
        } else {
          canvasW = Math.round(512 * aspect);
        }

        // Ensure a minimum canvas size for sharp rendering
        canvasW = Math.max(128, canvasW);
        canvasH = Math.max(128, canvasH);

        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Draw background color
          ctx.fillStyle = it.color;
          ctx.fillRect(0, 0, canvasW, canvasH);

          // Draw procedural details
          if (textureType === "wood") {
            ctx.strokeStyle = darkenColor(it.color, 0.12);
            ctx.lineWidth = Math.max(1, canvasW * 0.008);
            for (let j = -20; j < canvasW + 20; j += 16) {
              ctx.beginPath();
              for (let y = 0; y <= canvasH; y += 8) {
                const wave = Math.sin(y * 0.04 + j * 0.05) * 4 + Math.cos(y * 0.01) * 2;
                const x = j + wave;
                if (y === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();
            }
          } else if (textureType === "fabric") {
            ctx.strokeStyle = darkenColor(it.color, 0.08);
            ctx.lineWidth = 0.8;
            for (let j = 0; j < Math.max(canvasW, canvasH); j += 8) {
              if (j < canvasH) {
                ctx.beginPath();
                ctx.moveTo(0, j);
                ctx.lineTo(canvasW, j);
                ctx.stroke();
              }
              if (j < canvasW) {
                ctx.beginPath();
                ctx.moveTo(j, 0);
                ctx.lineTo(j, canvasH);
                ctx.stroke();
              }
            }
          } else if (textureType === "plant") {
            ctx.fillStyle = darkenColor(it.color, 0.15);
            for (let j = 0; j < 50; j++) {
              const rx = Math.random() * canvasW;
              const ry = Math.random() * canvasH;
              const rSize = 3 + Math.random() * 8;
              ctx.beginPath();
              ctx.ellipse(rx, ry, rSize, rSize / 2, Math.random() * Math.PI, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (textureType === "rug") {
            for (let j = 0; j < 2000; j++) {
              const rx = Math.random() * canvasW;
              const ry = Math.random() * canvasH;
              ctx.fillStyle =
                Math.random() > 0.5 ? darkenColor(it.color, 0.07) : lightenColor(it.color, 0.07);
              ctx.fillRect(rx, ry, 2, 2);
            }
          } else if (textureType === "leather") {
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = darkenColor(it.color, 0.1);
            for (let j = 0; j < 70; j++) {
              const rx = Math.random() * canvasW;
              const ry = Math.random() * canvasH;
              const rSize = (8 + Math.random() * 18) * (Math.min(canvasW, canvasH) / 256);
              ctx.beginPath();
              ctx.ellipse(rx, ry, rSize, rSize * 0.75, Math.random() * Math.PI, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.strokeStyle = darkenColor(it.color, 0.2);
            ctx.lineWidth = 0.6;
            for (let j = 0; j < 100; j++) {
              const rx = Math.random() * canvasW;
              const ry = Math.random() * canvasH;
              ctx.beginPath();
              ctx.moveTo(rx, ry);
              ctx.lineTo(rx + (Math.random() - 0.5) * 6, ry + (Math.random() - 0.5) * 6);
              ctx.stroke();
            }
          } else if (textureType === "stone") {
            for (let j = 0; j < 5; j++) {
              let x = Math.random() * canvasW;
              let y = Math.random() * canvasH;
              ctx.strokeStyle =
                Math.random() > 0.5 ? lightenColor(it.color, 0.25) : darkenColor(it.color, 0.2);
              ctx.lineWidth = 0.5 + Math.random() * 1.5;
              ctx.beginPath();
              ctx.moveTo(x, y);
              for (let seg = 0; seg < 6; seg++) {
                x += (Math.random() - 0.5) * (canvasW * 0.25);
                y += (Math.random() - 0.5) * (canvasH * 0.25);
                ctx.lineTo(x, y);
              }
              ctx.stroke();
            }
          }

          // Draw selection border if selected
          if (selectedIds.has(it.id)) {
            ctx.strokeStyle = "#a855f7";
            ctx.lineWidth = Math.max(4, Math.min(canvasW, canvasH) * 0.04);
            ctx.strokeRect(0, 0, canvasW, canvasH);
          }

          // Draw text labels if enabled
          if (showNames) {
            ctx.fillStyle = textCol;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const minDim = Math.min(canvasW, canvasH);
            const titleSize = Math.max(12, Math.round(minDim * 0.11));
            const subSize = Math.max(9, Math.round(minDim * 0.08));

            ctx.font = `bold ${titleSize}px sans-serif`;
            const nameY = canvasH * 0.42;
            const dimY = canvasH * 0.62;

            ctx.fillText(it.name, canvasW / 2, nameY);

            ctx.font = `500 ${subSize}px sans-serif`;
            ctx.fillStyle =
              textCol === "#fff" ? "rgba(255, 255, 255, 0.75)" : "rgba(17, 17, 17, 0.7)";
            ctx.fillText(`${it.width} × ${it.length}`, canvasW / 2, dimY);
          }
        }

        const tex = new THREE.CanvasTexture(canvas);
        topMat.map = tex;

        // Box groups: [+x, -x, +y(top), -y(bottom), +z, -z].
        // Cylinder groups: [side, top, bottom].
        const faceMats: THREE.Material[] = isCircle
          ? [sideMat, topMat, sideMat]
          : [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];

        const itemMesh = new THREE.Mesh(itemGeo, faceMats);
        itemMesh.position.x = room.x + it.x + it.width / 2 - centerX;
        itemMesh.position.z = room.y + it.y + it.length / 2 - centerZ;
        itemMesh.position.y = itElev + itHeight / 2;

        itemMesh.rotation.y = -(it.rotation * Math.PI) / 180;
        itemMesh.castShadow = true;
        itemMesh.receiveShadow = true;
        scene.add(itemMesh);
        activeItemMeshes.set(it.id, itemMesh);

        if (selectedIds.has(it.id)) {
          const highlightGeo: THREE.BufferGeometry = isCircle
            ? new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
            : new THREE.BoxGeometry(it.width + 1.5, itHeight + 1.5, it.length + 1.5);
          if (isCircle) {
            (highlightGeo as THREE.CylinderGeometry).scale(
              it.width + 1.5,
              itHeight + 1.5,
              it.length + 1.5,
            );
          }
          const highlightMat = new THREE.MeshBasicMaterial({
            color: "#a855f7",
            wireframe: true,
            transparent: true,
            opacity: 0.6,
          });
          const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
          itemMesh.add(highlightMesh);
        }
      }
    }

    // --- Toggleable Light Sources ---
    // Moved out to its own effect below (right after this one) so that
    // flipping "Enable Lighting" or an individual fixture's toggle doesn't
    // tear down and rebuild this entire scene -- see that effect's doc
    // comment for the full reasoning.

    // --- Animation Loop ---
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      // Dynamically fade walls blocking the camera view
      const camX = camera.position.x;
      const camZ = camera.position.z;

      // Calculate camera polar angle (phi) relative to controls.target to check pitch angle
      const dir = new THREE.Vector3().copy(camera.position).sub(controls.target);
      const phi = Math.acos(THREE.MathUtils.clamp(dir.y / dir.length(), -1, 1));

      // Fade factor scales from 0 (at phi <= 0.8 rad, viewed from above) to 1 (at phi >= 1.1 rad, horizontal view)
      let fadeFactor = 0;
      if (phi > 0.8) {
        fadeFactor = Math.min(1, (phi - 0.8) / 0.3);
      }

      for (const w of walls) {
        let targetOpacity = 1.0;

        // Blocking if the camera sits on the outward side of this wall's
        // own plane, past a margin scaled to that wall's own room instance
        // -- a single generic test that works for an axis-aligned
        // rectangular room's walls exactly as well as an L/T polygon
        // hallway's, and (unlike the old top/bottom/left/right string
        // heuristic this replaces) also generalizes correctly to any
        // number of rooms placed anywhere in the shared scene.
        //
        // Hysteresis band around fadeThreshold (rather than a single hard
        // cutoff): which side of the threshold flips the boolean depends
        // on the wall's CURRENT state, so a camera sitting almost exactly
        // on the threshold -- which happens constantly while orbiting near
        // a wall, or at any of the many wall-to-wall junctions in a
        // multi-room apartment -- can't flip it back and forth every
        // single frame. Without this, isBlocking (and therefore
        // targetOpacity) itself flickers, and the opacity lerp below is
        // just smoothly chasing an unstable target, which still reads as
        // visible flicker despite the smoothing.
        const dot = (camX - w.mid.x) * w.normal.x + (camZ - w.mid.z) * w.normal.z;
        const hysteresis = w.fadeThreshold * 0.5;
        const isBlocking = w.isBlockingState
          ? dot > w.fadeThreshold - hysteresis
          : dot > w.fadeThreshold + hysteresis;
        w.isBlockingState = isBlocking;

        if (isBlocking) {
          targetOpacity = THREE.MathUtils.lerp(1.0, wallFadeOpacityRef.current, fadeFactor);
        }

        w.currentOpacity = THREE.MathUtils.lerp(w.currentOpacity, targetOpacity, 0.12);

        w.group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat) => {
                mat.transparent = true;
                mat.opacity = w.currentOpacity;
                child.castShadow = w.currentOpacity > 0.45;
                child.receiveShadow = w.currentOpacity > 0.45;
              });
            }
          } else if (child instanceof THREE.LineSegments) {
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat) => {
                mat.transparent = true;
                mat.opacity = w.currentOpacity;
              });
            }
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          // Geometry/material of a cloned Kenney kit model instance are
          // shared with kitModelCache's template (THREE.Object3D.clone()
          // is shallow) and every other instance of the same file -- never
          // dispose those here, only the genuinely-per-rebuild box/cylinder
          // geometry and materials created above.
          if (obj.userData.sharedFromKitCache) return;
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      controls.dispose();
      renderer.dispose();

      dirLightRef.current = null;
      controlsRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
    };
  }, [
    rooms,
    selectedIds,
    showNames,
    isDark,
    sceneBounds,
    sunlightAngle,
    sunlightEnabled,
    kitModelVersion,
    // lightingEnabled/lightsOff deliberately NOT here -- see the separate
    // "Toggleable Light Sources" effect right below, which handles those
    // without rebuilding this entire (expensive) scene.
  ]);

  // --- Toggleable Light Sources ---
  // A separate, lightweight effect rather than folding this into the main
  // scene-building effect above: that effect tears down and rebuilds
  // EVERYTHING (walls, furniture, kit models, camera, controls, the whole
  // renderer) on every dependency change, which means simply flipping
  // "Enable Lighting" or one fixture's on/off toggle used to reset the
  // camera back to its default framing too -- jarring, and not what
  // toggling a light should do. This effect instead reuses the exact same
  // THREE.Scene the main effect built (via sceneRef) and only adds/removes
  // its own dedicated THREE.Group of light-only objects, leaving the
  // camera, controls, and everything else the user is looking at alone.
  //
  // It still depends on every input that makes the main effect above build
  // a brand new Scene object (rooms, selectedIds, showNames, isDark,
  // sceneBounds, sunlightAngle, sunlightEnabled, kitModelVersion) so that
  // when one of THOSE changes and a fresh scene is created, this effect
  // re-attaches its light group to it too -- otherwise a rebuild triggered
  // by something unrelated to lighting (e.g. toggling dark mode) would
  // leave the new scene with no lights until the next lighting-specific
  // change.
  //
  // This renderer has no real bloom/volumetric pipeline, so "glow" is
  // faked with layered, additive-blended, unlit (MeshBasicMaterial)
  // shapes -- several nested, increasingly large + increasingly
  // transparent copies of the same shape, rather than one hard-edged
  // shape at a single opacity. Additive blending means overlapping layers
  // naturally brighten toward the center, which is what actually reads as
  // "soft diffuse glow" instead of a flat, uniformly-colored silhouette
  // with a visible edge.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const lightGroup = new THREE.Group();
    scene.add(lightGroup);

    if (lightingEnabled) {
      const { centerX, centerZ } = sceneBounds;
      const lightColor = "#ffe1b0";
      const addGlowLayer = (
        geometry: THREE.BufferGeometry,
        opacity: number,
        extra?: Partial<THREE.MeshBasicMaterialParameters>,
      ) => {
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: lightColor,
            transparent: true,
            opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            ...extra,
          }),
        );
        lightGroup.add(mesh);
        return mesh;
      };

      for (const room of rooms) {
        for (const it of room.items) {
          const preset = it.icon ? PRESET_BY_KEY[it.icon] : undefined;
          if (!preset?.isLightSource || lightsOff.has(it.id)) continue;

          const itHeight = it.height ?? getDefaultHeight(it.icon, it.kind);
          const itElev = it.elevation ?? 0;
          const worldX = room.x + it.x + it.width / 2 - centerX;
          const worldZ = room.y + it.y + it.length / 2 - centerZ;
          // Near the shade/bulb of the fixture, not its floor-contact
          // point -- a floor lamp's light should come from up near its
          // shade, not from the floor beneath its base.
          const worldY = itElev + itHeight * 0.85;

          // Bigger fixtures read as brighter/more prominent than small
          // ones (a dining chandelier vs. a desk lamp), scaled off the
          // item's own footprint against a "typical lamp" baseline and
          // clamped so nothing vanishes or blows out the whole room.
          const sizeFactor = Math.min(2.4, Math.max(0.65, Math.max(it.width, it.length) / 38));

          // Ceiling/pendant/sconce/chandelier fixtures (see the "wall"
          // layer's doc comment in types/planner.ts) get a real downward
          // SpotLight plus a soft diffuse wash -- a lamp sitting on the
          // floor or a desk doesn't have a comparable single "beam," so it
          // just gets a stronger omnidirectional PointLight instead.
          const isDownlight = (it.layer ?? "main") === "wall";

          if (isDownlight) {
            // Wide angle + heavy penumbra: a real pendant/ceiling light
            // washes a broad area softly, it doesn't project a crisp
            // theatrical spotlight beam. This SpotLight still does the
            // actual falloff work (it's what makes nearby surfaces read
            // brighter than far ones), it just no longer gets a fake
            // beam-shaped mesh drawn along its cone -- see the
            // RectAreaLight below for that.
            const spotAngle = Math.PI / 4.2; // ~43 degrees
            const spotLight = new THREE.SpotLight(
              lightColor,
              22 * sizeFactor,
              500,
              spotAngle,
              0.95,
              0.85,
            );
            spotLight.position.set(worldX, worldY, worldZ);
            const spotTarget = new THREE.Object3D();
            spotTarget.position.set(worldX, 0, worldZ);
            lightGroup.add(spotTarget);
            spotLight.target = spotTarget;
            spotLight.castShadow = false;
            lightGroup.add(spotLight);

            // RectAreaLight: per the three.js manual's lights article
            // (https://threejs.org/manual/#en/lights), this is the light
            // type built for "a rectangular area of light like ... a
            // frosted sky light in a ceiling" -- exactly the fixture
            // we're modeling, and a real light rather than a translucent
            // mesh standing in for one. It has no cone/beam shape at all;
            // it just radiates softly from its rectangle, facing the
            // direction it's rotated toward (down, here), which is what
            // reads as a natural, diffuse ceiling wash instead of a hard
            // "flashlight" cone. Requires MeshStandardMaterial/
            // MeshPhysicalMaterial surfaces to receive it, which the
            // room's walls/floor/furniture already use.
            const panelSize = Math.max(22, Math.min(it.width, it.length) * 0.9) * sizeFactor;
            const rectLight = new THREE.RectAreaLight(
              lightColor,
              18 * sizeFactor,
              panelSize,
              panelSize,
            );
            rectLight.position.set(worldX, worldY, worldZ);
            rectLight.rotation.x = -Math.PI / 2; // face straight down
            lightGroup.add(rectLight);

            // Stop the floor pool a bit above true floor level (0), clear
            // of any "under" layer item (rugs, mats -- always <= 3cm tall,
            // see the catalog integrity test for that constraint) sitting
            // underneath. These are unlit, depthWrite:false planes/shells,
            // so anything else occupying the exact same y coordinate as
            // one of them is a textbook z-fighting setup -- the rug's
            // opaque top face and a coplanar glow disc at the same height
            // flicker as the depth test's result flips between them frame
            // to frame. This clearance was the actual cause of a reported
            // flickering rug once lighting was enabled.
            const floorClearance = 3.5;
            const dropHeight = Math.max(worldY - floorClearance, 1);

            // Pool of light roughly where the fixture's downward light
            // actually lands -- previously the base of a fake beam cone;
            // now just a standalone soft disc sized off the same spot
            // angle, since there's no cone mesh to inherit its radius
            // from anymore. Single disc (three stacked rings previously
            // read as visible concentric bands rather than one clean
            // spot).
            const beamRadius = Math.tan(spotAngle) * dropHeight;
            const poolDisc = addGlowLayer(
              new THREE.CircleGeometry(beamRadius, 32),
              Math.min(0.34, 0.26 * sizeFactor),
            );
            poolDisc.rotation.x = -Math.PI / 2;
            poolDisc.position.set(worldX, floorClearance, worldZ);
          } else {
            const pointLight = new THREE.PointLight(
              lightColor,
              7.5 * sizeFactor,
              Math.max(it.width, it.length, 60) * 18,
              1.4,
            );
            pointLight.position.set(worldX, worldY, worldZ);
            // Many small lamps casting shadows gets expensive fast and
            // reads as noisy flicker more than realism at this scale --
            // the directional sun light above already owns shadows.
            pointLight.castShadow = false;
            lightGroup.add(pointLight);
          }

          // Glowing bulb: a bright unlit core plus three soft additive
          // halos (each bigger and fainter than the last), scaled by the
          // same sizeFactor, so the fixture visibly reads as "on" up close
          // no matter how the real light above falls off across the room.
          const bulbRadius = Math.min(6, Math.max(it.width, it.length) * 0.1) * sizeFactor;
          const bulbMesh = new THREE.Mesh(
            new THREE.SphereGeometry(bulbRadius, 14, 14),
            new THREE.MeshBasicMaterial({ color: "#fffcf2" }),
          );
          bulbMesh.position.set(worldX, worldY, worldZ);
          lightGroup.add(bulbMesh);

          const haloLayers = [
            { radiusMult: 2.2, opacity: 0.55 },
            { radiusMult: 3.8, opacity: 0.3 },
            { radiusMult: 6, opacity: 0.13 },
          ];
          for (const layer of haloLayers) {
            const halo = addGlowLayer(
              new THREE.SphereGeometry(bulbRadius * layer.radiusMult, 14, 14),
              layer.opacity,
            );
            halo.position.set(worldX, worldY, worldZ);
          }
        }
      }
    }

    return () => {
      lightGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      scene.remove(lightGroup);
    };
  }, [
    rooms,
    selectedIds,
    showNames,
    isDark,
    sceneBounds,
    sunlightAngle,
    sunlightEnabled,
    kitModelVersion,
    lightingEnabled,
    lightsOff,
  ]);

  // Is German language active?
  const isDe = t.title === "Raumplaner";

  // Shared body for both the desktop always-visible panel and the mobile
  // bottom sheet (see useMobileViewOnly) -- every one of these is a genuine
  // view option (labels/sunlight/wall opacity/camera reset), not an editing
  // tool, so nothing needs to be dropped for mobile, just re-presented.
  const controlsBody = (
    <>
      {/* Toggle displays */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer font-medium">
          <input
            type="checkbox"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
          />
          <span>{isDe ? "Beschriftungen anzeigen" : "Show Item Labels"}</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer font-medium">
          <input
            type="checkbox"
            checked={sunlightEnabled}
            onChange={(e) => setSunlightEnabled(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
          />
          <span>{isDe ? "Sonnenlicht aktivieren" : "Enable Sunlight"}</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer font-medium">
          <input
            type="checkbox"
            checked={lightingEnabled}
            onChange={(e) => setLightingEnabled(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
          />
          <span>{isDe ? "Beleuchtung aktivieren" : "Enable Lighting"}</span>
        </label>
      </div>

      {/* Per-fixture light toggles -- every lamp/ceiling-light/sconce
          currently placed anywhere in view (see Preset.isLightSource),
          individually switchable once the master toggle above is on. */}
      {lightingEnabled && lightSourceItems.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border/20 pt-2">
          <span className="text-[10px] font-semibold text-muted-foreground">
            {isDe ? "Einzelne Lichtquellen" : "Individual Lights"}
          </span>
          <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1">
            {lightSourceItems.map((li) => (
              <label
                key={li.id}
                className="flex items-center gap-2 cursor-pointer text-[11px] font-medium"
              >
                <input
                  type="checkbox"
                  checked={!lightsOff.has(li.id)}
                  onChange={() => toggleItemLight(li.id)}
                  className="h-3 w-3 cursor-pointer rounded border-gray-300 accent-primary text-primary focus:ring-primary"
                />
                <span className="truncate">{li.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Sunlight Angle Slider */}
      {sunlightEnabled && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
            <span>{isDe ? "Sonnenlicht-Winkel" : "Sunlight Angle"}</span>
            <span>{sunlightAngle}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="5"
            value={sunlightAngle}
            onChange={(e) => setSunlightAngle(Number(e.target.value))}
            className="h-1 w-full cursor-pointer bg-slate-200 accent-primary rounded-lg appearance-none dark:bg-slate-700"
          />
        </div>
      )}

      {/* Wall Opacity Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
          <span>{isDe ? "Wand-Transparenz" : "Faded Wall Opacity"}</span>
          <span>{Math.round(wallFadeOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={wallFadeOpacity}
          onChange={(e) => setWallFadeOpacity(Number(e.target.value))}
          className="h-1 w-full cursor-pointer bg-slate-200 accent-primary rounded-lg appearance-none dark:bg-slate-700"
        />
      </div>

      {/* Reset Camera Button */}
      <button
        onClick={resetCamera}
        className="mt-1.5 w-full h-8 text-[11px] bg-primary text-primary-foreground font-semibold rounded-lg shadow hover:bg-primary/95 flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
        title={isDe ? "Kamera zurücksetzen (Taste 0 / Esc)" : "Reset camera target (Key 0 / Esc)"}
      >
        {isDe ? "Ansicht zurücksetzen" : "Reset Camera View"}
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-primary-foreground/20 text-primary-foreground rounded border border-primary-foreground/10">
          Esc / 0
        </kbd>
      </button>

      {/* Keyboard instructions -- not applicable on mobile (no keyboard/
          right-click), so this block is skipped there entirely. */}
      {!isMobileViewOnly && (
        <div className="border-t border-border/20 pt-2 text-[9px] text-muted-foreground/80 leading-relaxed flex flex-col gap-1">
          <div>
            •{" "}
            {isDe
              ? "Ziehen: Drehen • Rechtsklick: Verschieben"
              : "Drag: Rotate • Right-click: Pan camera"}
          </div>
          <div>
            •{" "}
            {isDe
              ? "Pfeiltasten: Kamera im Raum bewegen"
              : "Arrow Keys: Move camera in horizontal plane"}
          </div>
          <div>
            •{" "}
            {isDe
              ? "Shift + Pfeiltasten: Schnellere Bewegung"
              : "Shift + Arrow Keys: Fast camera movement"}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-slate-50/50 rounded-lg"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {isMobileViewOnly ? (
        <Drawer open={mobileControlsOpen} onOpenChange={setMobileControlsOpen}>
          <DrawerTrigger asChild>
            <button
              className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-background/85 backdrop-blur-md shadow-md text-foreground hover:bg-accent transition-colors"
              title={isDe ? "3D-Steuerung" : "3D View Controls"}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{isDe ? "3D-Steuerung" : "3D View Controls"}</DrawerTitle>
            </DrawerHeader>
            <div className="flex flex-col gap-3 px-4 pb-6 text-sm">{controlsBody}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        /* 3D Control Panel Overlay */
        <div className="absolute top-3 right-3 z-10 w-64 max-h-[85vh] overflow-y-auto flex flex-col gap-3 rounded-xl border border-border/40 bg-background/85 backdrop-blur-md p-3.5 shadow-lg select-none text-[11px] text-foreground">
          <div className="flex items-center justify-between font-semibold border-b border-border/20 pb-2 text-xs text-primary">
            <span>{isDe ? "3D-Steuerung" : "3D View Controls"}</span>
          </div>
          {controlsBody}
        </div>
      )}
    </div>
  );
}
