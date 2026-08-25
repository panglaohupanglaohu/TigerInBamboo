// Art-directed terrain profiles.  Each profile is data consumed by the same
// field compiler; none of them creates an alternate rectangular mesh.

export const TERRAIN_PROFILES_V8 = Object.freeze({
  "highland-citadel": Object.freeze({ type: "snow-massif", landformClass: "volcanic-snow-massif", peaks: 3, peakHeights: [8.6, 7.2, 6.4], snowline: 5.2, glacierGullies: 4, terraceCount: 5, waterfallCount: 4, minLandHeight: 3, hardEdges: ["terrace", "waterfall", "foundation"] }),
  "highland-snow-massif": Object.freeze({ type: "snow-massif", landformClass: "volcanic-snow-massif", peaks: 3, peakHeights: [8.6, 7.2, 6.4], snowline: 5.2, glacierGullies: 4, terraceCount: 5, waterfallCount: 4, minLandHeight: 3, hardEdges: ["terrace", "waterfall", "foundation"] }),
  "crystal-canyon": Object.freeze({ type: "rift-escarpment", landformClass: "rift-escarpment", ridgeCount: 2, mouthWidth: 0.08, floorWidth: 0.055, exitSaddle: true, faultSteps: 3, alluvialFan: true }),
  "crystal-rift-canyon": Object.freeze({ type: "rift-escarpment", landformClass: "rift-escarpment", ridgeCount: 2, mouthWidth: 0.08, floorWidth: 0.055, exitSaddle: true, faultSteps: 3, alluvialFan: true }),
  "saihoji-hills": Object.freeze({ type: "plain", landformClass: "japanese-alluvial-plain", aliasOf: "saihoji-plain", groveScale: 3, wetMoss: true, battlefieldKeepout: true, maxSlope: 0.16 }),
  "saihoji-plain": Object.freeze({ type: "plain", landformClass: "japanese-alluvial-plain", groveScale: 3, wetMoss: true, battlefieldKeepout: true, maxSlope: 0.16, floodplain: true, streamMargins: true }),
  "swamp-lake": Object.freeze({ type: "rift-long-lake", landformClass: "rift-long-lake", closedBasin: true, shallowShelf: true, wetlandRing: true, reedShore: true, islands: 3, curved: true }),
  "swamp-rift-lake": Object.freeze({ type: "rift-long-lake", landformClass: "rift-long-lake", closedBasin: true, shallowShelf: true, wetlandRing: true, reedShore: true, islands: 3, curved: true }),
  "bookshop-hill-chain": Object.freeze({ type: "volcanic-hills", landformClass: "auckland-volcanic-hills", aliasOf: "bookshop-auckland-hills", coneCount: 4, tuffShoulder: true, connectTo: "saihoji-moss-garden", walkingRoute: true, tramRoute: true }),
  "bookshop-auckland-hills": Object.freeze({ type: "volcanic-hills", landformClass: "auckland-volcanic-hills", coneCount: 4, tuffShoulder: true, connectTo: "saihoji-moss-garden", walkingRoute: true, tramRoute: true }),
  "triple-gate-highland": Object.freeze({ type: "rift-shoulder-pass", landformClass: "rift-shoulder-pass", highGround: true, saddle: true, birdCorridor: true, faultShoulder: true, cloudCeiling: true }),
  "triple-gate-rift-shoulder": Object.freeze({ type: "rift-shoulder-pass", landformClass: "rift-shoulder-pass", highGround: true, saddle: true, birdCorridor: true, faultShoulder: true, cloudCeiling: true }),
  "coastal-harbor-citadel": Object.freeze({ type: "coastal-harbor", shoreShelf: true, bay: true }),
  "curved-lake": Object.freeze({ type: "closed-basin", closedBasin: true }),
  "navona-water-court": Object.freeze({ type: "local-cistern", globalRoute: false }),
});

export function profileById(id) {
  return TERRAIN_PROFILES_V8[id] || null;
}

export const TERRAIN_PROFILE_ALIASES = Object.freeze({
  "saihoji-hills": "saihoji-plain",
  "bookshop-hill-chain": "bookshop-auckland-hills",
  "crystal-canyon": "crystal-rift-canyon",
  "highland-citadel": "highland-snow-massif",
  "swamp-lake": "swamp-rift-lake",
  "triple-gate-highland": "triple-gate-rift-shoulder",
});

export function canonicalProfileId(id) {
  return TERRAIN_PROFILE_ALIASES[id] || id;
}
