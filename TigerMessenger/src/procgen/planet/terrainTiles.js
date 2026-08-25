// =====================================================================
// Hand-authored terrain tile catalogue.  Tiles carry semantic fields and
// local sockets; they do not contain geometry.  The spherical WFC compiler
// turns this catalogue into a graph-compatible table.
// =====================================================================

export const TERRAIN_TILE_PROTOTYPES = Object.freeze([
  { id: "ocean.deep", family: "ocean", weight: 2.8, land: 0, elevation: -3, wetness: 1, forestness: 0, rockness: 0.05, sockets: ["ocean", "ocean"] },
  { id: "ocean.shelf", family: "ocean", weight: 2.2, land: 0, elevation: -1, wetness: 0.95, forestness: 0, rockness: 0.1, sockets: ["ocean", "coast"] },
  { id: "coast.convex", family: "coast", weight: 1.8, land: 0.45, elevation: 0, wetness: 0.8, forestness: 0.05, rockness: 0.15, sockets: ["ocean", "land"] },
  { id: "coast.concave", family: "coast", weight: 1.3, land: 0.5, elevation: 0.1, wetness: 0.75, forestness: 0.08, rockness: 0.12, sockets: ["ocean", "land"] },
  { id: "plain.grass", family: "plain", weight: 3.6, land: 1, elevation: 0.25, wetness: 0.25, forestness: 0.18, rockness: 0.05, sockets: ["land", "land"] },
  { id: "hill.low", family: "hill", weight: 2.3, land: 1, elevation: 0.75, wetness: 0.28, forestness: 0.35, rockness: 0.1, sockets: ["land", "land"] },
  { id: "hill.rolling", family: "hill", weight: 2.0, land: 1, elevation: 1.25, wetness: 0.34, forestness: 0.48, rockness: 0.12, sockets: ["land", "valley"] },
  { id: "ridge", family: "ridge", weight: 1.4, land: 1, elevation: 2.2, wetness: 0.2, forestness: 0.25, rockness: 0.42, sockets: ["ridge", "valley"] },
  { id: "mountain", family: "mountain", weight: 1.0, land: 1, elevation: 4.4, wetness: 0.18, forestness: 0.12, rockness: 0.72, sockets: ["ridge", "cliff"] },
  { id: "saddle", family: "saddle", weight: 0.8, land: 1, elevation: 2.8, wetness: 0.25, forestness: 0.18, rockness: 0.36, sockets: ["valley", "ridge"] },
  { id: "valley", family: "valley", weight: 1.6, land: 1, elevation: 0.4, wetness: 0.55, forestness: 0.42, rockness: 0.12, sockets: ["valley", "land"] },
  { id: "canyon.wall", family: "canyon", weight: 1.0, land: 1, elevation: 2.6, wetness: 0.25, forestness: 0.12, rockness: 0.86, sockets: ["cliff", "canyon"] },
  { id: "canyon.floor", family: "canyon", weight: 1.1, land: 1, elevation: 0.15, wetness: 0.7, forestness: 0.25, rockness: 0.3, sockets: ["canyon", "valley"] },
  { id: "lake.basin", family: "lake", weight: 0.9, land: 0.25, elevation: -0.4, wetness: 1, forestness: 0.05, rockness: 0.05, sockets: ["lake", "wetland"] },
  { id: "wetland", family: "wetland", weight: 1.2, land: 0.8, elevation: -0.05, wetness: 0.85, forestness: 0.35, rockness: 0.04, sockets: ["wetland", "land"] },
  { id: "forest.edge", family: "forest", weight: 1.8, land: 1, elevation: 0.55, wetness: 0.52, forestness: 0.74, rockness: 0.08, sockets: ["forest", "land"] },
  { id: "forest.core", family: "forest", weight: 1.5, land: 1, elevation: 0.85, wetness: 0.58, forestness: 0.98, rockness: 0.08, sockets: ["forest", "forest"] },
  { id: "waterfall.notch", family: "waterfall", weight: 0.55, land: 0.8, elevation: 1.1, wetness: 1, forestness: 0.22, rockness: 0.56, sockets: ["cliff", "lake"] },
  { id: "settlement.pad", family: "settlement", weight: 1.0, land: 1, elevation: 0.45, wetness: 0.2, forestness: 0, rockness: 0.18, sockets: ["land", "road"] },
  { id: "road.pass", family: "road", weight: 0.75, land: 1, elevation: 0.6, wetness: 0.18, forestness: 0.04, rockness: 0.12, sockets: ["road", "road"] },
  // Oskar-style landform-chain prototypes.  These are semantic modules, not
  // geometry: WFC chooses them, the scalar field/MC compiler renders them.
  { id: "peak.glacier", family: "peak", weight: 0.55, land: 1, elevation: 8.8, wetness: 0.72, forestness: 0, rockness: 0.88, snowness: 1, ashness: 0.35, sediment: 0.02, mossness: 0, flow: [0, -1, 0], sockets: ["peak", "snow", "ridge"], transitionTags: ["snow-massif", "glacial-runoff"] },
  { id: "peak.snowline", family: "peak", weight: 0.85, land: 1, elevation: 5.8, wetness: 0.55, forestness: 0.03, rockness: 0.72, snowness: 0.68, ashness: 0.42, sediment: 0.05, mossness: 0, flow: [0, -0.7, 0], sockets: ["snow", "ridge", "ash"], transitionTags: ["snowline", "ash-slope"] },
  { id: "rift.escarpment", family: "rift", weight: 0.8, land: 1, elevation: 3.6, wetness: 0.25, forestness: 0.08, rockness: 0.94, snowness: 0, ashness: 0.22, sediment: 0.1, mossness: 0.02, flow: [0, -0.25, 0], sockets: ["cliff", "canyon", "ridge"], transitionTags: ["rift-wall", "fault"] },
  { id: "rift.floor", family: "rift", weight: 1.15, land: 1, elevation: 0.28, wetness: 0.62, forestness: 0.18, rockness: 0.34, snowness: 0, ashness: 0.12, sediment: 0.58, mossness: 0.12, flow: [0, -0.65, 0], sockets: ["canyon", "valley", "wetland"], transitionTags: ["rift-floor", "alluvial-fan"] },
  { id: "rift.fault-step", family: "rift", weight: 0.72, land: 1, elevation: 2.1, wetness: 0.32, forestness: 0.12, rockness: 0.82, snowness: 0, ashness: 0.24, sediment: 0.22, mossness: 0.04, flow: [0, -0.45, 0], sockets: ["cliff", "fault", "canyon"], transitionTags: ["fault-step", "shoulder"] },
  { id: "lake.rift", family: "lake", weight: 1.0, land: 0.18, elevation: -0.48, wetness: 1, forestness: 0.02, rockness: 0.08, snowness: 0, ashness: 0, sediment: 0.72, mossness: 0.16, flow: [0, -0.18, 0], sockets: ["lake", "lake", "wetland"], transitionTags: ["rift-lake", "deep-water"] },
  { id: "lake.reed-shore", family: "lake", weight: 1.1, land: 0.62, elevation: -0.12, wetness: 0.95, forestness: 0.18, rockness: 0.06, snowness: 0, ashness: 0, sediment: 0.84, mossness: 0.6, flow: [0, -0.12, 0], sockets: ["lake", "wetland", "land"], transitionTags: ["reed-shore", "mud-flat"] },
  { id: "volcanic.cone", family: "volcanic", weight: 0.9, land: 1, elevation: 2.7, wetness: 0.22, forestness: 0.3, rockness: 0.56, snowness: 0, ashness: 0.9, sediment: 0.18, mossness: 0.04, flow: [0, -0.35, 0], sockets: ["cone", "ash", "land"], transitionTags: ["volcanic-cone", "auckland-field"] },
  { id: "volcanic.tuff", family: "volcanic", weight: 1.05, land: 1, elevation: 1.15, wetness: 0.3, forestness: 0.32, rockness: 0.48, snowness: 0, ashness: 0.78, sediment: 0.34, mossness: 0.08, flow: [0, -0.22, 0], sockets: ["ash", "land", "plain"], transitionTags: ["tuff-slope", "alluvial-edge"] },
  { id: "plain.alluvial", family: "plain", weight: 1.8, land: 1, elevation: 0.2, wetness: 0.52, forestness: 0.25, rockness: 0.06, snowness: 0, ashness: 0.04, sediment: 0.92, mossness: 0.42, flow: [0, -0.35, 0], sockets: ["plain", "stream", "land"], transitionTags: ["floodplain", "alluvial"] },
  { id: "plain.moss", family: "plain", weight: 1.45, land: 1, elevation: 0.14, wetness: 0.7, forestness: 0.34, rockness: 0.04, snowness: 0, ashness: 0.02, sediment: 0.78, mossness: 0.96, flow: [0, -0.22, 0], sockets: ["plain", "wetland", "stream"], transitionTags: ["moss-plain", "river-margin"] },
  { id: "plain.stream", family: "plain", weight: 0.92, land: 0.78, elevation: 0.04, wetness: 0.9, forestness: 0.12, rockness: 0.03, snowness: 0, ashness: 0, sediment: 0.88, mossness: 0.66, flow: [0, -0.62, 0], sockets: ["stream", "wetland", "plain"], transitionTags: ["plain-stream", "flood-channel"] },
]);

export function createTerrainTiles({ prototypes = TERRAIN_TILE_PROTOTYPES } = {}) {
  const orientations = [
    { id: "base", angle: 0, mirror: false },
    { id: "rot90", angle: Math.PI * 0.5, mirror: false },
    { id: "mirror", angle: 0, mirror: true },
  ];
  return prototypes.flatMap((prototype, prototypeIndex) => orientations.map((orientation, orientationIndex) => Object.freeze({
    ...prototype,
    index: prototypeIndex * orientations.length + orientationIndex,
    key: `${prototype.id}@${orientation.id}`,
    orientation: orientation.id,
    localAngle: orientation.angle,
    mirrored: orientation.mirror,
    fields: Object.freeze({
      land: prototype.land,
      elevation: prototype.elevation,
      wetness: prototype.wetness,
      forestness: prototype.forestness,
      rockness: prototype.rockness,
      snowness: prototype.snowness ?? 0,
      ashness: prototype.ashness ?? 0,
      sediment: prototype.sediment ?? 0,
      mossness: prototype.mossness ?? 0,
      flow: prototype.flow ? prototype.flow.slice() : [0, 0, prototype.wetness ?? 0],
      transitionTags: prototype.transitionTags ? prototype.transitionTags.slice() : [],
    }),
    sockets: orientation.mirror ? prototype.sockets.slice().reverse() : prototype.sockets.slice(),
  })));
}

export function terrainTileById(tiles, id) {
  return tiles.find((tile) => tile.id === id || tile.key === id) || null;
}
