import * as THREE from 'three';

const installed = new WeakMap();
const LANDING = [-.5195427402, .5237577109, -.6750949573];

/** Candidate only: replace the existing bed geometry with one locally refined clone.
 * The original geometry/material and all other scene surfaces remain untouched.
 * Static ray snapshots must be recreated after install/restore; geometry attributes
 * and userData.terrainGeometryVersion identify the new terrain revision.
 */
export function installSaihojiHarborBed(planet, options = {}) {
  const settings = {
    landing:options.landing ?? LANDING, coreRadius:options.coreRadius ?? 48,
    outerRadius:options.outerRadius ?? 64, bedRadius:options.bedRadius ?? 157.8,
    seaRadius:options.seaRadius ?? 160.5, referenceRadius:options.referenceRadius ?? 160,
    maxEdge:options.maxEdge ?? 2, maxIterations:options.maxIterations ?? 12,
    shorelineFade:options.shorelineFade ?? .5,
  };
  const direction = new THREE.Vector3().fromArray(settings.landing);
  if (![settings.coreRadius, settings.outerRadius, settings.bedRadius, settings.seaRadius,
    settings.referenceRadius, settings.maxEdge, settings.shorelineFade].every(Number.isFinite) ||
    !direction.toArray().every(Number.isFinite) || direction.lengthSq() === 0 ||
    settings.coreRadius < 0 || settings.outerRadius <= settings.coreRadius ||
    settings.bedRadius <= 0 || settings.seaRadius - settings.bedRadius <= 1.5 ||
    settings.referenceRadius <= 0 || settings.maxEdge <= 0 || settings.shorelineFade <= 0 ||
    !Number.isInteger(settings.maxIterations) || settings.maxIterations < 1) throw Error('Invalid harbor bed settings');
  direction.normalize(); settings.landing = direction.toArray();
  const key = JSON.stringify(settings), previous = installed.get(planet);
  if (previous && planet.geometry !== previous.geometry) throw Error('Harbor bed geometry changed externally; restore ownership first');
  if (previous?.key === key) return previous.controller;
  const original = previous?.original ?? planet?.geometry;
  if (!planet?.isMesh || !original?.attributes.position || original.attributes.position.itemSize !== 3) {
    throw Error('Harbor bed requires a planet mesh with position geometry');
  }
  if (Object.values(original.morphAttributes).some(a => a.length)) throw Error('Morph terrain is not supported');
  planet.updateWorldMatrix(true, false);
  const matrix = planet.matrixWorld.clone(), inverse = matrix.clone().invert();
  const attributes = {};
  for (const [name, attribute] of Object.entries(original.attributes)) {
    const values = [];
    for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values.push(attribute.getComponent(i,c));
    attributes[name] = {source:attribute, values};
  }
  const positions = attributes.position.values;
  const world = Array.from({length:original.attributes.position.count}, (_,i) =>
    new THREE.Vector3().fromArray(positions,i*3).applyMatrix4(matrix));
  function loweredPoint(point) {
    const r=point.length(),distance=point.angleTo(direction)*settings.referenceRadius;
    if(distance>=settings.outerRadius || r>=settings.seaRadius || r<=settings.bedRadius)return point.clone();
    const t=THREE.MathUtils.clamp((distance-settings.coreRadius)/(settings.outerRadius-settings.coreRadius),0,1);
    // The original surface approaches dry land continuously; keep that shoreline
    // intact rather than cutting a discontinuous cliff beneath an untouched vertex.
    const shore=THREE.MathUtils.smoothstep(settings.seaRadius-r,0,settings.shorelineFade);
    return point.clone().multiplyScalar((r+(settings.bedRadius-r)*(1-t*t*(3-2*t))*shore)/r);
  }
  const loweredWorld = world.map(loweredPoint);
  const originalCount = world.length;
  const canonical = world.map(v => v.toArray().map(x => Math.round(x*1e6)).join(','));
  const index = original.index;
  const triangles = [];
  const sourceCount = index?.count ?? originalCount;
  if (sourceCount % 3) throw Error('Planet geometry must be triangulated');
  for (let i=0; i<sourceCount; i+=3) {
    const indices = [0,1,2].map(k => index ? index.getX(i+k) : i+k);
    const group = original.groups.find(g => i >= g.start && i < g.start + g.count);
    triangles.push({v:indices, source:i/3, material:group?.materialIndex ?? 0});
  }
  let faces = triangles;
  const midpointByIndices = new Map(), changedSources = new Set();
  const center = direction.clone().multiplyScalar(settings.referenceRadius);
  // Conservative Euclidean support contains the spherical cap and its original
  // coarse triangles. Green splits affect only neighbors sharing a marked edge.
  const regionDistance = 2*settings.referenceRadius*Math.sin(settings.outerRadius/settings.referenceRadius/2);
  const triangle = new THREE.Triangle(), closest = new THREE.Vector3();
  const local = f => {
    triangle.set(...f.v.map(i => world[i]));
    triangle.closestPointToPoint(center, closest);
    return closest.distanceTo(center) <= regionDistance;
  };
  const edgeKey = (a,b) => canonical[a] < canonical[b] ? canonical[a]+'|'+canonical[b] : canonical[b]+'|'+canonical[a];
  function midpoint(a,b) {
    const key = a < b ? a+':'+b : b+':'+a;
    if (midpointByIndices.has(key)) return midpointByIndices.get(key);
    const id = world.length;
    for (const [name, {source, values}] of Object.entries(attributes)) {
      for (let c=0; c<source.itemSize; c++) values.push((values[a*source.itemSize+c]+values[b*source.itemSize+c])*.5);
    }
    world.push(world[a].clone().add(world[b]).multiplyScalar(.5));
    loweredWorld.push(loweredPoint(world[id]));
    canonical.push(world[id].toArray().map(x => Math.round(x*1e6)).join(','));
    midpointByIndices.set(key,id); return id;
  }
  let iterations=0;
  for (; iterations<settings.maxIterations; iterations++) {
    const marked = new Set();
    for (const f of faces) if (local(f)) {
      for (let i=0;i<3;i++) {const a=f.v[i],b=f.v[(i+1)%3];
        if (Math.max(world[a].distanceTo(world[b]),loweredWorld[a].distanceTo(loweredWorld[b])) > settings.maxEdge + 1e-8) marked.add(edgeKey(a,b));}
    }
    if (!marked.size) break;
    const next=[];
    for (const f of faces) {
      const [a,b,c]=f.v, ab=marked.has(edgeKey(a,b)),bc=marked.has(edgeKey(b,c)),ca=marked.has(edgeKey(c,a));
      const count=Number(ab)+Number(bc)+Number(ca);
      if (!count) {next.push(f);continue;}
      changedSources.add(f.source);
      const push = v => next.push({...f,v});
      if (count===3) {
        const x=midpoint(a,b),y=midpoint(b,c),z=midpoint(c,a);
        push([a,x,z]);push([x,b,y]);push([z,y,c]);push([x,y,z]);
      } else if (count===1) {
        const [x,y,z] = ab ? [a,b,c] : bc ? [b,c,a] : [c,a,b];
        const m=midpoint(x,y);push([x,m,z]);push([m,y,z]);
      } else {
        // Rotate so x-y and y-z are split. Share both edge midpoints with neighbors.
        const [x,y,z] = ab&&bc ? [a,b,c] : bc&&ca ? [b,c,a] : [c,a,b];
        const m=midpoint(x,y),n=midpoint(y,z);
        push([m,y,n]);push([x,m,z]);push([m,n,z]);
      }
    }
    faces=next;
  }
  let maxLocalEdge=0;
  for (const f of faces) if(local(f)) for(let i=0;i<3;i++) maxLocalEdge=Math.max(maxLocalEdge,world[f.v[i]].distanceTo(world[f.v[(i+1)%3]]),loweredWorld[f.v[i]].distanceTo(loweredWorld[f.v[(i+1)%3]]));
  if (maxLocalEdge>settings.maxEdge+1e-6) throw Error('Harbor bed refinement did not converge');
  let lowered=0, dryPreserved=0;
  const moved = new Set();
  for (let i=0;i<world.length;i++) {
    const point=world[i],r=point.length();
    const distance=point.angleTo(direction)*settings.referenceRadius;
    if(distance>=settings.outerRadius)continue;
    // Preserve existing dry terrain, and never raise a pre-existing deep canyon.
    if(r>=settings.seaRadius) {dryPreserved++;continue;}
    if(r<=settings.bedRadius)continue;
    const next=loweredWorld[i];
    if(next.distanceToSquared(point)<1e-18)continue;
    point.copy(next);
    const p=point.clone().applyMatrix4(inverse);
    positions[i*3]=p.x;positions[i*3+1]=p.y;positions[i*3+2]=p.z;
    moved.add(i);lowered++;
  }
  for(const f of faces)if(f.v.some(i=>moved.has(i)))changedSources.add(f.source);
  const geometry = original.clone();
  for(const [name,{source,values}] of Object.entries(attributes)) {
    const attribute = new THREE.BufferAttribute(new source.array.constructor(values.length),source.itemSize,source.normalized);
    for(let i=0;i<values.length/source.itemSize;i++)for(let c=0;c<source.itemSize;c++)attribute.setComponent(i,c,values[i*source.itemSize+c]);
    attribute.setUsage(source.usage);attribute.needsUpdate=true;geometry.setAttribute(name,attribute);
  }
  geometry.setIndex(faces.flatMap(f=>f.v));geometry.index.needsUpdate=true;
  geometry.clearGroups();
  if(original.groups.length)for(let i=0;i<faces.length;) {let end=i+1;while(end<faces.length&&faces[end].material===faces[i].material)end++;geometry.addGroup(i*3,(end-i)*3,faces[i].material);i=end;}
  geometry.setDrawRange(0,faces.length*3);
  geometry.computeVertexNormals();
  // Preserve exact source normals at unchanged original vertices (including dry
  // land and the transition boundary). New/deformed vertices use the new faces.
  if(original.attributes.normal) for(let i=0;i<originalCount;i++)if(!moved.has(i)) {
    const n=original.attributes.normal;geometry.attributes.normal.setXYZ(i,n.getX(i),n.getY(i),n.getZ(i));
  }
  geometry.attributes.normal.needsUpdate=true;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const version=(planet.userData.terrainGeometryVersion??0)+1;
  geometry.userData={...geometry.userData,saihojiHarborBed:{...settings,version}};
  const diagnostics={source:'local-conforming-harbor-bed-candidate',...settings,version,
    originalVertices:originalCount,vertices:world.length,originalTriangles:triangles.length,
    triangles:faces.length,unchangedOriginalTriangles:triangles.length-changedSources.size,
    loweredVertices:lowered,dryVerticesPreserved:dryPreserved,iterations,maxLocalEdge,
    requiresStaticRaycastRebuild:true};
  let restored=false;
  const controller={geometry,diagnostics,restore(){
    if(restored)return false;
    if(installed.get(planet)?.controller!==controller)return false;
    if(planet.geometry!==geometry)throw Error('Cannot overwrite externally replaced planet geometry');
    planet.geometry=original;planet.userData.terrainGeometryVersion=(planet.userData.terrainGeometryVersion??0)+1;
    delete planet.userData.saihojiHarborBed;installed.delete(planet);geometry.dispose();restored=true;return true;
  }};
  // Commit only after successful refinement: failed candidates never touch the mesh.
  planet.geometry=geometry;planet.userData.terrainGeometryVersion=version;
  planet.userData.saihojiHarborBed=diagnostics;
  installed.set(planet,{key,original,geometry,controller});
  if(previous)previous.geometry.dispose();
  return controller;
}
