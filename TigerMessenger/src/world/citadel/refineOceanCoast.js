import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

/** Refine the existing ocean shell, with edge-conforming splits at the coast. */
export function refineCitadelOceanCoast(ocean, city, radius = 160) {
  if (!ocean?.geometry || !city) return null;
  if (ocean.userData.citadelOceanCoast) return ocean.userData.citadelOceanCoast;
  ocean.updateWorldMatrix(true, false);
  city.updateWorldMatrix(true, false);
  const source = ocean.geometry;
  const attributes = source.attributes;
  const names = Object.keys(attributes);
  const data = Object.fromEntries(names.map(name => [name, Array.from(attributes[name].array)]));
  const toCity = city.matrixWorld.clone().invert().multiply(ocean.matrixWorld);
  const fromWorld = ocean.matrixWorld.clone().invert();
  const world = new THREE.Vector3();
  const point = i => new THREE.Vector3().fromArray(data.position, i * 3);
  const local = i => point(i).applyMatrix4(toCity);
  let triangles = [];
  const count = source.index?.count ?? attributes.position.count;
  for (let i = 0; i < count; i += 3) triangles.push([0, 1, 2].map(j => source.index ? source.index.getX(i + j) : i + j));
  const originalTriangles = triangles.length;
  const originalVertices = attributes.position.count;
  const maximumAddedTriangles = 60000;
  const targetEdgeLength = 2;
  let iterations = 0, budgetLimited = false;
  // Geometric keys also join duplicated UV-seam vertices. Their attributes
  // stay separate, but both sides split the same geometric edge at the same time.
  const vertexKey = i => point(i).toArray().map(v => Math.round(v * 100000)).join(',');
  let keys = Array.from({length: originalVertices}, (_, i) => vertexKey(i));
  const edgeKey = (a, b) => keys[a] < keys[b] ? `${keys[a]}|${keys[b]}` : `${keys[b]}|${keys[a]}`;
  const inRegion = tri => {
    const ps = tri.map(local);
    return Math.max(...ps.map(p => p.x)) >= -45 && Math.min(...ps.map(p => p.x)) <= 100
      && Math.max(...ps.map(p => p.z)) >= -10 && Math.min(...ps.map(p => p.z)) <= 115
      && Math.max(...ps.map(p => p.y)) >= -85 && Math.min(...ps.map(p => p.y)) <= 35;
  };
  for (; iterations < 12; iterations++) {
    const marked = new Set();
    for (const tri of triangles) {
      if (!inRegion(tri)) continue;
      for (let e = 0; e < 3; e++) {
        const a = tri[e], b = tri[(e + 1) % 3];
        const wa = point(a).applyMatrix4(ocean.matrixWorld);
        const wb = point(b).applyMatrix4(ocean.matrixWorld);
        if (wa.distanceTo(wb) > targetEdgeLength + 1e-5) marked.add(edgeKey(a, b));
      }
    }
    if (!marked.size) break;
    let added = 0;
    for (const tri of triangles) for (let e = 0; e < 3; e++) if (marked.has(edgeKey(tri[e], tri[(e + 1) % 3]))) added++;
    if (triangles.length + added - originalTriangles > maximumAddedTriangles) {budgetLimited = true; break;}
    const midpointCache = new Map();
    const midpoint = (a, b) => {
      const cacheKey = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (midpointCache.has(cacheKey)) return midpointCache.get(cacheKey);
      const index = data.position.length / 3;
      for (const name of names) {
        const size = attributes[name].itemSize;
        for (let c = 0; c < size; c++) data[name].push((data[name][a * size + c] + data[name][b * size + c]) * .5);
      }
      world.fromArray(data.position, index * 3).applyMatrix4(ocean.matrixWorld).normalize();
      world.multiplyScalar(radius + officialOceanLevelAt(world)).applyMatrix4(fromWorld);
      world.toArray(data.position, index * 3);
      keys.push(vertexKey(index));
      midpointCache.set(cacheKey, index);
      return index;
    };
    const next = [];
    for (const [a, b, c] of triangles) {
      const ab = marked.has(edgeKey(a, b)) ? midpoint(a, b) : null;
      const bc = marked.has(edgeKey(b, c)) ? midpoint(b, c) : null;
      const ca = marked.has(edgeKey(c, a)) ? midpoint(c, a) : null;
      const splits = Number(ab !== null) + Number(bc !== null) + Number(ca !== null);
      if (splits === 0) next.push([a, b, c]);
      else if (splits === 3) next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      else if (splits === 1) {
        if (ab !== null) next.push([a, ab, c], [ab, b, c]);
        else if (bc !== null) next.push([b, bc, a], [bc, c, a]);
        else next.push([c, ca, b], [ca, a, b]);
      } else {
        // Rotate the unsplit edge to a-b, then fan the remaining quadrilateral.
        if (ab === null) next.push([c, ca, bc], [a, b, bc], [a, bc, ca]);
        else if (bc === null) next.push([a, ab, ca], [b, c, ca], [b, ca, ab]);
        else next.push([b, bc, ab], [c, a, ab], [c, ab, bc]);
      }
    }
    triangles = next;
  }
  const geometry = new THREE.BufferGeometry();
  for (const name of names) {
    const old = attributes[name];
    const next = new THREE.BufferAttribute(new old.array.constructor(data[name]), old.itemSize, old.normalized);
    next.name = old.name;
    geometry.setAttribute(name, next);
  }
  geometry.setIndex(triangles.flat());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {...source.userData};
  let longestRegionalEdge = 0;
  for (const tri of triangles) if (inRegion(tri)) for (let e = 0; e < 3; e++) {
    longestRegionalEdge = Math.max(longestRegionalEdge,
      point(tri[e]).applyMatrix4(ocean.matrixWorld).distanceTo(point(tri[(e + 1) % 3]).applyMatrix4(ocean.matrixWorld)));
  }
  const report = {
    originalTriangles, triangles: triangles.length, addedTriangles: triangles.length - originalTriangles,
    originalVertices, vertices: geometry.attributes.position.count, iterations, budgetLimited,
    targetEdgeLength, longestRegionalEdge, sharedGeometricEdges: true,
    source: 'existing-global-ocean-shell', frame: 'city-authored-local',
    bounds: {x: [-45, 100], z: [-10, 115], y: [-85, 35]},
    attributes: names, originalPositionsPreserved: true,
  };
  ocean.__citadelOceanCoastSource = source;
  ocean.geometry = geometry;
  ocean.userData.citadelOceanCoast = report;
  return report;
}
