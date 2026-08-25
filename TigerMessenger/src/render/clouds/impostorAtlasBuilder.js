// =====================================================================
// Procedural cloud impostor atlas.  This is an authored low-cost proxy, not
// a fluid simulation: color/alpha + a signed-ish distance channel are baked
// once and sampled by the shader.
// =====================================================================

export const CLOUD_ATLAS_SCHEMA_VERSION = 2;

function hashString(value) { let h = 2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

export function buildCloudImpostorAtlas({ views = 12, size = 48, sourceHash = "project-lowpoly-puff-v2" } = {}) {
  const pixelCount = views * size * size;
  const colorAlpha = new Uint8Array(pixelCount * 4);
  const distance = new Uint8Array(pixelCount);
  for (let view = 0; view < views; view++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + 0.5) / size * 2 - 1;
    const ny = (y + 0.5) / size * 2 - 1;
    const viewPhase = (view / Math.max(1, views)) * Math.PI * 2;
    // SDF union of the same low-poly puffs used by the project cloud asset.
    // The view phase only changes overlap subtly; it never turns the cloud into
    // a flat ellipse, so the baked billboard keeps the rounded cotton silhouette.
    const puffs = [
      [-0.48, 0.08, 0.30], [-0.22, -0.06, 0.42], [0.08, -0.12, 0.45],
      [0.38, 0.02, 0.34], [0.58, 0.12, 0.22], [0.03, 0.23, 0.3],
    ];
    let d = Infinity;
    for (let puff = 0; puff < puffs.length; puff++) {
      const [px, py, radius] = puffs[puff];
      const wobble = 0.018 * Math.sin(viewPhase + puff * 1.7 + nx * 7);
      d = Math.min(d, Math.hypot((nx - px) * 0.96, (ny - py) * 1.04) - radius - wobble);
    }
    // A gently flattened underside makes a low cloud/fog billboard sit in the
    // trees instead of reading as a floating white ball.
    d = Math.max(d, ny < -0.57 ? (-0.57 - ny) * 0.42 : d);
    const alpha = Math.round(Math.max(0, Math.min(1, 0.5 - d * 2.3)) * 255);
    const i = ((view * size * size) + y * size + x);
    colorAlpha[i * 4] = 244;
    colorAlpha[i * 4 + 1] = 248;
    colorAlpha[i * 4 + 2] = 238;
    colorAlpha[i * 4 + 3] = alpha;
    distance[i] = Math.round(Math.max(0, Math.min(1, 0.5 - d)) * 255);
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

export function createThreeCloudAtlasTexture(THREE, atlas) {
  if (!THREE?.DataTexture || !atlas) return null;
  const texture = new THREE.DataTexture(atlas.colorAlpha, atlas.size * atlas.views, atlas.size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
