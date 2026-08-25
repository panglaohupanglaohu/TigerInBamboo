export { createTerrainTiles, TERRAIN_TILE_PROTOTYPES } from "./terrainTiles.js";

export function validateTerrainTile(tile) {
  const errors = [];
  for (const key of ["id", "family"]) if (!tile?.[key]) errors.push(key);
  for (const key of ["land", "elevation", "wetness", "forestness", "rockness"]) if (!Number.isFinite(tile?.[key])) errors.push(key);
  for (const key of ["snowness", "ashness", "sediment", "mossness"]) if (tile?.[key] != null && !Number.isFinite(tile[key])) errors.push(key);
  if (!Array.isArray(tile?.sockets) || tile.sockets.length < 2) errors.push("sockets");
  if (tile?.flow != null && (!Array.isArray(tile.flow) || tile.flow.length !== 3 || tile.flow.some((value) => !Number.isFinite(value)))) errors.push("flow");
  if (tile?.transitionTags != null && !Array.isArray(tile.transitionTags)) errors.push("transitionTags");
  return { ok: errors.length === 0, errors };
}
