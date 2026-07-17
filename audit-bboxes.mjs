import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import fs from "node:fs";
import path from "node:path";

// Extract every kitModel entry from planner-presets.ts via regex (key, file, min/max).
const src = fs.readFileSync("src/lib/planner-presets.ts", "utf8");
const entries = [];
const re = /kitModel:\s*\{\s*file:\s*"([^"]+)",\s*minX:\s*(-?[\d.]+),\s*minY:\s*(-?[\d.]+),\s*minZ:\s*(-?[\d.]+),\s*maxX:\s*(-?[\d.]+),\s*maxY:\s*(-?[\d.]+),\s*maxZ:\s*(-?[\d.]+),\s*\}/g;
let m;
while ((m = re.exec(src))) {
  entries.push({
    file: m[1],
    minX: +m[2], minY: +m[3], minZ: +m[4],
    maxX: +m[5], maxY: +m[6], maxZ: +m[7],
  });
}
console.log(`Found ${entries.length} kitModel entries via regex.\n`);

const loader = new GLTFLoader();
const dir = "public/models/kenney";

function loadGltf(file) {
  return new Promise((resolve, reject) => {
    const buf = fs.readFileSync(path.join(dir, file));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    loader.parse(ab, "", resolve, reject);
  });
}

const uniqueFiles = [...new Set(entries.map(e => e.file))];
const realBbox = new Map();
for (const file of uniqueFiles) {
  try {
    const gltf = await loadGltf(file);
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    realBbox.set(file, {
      minX: +(box.min.x*100).toFixed(2), minY: +(box.min.y*100).toFixed(2), minZ: +(box.min.z*100).toFixed(2),
      maxX: +(box.max.x*100).toFixed(2), maxY: +(box.max.y*100).toFixed(2), maxZ: +(box.max.z*100).toFixed(2),
    });
  } catch (err) {
    console.error(`FAILED to load ${file}:`, err.message);
  }
}

let mismatchCount = 0;
for (const e of entries) {
  const real = realBbox.get(e.file);
  if (!real) continue;
  const axes = ["minX","minY","minZ","maxX","maxY","maxZ"];
  const diffs = axes.filter(ax => Math.abs(e[ax] - real[ax]) > 0.5); // >0.5cm tolerance
  if (diffs.length > 0) {
    mismatchCount++;
    console.log(`MISMATCH ${e.file}:`);
    console.log(`  stored: min(${e.minX},${e.minY},${e.minZ}) max(${e.maxX},${e.maxY},${e.maxZ})`);
    console.log(`  real:   min(${real.minX},${real.minY},${real.minZ}) max(${real.maxX},${real.maxY},${real.maxZ})`);
  }
}
console.log(`\n${mismatchCount} / ${uniqueFiles.length} unique files mismatched.`);
