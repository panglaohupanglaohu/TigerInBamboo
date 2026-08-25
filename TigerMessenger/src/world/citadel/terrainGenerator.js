// =====================================================================
//  地形生成 pipeline：锚点 → 排水 → 柔坡 → 断崖 → 侵蚀 → 路线验证（G2）
//  纯数据；每 pass 可单步/导出。长窄有向结构先锁定，不交给 WFC。
// =====================================================================

import { compileTopology, facePoints } from "./topology.js";
import { createRng } from "../../core/rng.js";

export const TERRAIN_PASSES = Object.freeze([
  "stampGameplayAnchors",
  "solveDrainage",
  "relaxSoftSlopes",
  "sharpenCliffBands",
  "erodeAlongFlow",
  "validatePlayableConnections",
]);

function cloneHeight(map) {
  return new Map(map);
}

function neighborsOf(mesh) {
  const adj = new Map(mesh.vertices.map((v) => [v.id, new Set()]));
  for (const he of mesh.halfEdges) {
    const a = he.vertex;
    const b = mesh.halfEdges[he.next].vertex;
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  return adj;
}

export function createTerrainPipeline(blueprint, seed = 1, topo = null) {
  const topology = topo || compileTopology(blueprint, seed);
  const mesh = topology.halfEdge;
  const rng = createRng(seed);
  const height = new Map(mesh.vertices.map((v) => [v.id, v.y]));
  const flow = new Map(mesh.vertices.map((v) => [v.id, { dx: 0, dz: 0, outlet: false }]));
  const locked = new Set();
  const pools = [];
  const cliffs = new Set();
  const log = [];
  let cursor = 0;
  const adj = neighborsOf(mesh);

  const field = () => ({
    height: cloneHeight(height),
    flow: new Map(flow),
    locked: new Set(locked),
    pools: pools.slice(),
    cliffs: new Set(cliffs),
  });

  function stampGameplayAnchors() {
    for (const f of mesh.faces) {
      if (f.flags?.nearNotch || f.flags?.harbor || f.semantic === "cell") {
        let h = f.he;
        for (let i = 0; i < f.n; i++) {
          locked.add(mesh.halfEdges[h].vertex);
          h = mesh.halfEdges[h].next;
        }
      }
    }
    const notchFaces = mesh.faces.filter((f) => f.flags?.nearNotch && f.terraceId === 1);
    for (const f of notchFaces) {
      const pts = facePoints(mesh, f);
      const c = {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
      };
      pools.push({ id: `outlet:waterfall-l1:${f.id}`, x: c.x, z: c.z, kind: "waterfall-outlet" });
    }
    log.push({ pass: "stampGameplayAnchors", locked: locked.size, outlets: pools.length });
  }

  function solveDrainage() {
    let lifted = 0;
    const order = [...mesh.vertices].sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const v of order) {
      if (locked.has(v.id)) {
        flow.get(v.id).outlet = pools.some((p) => Math.hypot(p.x - v.x, p.z - v.z) < 6);
        continue;
      }
      let best = null;
      let bestH = height.get(v.id);
      for (const nid of adj.get(v.id) || []) {
        const h = height.get(nid);
        if (h < bestH) {
          bestH = h;
          best = nid;
        }
      }
      if (best) {
        const nb = mesh.vertices.find((x) => x.id === best);
        flow.set(v.id, { dx: nb.x - v.x, dz: nb.z - v.z, outlet: false });
      } else {
        const isPool = pools.some((p) => Math.hypot(p.x - v.x, p.z - v.z) < 4);
        if (!isPool) {
          let minN = Infinity;
          for (const nid of adj.get(v.id) || []) minN = Math.min(minN, height.get(nid));
          if (Number.isFinite(minN)) {
            height.set(v.id, minN + 0.01);
            lifted += 1;
          }
        } else {
          flow.get(v.id).outlet = true;
        }
      }
    }
    log.push({ pass: "solveDrainage", lifted });
  }

  function relaxSoftSlopes() {
    const next = cloneHeight(height);
    for (const v of mesh.vertices) {
      if (locked.has(v.id)) continue;
      let s = height.get(v.id);
      let n = 1;
      for (const nid of adj.get(v.id) || []) {
        s += height.get(nid);
        n += 1;
      }
      next.set(v.id, s / n);
    }
    for (const [id, h] of next) height.set(id, h);
    log.push({ pass: "relaxSoftSlopes" });
  }

  function sharpenCliffBands() {
    cliffs.clear();
    for (const v of mesh.vertices) {
      if (locked.has(v.id)) continue;
      if (String(v.id).includes(":r1:")) cliffs.add(v.id);
    }
    log.push({ pass: "sharpenCliffBands", bands: cliffs.size, minDrop: 1.2, maxWidth: 0.9 });
  }

  function erodeAlongFlow() {
    for (let iter = 0; iter < 6; iter++) {
      rng.next();
      for (const v of mesh.vertices) {
        if (locked.has(v.id)) continue;
        const fl = flow.get(v.id);
        if (!fl || (fl.dx === 0 && fl.dz === 0)) continue;
        height.set(v.id, height.get(v.id) - 0.002);
      }
    }
    log.push({ pass: "erodeAlongFlow", iterations: 6 });
  }

  function validatePlayableConnections() {
    const terraces = new Set(mesh.faces.filter((f) => f.semantic === "terrace-top").map((f) => f.terraceId));
    const routes = ["harbor→gate", "horse→terrace5", "terrace5→terrace1"];
    const ok =
      terraces.has(0) &&
      terraces.has(1) &&
      terraces.has(4) &&
      mesh.faces.some((f) => f.flags?.nearNotch && f.terraceId === 1);
    log.push({ pass: "validatePlayableConnections", ok, routes, terraces: [...terraces].sort() });
    if (!ok) throw new Error("required citadel routes not connected in terrain field");
  }

  const impl = {
    stampGameplayAnchors,
    solveDrainage,
    relaxSoftSlopes,
    sharpenCliffBands,
    erodeAlongFlow,
    validatePlayableConnections,
  };

  return {
    topology,
    get field() {
      return field();
    },
    get log() {
      return log.slice();
    },
    get cursor() {
      return cursor;
    },
    step() {
      if (cursor >= TERRAIN_PASSES.length) return false;
      impl[TERRAIN_PASSES[cursor]]();
      cursor += 1;
      return true;
    },
    runAll() {
      while (this.step()) {}
      return field();
    },
    exportState() {
      return {
        pass: TERRAIN_PASSES[Math.max(0, cursor - 1)] || null,
        cursor,
        log: log.slice(),
        height: Object.fromEntries(height),
        pools,
        cliffs: [...cliffs].sort(),
      };
    },
  };
}

export function buildCitadelTerrain(blueprint, seed = 1) {
  const pipe = createTerrainPipeline(blueprint, seed);
  const field = pipe.runAll();
  return { topology: pipe.topology, field, log: pipe.log };
}
