import {createTargetNewCityEnclosure} from './targetNewCityEnclosure.js';
import {createTargetStreetDressing} from './targetStreetDressing.js';
import * as THREE from 'three';
import {TARGET_ARCHITECTURE_PALETTE,TARGET_ARCHITECTURE_COLOUR_VERSION} from './targetArchitecturePalette.js';

// Hand-authored target-v3 architecture; local +Z is the entrance, Y is up.
// No terrain, light, texture, or scene-global material is owned by this factory.
export const TARGET_NEW_CITY_MAIN_PALETTE = Object.freeze(Object.fromEntries(['stone','trim','blue','blueShade','roof','roofLight','dome','domeLight','domeShade','rib','window','glass','gold'].map(k=>[k,TARGET_ARCHITECTURE_PALETTE[k]])));

export function createTargetNewCityMain({ seed = 17, palette = {}, proportion = 'original', batchWindowDetails = false, courtyardSurfaceHeightAt = null, layout = 'legacy' } = {}) {
  if(!['legacy','walled-court-1'].includes(layout))throw new TypeError('unknown new-city layout');
  const walled=layout==='walled-court-1';
  if(typeof batchWindowDetails!=='boolean')throw new TypeError('batchWindowDetails must be boolean');
  if(!['original','expanded-1'].includes(proportion))throw new TypeError('unknown new-city proportion');
  const expanded=proportion==='expanded-1',sxz=expanded?1.1:1,sy=expanded?1.2:1,pivotY=1.2;
  const mapY=y=>y<=pivotY?y:pivotY+(y-pivotY)*sy;
  const mapPoint=p=>[p[0]*sxz,mapY(p[1]),p[2]*sxz];
  const colours = { ...TARGET_NEW_CITY_MAIN_PALETTE,townYellow:TARGET_ARCHITECTURE_PALETTE.yellow,townTeal:TARGET_ARCHITECTURE_PALETTE.teal,townRose:TARGET_ARCHITECTURE_PALETTE.pink, ...palette };
  const group = new THREE.Group(); group.name = 'citadel-target-new-city-main';
  group.userData.preserveCitadelMaterials = true;
  group.userData.targetArchitecture = 'new-city-main-v2';
  const geometries = new Set(), materials = new Set(), footprints = [], windowRoots = [];
  const mats = Object.fromEntries(Object.entries(colours).map(([key, color]) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: key === 'dome' ? .67 : .85, metalness: key === 'gold' ? .2 : 0 });
    material.name = `target-new-city-${key}`;
    material.userData.preserveCitadelMaterials = true;
    material.userData.preserveCitadelMaterial = true;
    material.userData.targetArchitectureColour={version:TARGET_ARCHITECTURE_COLOUR_VERSION,role:key,albedo:color};
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
    const root = new THREE.Group(); root.name = name; root.position.set(x, y, z); root.rotation.y = yaw; group.add(root); windowRoots.push(root);
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
  // Low orange-roof homes embrace the drum on both flanks and the rear,
  // leaving the entrance and rear nave axis open. Seat them on the actual hill.
  const courtyardHomes=[],courtyardRejected=[],courtyardPlants=[];
  const legacyHomes=[
    [0,-13.2,-9.8,4.5,4.4,5.1,'townYellow'],[1,13.2,-9.8,4.5,4.4,5.8,'townTeal'],
    [2,-7.5,-15.3,4.6,4.4,4.8,'townRose'],[3,7.5,-15.3,4.6,4.4,5.4,'townYellow'],
    [4,-17.1,-4.2,3.7,4.3,4.1,'townTeal'],[5,17.1,-4.2,3.7,4.3,4.6,'townYellow'],
    [6,-16.0,4.6,3.6,4.1,4.3,'townRose'],[7,16.0,4.6,3.6,4.1,4.8,'townTeal'],
    [8,-18.2,-10.7,3.4,4.0,4.0,'townYellow'],[9,18.2,-10.7,3.4,4.0,4.2,'townRose']];
  const walledPositions=[[-12.9,-10.1],[12.6,-9.1],[-8.8,-15.1],[8.7,-15.2],[-17.4,-4.4],[17.4,-3.5],[-14.2,3.9],[14.2,4.6],[-17.5,-11.0],[17.5,-9.3]];
  const homes=walled?legacyHomes.map((row,i)=>[row[0],...walledPositions[i],row[3],i===6?3.9:row[4],...row.slice(5)]):legacyHomes;
  for(const [i,x,z,w,d,h,colour]of homes){
    const corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[(x+a)*sxz,(z+b)*sxz]);
    const probes=[...corners,[x*sxz,z*sxz],[(x-w/2)*sxz,z*sxz],[(x+w/2)*sxz,z*sxz],[x*sxz,(z-d/2)*sxz],[x*sxz,(z+d/2)*sxz]];
    const ys=courtyardSurfaceHeightAt?probes.map(p=>courtyardSurfaceHeightAt(...p)):probes.map(()=>0);
    if(ys.some(v=>!Number.isFinite(v))||Math.max(...ys)-Math.min(...ys)>(i>=6?2.5:4.5)){courtyardRejected.push({i,reason:'missing-or-steep-actual-ground',samples:ys});continue;}
    const top=Math.max(0,...ys)+.08,bottom=Math.min(0,...ys)-.10,unmap=v=>v<=pivotY?v:pivotY+(v-pivotY)/sy,floor=unmap(top),low=unmap(bottom),id='dome-courtyard-house-'+i;
    box(id+'-foundation',w+.2,floor-low,d+.2,x,(floor+low)/2,z,'stone',.07);
    box(id+'-wall',w,h,d,x,floor+h/2,z,colour,.10);roof(id+'-roof',x,floor+h,z,w+.45,d+.45,.9);
    for(const side of[-1,1]){window(id+'-front-'+side,x+side*w*.23,floor+1.7,z+d/2+.02,0,.52,.7);window(id+'-upper-'+side,x+side*w*.23,floor+3.5,z+d/2+.02,0,.52,.7);}
    footprint(id,x,z,w+.45,d+.45,low,floor+h+.95,{supportedBy:'actual-courtyard-terrain',courtyard:true});
    courtyardHomes.push({id,position:[x*sxz,top,z*sxz],support:ys,foundationHeight:top-bottom,colour});
  }
  // Seat planted pockets on their own actual ground, not the adjacent home's
  // highest corner. The entrance/nave and every house footprint remain clear.
  for(const[x,z,size,tall]of[[-6.4,6.3,.95,true],[6.4,6.3,.95,true],[-12.2,5.2,1,false],[12.2,5.2,1,false],[-16,8.1,1.15,true],[16,8.1,1.15,true],[-8.3,-11.3,.8,false],[8.3,-11.3,.8,false],[-18.4,-.6,1.1,true],[18.4,-.6,1.1,true],[-14.7,-7.5,.85,false],[14.7,-7.5,.85,false]]){
    if(footprints.some(f=>{const xs=f.polygon.map(p=>p[0]),zs=f.polygon.map(p=>p[1]);return x>Math.min(...xs)-.65&&x<Math.max(...xs)+.65&&z>Math.min(...zs)-.65&&z<Math.max(...zs)+.65;}))continue;
    const px=x*sxz,pz=z*sxz,ys=[[0,0],[-.45,0],[.45,0],[0,-.45],[0,.45]].map(([dx,dz])=>courtyardSurfaceHeightAt?courtyardSurfaceHeightAt(px+dx,pz+dz):0);
    if(ys.some(y=>!Number.isFinite(y))||Math.max(...ys)-Math.min(...ys)>.45)continue;
    courtyardPlants.push([px,Math.max(...ys)-.05,pz,size,tall,true]);
  }
  // An open rear court is a destination reached through the real nave, not
  // another house in the rear door axis. Low perimeter masonry leaves its sky
  // and centre open; the surrounding homes remain the higher enclosing mass.
  const rearCourt={built:false,clearAxis:true,source:'user rear-courtyard reference 2026-10-07',bounds:[[-4.3,-17.5],[4.3,-10.7]],steps:[],openRearGate:2.4};
  const courtProbes=[[-4.3,-17.5],[4.3,-17.5],[-4.3,-10.7],[4.3,-10.7],[0,-14.1]].map(([x,z])=>courtyardSurfaceHeightAt?courtyardSurfaceHeightAt(x*sxz,z*sxz):0);
  if(courtProbes.every(Number.isFinite)&&Math.max(...courtProbes)-Math.min(...courtProbes)<1.0){
    const unmap=v=>v<=pivotY?v:pivotY+(v-pivotY)/sy;
    const sampledTop=Math.max(.08,...courtProbes.map(y=>y+.04)),sampledBottom=Math.min(...courtProbes)-.08;
    const top=walled?unmap(sampledTop):sampledTop,bottom=walled?unmap(sampledBottom):sampledBottom;
    const court=box('rear-court-stone-floor',8.6,top-bottom,6.8,0,(top+bottom)/2,-14.1,'trim',.025);court.userData.targetWalkable=true;
    footprint('rear-court-stone-floor',0,-14.1,8.6,6.8,bottom,top,{walkable:true,support:true});
    const path=box('rear-court-door-path',3.8,top-bottom,1.5,0,(top+bottom)/2,-10.4,'trim',.025);path.userData.targetWalkable=true;
    for(let i=0;i<4;i++){const y=Math.max(top,1.2-(i+1)*.3),z=-8.3-i*.6,m=box('rear-court-access-step-'+i,3.8,y-bottom,.62,0,(y+bottom)/2,z,'trim',.02);m.userData.targetWalkable=true;rearCourt.steps.push(mapPoint([0,y,z]));}
    for(const side of[-1,1]){
      box('rear-court-side-curb-'+side,.28,.48,6.8,side*4.16,top+.24,-14.1,'stone',.03);
      box('rear-court-rear-wall-'+side,2.8,1.05,.34,side*2.65,top+.525,-17.33,'stone',.05);
      for(const z of[-12,-15.5]){box('rear-court-pergola-pier-'+side+'-'+z,.26,2.25,.26,side*4.16,top+1.125,z,'stone',.025);}
      box('rear-court-pergola-beam-'+side,.38,.2,4.2,side*4.16,top+2.27,-13.75,'trim',.025);
      for(const z of[-12.5,-16])if(!walled)courtyardPlants.push([side*2.85*sxz,top-.06,z*sxz,.8,false,true]);
    }
    // Inlaid strips articulate circulation without covering the planting beds.
    for(const side of[-1,1])box('rear-court-axis-inlay-'+side,.09,.012,6.2,side*.95,top+.007,-14.1,'stone',0);
    Object.assign(rearCourt,{built:true,top,bottom,support: courtProbes,centralPathWidth:1.9*sxz,throughNave:true});
  }else rearCourt.reason='missing-or-steep-rear-court-ground';
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
  let enclosure=null;
  if(walled){
    group.updateMatrixWorld(true);
    const floor=group.getObjectByName('rear-court-stone-floor');let court=null;
    if(floor){const bounds=new THREE.Box3().setFromObject(floor);court={top:bounds.max.y,bottom:bounds.min.y,minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z};
      for(const node of [...group.children])if(node===floor||node.name.startsWith('rear-court-axis-inlay-')){node.removeFromParent();geometries.delete(node.geometry);node.geometry.dispose();}
      const i=footprints.findIndex(f=>f.id==='rear-court-stone-floor');if(i>=0)footprints.splice(i,1);
      Object.assign(rearCourt,{clearAxis:false,circulation:'two-sided-fountain-bypass',top:court.top,bottom:court.bottom});
    }
    enclosure=createTargetNewCityEnclosure({surfaceHeightAt:courtyardSurfaceHeightAt,materials:mats,court,scale:sxz});group.add(enclosure.group);footprints.push(...enclosure.report.footprints);
    for(const node of group.children)if(node.name.startsWith('rear-court-access-step-')||node.name==='rear-court-door-path'){node.userData.targetWalkable=true;node.userData.newCityPublicWalkable=true;}
  }
  group.updateMatrixWorld(true);
  const courtDressing=createTargetStreetDressing({plants:courtyardPlants,lamps:[[-4.8,4.7,6.8],[4.8,4.7,6.8]].map(mapPoint),lightLimit:2});group.add(courtDressing.group);
  const windowBatchReport={enabled:batchWindowDetails,version:'main-window-batches-1',windowCount:windowRoots.length,beforeMeshes:windowRoots.reduce((n,r)=>n+r.children.length,0),afterMeshes:null,zones:[],triangles:0,sourceMeshesRemoved:false,gpuMeasured:false};
  if(batchWindowDetails){
    // The expanded deformation above is complete before baking. Three spatial
    // regions retain useful frustum bounds; material identity is never changed.
    const inverse=group.matrixWorld.clone().invert(),prepared=[],sourceMeshes=[];
    try{
      for(const zone of ['drum','left','right']){
        const roots=windowRoots.filter(r=>(r.name.startsWith('drum-window-')?'drum':r.name.includes('--1')?'left':'right')===zone),buckets=new Map();
        for(const root of roots)for(const source of root.children){
          if(!source.isMesh||source.isInstancedMesh||source.isSkinnedMesh||Array.isArray(source.material))throw new Error('unexpected window batch source');
          const key=source.material;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({source,root});
        }
        const zoneReport={id:zone,windows:roots.map(r=>r.name),beforeMeshes:roots.reduce((n,r)=>n+r.children.length,0),batches:[]};
        for(const [material,rows]of buckets){
          const attributes=new Map(),ranges=[];let vertexOffset=0,signature=null;
          for(const {source,root}of rows){
            const geometry=source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone();
            geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,source.matrixWorld));
            try{
              const shape=JSON.stringify(Object.entries(geometry.attributes).map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name]).sort());
              if(signature!==null&&signature!==shape)throw new Error('incompatible window attributes');signature=shape;
              for(const [name,a]of Object.entries(geometry.attributes)){if(!attributes.has(name))attributes.set(name,{itemSize:a.itemSize,normalized:a.normalized,Type:a.array.constructor,values:[]});attributes.get(name).values.push(...a.array);}
              const count=geometry.attributes.position.count;
              ranges.push({sourceName:source.name,windowName:root.name,firstTriangle:vertexOffset/3,triangleCount:count/3,firstVertex:vertexOffset,vertexCount:count,semantic:'protected-main-window-detail',materialName:material.name});vertexOffset+=count;
            }finally{geometry.dispose();}
            sourceMeshes.push(source);
          }
          const geometry=new THREE.BufferGeometry();for(const [name,a]of attributes)geometry.setAttribute(name,new THREE.BufferAttribute(new a.Type(a.values),a.itemSize,a.normalized));geometry.computeBoundingBox();geometry.computeBoundingSphere();
          const reference=rows[0].source,role=material===mats.window?'frames':'panes',batch=new THREE.Mesh(geometry,material);batch.name=`main-window-batch-${zone}-${role}`;batch.castShadow=reference.castShadow;batch.receiveShadow=reference.receiveShadow;batch.renderOrder=reference.renderOrder;batch.layers.mask=reference.layers.mask;batch.frustumCulled=reference.frustumCulled;
          batch.userData={preserveCitadelMaterials:true,targetWalkable:false,targetWindowBatch:{version:windowBatchReport.version,zone,semantic:'protected-main-window-detail',sourceFaces:ranges}};
          prepared.push(batch);zoneReport.batches.push({name:batch.name,materialName:material.name,triangles:vertexOffset/3,sourceFaces:ranges,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}});windowBatchReport.triangles+=vertexOffset/3;
        }
        windowBatchReport.zones.push(zoneReport);
      }
    }catch(error){for(const batch of prepared)batch.geometry.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();group.clear();throw error;}
    // Originals are removed, not hidden. The provider must initially collect or
    // refresh from these real replacement triangles; no invisible collider trick.
    for(const source of sourceMeshes){source.removeFromParent();geometries.delete(source.geometry);source.geometry.dispose();}
    for(const batch of prepared){geometries.add(batch.geometry);group.add(batch);}
    for(const root of windowRoots){root.userData.targetWindowSource={semantic:'protected-main-window',batches:prepared.filter(b=>b.userData.targetWindowBatch.sourceFaces.some(r=>r.windowName===root.name)).map(b=>b.name)};}
    windowBatchReport.afterMeshes=prepared.length;windowBatchReport.sourceMeshesRemoved=true;
    group.updateMatrixWorld(true);
  }else windowBatchReport.afterMeshes=windowBatchReport.beforeMeshes;
  const bounds = new THREE.Box3().setFromObject(group), size = bounds.getSize(new THREE.Vector3());
  let triangles = 0, meshes = 0;
  group.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  const report = {
    layout,enclosure:enclosure?.report??null,
    version: batchWindowDetails?'target-new-city-main-v4-window-batches':expanded?'target-new-city-main-v3-expanded':'target-new-city-main-v2', windowBatching:windowBatchReport, proportion, scaleContract:{xz:sxz,aboveThresholdY:sy,thresholdY:pivotY,splitTriangles,defaultUnchanged:!expanded,requiresRouteRebuild:expanded}, seed, palette: colours, origin: 'platform centre at ground, +Z entrance',
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() }, footprints,
    entry: { position: mapPoint([0, 1.2, 6.7]), inward: [0, 0, -1], clearWidth: 5*sxz, clearHeightAtCentre: 7.6*sy, rectangularClearHeight: 5.1*sy },
    passage: { from: mapPoint([0, 1.2, 6.7]), to: mapPoint([0, 1.2, -8]), clearWidth: 5*sxz, rectangularClearHeight: 5.1*sy, through: true },
    stairs: { bottom: expanded?[0,.3,14.75]:mapPoint([0, 0, 12.96]), top: mapPoint([0, 1.2, 7.8]), width: 6.2*sxz, steps: 4, maxRise: .3, ...(expanded?{walkPath:[[0,.3,14.75],...Array.from({length:4},(_,i)=>[0,(i+1)*.3,(12.3-i*1.3)*sxz]),[0,1.2,7.1*sxz],[0,1.2,6.7*sxz]],jointLanding:{top:.3,bottom:-.35,polygon:[[-3.41,13.2],[3.41,13.2],[3.41,15.6],[-3.41,15.6]]}}:{}) },
    performance: { meshes, triangles, materials: materials.size, geometries: geometries.size },
    courtyard:{version:'dome-surrounding-homes-3-open-rear-court',rearCourt,homes:courtyardHomes,rejected:courtyardRejected,dressing:courtDressing.report,frontAxisKeptClear:true},
    targetSource: 'artifacts/pipeline/citadel-architecture-target-20261005/target-v3-landmarks.png',
    validation: { gpuIntegrated: false, visualScore: null, note: 'Geometry factory only; final terrain seating, connected approach, GPU lighting and independent target review remain integration responsibilities.' },
  };
  group.userData.targetArchitecture=report.version;
  group.userData.targetArchitectureReport = report;
  let disposed = false;
  return { group, report,streetDressing:courtDressing, dispose() { if (disposed) return; disposed = true;enclosure?.dispose();courtDressing.dispose(); group.removeFromParent(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); group.clear(); } };
}

/** Snapshot only the real entrance tread/landing triangles into castle chart.
 * Works before main is attached. Caller owns dispose and must recreate after
 * changing proportion/placement. Never samples hall roofs as walking ground. */
export function createTargetNewCityApproachSampler({main,origin=[74,12,33],yaw=-55*Math.PI/180,placementMatrix=null,sampleTerrain}={}){
 const root=main?.group||main;if(!root?.isObject3D||typeof sampleTerrain!=='function')throw new TypeError('main group and terrain sampler required');
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),placement=placementMatrix?.clone()??new THREE.Matrix4().makeRotationY(yaw).setPosition(...origin),vertices=[];
 root.traverse(o=>{if(!o.isMesh||!/^entrance-(stair-|landing)/.test(o.name))return;const m=placement.clone().multiply(inverse).multiply(o.matrixWorld),p=o.geometry.attributes.position,ix=o.geometry.index;for(let i=0;i<(ix?.count||p.count);i++)vertices.push(...new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(m).toArray());});
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeBoundingSphere();const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);let disposed=false;
 return{sampleSurface(x,z){if(disposed)throw new Error('approach sampler disposed');const ground=sampleTerrain(x,z),gy=typeof ground==='number'?ground:ground?.height;ray.set(new THREE.Vector3(x,220,z),new THREE.Vector3(0,-1,0));ray.far=1000;const hit=ray.intersectObject(mesh,false)[0];if(hit&&(!Number.isFinite(gy)||hit.point.y>gy))return{height:hit.point.y,mesh:'actual-main-approach-triangles'};return ground;},dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();}};
}
