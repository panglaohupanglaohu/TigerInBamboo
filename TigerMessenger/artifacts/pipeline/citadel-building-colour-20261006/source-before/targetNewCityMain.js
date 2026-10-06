import * as THREE from 'three';

// Hand-authored target-v3 architecture; local +Z is the entrance, Y is up.
// No terrain, light, texture, or scene-global material is owned by this factory.
export const TARGET_NEW_CITY_MAIN_PALETTE = Object.freeze({
  stone: '#f1dfb4', trim: '#f8ebce', blue: '#8bc5dd', blueShade: '#83bcd7',
  roof: '#e77c45', roofLight: '#f79855', dome: '#296392', domeLight: '#3473a2',
  domeShade: '#245983', rib: '#739daf', window: '#f8f4dc', glass: '#426477', gold: '#dba957',
});

export function createTargetNewCityMain({ seed = 17, palette = {}, proportion = 'original' } = {}) {
  if(!['original','expanded-1'].includes(proportion))throw new TypeError('unknown new-city proportion');
  const expanded=proportion==='expanded-1',sxz=expanded?1.1:1,sy=expanded?1.2:1,pivotY=1.2;
  const mapY=y=>y<=pivotY?y:pivotY+(y-pivotY)*sy;
  const mapPoint=p=>[p[0]*sxz,mapY(p[1]),p[2]*sxz];
  const colours = { ...TARGET_NEW_CITY_MAIN_PALETTE, ...palette };
  const group = new THREE.Group(); group.name = 'citadel-target-new-city-main';
  group.userData.preserveCitadelMaterials = true;
  group.userData.targetArchitecture = 'new-city-main-v2';
  const geometries = new Set(), materials = new Set(), footprints = [];
  const mats = Object.fromEntries(Object.entries(colours).map(([key, color]) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: key === 'dome' ? .67 : .85, metalness: key === 'gold' ? .2 : 0 });
    material.name = `target-new-city-${key}`;
    material.userData.preserveCitadelMaterials = true;
    material.userData.preserveCitadelMaterial = true;
    materials.add(material); return [key, material];
  }));
  function mesh(name, geometry, material, x = 0, y = 0, z = 0) {
    geometries.add(geometry);
    const m = new THREE.Mesh(geometry, typeof material === 'string' ? mats[material] : material);
    m.name = name; m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    m.userData.preserveCitadelMaterials = true; group.add(m); return m;
  }
  function box(name, w, h, d, x, y, z, mat = 'stone', bevel = .07) {
    const r = Math.min(bevel, w / 6, h / 6, d / 6);
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2 + r); s.lineTo(w / 2 - r, -h / 2 + r);
    s.lineTo(w / 2 - r, h / 2 - r); s.lineTo(-w / 2 + r, h / 2 - r); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.translate(0, 0, -d / 2 + r); return mesh(name, g, mat, x, y, z);
  }
  function footprint(id, x, z, w, d, floorY, roofY, extra = {}) {
    footprints.push({ id, polygon: [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]], floorY, roofY, ...extra });
  }
  // A hip roof is a closed six-vertex solid with a short ridge, not a box cap.
  function roof(name, x, y, z, w, d, rise = 1.25) {
    const v = [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w * .25, rise, 0], [w * .25, rise, 0]];
    const ids = [0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ids.flatMap(i => v[i]), 3)); g.computeVertexNormals();
    mesh(name, g, 'roof', x, y, z); box(`${name}-eave`, w, .2, d, x, y, z, 'roofLight', .04);
    box(`${name}-ridge`, w * .51, .16, .2, x, y + rise, z, 'roofLight', .06);
  }
  function window(name, x, y, z, yaw = 0, w = .64, h = .72) {
    const root = new THREE.Group(); root.name = name; root.position.set(x, y, z); root.rotation.y = yaw; group.add(root);
    // Four raised plaster members leave an inset glass face and sill readable in shadow.
    for (const [tag, bw, bh, px, py] of [['left', .095, h, -w / 2, 0], ['right', .095, h, w / 2, 0], ['top', w + .09, .1, 0, h / 2], ['sill', w + .2, .13, 0, -h / 2]]) {
      const p = box(`${name}-${tag}`, bw, bh, .12, px, py, .035, 'window', .025); group.remove(p); root.add(p);
    }
    const glass = mesh(`${name}-recess`, new THREE.PlaneGeometry(w, h), 'glass'); group.remove(glass); root.add(glass);
    const mullion = box(`${name}-mullion`, .055, h, .065, 0, 0, .04, 'window', .012); group.remove(mullion); root.add(mullion);
  }
  function archWall(name, w, h, depth, z, material = 'stone', radius = 2.5, spring = 6.3) {
    // The outline runs up and around the void from the floor, so the opening
    // contains no invisible door plane, central box or backface plug.
    const floor = 1.2, s = new THREE.Shape();
    s.moveTo(-w / 2, floor); s.lineTo(-w / 2, floor + h); s.lineTo(w / 2, floor + h); s.lineTo(w / 2, floor); s.lineTo(radius, floor); s.lineTo(radius, spring);
    for (let i = 1; i <= 20; i++) { const a = Math.PI * i / 20; s.lineTo(radius * Math.cos(a), spring + radius * Math.sin(a)); }
    s.lineTo(-radius, floor); s.closePath();
    return mesh(name, new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20, steps: 1 }), material, 0, 0, z);
  }
  // Solid floor only below the passage. Four shallow approach treads end at 1.2m.
  box('main-hall-floor', 12, 1.2, 15.2, 0, .6, -.4, 'trim');
  footprint('main-hall-floor', 0, -.4, 12, 15.2, 0, 1.2, { support: true });
  for (let i = 0; i < 4; i++) {
    const top = (i + 1) * .3, z = 12.3 - i * 1.3;
    box(`entrance-stair-${i}`, 6.2, top, 1.32, 0, top / 2, z, 'trim', .025);
    footprint(`entrance-stair-${i}`, 0, z, 6.2, 1.32, 0, top, { support: true, walkable: true });
  }
  box('entrance-landing', 6.2, 1.2, 1.55, 0, .6, 7.1, 'trim');
  footprint('entrance-landing', 0, 7.1, 6.2, 1.55, 0, 1.2, { support: true, walkable: true });
  archWall('main-entry-real-arch', 11.5, 10.0, .95, 5.5);
  archWall('main-hall-rear-real-arch', 11.5, 10.0, .8, -7.8);
  // Tunnel sides and roof support the upper drum without filling its nave.
  for (const x of [-5.3, 5.3]) {
    box('main-hall-side-wall', .9, 10, 13, x, 6.2, -.65, 'stone');
    footprint(`main-side-${x}`, x, -.65, .9, 13, 1.2, 11.2);
  }
  box('main-hall-ceiling', 11.5, .55, 13.3, 0, 10.95, -.7, 'stone');
  box('main-hall-front-cornice', 12, .45, 1.4, 0, 11.35, 5.65, 'trim');
  roof('main-hall-orange-frieze', 0, 11.66, 4.25, 12.2, 4.2, .65);
  // Contrasting limestone archivolt: wedge voussoirs follow the actual opening.
  for (let i = 0; i < 17; i++) {
    const a0 = i * Math.PI / 17 + .012, a1 = (i + 1) * Math.PI / 17 - .012;
    const s = new THREE.Shape();
    s.moveTo(2.53 * Math.cos(a0), 6.3 + 2.53 * Math.sin(a0)); s.lineTo(2.93 * Math.cos(a0), 6.3 + 2.93 * Math.sin(a0));
    s.absarc(0, 6.3, 2.93, a0, a1, false); s.lineTo(2.53 * Math.cos(a1), 6.3 + 2.53 * Math.sin(a1)); s.absarc(0, 6.3, 2.53, a1, a0, true);
    mesh(`entry-arch-stone-${i}`, new THREE.ExtrudeGeometry(s, { depth: .22, bevelEnabled: false, curveSegments: 3 }), 'trim', 0, 0, 6.43);
  }
  for (const x of [-2.73, 2.73]) box('entry-arch-pier', .4, 5.1, .25, x, 3.75, 6.53, 'trim');
  for (const x of [-5.0, 5.0]) {
    box('facade-corner-pilaster', .48, 9.5, .25, x, 5.95, 6.5, 'trim');
    for (const y of [2, 4.7, 7.4, 10]) box('facade-quoin', .67, .38, .32, x, y, 6.57, 'trim');
  }
  // A single shallow upper band articulates the remaining wall above the tall arch.
  box('main-entry-upper-stringcourse', 10.5, .16, .24, 0, 9.92, 6.54, 'trim', .025);
  // Behind the entrance block: warm twelve-sided drum and a hemispherical roof.
  mesh('dome-drum', new THREE.CylinderGeometry(6.15, 6.15, 6.3, 12), 'stone', 0, 14.55, -1.4);
  mesh('dome-drum-upper-cornice', new THREE.CylinderGeometry(6.4, 6.4, .3, 48), 'trim', 0, 17.8, -1.4);
  mesh('dome-drum-lower-belt', new THREE.CylinderGeometry(6.22, 6.22, .24, 12), 'trim', 0, 12.3, -1.4);
  for (let i = 0; i < 12; i++) {
    const a = (i + .5) * Math.PI * 2 / 12;
    window(`drum-window-${i}`, Math.sin(a) * 5.965, 15.75, -1.4 + Math.cos(a) * 5.965, a, .62, .72);
  }
  const domeBase = 17.99, domeH = 5.15, domeR = 6.3, sectors = 16, subdivisions = 4, rings = 14;
  for (let sector = 0; sector < sectors; sector++) {
    const vertices = [], indices = [];
    for (let j = 0; j <= rings; j++) {
      const t = .5 * Math.PI * j / rings, radius = domeR * Math.cos(t), y = domeH * Math.sin(t);
      for (let k = 0; k <= subdivisions; k++) {
        const a = 2 * Math.PI * (sector + k / subdivisions) / sectors;
        vertices.push(radius * Math.sin(a), y, radius * Math.cos(a));
      }
    }
    for (let j = 0; j < rings; j++) for (let k = 0; k < subdivisions; k++) {
      const a = j * (subdivisions + 1) + k, b = a + subdivisions + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
    mesh(`blue-dome-panel-${sector}`, g, sector % 4 === 0 ? 'domeLight' : sector % 4 === 2 ? 'domeShade' : 'dome', 0, domeBase, -1.4);
    const a = 2 * Math.PI * sector / sectors, points = [];
    for (let j = 0; j <= 22; j++) { const t = .5 * Math.PI * j / 22; points.push(new THREE.Vector3((domeR + .015) * Math.cos(t) * Math.sin(a), domeH * Math.sin(t) + .012, (domeR + .015) * Math.cos(t) * Math.cos(a))); }
    mesh(`dome-raised-rib-${sector}`, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 22, .025, 4, false), 'rib', 0, domeBase, -1.4);
  }
  mesh('dome-finial-foot', new THREE.SphereGeometry(.24, 12, 8), 'gold', 0, 23.36, -1.4);
  mesh('dome-finial-spire', new THREE.ConeGeometry(.14, 1.05, 10), 'gold', 0, 23.975, -1.4);
  footprint('main-drum', 0, -1.4, 12.8, 12.8, 11.2, 24.5, { supportedBy: 'main-hall', elevated: true });
  footprint('main-hall', 0, -.65, 11.5, 14.3, 1.2, 11.6, { opening: { minX: -2.5, maxX: 2.5, floorY: 1.2, springY: 6.3, crownY: 8.8, frontZ: 6.65, rearZ: -7.8 } });
  // Flanking blue towers and staggered cream wings create a continuous frontage.
  for (const side of [-1, 1]) {
    const x = side * 8.05, z = .5, top = side < 0 ? 13.1 : 12.7;
    box(`blue-tower-${side}`, 4.8, top - 1.2, 6.4, x, (top + 1.2) / 2, z, side < 0 ? 'blue' : 'blueShade', .14);
    box(`blue-tower-base-${side}`, 5.05, 1.7, 6.6, x, .85, z, 'trim');
    box(`blue-tower-upper-cornice-${side}`, 4.98, .17, 6.58, x, top - .12, z, 'trim', .025);
    roof(`blue-tower-roof-${side}`, x, top, z, 5.4, 7, 1.05);
    footprint(`blue-tower-${side}`, x, z, 5.4, 7, 0, top + 1.15);
    for (const y of [4.2, 7.4, 10.65]) {
      window(`blue-front-${side}-${y}`, x, y, 3.715, 0, .65, .74);
      window(`blue-side-${side}-${y}`, x + side * 2.415, y, 1, side * Math.PI / 2, .65, .74);
    }
    const wx = side * 12, wz = -2.2, wtop = side < 0 ? 9.6 : 10.1;
    box(`cream-wing-${side}`, 4.4, wtop - 1.2, 7, wx, (wtop + 1.2) / 2, wz, 'stone', .12);
    box(`cream-wing-base-${side}`, 4.6, 1.45, 7.15, wx, .725, wz, 'trim');
    box(`cream-wing-upper-cornice-${side}`, 4.56, .15, 7.16, wx, wtop - .11, wz, 'trim', .025);
    roof(`cream-wing-roof-${side}`, wx, wtop, wz, 5.05, 7.6, .9);
    footprint(`cream-wing-${side}`, wx, wz, 5.05, 7.6, 0, wtop + 1);
    for (const y of [3.5, 6.7]) {
      window(`wing-front-${side}-${y}`, wx, y, 1.315, 0, .68, .74);
      window(`wing-side-${side}-${y}`, wx + side * 2.215, y, -1, side * Math.PI / 2, .68, .74);
    }
    // A small cream lantern peeks behind each blue roof.
    const tx = side * 8.05, tz = -1.4;
    mesh(`rear-lantern-${side}`, new THREE.CylinderGeometry(1.05, 1.15, 3.05, 12), 'trim', tx, top + .45, tz);
    mesh(`rear-lantern-orange-cap-${side}`, new THREE.SphereGeometry(1.27, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'roof', tx, top + 1.98, tz);
    mesh(`rear-lantern-pin-${side}`, new THREE.ConeGeometry(.09, .48, 8), 'gold', tx, top + 3.44, tz);
    window(`rear-lantern-window-${side}`, tx, top + .6, tz + 1.12, 0, .4, .52);
    footprint(`rear-lantern-${side}`, tx, tz, 2.54, 2.54, top - 1.08, top + 3.68, { elevated: true, supportedBy: `blue-tower-${side}` });
  }
  // Candidate-only piecewise deformation in the COMPLETE group frame. Cut
  // triangles at the fixed threshold first: merely moving endpoints of tall
  // triangles would otherwise stretch the geometry below the 1.2m doorway.
  let splitTriangles=0;
  group.updateMatrixWorld(true);
  if(expanded){group.traverse(o=>{if(!o.isMesh)return;const old=o.geometry,p=old.attributes.position,n=old.attributes.normal,uv=old.attributes.uv,idx=old.index,m=o.matrixWorld.clone(),inverse=m.clone().invert(),normalToGroup=new THREE.Matrix3().getNormalMatrix(m),normalToLocal=new THREE.Matrix3().getNormalMatrix(inverse),positions=[],normals=[],uvs=[];
    const vertex=i=>({p:new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m),n:new THREE.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalToGroup).normalize(),uv:uv?new THREE.Vector2().fromBufferAttribute(uv,i):new THREE.Vector2()});
    const interpolate=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});
    const clip=(poly,upper)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],aa=upper?a.p.y>=pivotY:a.p.y<=pivotY,bb=upper?b.p.y>=pivotY:b.p.y<=pivotY;if(aa)out.push(a);if(aa!==bb)out.push(interpolate(a,b,(pivotY-a.p.y)/(b.p.y-a.p.y)));}return out;};
    const emit=(poly,upper)=>{for(let i=1;i<poly.length-1;i++){const tri=[poly[0],poly[i],poly[i+1]];if(new THREE.Triangle(...tri.map(v=>v.p)).getArea()<1e-12)continue;for(const v of tri){const q=new THREE.Vector3(v.p.x*sxz,mapY(v.p.y),v.p.z*sxz).applyMatrix4(inverse),normal=v.n.clone().divide(new THREE.Vector3(sxz,upper?sy:1,sxz)).normalize().applyMatrix3(normalToLocal).normalize();positions.push(...q.toArray());normals.push(...normal.toArray());uvs.push(...v.uv.toArray());}}};
    for(let i=0;i<(idx?.count||p.count);i+=3){const tri=[0,1,2].map(j=>vertex(idx?idx.getX(i+j):i+j)),lo=Math.min(...tri.map(v=>v.p.y)),hi=Math.max(...tri.map(v=>v.p.y));if(lo<pivotY&&hi>pivotY){emit(clip(tri,false),false);emit(clip(tri,true),true);splitTriangles++;}else emit(tri,lo>=pivotY);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;geometries.delete(old);old.dispose();geometries.add(g);
  });
   for(const f of footprints){f.polygon=f.polygon.map(([x,z])=>[x*sxz,z*sxz]);f.floorY=mapY(f.floorY);f.roofY=mapY(f.roofY);if(f.opening){for(const k of['minX','maxX','frontZ','rearZ'])f.opening[k]*=sxz;for(const k of['floorY','springY','crownY'])f.opening[k]=mapY(f.opening[k]);}}
  }
  if(expanded){box('entrance-landing-surveyed-joint',6.82,.65,2.4,0,-.025,14.4,'trim',.02);footprint('entrance-landing-surveyed-joint',0,14.4,6.82,2.4,-.35,.3,{support:true,walkable:true});}
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group), size = bounds.getSize(new THREE.Vector3());
  let triangles = 0, meshes = 0;
  group.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  const report = {
    version: expanded?'target-new-city-main-v3-expanded':'target-new-city-main-v2', proportion, scaleContract:{xz:sxz,aboveThresholdY:sy,thresholdY:pivotY,splitTriangles,defaultUnchanged:!expanded,requiresRouteRebuild:expanded}, seed, palette: colours, origin: 'platform centre at ground, +Z entrance',
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() }, footprints,
    entry: { position: mapPoint([0, 1.2, 6.7]), inward: [0, 0, -1], clearWidth: 5*sxz, clearHeightAtCentre: 7.6*sy, rectangularClearHeight: 5.1*sy },
    passage: { from: mapPoint([0, 1.2, 6.7]), to: mapPoint([0, 1.2, -8]), clearWidth: 5*sxz, rectangularClearHeight: 5.1*sy, through: true },
    stairs: { bottom: expanded?[0,.3,14.75]:mapPoint([0, 0, 12.96]), top: mapPoint([0, 1.2, 7.8]), width: 6.2*sxz, steps: 4, maxRise: .3, ...(expanded?{walkPath:[[0,.3,14.75],...Array.from({length:4},(_,i)=>[0,(i+1)*.3,(12.3-i*1.3)*sxz]),[0,1.2,7.1*sxz],[0,1.2,6.7*sxz]],jointLanding:{top:.3,bottom:-.35,polygon:[[-3.41,13.2],[3.41,13.2],[3.41,15.6],[-3.41,15.6]]}}:{}) },
    performance: { meshes, triangles, materials: materials.size, geometries: geometries.size },
    targetSource: 'artifacts/pipeline/citadel-architecture-target-20261005/target-v3-landmarks.png',
    validation: { gpuIntegrated: false, visualScore: null, note: 'Geometry factory only; final terrain seating, connected approach, GPU lighting and independent target review remain integration responsibilities.' },
  };
  group.userData.targetArchitecture=report.version;
  group.userData.targetArchitectureReport = report;
  let disposed = false;
  return { group, report, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); group.clear(); } };
}

/** Snapshot only the real entrance tread/landing triangles into castle chart.
 * Works before main is attached. Caller owns dispose and must recreate after
 * changing proportion/placement. Never samples hall roofs as walking ground. */
export function createTargetNewCityApproachSampler({main,origin=[74,12,33],yaw=-55*Math.PI/180,sampleTerrain}={}){
 const root=main?.group||main;if(!root?.isObject3D||typeof sampleTerrain!=='function')throw new TypeError('main group and terrain sampler required');
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),placement=new THREE.Matrix4().makeRotationY(yaw).setPosition(...origin),vertices=[];
 root.traverse(o=>{if(!o.isMesh||!/^entrance-(stair-|landing)/.test(o.name))return;const m=placement.clone().multiply(inverse).multiply(o.matrixWorld),p=o.geometry.attributes.position,ix=o.geometry.index;for(let i=0;i<(ix?.count||p.count);i++)vertices.push(...new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(m).toArray());});
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeBoundingSphere();const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);let disposed=false;
 return{sampleSurface(x,z){if(disposed)throw new Error('approach sampler disposed');const ground=sampleTerrain(x,z),gy=typeof ground==='number'?ground:ground?.height;ray.set(new THREE.Vector3(x,220,z),new THREE.Vector3(0,-1,0));ray.far=1000;const hit=ray.intersectObject(mesh,false)[0];if(hit&&(!Number.isFinite(gy)||hit.point.y>gy))return{height:hit.point.y,mesh:'actual-main-approach-triangles'};return ground;},dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();}};
}
