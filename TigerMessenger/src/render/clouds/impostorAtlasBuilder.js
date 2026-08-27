// =====================================================================
// Procedural impostor atlases.  S12 (Oskar, 2024-11-01): "A fluffy cloud
// shader. It is using the same impostors as the trees" — clouds and tree
// canopies share one billboard-impostor pipeline, baked once into a single
// atlas and drawn in the same draw call.
//
// This is an authored low-cost proxy, not a fluid simulation: color/alpha +
// a signed-ish distance channel are baked once and sampled by the shader.
// =====================================================================

export const CLOUD_ATLAS_SCHEMA_VERSION = 2;
export const SHARED_ATLAS_SCHEMA_VERSION = 1;

function hashString(value) { let h = 2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

// One square billboard block (size×size) of the atlas.  kind decides which
// authored SDF silhouette is baked: the cloud puff union or the tree canopy
// lobe union (the same three-lobe crown the low-poly citadel tree uses).
function bakeViewBlock(size, viewIndex, viewCount, kind) {
  const colorAlpha = new Uint8Array(size * size * 4);
  const distance = new Uint8Array(size * size);
  const viewPhase = (viewIndex / Math.max(1, viewCount)) * Math.PI * 2;
  const puffs = kind === "canopy"
    ? [[-0.3, 0.06, 0.34], [0.3, 0.06, 0.34], [0.0, 0.4, 0.36]]
    : [[-0.48, 0.08, 0.30], [-0.22, -0.06, 0.42], [0.08, -0.12, 0.45],
       [0.38, 0.02, 0.34], [0.58, 0.12, 0.22], [0.03, 0.23, 0.3]];
  const cloudRgb = [244, 248, 238];
  const canopyRgb = [87, 133, 66];
  const trunkRgb = [94, 72, 48];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + 0.5) / size * 2 - 1;
    const ny = (y + 0.5) / size * 2 - 1;
    // SDF union of the same low-poly puffs used by the project cloud asset.
    // The view phase only changes overlap subtly; it never turns the cloud into
    // a flat ellipse, so the baked billboard keeps the rounded cotton silhouette.
    let d = Infinity;
    for (let puff = 0; puff < puffs.length; puff++) {
      const [px, py, radius] = puffs[puff];
      const wobble = 0.018 * Math.sin(viewPhase + puff * 1.7 + nx * 7);
      d = Math.min(d, Math.hypot((nx - px) * 0.96, (ny - py) * 1.04) - radius - wobble);
    }
    // A gently flattened underside makes a low cloud/fog billboard sit in the
    // trees instead of reading as a floating white ball; the canopy underside
    // is cut harder so the crown reads as growing out of the terrain, not
    // hovering above it.  The canopy block keeps a narrow brown trunk column
    // under the crown so the shared impostor still reads as a tree.
    let rgb = kind === "canopy" ? canopyRgb : cloudRgb;
    if (kind === "canopy") {
      const flatLine = -0.42;
      if (ny < flatLine) {
        const trunkHalf = 0.07;
        const trunkD = Math.abs(nx) - trunkHalf;
        if (trunkD < 0.05) {
          d = trunkD * 2.0 - 0.2;
          rgb = trunkRgb;
        } else {
          d = Math.max(d, (flatLine - ny) * 0.6);
        }
      }
    } else if (ny < -0.57) {
      d = Math.max(d, (-0.57 - ny) * 0.42);
    }
    const alpha = Math.round(Math.max(0, Math.min(1, 0.5 - d * 2.3)) * 255);
    const i = (y * size + x);
    colorAlpha[i * 4] = rgb[0];
    colorAlpha[i * 4 + 1] = rgb[1];
    colorAlpha[i * 4 + 2] = rgb[2];
    colorAlpha[i * 4 + 3] = alpha;
    distance[i] = Math.round(Math.max(0, Math.min(1, 0.5 - d)) * 255);
  }
  return { colorAlpha, distance };
}

export function buildCloudImpostorAtlas({ views = 12, size = 48, sourceHash = "project-lowpoly-puff-v2" } = {}) {
  const pixelCount = views * size * size;
  const colorAlpha = new Uint8Array(pixelCount * 4);
  const distance = new Uint8Array(pixelCount);
  for (let view = 0; view < views; view++) {
    const block = bakeViewBlock(size, view, views, "cloud");
    colorAlpha.set(block.colorAlpha, view * size * size * 4);
    distance.set(block.distance, view * size * size);
  }
  return Object.freeze({
    version: CLOUD_ATLAS_SCHEMA_VERSION,
    views,
    size,
    channels: ["color", "alpha", "distance"],
    shape: "stacked-lowpoly-puffs-sdf",
    sourceAsset: "project-lowpoly-cloud-puff",
    viewPolicy: "8-16-angle-billboard-atlas",
    colorAlpha,
    distance,
    sourceHash,
    hash: `cloud-atlas:${hashString(`${views}:${size}:${sourceHash}`)}`,
  });
}

// S12 shared atlas: cloud blocks and tree-canopy blocks live in ONE texture.
// The shader picks the block family per instance via aShape (0 = cloud,
// 1 = canopy), so a single InstancedBufferGeometry draw call renders the
// cloud-sea frame and the slope tree crowns together.
export function buildSharedImpostorAtlas({ cloudViews = 8, canopyViews = 6, size = 48, sourceHash = "oskar-s12-shared-impostor-v1" } = {}) {
  const views = cloudViews + canopyViews;
  const pixelCount = views * size * size;
  const colorAlpha = new Uint8Array(pixelCount * 4);
  const distance = new Uint8Array(pixelCount);
  const blockOf = [];
  for (let view = 0; view < views; view++) {
    const kind = view < cloudViews ? "cloud" : "canopy";
    const localView = kind === "canopy" ? view - cloudViews : view;
    const block = bakeViewBlock(size, localView, kind === "canopy" ? canopyViews : cloudViews, kind);
    colorAlpha.set(block.colorAlpha, view * size * size * 4);
    distance.set(block.distance, view * size * size);
    blockOf.push(kind);
  }
  return Object.freeze({
    version: SHARED_ATLAS_SCHEMA_VERSION,
    views,
    cloudViews,
    canopyViews,
    size,
    channels: ["color", "alpha", "distance"],
    shape: "cloud+canopy-shared-octa-impostor",
    sourceAsset: "project-lowpoly-cloud-puff+highland-tree-canopy",
    viewPolicy: "8-16-angle-billboard-atlas-shared",
    colorAlpha,
    distance,
    blockOf,
    sourceHash,
    hash: `shared-impostor-atlas:${hashString(`${cloudViews}:${canopyViews}:${size}:${sourceHash}`)}`,
  });
}

// 提取共享 atlas 的云块 0 为独立纹理（Sprite 云用：THREE.Sprite 自动面向
// 相机，不依赖 billboard shader——2026-08-27 云可见性修复的可靠路径）。
export function extractCloudBlockTexture(THREE, atlas, { block = 0 } = {}) {
  if (!THREE?.DataTexture || !atlas) return null;
  const size = atlas.size;
  const blockData = new Uint8Array(size * size * 4);
  const src = atlas.colorAlpha;
  const base = block * size * size * 4;
  for (let i = 0; i < size * size * 4; i++) blockData[i] = src[base + i];
  const texture = new THREE.DataTexture(blockData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
  return texture;
}

export function createThreeCloudAtlasTexture(THREE, atlas) {
  if (!THREE?.DataTexture || !atlas) return null;
  const texture = new THREE.DataTexture(atlas.colorAlpha, atlas.size * atlas.views, atlas.size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
