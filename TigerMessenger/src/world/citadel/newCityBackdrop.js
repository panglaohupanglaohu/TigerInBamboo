import * as THREE from 'three';
import {WEST_CITY} from './westCityLayout.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// The new holy city climbs from the harbour (local z≈50) to the crown (z≈10);
// beyond the crown there was nothing but open planet surface, so from the plaza the
// keep stood against empty sky. These are the layered ridges the target image puts
// behind it. Authored in the west-city local frame (same frame as WEST_CITY), which
// keeps them locked to the city through the composition offset and sphere placement.
export const NEW_CITY_BACKDROP = Object.freeze({
  version: 5,
  frame: 'west-city-authored-local',
  bands: Object.freeze([
    // z: distance behind the crown (crown district sits at z=10), base: foot, peak: ridge height
    Object.freeze({id: 'near', z: -95, base: -35, peak: 108, halfSpan: 145, seed: 3, color: 0x285b91, steps: 96}),
    Object.freeze({id: 'mid', z: -143, base: -44, peak: 151, halfSpan: 205, seed: 11, color: 0x397cb0, steps: 108}),
    Object.freeze({id: 'far', z: -242, base: -61, peak: 202, halfSpan: 282, seed: 23, color: 0x5799bf, steps: 120}),
  ]),
});

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

// Reference composition: the left city leans into the high massif, while a
// lower saddle separates the keep from distant right-hand hills. Control the
// whole ridge silhouette, rather than surrounding both cities with equal peaks.
function skylineScale(t) {
  const knots=[[0,.12],[.14,.82],[.29,1],[.44,.64],[.56,.30],[.69,.26],[.85,.48],[1,.08]];
  for(let i=1;i<knots.length;i++)if(t<=knots[i][0]){
    const a=knots[i-1],b=knots[i],u=(t-a[0])/(b[0]-a[0]);
    const s=u*u*(3-2*u);
    return a[1]+(b[1]-a[1])*s;
  }
  return knots.at(-1)[1];
}

/** A folded rock surface, not an extruded skyline card. Fine transverse
 * ridges preserve the reference's craggy scale without separate rock objects. */
function ridgeGeometry({halfSpan, base, peak, steps, seed}) {
  const rnd = lcg(seed);
  const rows = 13, depth = halfSpan * 0.46;
  const crest = [], points = [], positions = [], colors = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Broad connected escarpments: the former .21/.12 sine amplitudes cut
    // deep V valleys and made each massif look like a separate cone.
    const mass = .83 + .065 * Math.sin(t * 11.4 + seed) + .025 * Math.sin(t * 27 + seed * .3);
    const crags = .016 * Math.sin(t * 183 + seed) + .034 * rnd();
    const taper = .74 + .26 * Math.pow(Math.sin(t * Math.PI), .22);
    crest.push((mass + crags) * taper * peak * skylineScale(t));
  }
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    // The steep front has ledges; the ridge's back slopes away naturally.
    const rise = t < .76 ? Math.pow(t / .76, .78) : 1 - (t - .76) * 1.15;
    for (let col = 0; col <= steps; col++) {
      const edge = col === 0 || col === steps || row === 0;
      const x = -halfSpan + col / steps * halfSpan * 2 + (edge ? 0 : (rnd() - .5) * 2.4);
      const flute = (Math.sin(col * 1.17 + seed) * 3.3 + Math.sin(col * .44 + seed) * 1.8) * Math.sin(t * Math.PI);
      const ledge = row > 1 && row < 9 ? Math.sin(row * 1.9 + col * .21) * 1.7 : 0;
      const rawY = base + crest[col] * rise + flute + ledge + (edge ? 0 : (rnd() - .5) * 1.8);
      // All four perimeter edges end below the sea, including the formerly
      // open, still elevated back row. Ease down over several rock rows.
      const smooth=u=>{u=THREE.MathUtils.clamp(u,0,1);return u*u*(3-2*u);};
      const rim=smooth(col/steps/.10)*smooth((1-col/steps)/.10)*smooth((1-t)/.24);
      const y = -3 + Math.max(0,rawY-base)*rim;
      const z = depth * (.42 - t) + Math.sin(col * 1.17 + seed) * 3.4 * Math.sin(t * Math.PI) + (edge ? 0 : (rnd() - .5) * 2.2);
      points.push(new THREE.Vector3(x, y, z));
    }
  }
  const face = (a, b, c) => {
    const light = .73 + rnd() * .32 + Math.max(0, (a.y + b.y + c.y) / 3 - base) / peak * .10;
    for (const v of [a, b, c]) { positions.push(v.x, v.y, v.z); colors.push(light * .90, light * .96, light); }
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < steps; c++) {
    const a = points[r * (steps + 1) + c], b = points[r * (steps + 1) + c + 1];
    const d = points[(r + 1) * (steps + 1) + c], e = points[(r + 1) * (steps + 1) + c + 1];
    if ((c + r) % 2) { face(a, b, d); face(b, e, d); }
    else { face(a, b, e); face(a, e, d); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  g.userData.treeAnchors = points.filter((_, i) => {
    const row = Math.floor(i / (steps + 1));
    // Keep the crest itself bare; clustered growth belongs on lower ledges.
    const col = i % (steps + 1);
    return row >= 2 && row <= 6 && points[i].y>1 && i % 3 === 0 && Math.sin(col * .43 + seed) > -.15;
  });
  return g;
}

function forest(anchors, seed, color) {
  const random = lcg(seed + 931);
  const shape = new THREE.LatheGeometry([
    new THREE.Vector2(.12, 0), new THREE.Vector2(.65, .9),
    new THREE.Vector2(.83, 2), new THREE.Vector2(.62, 3.2),
    new THREE.Vector2(.40, 4.35), new THREE.Vector2(.12, 5.6), new THREE.Vector2(0, 6.2),
  ], 5);
  const material = new THREE.MeshStandardMaterial({color, roughness: 1, flatShading: true});
  const mesh = new THREE.InstancedMesh(shape, material, anchors.length);
  mesh.name = 'citadel-backdrop-cypress-forest';
  const transform = new THREE.Object3D();
  anchors.forEach((p, i) => {
    transform.position.copy(p); transform.position.y -= .35;
    const scale = .34 + random() * .47;
    transform.scale.set(scale * (.70 + random() * .3), scale, scale);
    transform.rotation.y = random() * Math.PI;
    transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.userData.decorativeOnly = true; mesh.userData.skipColliders = true;
  return mesh;
}

export function buildNewCityBackdrop() {
  const root = new THREE.Group();
  root.name = 'citadel-new-city-backdrop-range';
  root.userData.manifest = NEW_CITY_BACKDROP;
  root.userData.sourceId = 'citadel-new-city-backdrop-v5-spherical-shore';
  // Purely scenic: never a collider, never a navigation surface.
  root.userData.decorativeOnly = true;
  root.userData.skipColliders = true;

  for (const band of NEW_CITY_BACKDROP.bands) {
    const mat = new THREE.MeshStandardMaterial({
      color: band.color, roughness: 0.98, metalness: 0, flatShading: true,
      vertexColors: true, emissive: band.color, emissiveIntensity: band.id === 'far' ? .30 : band.id === 'mid' ? .21 : .13,
      dithering: false, fog: true,
    });
    mat.name = `citadel-backdrop-${band.id}`;
    const mesh = new THREE.Mesh(ridgeGeometry(band), mat);
    mesh.name = `citadel-backdrop-ridge-${band.id}`;
    mesh.position.set(WEST_CITY.x, 0, band.z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData.decorativeOnly = true;
    mesh.userData.skipColliders = true;
    root.add(mesh);
    const trees = forest(mesh.geometry.userData.treeAnchors, band.seed, band.id === 'near' ? 0x123e45 : 0x245d72);
    trees.position.copy(mesh.position);
    root.add(trees);
  }
  return root;
}

const authoredPositions=new WeakMap(),authoredInstances=new WeakMap();

/** Final world placement is essential: the sea is centred on the planet, not
 * on the castle's tangent plane. Keep authored altitude, bend the horizontal
 * footprint onto the real ocean and recalculate outward tree orientation. */
export function conformNewCityBackdropToOcean(city,radius) {
  const root=city?.getObjectByName('citadel-new-city-backdrop-range');
  if(!root||!(radius>0))return null;
  root.updateWorldMatrix(true,true);
  let vertices=0,trees=0;
  for(const mesh of root.children){
    const inverse=mesh.matrixWorld.clone().invert();
    const project=p=>{
      const altitude=p.y;
      const direction=new THREE.Vector3(p.x,0,p.z).applyMatrix4(mesh.matrixWorld).normalize();
      return direction.multiplyScalar(radius+officialOceanLevelAt(direction)+altitude).applyMatrix4(inverse);
    };
    if(mesh.isInstancedMesh){
      let source=authoredInstances.get(mesh);
      if(!source){source=Array.from({length:mesh.count},(_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;});authoredInstances.set(mesh,source);}
      const worldQ=mesh.getWorldQuaternion(new THREE.Quaternion()),invQ=worldQ.clone().invert();
      for(let i=0;i<source.length;i++){
        const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();source[i].decompose(p,q,s);
        p.copy(project(p));
        const up=p.clone().applyMatrix4(mesh.matrixWorld).normalize().applyQuaternion(invQ);
        const tilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up);
        mesh.setMatrixAt(i,new THREE.Matrix4().compose(p,tilt.multiply(q),s));trees++;
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    }else if(mesh.name.startsWith('citadel-backdrop-ridge-')){
      const attr=mesh.geometry.attributes.position;
      let source=authoredPositions.get(mesh.geometry);
      if(!source){source=Float32Array.from(attr.array);authoredPositions.set(mesh.geometry,source);}
      for(let i=0;i<attr.count;i++){const p=project(new THREE.Vector3().fromArray(source,i*3));attr.setXYZ(i,p.x,p.y,p.z);vertices++;}
      attr.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
    }
  }
  return root.userData.oceanConformance={version:1,radius,vertices,trees,perimeterDepth:3,source:'officialOceanLevelAt',playableCityUnchanged:true};
}
