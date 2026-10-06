import * as THREE from 'three';

/** Target-v3 old-city spillway. Local origin is the centre outlet sill;
 * +Y is up, +Z points out of the wall towards the sea. No terrain mutations.
 * The caller samples the actual receiving sea surface and supplies dropHeight.
 */
export const TARGET_WATERFALL_PALETTE = Object.freeze({
  stone: '#dfcfad', stoneLight: '#eee0bd', stoneShade: '#b7aa91',
  recess: '#566864', water: '#65c5d6', waterLight: '#dcf6ec', foam: '#edf9ef',
});

function rng(seed) {
  let n = seed >>> 0;
  return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Bake stone components into one vertex-coloured draw, preserving the real
// reveals, voussoirs and coping instead of painting arches onto a solid slab.
function stoneBatch(parts) {
  const pos = [], normal = [], color = [];
  for (const {geometry, tint} of parts) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.attributes.position, n = g.attributes.normal, c = new THREE.Color(tint);
    pos.push(...p.array); normal.push(...n.array);
    for (let i = 0; i < p.count; i++) color.push(c.r, c.g, c.b);
    if (g !== geometry) g.dispose();
    geometry.dispose();
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  result.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

function archPath(PathClass, x, radius, spring, sill = 0) {
  const path = new PathClass();
  path.moveTo(x - radius, sill); path.lineTo(x + radius, sill);
  path.lineTo(x + radius, spring);
  path.absarc(x, spring, radius, 0, Math.PI, false);
  path.lineTo(x - radius, sill);
  return path;
}

function waterMaterial(palette, time, front) {
  const material = new THREE.MeshStandardMaterial({
    color: palette.water, emissive: palette.water, emissiveIntensity: 0.22,
    transparent: true, opacity: front ? 0.54 : 0.8,
    roughness: 0.36, metalness: 0, depthWrite: false, side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  material.name = `target-waterfall-${front ? 'silvery-flow' : 'aqua-depth'}`;
  // Retain the standard material output path, including any renderer MRT
  // adaptation. Never declare a second fragment output or gl_FragData here.
  material.onBeforeCompile = shader => {
    shader.uniforms.targetWaterTime = time;
    shader.uniforms.targetWaterWhite = {value: new THREE.Color(palette.waterLight)};
    shader.vertexShader = 'varying vec2 vTargetWaterUV;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\nvTargetWaterUV = uv;');
    shader.fragmentShader = 'uniform float targetWaterTime; uniform vec3 targetWaterWhite; varying vec2 vTargetWaterUV;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float across = vTargetWaterUV.x;
      float down = vTargetWaterUV.y;
      float strand = pow(0.5 + 0.5 * sin(across * 116.0 + sin(down * 16.0 - targetWaterTime * 4.1) * 0.85), 7.0);
      float surge = 0.5 + 0.5 * sin(down * 42.0 - targetWaterTime * 9.0 + across * 23.0);
      float foamTop = (1.0 - smoothstep(0.0, 0.10, down)) * 0.75;
      float white = clamp(strand * (0.58 + surge * 0.36) + foamTop, 0.0, 0.94);
      diffuseColor.rgb = mix(diffuseColor.rgb, targetWaterWhite, white);
      diffuseColor.a *= smoothstep(0.0, 0.045, across) * smoothstep(0.0, 0.045, 1.0 - across);
      diffuseColor.a *= ${front ? '0.30 + white * 0.70' : '0.84 + surge * 0.16'};
    `);
  };
  material.customProgramCacheKey = () => `target-old-city-waterfall-v1-${front ? 1 : 0}`;
  return material;
}

function curtainGeometry(width, height, centers, front) {
  const positions = [], uvs = [], index = [], base = [];
  const nx = 12, ny = 28, mouthWidth = width * 0.232;
  for (let stream = 0; stream < 3; stream++) {
    const start = positions.length / 3;
    for (let row = 0; row <= ny; row++) {
      const t = row / ny;
      // Individual spillways merge gently downstream; endpoint is fixed.
      const span = mouthWidth * (1 + 0.31 * Math.sin(t * Math.PI * 0.5));
      for (let col = 0; col <= nx; col++) {
        const u = col / nx;
        const x = centers[stream] + (u - 0.5) * span;
        const y = row === 0 ? 0 : -height * t;
        const z = width * (0.053 + 0.075 * Math.sqrt(t) + 0.035 * t * t) + (front ? 0.08 : 0);
        positions.push(x, y, z); base.push(x, y, z);
        uvs.push(u, t);
      }
    }
    for (let row = 0; row < ny; row++) for (let col = 0; col < nx; col++) {
      const a = start + row * (nx + 1) + col, b = a + nx + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.basePositions = new Float32Array(base);
  return geometry;
}

// Static receiving sea only. Sampling is entirely construction-time; updates
// interpolate this bounded cache and never call the terrain/ocean raycaster.
function receivingSurfaceCache(sample, width, scale, step, tolerance) {
  const impactZ = width * .163;
  const bounds = {minX: -width * .66 - .04 * scale, maxX: width * .66 + .04 * scale,
    minZ: impactZ - 2.13 * scale - .04 * scale, maxZ: impactZ + 2.63 * scale + .04 * scale};
  const memo = new Map(); let calls = 0, missing = 0, minY = Infinity, maxY = -Infinity;
  function exact(x, z) {
    const key = `${x.toFixed(9)},${z.toFixed(9)}`;
    if (memo.has(key)) return memo.get(key);
    if (calls >= 20000) return null;
    const y = sample(x, z); calls++;
    if (y !== null && !Number.isFinite(y)) throw new TypeError('receivingSurfaceHeightAt must return finite local Y or null');
    if (y === null) missing++; else {minY = Math.min(minY, y); maxY = Math.max(maxY, y);}
    memo.set(key, y); return y;
  }
  let grid, error = Infinity, unavailableChecks = 0, validationSamples = 0, refinement = 0;
  function lookup(x, z) {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return null;
    const fx = (x - bounds.minX) / grid.dx, fz = (z - bounds.minZ) / grid.dz;
    const ix = Math.min(grid.nx - 1, Math.floor(fx)), iz = Math.min(grid.nz - 1, Math.floor(fz));
    const u = fx - ix, v = fz - iz, n = grid.nx + 1;
    const values = [grid.ys[iz*n+ix], grid.ys[iz*n+ix+1], grid.ys[(iz+1)*n+ix], grid.ys[(iz+1)*n+ix+1]];
    if (values.some(y => y === null)) return null;
    return (values[0]*(1-u)+values[1]*u)*(1-v)+(values[2]*(1-u)+values[3]*u)*v;
  }
  for (refinement = 0; refinement <= 3; refinement++) {
    const pitch = step / 2 ** refinement, nx = Math.ceil((bounds.maxX-bounds.minX)/pitch), nz = Math.ceil((bounds.maxZ-bounds.minZ)/pitch);
    if ((nx+1)*(nz+1) > 8000) {if(!grid)throw new RangeError('surface grid exceeds bounded sample budget');refinement--; break;}
    grid = {nx, nz, dx: (bounds.maxX-bounds.minX)/nx, dz: (bounds.maxZ-bounds.minZ)/nz, ys: []};
    for (let j=0;j<=nz;j++) for(let i=0;i<=nx;i++) grid.ys.push(exact(bounds.minX+i*grid.dx,bounds.minZ+j*grid.dz));
    error = 0; unavailableChecks = 0; validationSamples = 0;
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)for(const [u,v] of [[.5,.5],[.5,0],[0,.5]]) {
      const x=bounds.minX+(i+u)*grid.dx,z=bounds.minZ+(j+v)*grid.dz,actual=exact(x,z),estimated=lookup(x,z);validationSamples++;
      if(actual===null||estimated===null)unavailableChecks++;else error=Math.max(error,Math.abs(actual-estimated));
    }
    if (unavailableChecks || error <= tolerance || calls >= 20000) break;
  }
  const report = {enabled: true, staticSurface: true, bounds, grid: {columns:grid.nx+1,rows:grid.nz+1,stepX:grid.dx,stepZ:grid.dz},
    refinementPasses: Math.min(refinement,3), callbackCalls: calls, missingSamples: missing, validationSamples, unavailableChecks,
    maximumSampledInterpolationError: error, tolerance, sampledPass: unavailableChecks===0&&error<=tolerance&&calls<20000,
    continuousErrorBoundProven:false, perFrameCallbackCalls:0, minY:Number.isFinite(minY)?minY:null,maxY:Number.isFinite(maxY)?maxY:null,
    method:'bilinear static grid; independent cell centres and edge-midpoint checks; at most 3 refinements and 20000 callback calls',
    limitations:['Finite validation probes are not a continuous error bound.','Recreate this asset after sea geometry/version or local transform changes.','Missing receiving sea hides affected foam and whole ripple mesh; no flat fallback is claimed as seating.']};
  return {lookup, exact, report, syncCounts(){report.callbackCalls=calls;report.missingSamples=missing;}};
}

export function createTargetOldCityWaterfall({dropHeight = 16, width = 9, seed = 20261005, palette = {},
  receivingSurfaceHeightAt = null, receivingSurfaceGridStep = null, receivingSurfaceTolerance = null} = {}) {
  if (!Number.isFinite(dropHeight) || dropHeight <= 0) throw new RangeError('dropHeight must be finite and positive');
  if (!Number.isFinite(width) || width <= 0) throw new RangeError('width must be finite and positive');
  if (receivingSurfaceHeightAt !== null && typeof receivingSurfaceHeightAt !== 'function') throw new TypeError('receivingSurfaceHeightAt must be a function or null');
  const surfaceStep = receivingSurfaceGridStep ?? .75 * width / 9, surfaceTolerance = receivingSurfaceTolerance ?? .015 * width / 9;
  if (!Number.isFinite(surfaceStep) || surfaceStep <= 0 || !Number.isFinite(surfaceTolerance) || surfaceTolerance <= 0) throw new RangeError('surface grid step and tolerance must be positive and finite');
  if (surfaceStep < width / 150) throw new RangeError('surface grid step exceeds bounded sample budget');
  const surface = receivingSurfaceHeightAt ? receivingSurfaceCache(receivingSurfaceHeightAt,width,width/9,surfaceStep,surfaceTolerance) : null;
  const p = {...TARGET_WATERFALL_PALETTE, ...palette}, random = rng(seed);
  const group = new THREE.Group(); group.name = 'target-old-city-waterfall';
  group.userData.targetArchitecture = true;
  group.userData.materialOwner = 'target-old-city-waterfall';
  group.userData.preserveCitadelMaterials = true;
  const scale = width / 9, radius = width * 0.12, spring = width * 0.065;
  const centers = [-width * 0.29, 0, width * 0.29];
  const masonry = [], parts = [];
  const addStone = (geometry, tint, name) => { masonry.push({geometry, tint}); parts.push(name); };
  const box = (name, sx, sy, sz, x, y, z, tint = p.stoneLight) =>
    addStone(new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), tint, name);
  const wall = new THREE.Shape();
  wall.moveTo(-width / 2, -0.48 * scale); wall.lineTo(width / 2, -0.48 * scale);
  wall.lineTo(width / 2, 2.55 * scale); wall.lineTo(-width / 2, 2.55 * scale); wall.closePath();
  for (const x of centers) wall.holes.push(archPath(THREE.Path, x, radius, spring));
  addStone(new THREE.ExtrudeGeometry(wall, {depth: 1.45 * scale, bevelEnabled: false, curveSegments: 10}).translate(0, 0, -1.15 * scale), p.stone, 'three-open-arch-spillway-wall');
  centers.forEach((x, archIndex) => {
    const outer = radius + 0.22 * scale;
    for (let wedge = 0; wedge < 9; wedge++) {
      const a = wedge / 9 * Math.PI + 0.009, b = (wedge + 1) / 9 * Math.PI - 0.009;
      const shape = new THREE.Shape();
      shape.moveTo(x + Math.cos(a) * radius, spring + Math.sin(a) * radius);
      shape.lineTo(x + Math.cos(a) * outer, spring + Math.sin(a) * outer);
      shape.absarc(x, spring, outer, a, b, false);
      shape.lineTo(x + Math.cos(b) * radius, spring + Math.sin(b) * radius);
      shape.absarc(x, spring, radius, b, a, true); shape.closePath();
      addStone(new THREE.ExtrudeGeometry(shape, {depth: 0.20 * scale, bevelEnabled: false, curveSegments: 2}).translate(0, 0, 0.30 * scale), wedge % 3 === 0 ? p.stone : p.stoneLight, `outlet-${archIndex + 1}-voussoir-${wedge + 1}`);
    }
    for (const sign of [-1, 1]) box(`outlet-${archIndex + 1}-jamb-${sign}`, 0.22 * scale, spring, 0.22 * scale, x + sign * (radius + 0.11 * scale), spring / 2, 0.40 * scale);
    box(`outlet-${archIndex + 1}-projecting-sill`, radius * 2.15, 0.15 * scale, 1.85 * scale, x, -0.085 * scale, -0.18 * scale);
  });
  box('spillway-coping', width + 0.35 * scale, 0.24 * scale, 1.8 * scale, 0, 2.55 * scale, -0.36 * scale);
  box('spillway-drip-course', width + 0.13 * scale, 0.12 * scale, 0.2 * scale, 0, 2.23 * scale, 0.39 * scale, p.stoneShade);
  const stone = new THREE.Mesh(stoneBatch(masonry), new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.94}));
  stone.name = 'target-waterfall-stone-three-arch-outlets'; stone.castShadow = true; stone.receiveShadow = true;
  group.add(stone);
  // Recess at the back of each real tunnel, not across its visible front.
  const throatParts = centers.map(x => ({geometry: new THREE.ShapeGeometry(archPath(THREE.Shape, x, radius * 0.98, spring), 10).translate(0, 0, -1.16 * scale), tint: p.recess}));
  const throats = new THREE.Mesh(stoneBatch(throatParts), new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, side: THREE.DoubleSide}));
  throats.name = 'target-waterfall-recessed-water-feeds'; group.add(throats);

  const time = {value: 0}, curtains = [];
  for (let layer = 0; layer < 2; layer++) {
    const curtain = new THREE.Mesh(curtainGeometry(width, dropHeight, centers, layer === 1), waterMaterial(p, time, layer === 1));
    curtain.name = layer ? 'target-waterfall-silver-flow-ribbons' : 'target-waterfall-aqua-three-stream-curtain';
    curtain.renderOrder = 4 + layer; curtain.frustumCulled = false;
    group.add(curtain); curtains.push(curtain);
  }
  const impactZ = width * 0.163, dummy = new THREE.Object3D();
  const foam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({color: p.foam, roughness: 0.8, emissive: p.foam, emissiveIntensity: 0.12}), 45);
  foam.name = 'target-waterfall-impact-white-foam'; foam.frustumCulled = false;
  const foamData = Array.from({length: foam.count}, (_, i) => ({
    x: (i / (foam.count - 1) - 0.5) * width * 0.99,
    z: impactZ + (random() - 0.2) * 1.6 * scale,
    size: (0.18 + random() * 0.24) * scale, phase: random() * Math.PI * 2,
  }));
  if (surface) {
    for (const f of foamData) f.receivingY = surface.exact(f.x, f.z);
    surface.syncCounts();
    surface.report.exactFoamCentres = foamData.filter(f => f.receivingY !== null).length;
    if(surface.report.exactFoamCentres!==foamData.length)surface.report.sampledPass=false;
  }
  group.add(foam);
  const rippleGeometry = new THREE.RingGeometry(0.9, 1, 48); rippleGeometry.rotateX(-Math.PI / 2);
  const rippleMaterial = new THREE.MeshBasicMaterial({color: p.foam, transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true});
  let curvedRippleBase = null, ripples;
  if (surface) {
    curvedRippleBase = rippleGeometry.attributes.position.array.slice();
    const geometry = new THREE.BufferGeometry(), positions = new Float32Array(curvedRippleBase.length * 3), index = [];
    const count = curvedRippleBase.length / 3;
    for (let i=0;i<3;i++) for (const n of rippleGeometry.index.array) index.push(n+i*count);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3)); geometry.setIndex(index);
    ripples = new THREE.Mesh(geometry,rippleMaterial); rippleGeometry.dispose();
  } else ripples = new THREE.InstancedMesh(rippleGeometry,rippleMaterial,3);
  ripples.name = 'target-waterfall-expanding-impact-ripples'; ripples.frustumCulled = false; ripples.renderOrder = 6; group.add(ripples);
  let disposed = false;
  function update(seconds = 0) {
    if (disposed || !Number.isFinite(seconds)) return;
    time.value = seconds;
    curtains.forEach((mesh, layer) => {
      const position = mesh.geometry.attributes.position, base = mesh.geometry.userData.basePositions, uv = mesh.geometry.attributes.uv;
      for (let i = 0; i < position.count; i++) {
        const t = uv.getY(i), u = uv.getX(i), envelope = Math.sin(t * Math.PI);
        const ripple = Math.sin(t * 22 - seconds * 5.2 + u * 8 + layer * 1.8);
        position.setXYZ(i, base[i * 3] + ripple * envelope * 0.045 * scale, base[i * 3 + 1], base[i * 3 + 2] + ripple * envelope * 0.095 * scale);
      }
      position.needsUpdate = true; mesh.geometry.computeVertexNormals();
    });
    foamData.forEach((f, i) => {
      const pulse = 0.8 + 0.2 * Math.sin(seconds * 3.3 + f.phase);
      dummy.position.set(f.x, (surface ? (f.receivingY ?? -dropHeight) : -dropHeight) + 0.045 * scale, f.z);
      dummy.rotation.set(0, f.phase + seconds * 0.06, 0);
      const visible = !surface || f.receivingY !== null;
      dummy.scale.set(visible ? f.size * 1.8 * pulse : 0, visible ? f.size * 0.46 : 0, visible ? f.size * pulse : 0);
      dummy.updateMatrix(); foam.setMatrixAt(i, dummy.matrix);
    });
    foam.instanceMatrix.needsUpdate = true;
    let missingRippleVertices = 0;
    for (let i = 0; i < 3; i++) {
      const phase = ((seconds * 0.14 + i / 3) % 1 + 1) % 1;
      dummy.position.set(0, -dropHeight + (0.016 + i * 0.007) * scale, impactZ + 0.25 * scale);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(width * (0.37 + phase * 0.29), 1, scale * (0.48 + phase * 1.9));
      if (surface) {
        const pos = ripples.geometry.attributes.position, count = curvedRippleBase.length / 3;
        for (let j=0;j<count;j++) {
          const x=curvedRippleBase[j*3]*dummy.scale.x, z=dummy.position.z+curvedRippleBase[j*3+2]*dummy.scale.z;
          const y=surface.lookup(x,z); if(y===null)missingRippleVertices++;
          pos.setXYZ(i*count+j,x,(y??-dropHeight)+(0.016+i*.007)*scale,z);
        }
      } else {dummy.updateMatrix(); ripples.setMatrixAt(i, dummy.matrix);}
    }
    if (surface) {
      ripples.geometry.attributes.position.needsUpdate=true; ripples.geometry.computeBoundingBox(); ripples.geometry.computeBoundingSphere();
      ripples.visible=missingRippleVertices===0;
      surface.report.currentMissingRippleVertices=missingRippleVertices;
      surface.report.curvedRippleVertices=ripples.geometry.attributes.position.count;
    } else ripples.instanceMatrix.needsUpdate = true;
  }
  update(0); group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  // Cover the full ripple cycle and CPU ripple envelope, not just frame zero.
  bounds.min.x = Math.min(bounds.min.x, -width * 0.66);
  bounds.max.x = Math.max(bounds.max.x, width * 0.66);
  bounds.min.z = Math.min(bounds.min.z, impactZ - 2.13 * scale);
  bounds.max.z = Math.max(bounds.max.z, impactZ + 2.63 * scale);
  if(surface && surface.report.minY!==null){bounds.min.y=Math.min(bounds.min.y,surface.report.minY-.25*scale);bounds.max.y=Math.max(bounds.max.y,surface.report.maxY+.25*scale);}
  bounds.expandByScalar(0.15 * scale);
  const report = {
    version: 'target-v3-old-city-waterfall-1', seed, width, dropHeight,
    coordinateContract: 'origin: centre outlet sill; +Y up; +Z sea-facing',
    outletCount: 3, outletCenters: centers.map(x => [x, 0, width * 0.053]),
    curtainTopY: 0, curtainBottomY: -dropHeight, receivingSeaY: -dropHeight,
    impactCenter: [0, -dropHeight, impactZ],
    boundingBox: {min: bounds.min.toArray(), max: bounds.max.toArray()},
    boundingBoxIncludesAnimation: true,
    partNames: [...parts, ...group.children.map(child => child.name)],
    drawCalls: group.children.length, triangles: 0,
    drawCallScope: 'estimated main colour pass; excludes renderer shadow and postprocessing passes',
    status: 'standalone-geometry-tested; runtime-seating-and-visual-review-required',
    navigationVerified: false, surfaceSeatingVerified: false,
    receivingSurface: surface ? surface.report : {enabled:false,mode:'legacy horizontal plane',perFrameCallbackCalls:0},
  };
  group.traverse(mesh => { if (mesh.isMesh) report.triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1); });
  group.userData.targetWaterfallReport = report;
  function dispose() {
    if (disposed) return; disposed = true;
    group.removeFromParent();
    const geometries = new Set(), materials = new Set();
    group.traverse(mesh => { if (mesh.isMesh) {geometries.add(mesh.geometry); for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) materials.add(mat); if (mesh.isInstancedMesh) mesh.dispose();} });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); group.clear();
  }
  return {group, report, update, dispose};
}
