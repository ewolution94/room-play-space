import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Item, Opening } from "@/types/planner";

interface ThreeDViewProps {
  roomW: number; // cm
  roomL: number; // cm
  items: Item[];
  openings: Opening[];
  selectedIds: Set<string>;
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

export function ThreeDView({ roomW, roomL, items, openings, selectedIds }: ThreeDViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc"); // slate-50

    // --- Camera Setup ---
    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 5000);
    // Position camera diagonally looking down at the center
    camera.position.set(roomW * 0.8, Math.max(roomW, roomL) * 1.2, roomL * 1.2);

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

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight("#ffffff", 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#ffffff", 0.85);
    dirLight.position.set(roomW, 350, roomL);
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

    // Soft sky light to simulate indirect daylight
    const hemiLight = new THREE.HemisphereLight("#bae6fd", "#fed7aa", 0.25); // sky-200 to orange-200
    scene.add(hemiLight);

    // --- Floor Plan Grid ---
    // Floor plane
    const floorGeo = new THREE.PlaneGeometry(roomW, roomL);
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#e2e8f0", // slate-200
      roughness: 0.8,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.05; // tiny offset to avoid z-fighting with helpers
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Floor outline border
    const borderGeo = new THREE.BoxGeometry(roomW + 2, 1, roomL + 2);
    const borderMat = new THREE.MeshBasicMaterial({ color: "#cbd5e1" }); // slate-300
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.y = -0.5;
    scene.add(borderMesh);

    // Grid helper
    const maxDim = Math.max(roomW, roomL);
    const gridHelper = new THREE.GridHelper(maxDim, Math.round(maxDim / 50), "#94a3b8", "#cbd5e1");
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

    // Helper function to build segments for a single wall
    const buildWallSegments = (
      wallSide: "top" | "bottom" | "left" | "right",
      length: number,
      centerX: number,
      centerZ: number,
      rotationY: number
    ) => {
      const wallGroup = new THREE.Group();
      wallGroup.position.set(centerX, 0, centerZ);
      wallGroup.rotation.y = rotationY;

      // Find and sort openings on this specific wall
      const wallOpenings = openings
        .filter((o) => o.wall === wallSide)
        .sort((a, b) => a.position - b.position);

      const segments: { start: number; end: number }[] = [];
      let lastPos = 0;

      // Draw standard wall slabs and track openings
      for (const o of wallOpenings) {
        // Slab before opening
        if (o.position > lastPos) {
          segments.push({ start: lastPos, end: o.position });
        }

        // Openings specific geometries:
        // Window sill and lintels, or Door lintels
        const opStart = o.position;
        const opEnd = o.position + o.width;

        const opCenterLocal = (opStart + opEnd) / 2 - length / 2;
        const sillHeight = 90;
        const windowHeight = 120;
        const doorHeight = 200;

        // Render framing lintels/sills
        if (o.kind === "window") {
          // Sill (wall below window)
          const sillGeo = new THREE.BoxGeometry(o.width, sillHeight, wallThickness);
          const sillMesh = new THREE.Mesh(sillGeo, wallMat);
          sillMesh.position.set(opCenterLocal, sillHeight / 2, 0);
          sillMesh.castShadow = true;
          sillMesh.receiveShadow = true;
          wallGroup.add(sillMesh);

          // Lintel (wall above window)
          const lintelH = wallHeight - (sillHeight + windowHeight);
          if (lintelH > 0) {
            const lintelGeo = new THREE.BoxGeometry(o.width, lintelH, wallThickness);
            const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
            lintelMesh.position.set(opCenterLocal, wallHeight - lintelH / 2, 0);
            lintelMesh.castShadow = true;
            lintelMesh.receiveShadow = true;
            wallGroup.add(lintelMesh);
          }

          // Glass pane
          const glassGeo = new THREE.BoxGeometry(o.width - 2, windowHeight - 2, 4);
          const glassMesh = new THREE.Mesh(glassGeo, glassMat);
          glassMesh.position.set(opCenterLocal, sillHeight + windowHeight / 2, 0);
          wallGroup.add(glassMesh);

          // Thin window frame border
          const frameGeo = new THREE.BoxGeometry(o.width, windowHeight, wallThickness - 2);
          const frameEdge = new THREE.BoxHelper(new THREE.Mesh(frameGeo), new THREE.Color("#475569"));
          (frameEdge.material as THREE.LineBasicMaterial).linewidth = 1;
          frameEdge.position.set(opCenterLocal, sillHeight + windowHeight / 2, 0);
          wallGroup.add(frameEdge);
        } else if (o.kind === "door") {
          // Lintel (wall above door)
          const lintelH = wallHeight - doorHeight;
          if (lintelH > 0) {
            const lintelGeo = new THREE.BoxGeometry(o.width, lintelH, wallThickness);
            const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
            lintelMesh.position.set(opCenterLocal, wallHeight - lintelH / 2, 0);
            lintelMesh.castShadow = true;
            lintelMesh.receiveShadow = true;
            wallGroup.add(lintelMesh);
          }

          // Render a simple semi-open door leaf
          const doorThick = 4;
          const doorWidth = o.width - 4;
          const leafGeo = new THREE.BoxGeometry(doorWidth, doorHeight - 2, doorThick);
          const leafMesh = new THREE.Mesh(leafGeo, woodMat);
          // Anchor rotation at the side of the door hinge (start of opening)
          // For simplicity, shift center so rotation hinge is at local -width/2
          leafMesh.geometry.translate(doorWidth / 2, 0, 0);
          leafMesh.position.set(opStart - length / 2 + 2, (doorHeight - 2) / 2, 0);
          // Angle open slightly (45 deg)
          const angle = o.swing === "out" ? Math.PI / 4 : -Math.PI / 4;
          leafMesh.rotation.y = angle;
          leafMesh.castShadow = true;
          wallGroup.add(leafMesh);

          // Thin door frame border
          const frameGeo = new THREE.BoxGeometry(o.width, doorHeight, wallThickness - 2);
          const frameEdge = new THREE.BoxHelper(new THREE.Mesh(frameGeo), new THREE.Color("#475569"));
          frameEdge.position.set(opCenterLocal, doorHeight / 2, 0);
          wallGroup.add(frameEdge);
        }

        lastPos = Math.min(length, o.position + o.width);
      }

      // Final wall slab
      if (length > lastPos) {
        segments.push({ start: lastPos, end: length });
      }

      // Add full wall segments
      for (const seg of segments) {
        const segLen = seg.end - seg.start;
        if (segLen <= 0.1) continue;
        const segGeo = new THREE.BoxGeometry(segLen, wallHeight, wallThickness);
        const segMesh = new THREE.Mesh(segGeo, wallMat);
        const localCenter = (seg.start + seg.end) / 2 - length / 2;
        segMesh.position.set(localCenter, wallHeight / 2, 0);
        segMesh.castShadow = true;
        segMesh.receiveShadow = true;
        wallGroup.add(segMesh);
      }

      scene.add(wallGroup);
    };

    // Top wall
    buildWallSegments("top", roomW, 0, -roomL / 2 - wallThickness / 2, 0);
    // Bottom wall
    buildWallSegments("bottom", roomW, 0, roomL / 2 + wallThickness / 2, Math.PI);
    // Left wall
    buildWallSegments("left", roomL, -roomW / 2 - wallThickness / 2, 0, Math.PI / 2);
    // Right wall
    buildWallSegments("right", roomL, roomW / 2 + wallThickness / 2, 0, -Math.PI / 2);

    // --- Render Placed Items ---
    const activeItemMeshes = new Map<string, THREE.Mesh>();

    for (const it of items) {
      const itHeight = it.height ?? getDefaultHeight(it.icon, it.kind);
      const itElev = it.elevation ?? 0;

      const itemGeo = new THREE.BoxGeometry(it.width, itHeight, it.length);
      const itemMat = new THREE.MeshStandardMaterial({
        color: it.color,
        roughness: 0.5,
        metalness: 0.1,
      });

      const itemMesh = new THREE.Mesh(itemGeo, itemMat);

      // Translation coordinate mapping:
      // x_3d = (it.x + it.width / 2) - roomW / 2
      // z_3d = (it.y + it.length / 2) - roomL / 2
      // y_3d = itElev + itHeight / 2
      itemMesh.position.x = it.x + it.width / 2 - roomW / 2;
      itemMesh.position.z = it.y + it.length / 2 - roomL / 2;
      itemMesh.position.y = itElev + itHeight / 2;

      // Clockwise rotation (negative angle in Three.js)
      itemMesh.rotation.y = -(it.rotation * Math.PI) / 180;
      itemMesh.castShadow = true;
      itemMesh.receiveShadow = true;
      scene.add(itemMesh);
      activeItemMeshes.set(it.id, itemMesh);

      // Add simple icon visual accents to distinguish chairs/tables slightly if wanted,
      // but standard colors and outlines look very sleek.
      if (selectedIds.has(it.id)) {
        // Selection highlight wireframe box
        const highlightGeo = new THREE.BoxGeometry(it.width + 1.5, itHeight + 1.5, it.length + 1.5);
        const highlightMat = new THREE.MeshBasicMaterial({
          color: "#a855f7", // purple-500
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

      // Dispose Three.js objects
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
    };
  }, [roomW, roomL, items, openings, selectedIds]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-50/50 rounded-lg">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute top-3 right-3 z-10 bg-background/80 backdrop-blur-sm px-2.5 py-1.5 rounded-md border text-[10px] text-muted-foreground font-medium select-none pointer-events-none">
        Drag: Rotate • Right-click: Pan • Scroll: Zoom
      </div>
    </div>
  );
}
