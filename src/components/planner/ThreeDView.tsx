import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Item, Opening, Point } from "@/types/planner";
import type { TranslationStrings } from "@/lib/planner-translations";
import { readableText } from "@/lib/planner-math";

interface ThreeDViewProps {
  t: TranslationStrings;
  roomW: number; // cm
  roomL: number; // cm
  items: Item[];
  openings: Opening[];
  selectedIds: Set<string>;
  corners: Point[];
  wallColors: Record<string, string>;
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

function createProceduralTexture(type: "wood" | "fabric" | "plant" | "rug", baseColor: string): THREE.Texture {
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
      ctx.fillStyle = Math.random() > 0.5 ? darkenColor(baseColor, 0.07) : lightenColor(baseColor, 0.07);
      ctx.fillRect(rx, ry, 2, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function getDefaultHeight(icon?: string, kind?: string): number {
  if (kind === "chair") return 80;
  if (!icon) return 75; // default custom box height
  switch (icon) {
    case "chair-office":
      return 85;
    case "armchair":
      return 80;
    case "sofa":
      return 80;
    case "bed-double":
    case "bed-single":
      return 45;
    case "desk":
    case "round-table":
      return 75;
    case "coffee-table":
      return 45;
    case "side-table":
      return 55;
    case "bookshelf":
      return 180;
    case "wardrobe":
      return 200;
    case "filing-cabinet":
      return 120;
    case "stove":
    case "sink":
      return 90;
    case "fridge":
      return 180;
    case "toilet":
      return 75;
    case "bathtub":
      return 60;
    case "plant":
      return 80;
    case "floor-lamp":
      return 160;
    case "rug":
      return 0.5; // flat on floor
    default:
      return 75;
  }
}

export function ThreeDView({
  t,
  roomW,
  roomL,
  items,
  openings,
  selectedIds,
  corners,
  wallColors,
  isDark = false,
}: ThreeDViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // View settings state
  const [showNames, setShowNames] = useState(true);
  const [wallFadeOpacity, setWallFadeOpacity] = useState(0.25);
  const [sunlightEnabled, setSunlightEnabled] = useState(true);
  const [sunlightAngle, setSunlightAngle] = useState(45);

  // References for live updates without scene rebuilds
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wallFadeOpacityRef = useRef<number>(0.25);

  // Sync state values with refs for animation loop / effects
  useEffect(() => {
    wallFadeOpacityRef.current = wallFadeOpacity;
  }, [wallFadeOpacity]);

  useEffect(() => {
    if (dirLightRef.current) {
      dirLightRef.current.visible = sunlightEnabled;
      const rad = (sunlightAngle * Math.PI) / 180;
      dirLightRef.current.position.set(Math.cos(rad) * roomW, 350, Math.sin(rad) * roomL);
    }
  }, [sunlightEnabled, sunlightAngle, roomW, roomL]);

  // Reset Camera View Helper
  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(roomW * 0.8, Math.max(roomW, roomL) * 1.2, roomL * 1.2);
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
      
      let moveDir = new THREE.Vector3();
      
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
  }, [roomW, roomL]);

  // Main Three.js Scene Setup Effect
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !corners || corners.length < 4) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? "#0f172a" : "#f8fafc"); // slate-900 vs slate-50

    // --- Camera Setup ---
    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 5000);
    camera.position.set(roomW * 0.8, Math.max(roomW, roomL) * 1.2, roomL * 1.2);
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
    dirLight.position.set(Math.cos(rad) * roomW, 350, Math.sin(rad) * roomL);
    dirLight.visible = sunlightEnabled;
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 1000;

    // Dynamic shadow camera boundaries based on room size
    const d = Math.max(roomW, roomL) * 0.8;
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
      isDark ? 0.15 : 0.25
    );
    scene.add(hemiLight);

    // Floor plane geometry removed as requested to leave only the grid helper
    // Grid helper (extended to cover a massive 80x80m layout space)
    const maxDim = 8000;
    const gridColor1 = isDark ? "#475569" : "#94a3b8"; // slate-600 vs slate-400
    const gridColor2 = isDark ? "#1e293b" : "#cbd5e1"; // slate-800 vs slate-200
    const gridHelper = new THREE.GridHelper(maxDim, Math.round(maxDim / 50), gridColor1, gridColor2);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // --- Draw segmented walls with door/window openings ---
    const wallHeight = 240; // cm
    const wallThickness = 12; // cm
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

    const w0 = getUnitVector(corners[0], corners[1]); // top
    const w1 = getUnitVector(corners[1], corners[2]); // right
    const w2 = getUnitVector(corners[2], corners[3]); // bottom
    const w3 = getUnitVector(corners[3], corners[0]); // left

    const getSinTheta = (v1: { x: number; y: number }, v2: { x: number; y: number }) => {
      return Math.max(0.1, Math.abs(v1.x * v2.y - v1.y * v2.x));
    };

    const sin0 = getSinTheta(w3, w0); // corner 0 (left-top)
    const sin1 = getSinTheta(w0, w1); // corner 1 (top-right)
    const sin2 = getSinTheta(w1, w2); // corner 2 (right-bottom)
    const sin3 = getSinTheta(w2, w3); // corner 3 (bottom-left)

    const halfThick = wallThickness / 2;

    const wallOffsets = {
      top: {
        start: -halfThick / sin0,
        end: halfThick / sin1,
      },
      right: {
        start: halfThick / sin1,
        end: -halfThick / sin2,
      },
      bottom: {
        start: -halfThick / sin2,
        end: halfThick / sin3,
      },
      left: {
        start: halfThick / sin3,
        end: -halfThick / sin0,
      },
    };

    const walls: {
      side: "top" | "bottom" | "left" | "right";
      group: THREE.Group;
      currentOpacity: number;
    }[] = [];

    // Helper function to build segments for a single wall
    const buildWallSegments = (
      wallSide: "top" | "bottom" | "left" | "right",
      ptA: Point,
      ptB: Point
    ) => {
      const ax = ptA.x - roomW / 2;
      const az = ptA.y - roomL / 2;
      const bx = ptB.x - roomW / 2;
      const bz = ptB.y - roomL / 2;

      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length <= 0.1) return;

      const centerX = (ax + bx) / 2;
      const centerZ = (az + bz) / 2;
      const rotationY = -Math.atan2(dz, dx);

      const wallGroup = new THREE.Group();
      wallGroup.position.set(centerX, 0, centerZ);
      wallGroup.rotation.y = rotationY;

      // Clone base materials to fade each wall group independently
      const localWallMat = wallMat.clone();
      localWallMat.color.set(wallColors[wallSide] || "#f1f5f9");

      const localGlassMat = glassMat.clone();
      const localWoodMat = woodMat.clone();

      const wallOpenings = openings
        .filter((o) => o.wall === wallSide)
        .map((o) => {
          if (wallSide === "bottom" || wallSide === "left") {
            return {
              ...o,
              position: length - o.position - o.width,
            };
          }
          return o;
        })
        .sort((a, b) => a.position - b.position);

      const startOffset = wallOffsets[wallSide].start;
      const endOffset = wallOffsets[wallSide].end;

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
          const leftPostGeo = new THREE.BoxGeometry(frameBorder, windowHeight - frameBorder * 2, frameThickness);
          const leftPost = new THREE.Mesh(leftPostGeo, frameMat);
          leftPost.position.set(opCenterLocal - o.width / 2 + frameBorder / 2, sillHeight + windowHeight / 2, 0);
          leftPost.castShadow = true;
          leftPost.receiveShadow = true;
          wallGroup.add(leftPost);

          // Right frame post
          const rightPostGeo = new THREE.BoxGeometry(frameBorder, windowHeight - frameBorder * 2, frameThickness);
          const rightPost = new THREE.Mesh(rightPostGeo, frameMat);
          rightPost.position.set(opCenterLocal + o.width / 2 - frameBorder / 2, sillHeight + windowHeight / 2, 0);
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
          
          const isReversed = wallSide === "bottom" || wallSide === "left";
          const isStart = (o.hinge || "start") === "start";
          const isStart3D = isReversed ? !isStart : isStart;
          
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
            new THREE.LineBasicMaterial({ color: o.color || "#475569" })
          );
          frameEdge.position.set(opCenterLocal, doorHeight / 2, 0);
          wallGroup.add(frameEdge);
        }

        lastPos = Math.min(length + endOffset, o.position + o.width);
      }

      if (length + endOffset > lastPos) {
        segments.push({ start: lastPos, end: length + endOffset });
      }

      for (const seg of segments) {
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
      walls.push({
        side: wallSide,
        group: wallGroup,
        currentOpacity: 1.0,
      });
    };

    buildWallSegments("top", corners[0], corners[1]);
    buildWallSegments("right", corners[1], corners[2]);
    buildWallSegments("bottom", corners[2], corners[3]);
    buildWallSegments("left", corners[3], corners[0]);

    // --- Render Placed Items ---
    const activeItemMeshes = new Map<string, THREE.Mesh>();

    for (const it of items) {
      const itHeight = it.height ?? getDefaultHeight(it.icon, it.kind);
      const itElev = it.elevation ?? 0;

      const itemGeo = new THREE.BoxGeometry(it.width, itHeight, it.length);
      
      let textureType: "wood" | "fabric" | "plant" | "rug" | null = null;
      let metalness = 0.1;
      let roughness = 0.5;

      const lowerIcon = (it.icon || "").toLowerCase();
      const lowerName = it.name.toLowerCase();

      if (
        lowerIcon.includes("fridge") ||
        lowerIcon.includes("sink") ||
        lowerIcon.includes("stove") ||
        lowerName.includes("kühlschrank") ||
        lowerName.includes("spüle") ||
        lowerName.includes("herd")
      ) {
        metalness = 0.85;
        roughness = 0.2;
      } else if (
        lowerIcon.includes("desk") ||
        lowerIcon.includes("table") ||
        lowerIcon.includes("bookshelf") ||
        lowerIcon.includes("wardrobe") ||
        lowerIcon.includes("cabinet") ||
        lowerName.includes("tisch") ||
        lowerName.includes("regal") ||
        lowerName.includes("schrank") ||
        lowerName.includes("desk") ||
        lowerName.includes("table") ||
        lowerName.includes("shelf") ||
        lowerName.includes("wardrobe")
      ) {
        if (!(lowerIcon.includes("filing") && (it.color === "#9aa0a6" || it.color.toLowerCase() === "#gray"))) {
          textureType = "wood";
          roughness = 0.7;
        } else {
          metalness = 0.5;
          roughness = 0.35;
        }
      } else if (
        lowerIcon.includes("chair") ||
        lowerIcon.includes("sofa") ||
        lowerIcon.includes("armchair") ||
        lowerIcon.includes("bed") ||
        lowerName.includes("stuhl") ||
        lowerName.includes("sofa") ||
        lowerName.includes("sessel") ||
        lowerName.includes("bett") ||
        lowerName.includes("chair") ||
        lowerName.includes("couch") ||
        lowerName.includes("bed")
      ) {
        textureType = "fabric";
        roughness = 0.95;
      } else if (
        lowerIcon.includes("plant") ||
        lowerName.includes("pflanze") ||
        lowerName.includes("plant")
      ) {
        textureType = "plant";
        roughness = 0.6;
      } else if (
        lowerIcon.includes("rug") ||
        lowerName.includes("teppich") ||
        lowerName.includes("rug")
      ) {
        textureType = "rug";
        roughness = 0.95;
      }

      // Base side material
      const sideMat = new THREE.MeshStandardMaterial({
        color: it.color,
        roughness: roughness,
        metalness: metalness,
      });

      if (textureType) {
        const tex = createProceduralTexture(textureType, it.color);
        sideMat.map = tex;
        tex.repeat.set(it.width / 40, it.length / 40);
      }

      // Generate 6 materials: Top face maps custom canvas containing labels, others map sideMat
      const faceMats: THREE.Material[] = [];
      const textCol = readableText(it.color);

      for (let i = 0; i < 6; i++) {
        if (i === 2) {
          // Top face material
          const topMat = new THREE.MeshStandardMaterial({
            roughness: roughness,
            metalness: metalness,
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
                if (j < canvasH) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvasW, j); ctx.stroke(); }
                if (j < canvasW) { ctx.beginPath(); ctx.moveTo(j, 0); ctx.lineTo(j, canvasH); ctx.stroke(); }
              }
            } else if (textureType === "plant") {
              ctx.fillStyle = darkenColor(it.color, 0.15);
              for (let j = 0; j < 50; j++) {
                const rx = Math.random() * canvasW;
                const ry = Math.random() * canvasH;
                const rSize = 3 + Math.random() * 8;
                ctx.beginPath(); ctx.ellipse(rx, ry, rSize, rSize / 2, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
              }
            } else if (textureType === "rug") {
              for (let j = 0; j < 2000; j++) {
                const rx = Math.random() * canvasW;
                const ry = Math.random() * canvasH;
                ctx.fillStyle = Math.random() > 0.5 ? darkenColor(it.color, 0.07) : lightenColor(it.color, 0.07);
                ctx.fillRect(rx, ry, 2, 2);
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
              ctx.fillStyle = textCol === "#fff" ? "rgba(255, 255, 255, 0.75)" : "rgba(17, 17, 17, 0.7)";
              ctx.fillText(`${it.width} × ${it.length}`, canvasW / 2, dimY);
            }
          }

          const tex = new THREE.CanvasTexture(canvas);
          topMat.map = tex;
          faceMats.push(topMat);
        } else {
          faceMats.push(sideMat);
        }
      }

      const itemMesh = new THREE.Mesh(itemGeo, faceMats);
      itemMesh.position.x = it.x + it.width / 2 - roomW / 2;
      itemMesh.position.z = it.y + it.length / 2 - roomL / 2;
      itemMesh.position.y = itElev + itHeight / 2;

      itemMesh.rotation.y = -(it.rotation * Math.PI) / 180;
      itemMesh.castShadow = true;
      itemMesh.receiveShadow = true;
      scene.add(itemMesh);
      activeItemMeshes.set(it.id, itemMesh);

      if (selectedIds.has(it.id)) {
        const highlightGeo = new THREE.BoxGeometry(it.width + 1.5, itHeight + 1.5, it.length + 1.5);
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

    // --- Animation Loop ---
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      // Dynamically fade walls blocking the camera view
      const camX = camera.position.x;
      const camZ = camera.position.z;

      for (const w of walls) {
        let targetOpacity = 1.0;
        
        // Determine if camera is outside this wall looking in
        if (w.side === "top" && camZ < -roomL * 0.1) {
          targetOpacity = wallFadeOpacityRef.current;
        } else if (w.side === "bottom" && camZ > roomL * 0.1) {
          targetOpacity = wallFadeOpacityRef.current;
        } else if (w.side === "left" && camX < -roomW * 0.1) {
          targetOpacity = wallFadeOpacityRef.current;
        } else if (w.side === "right" && camX > roomW * 0.1) {
          targetOpacity = wallFadeOpacityRef.current;
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
    };
  }, [roomW, roomL, items, openings, selectedIds, showNames, corners, wallColors, isDark]);

  // Is German language active?
  const isDe = t.title === "Raumplaner";

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-50/50 rounded-lg">
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* 3D Control Panel Overlay */}
      <div className="absolute top-3 right-3 z-10 w-64 max-h-[85vh] overflow-y-auto flex flex-col gap-3 rounded-xl border border-border/40 bg-background/85 backdrop-blur-md p-3.5 shadow-lg select-none text-[11px] text-foreground">
        <div className="flex items-center justify-between font-semibold border-b border-border/20 pb-2 text-xs text-primary">
          <span>{isDe ? "3D-Steuerung" : "3D View Controls"}</span>
        </div>
        
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
        </div>

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
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-primary-foreground/20 text-primary-foreground rounded border border-primary-foreground/10">Esc / 0</kbd>
        </button>

        {/* Keyboard instructions */}
        <div className="border-t border-border/20 pt-2 text-[9px] text-muted-foreground/80 leading-relaxed flex flex-col gap-1">
          <div>• {isDe ? "Ziehen: Drehen • Rechtsklick: Verschieben" : "Drag: Rotate • Right-click: Pan camera"}</div>
          <div>• {isDe ? "Pfeiltasten: Kamera im Raum bewegen" : "Arrow Keys: Move camera in horizontal plane"}</div>
          <div>• {isDe ? "Shift + Pfeiltasten: Schnellere Bewegung" : "Shift + Arrow Keys: Fast camera movement"}</div>
        </div>
      </div>
    </div>
  );
}
