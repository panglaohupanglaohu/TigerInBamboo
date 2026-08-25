// =====================================================================
//  V4  fort 编译管线（G2–G5 装配）
// =====================================================================

import { compileTopology } from "./topology.js";
import { createTerrainPipeline } from "./terrainGenerator.js";
import { createSurfaceProvider } from "./surfaceProvider.js";
import { compileTerrainUV } from "./terrainUvCompiler.js";
import { createModuleCatalog } from "./moduleCatalog.js";
import { resolveTown } from "./moduleResolver.js";
import { compileSurfaceGraph } from "./surfaceGraph.js";
import { materializeTownGeometry } from "./clusterGeometry.js";
import { extractLowPolySurface } from "./terrainExtract.js";

export function compileCitadelV4(blueprint, seed = 1) {
  const pipe = createTerrainPipeline(blueprint, seed);
  const field = pipe.runAll();
  const topo = pipe.topology;
  const surfaces = createSurfaceProvider(topo.halfEdge, field);
  const uv = compileTerrainUV(topo.halfEdge, field);
  const catalog = createModuleCatalog();
  const town = resolveTown(blueprint, catalog, seed);
  const geo = materializeTownGeometry(town, topo, blueprint, seed);
  town.props = {
    slots: geo.slots,
    placed: geo.placed,
    usage: geo.usage.props,
    familyUsage: geo.usage.families,
    note: "v6-g3-data",
  };
  town.geometryHash = geo.hash;
  const terrainMesh = extractLowPolySurface(topo, field);
  const graph = compileSurfaceGraph(topo, surfaces);
  return Object.freeze({
    topo,
    terrain: Object.freeze({
      field,
      log: pipe.log,
      extract: Object.freeze({ hash: terrainMesh.hash, report: terrainMesh.report }),
    }),
    surfaces,
    uv,
    catalog,
    town,
    graph,
    seed,
  });
}
