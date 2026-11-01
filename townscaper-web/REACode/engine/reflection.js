/**
 * Flat-colour reflection — the "abstract flat coloured mid point".
 *
 * Reference (2020-01-10): "The technical solution is almost the same as in Bad
 * North. One big difference is that the bright colours wouldn't let me get away
 * with a monochrome reflection, so I had to figure out this somewhat abstract
 * flat coloured mid point. (Also, the wave skirt stretches further this time)"
 *
 * Reading the still: a mirror image IS there, but it carries no detail. Every
 * reflected mass is one flat block of colour that sits roughly halfway between
 * the building's colour and the water's. That is what "mid point" means — not a
 * gradient, a single in-between tone.
 *
 * So: mirror the land geometry, drop the lighting entirely (MeshBasicMaterial),
 * and tint the whole thing with the island's average paint mixed halfway toward
 * the sea colour. Cheap, and it reads as reflection without competing with the
 * town — which is exactly the problem a sharp mirror had with bright colours.
 */

import * as THREE from 'three';

/** Average paint colour over every painted voxel, in linear space. */
function averagePaint(town) {
  const palette = town.palette.colors;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;

  for (let id = 0; id < town.solid.length; id++) {
    if (town.solid[id] === 0) continue;
    // roofs matter more visually than walls on a bright town, so count both
    const wall = town.colors[id];
    const roof = town.roofColors[id];
    const hex = roof >= 0 ? palette[roof] : wall >= 0 ? palette[wall] : null;
    if (!hex) continue;
    const v = parseInt(hex.slice(1), 16);
    r += ((v >> 16) & 255) / 255;
    g += ((v >> 8) & 255) / 255;
    b += (v & 255) / 255;
    n++;
  }
  if (n === 0) return new THREE.Color('#cfc6b4');
  return new THREE.Color(r / n, g / n, b / n);
}

export function createFlatReflection(land, town, {
  seaHex = '#2d6b7d',
  // 0.5 is literally "halfway between the building and the sea", which is the
  // midpoint the note describes. Nudged down a touch so it sits under the water.
  mix = 0.38,
  opacity = 0.42,
  surfaceY = -0.02,
} = {}) {
  const paint = averagePaint(town);
  const sea = new THREE.Color(seaHex).convertSRGBToLinear();
  const mid = paint.clone().lerp(sea, mix);

  const material = new THREE.MeshBasicMaterial({
    color: mid,
    transparent: true,
    opacity,
    depthWrite: false,
    // the mirrored geometry has inverted winding, so draw both faces
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(land.geometry, material);
  mesh.scale.y = -0.85;          // flipped, and slightly squashed: water is not glass
  mesh.position.y = surfaceY;
  mesh.userData.overlayOnly = true;

  return {
    mesh,
    material,
    colour: mid.clone(),
    dispose() { material.dispose(); },
  };
}
