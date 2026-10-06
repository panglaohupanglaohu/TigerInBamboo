import {applyHistoricStone} from './historicStone.js';
import {applyAshleyPalette} from './ashleyPalette.js';
import {preservesCitadelMaterial} from './materialOwnership.js';
import * as THREE from 'three';
import {createMangaWaterfall} from '../mangaWaterfall.js';
export const HOLY_STYLE_ROUND=8;
export function holyStyleRound(){const q=new URLSearchParams(globalThis.location?.search||'');return q.has('holyStyle')?THREE.MathUtils.clamp(Number(q.get('holyStyle'))||0,0,10):HOLY_STYLE_ROUND;}
export function applyHolyCityRoofPalette(city){
 if(holyStyleRound()<1)return;
 const clones=new Map();
 city.traverse(o=>{
  if(!o.isMesh)return;
  const recolor=m=>{
   if(preservesCitadelMaterial(o,m))return m;
   if(!/^claude-house-roof/.test(m.name)&&m.name!=='citadel-target-blue-dome')return m;
   if(!clones.has(m)){const c=m.clone();c.color.setHex(0xbc825e);c.roughness=.94;clones.set(m,c);}return clones.get(m);
  };
  o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);
 });
 city.userData.holyStyleRound=holyStyleRound();
}
export function addCathedralFacade(root){
 if(holyStyleRound()<2)return;
 const stone=new THREE.MeshStandardMaterial({color:0xeee6d4,roughness:.94});
 const shade=new THREE.MeshStandardMaterial({color:0xc4bdaa,roughness:.95});
 const add=(g,m,n,x,y,z)=>{const o=new THREE.Mesh(g,m);o.name=n;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 const pediment=new THREE.Shape();pediment.moveTo(-12,0);pediment.lineTo(12,0);pediment.lineTo(0,6);pediment.closePath();
 add(new THREE.ExtrudeGeometry(pediment,{depth:.7,bevelEnabled:false}),stone,'holy-cathedral-pediment',60,31,11.4);
 const inset=new THREE.Shape();inset.moveTo(-8.7,.55);inset.lineTo(8.7,.55);inset.lineTo(0,4.85);inset.closePath();
 add(new THREE.ShapeGeometry(inset),shade,'holy-pediment-inset',60,31,12.12);
 add(new THREE.BoxGeometry(25,.55,1.35),stone,'holy-cathedral-entablature',60,30.8,11.7);
 for(const x of [50.3,52.0,68.0,69.7]){
  add(new THREE.CylinderGeometry(.33,.44,13.5,16),stone,'holy-facade-column',x,23.25,11.9);
  for(const y of [16.45,29.95])add(new THREE.BoxGeometry(1,.4,.95),stone,'holy-column-capital',x,y,11.9);
 }
 const medallion=add(new THREE.TorusGeometry(.8,.14,8,32),stone,'holy-pediment-medallion',60,33.2,12.2);
 root.userData.holyArchivedMerlons=root.children.filter(o=>o.name.includes('merlon'));
 for(const child of root.userData.holyArchivedMerlons)root.remove(child);
 if(holyStyleRound()>=4){
  const terracotta=new THREE.MeshStandardMaterial({color:0xc28b65,roughness:.93});
  const drum=add(new THREE.CylinderGeometry(7.1,7.1,1.0,32),stone,'holy-main-dome-drum',60,42.65,-4.4);
  const dome=add(new THREE.SphereGeometry(7.2,48,24,0,Math.PI*2,0,Math.PI/2),terracotta,'holy-main-cathedral-dome',60,43.15,-4.4);dome.scale.y=.86;
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6,points=[];
   for(let j=0;j<=20;j++){const t=j/20*Math.PI/2;points.push(new THREE.Vector3(60+Math.cos(a)*7.25*Math.cos(t),43.15+6.23*Math.sin(t),-4.4+Math.sin(a)*7.25*Math.cos(t)));}
   add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.055,6,false),stone,'holy-dome-stone-rib',0,0,0);
  }
  add(new THREE.CylinderGeometry(.55,.75,1.1,12),stone,'holy-dome-lantern',60,49.9,-4.4);
  add(new THREE.ConeGeometry(.68,.75,12),terracotta,'holy-dome-lantern-cap',60,50.8,-4.4);
 }
}
export function addOldPalaceCrown(tower){
 if(holyStyleRound()<3)return;
 const roof=tower.getObjectByName('highland-central-tower-roof');
 const finial=tower.getObjectByName('highland-central-tower-finial');
 if(roof)roof.visible=false;if(finial)finial.visible=false;
 const stone=new THREE.MeshStandardMaterial({color:0xefe6cf,roughness:.94});
 const domeMat=new THREE.MeshStandardMaterial({color:0xd9c197,roughness:.91});
 const root=new THREE.Group();root.name='holy-old-palace-open-crown';tower.add(root);
 const add=(g,m,n,x,y,z)=>{const o=new THREE.Mesh(g,m);o.name=n;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 // A square-to-octagonal masonry transition seats the lantern on the shaft.
 add(new THREE.BoxGeometry(3.15,.38,3.05),stone,'old-palace-crown-plinth',0,32.43,0);
 add(new THREE.CylinderGeometry(1.85,1.65,.42,8),stone,'old-palace-crown-transition',0,32.72,0);
 add(new THREE.CylinderGeometry(1.96,1.96,.26,8),stone,'old-palace-cornice',0,33.03,0);
 const r=1.58,base=33.12,spring=34.20,span=2*r*Math.sin(Math.PI/8),inner=(span-.38)/2;
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.cos(a)*r,z=Math.sin(a)*r;
  add(new THREE.CylinderGeometry(.22,.25,1.20,8),stone,'old-palace-arcade-column',x,base+.60,z);
  add(new THREE.BoxGeometry(.53,.20,.53),stone,'old-palace-column-base',x,base+.07,z);
  add(new THREE.BoxGeometry(.49,.17,.49),stone,'old-palace-capital',x,spring,z);
  // Extruded arch ring joins neighboring piers, leaving the gallery open.
  const shape=new THREE.Shape(),outer=inner+.20;
  // Solid spandrels carry the continuous upper cornice, not just arch tips.
  shape.moveTo(-outer,0);shape.lineTo(-outer,.63);shape.lineTo(outer,.63);
  shape.lineTo(outer,0);shape.lineTo(inner,0);
  shape.absarc(0,0,inner,0,Math.PI,false);shape.closePath();
  const mid=a+Math.PI/8,arch=add(new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:false}),stone,'old-palace-arcade-arch',Math.cos(mid)*r*Math.cos(Math.PI/8),spring,Math.sin(mid)*r*Math.cos(Math.PI/8));
  arch.geometry.translate(0,0,-.14);
  arch.rotation.y=-mid-Math.PI/2;
 }
 add(new THREE.CylinderGeometry(1.94,1.87,.30,16),stone,'old-palace-cornice',0,34.91,0);
 const dome=add(new THREE.SphereGeometry(2.02,32,16,0,Math.PI*2,0,Math.PI/2),domeMat,'old-palace-ivory-dome',0,35.04,0);dome.scale.y=.83;
 add(new THREE.ConeGeometry(.10,.60,10),domeMat,'old-palace-finial',0,37.0,0);
 tower.userData.holyPalaceCrown=true;
}

// ---------------------------------------------------------------------
// r05–r06 (Claude, 2026-09-25): old town toward the cliff-palace reference
// (assets/concepts/citadel-style-v2/ref-old-town-cliff-palace.webp):
// r05 ivory/peach limestone walls, pale-sand roofs and domes, warm dark
//     openings, and the green meadow slab repaved as a stone terrace;
// r06 continuous crenellated rampart along the plateau rim with open
//     arcaded domed pavilions (chhatri) on its corners.
// Only meshes inside the old-town footprint and above the plateau are touched;
// terrain, vegetation, clouds, lights and the plinth are skipped.
// ---------------------------------------------------------------------
const OLD_TOWN_SKIP = /waterfall|jade-pool|mountain|terrain|ridge|range|cliff|rock|tree|cypress|pine|grass|shrub|canopy|leaf|flower|planting|cloud|mist|(^|-)lights?(-|$)|light-volume|highland-light|volume|glow|lamp|plinth|platform-side|holy-old|old-palace|soldier|trooper|horse|bird|contour|slope/i;
const OLD_TOWN_GROUP_SKIP = /waterfall|jade-pool|holy-old-town|tree|cypress|pine|grass|shrub|canopy|grove|vegetation|cloud|mist|light-volume|highland-light|lamp|plinth|rampart|chhatri/i;
const IVORY = [0xf5eddb, 0xf0e6d0, 0xede0c6, 0xf6ead4, 0xefdcc2];
function holyOldTownColour(c, salt) {
  const hsl = {h: 0, s: 0, l: 0}; c.getHSL(hsl);
  const cool = hsl.h > 0.45 && hsl.h < 0.75;                       // blue / slate family
  if (hsl.l < 0.3 && !(cool && hsl.s > 0.3)) return c.setHex(0x3b3129).lerp(new THREE.Color(0x2a221c), 0.5 - hsl.l); // openings
  if (cool && hsl.l < 0.6) return c.setHex(0xdcc696).offsetHSL(0, 0, (hsl.l - 0.45) * 0.2);             // roofs / domes -> pale sand-gold
  const base = new THREE.Color(IVORY[Math.abs(salt) % IVORY.length]);
  return c.copy(base).offsetHSL(0, 0, (hsl.l - 0.8) * 0.16);                                             // walls -> limestone, soft relief
}
// Facade atlases carry the slate roofs/colour washes in their texels: recolour
// each unique texture once (sRGB pixels through the same palette rule).
const HOLY_TEX = new Map();
function holyOldTownTexture(tex) {
  if (!tex || HOLY_TEX.has(tex)) return HOLY_TEX.get(tex) || tex;
  const img = tex.image;
  const w = img?.naturalWidth || img?.width, h = img?.naturalHeight || img?.height;
  if (typeof document === 'undefined') return tex;
  if (!w || !h || (img instanceof HTMLImageElement && !img.complete)) return null;   // not loaded yet: caller retries
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d', {willReadFrequently: true});
  let data;
  if (img.data) { data = new ImageData(new Uint8ClampedArray(img.data.length === w * h * 4 ? img.data : new Uint8Array(w * h * 4)), w, h); }
  else { g.drawImage(img, 0, 0); data = g.getImageData(0, 0, w, h); }
  const px = data.data, c = new THREE.Color();
  for (let i = 0; i < px.length; i += 4) {
    c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace);
    holyOldTownColour(c, (i >> 12));
    const o = {r: 0, g: 0, b: 0}; c.getRGB(o, THREE.SRGBColorSpace);
    px[i] = o.r * 255; px[i + 1] = o.g * 255; px[i + 2] = o.b * 255;
  }
  g.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(canvas);
  for (const k of ['wrapS', 'wrapT', 'magFilter', 'minFilter', 'flipY', 'colorSpace', 'anisotropy', 'generateMipmaps']) out[k] = tex[k];
  out.repeat.copy(tex.repeat); out.offset.copy(tex.offset); out.center.copy(tex.center); out.rotation = tex.rotation;
  out.needsUpdate = true;
  HOLY_TEX.set(tex, out);
  return out;
}
function holyInOldTown(o, castle, inv) {
  const box = new THREE.Box3().setFromObject(o); if (box.isEmpty()) return false;
  const c = box.getCenter(new THREE.Vector3()).applyMatrix4(inv);
  return c.x > -95 && c.x < -18 && c.z > -45 && c.z < 28 && c.y > -2;
}
const HOLY_FOOT = {minX: -95, maxX: -18, minZ: -45, maxZ: 28, minY: -2};
function holyStraddlesOldTown(o, inv) {
  if (!o.geometry?.attributes?.position || o.isInstancedMesh) return false;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  if (ms.some(m => !m || m.map || m.isShaderMaterial || !m.color)) return false;
  const box = new THREE.Box3().setFromObject(o).applyMatrix4(inv);
  return box.max.x > HOLY_FOOT.minX && box.min.x < HOLY_FOOT.maxX && box.max.z > HOLY_FOOT.minZ && box.min.z < HOLY_FOOT.maxZ && box.max.y > HOLY_FOOT.minY;
}
// Merged static meshes span both towns: recolour only old-town vertices through
// a vertex-colour channel seeded with the original material colour.
function holySplitRecolour(o, castle, inv) {
  const geo = o.geometry.clone(), pos = geo.attributes.position, n = pos.count;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  const matOf = new Array(n).fill(0);
  if (geo.groups?.length && Array.isArray(o.material)) for (const g of geo.groups) {
    const idx = geo.index;
    for (let k = g.start; k < g.start + g.count; k++) matOf[idx ? idx.getX(k) : k] = g.materialIndex;
  }
  const had = geo.attributes.color, colors = new Float32Array(n * 3), m2l = inv.clone().multiply(o.matrixWorld), v = new THREE.Vector3(), c = new THREE.Color();
  let changed = 0;
  for (let i = 0; i < n; i++) {
    c.copy(ms[matOf[i]].color);
    if (had && ms[matOf[i]].vertexColors) c.multiply(new THREE.Color(had.getX(i), had.getY(i), had.getZ(i)));
    v.fromBufferAttribute(pos, i).applyMatrix4(m2l);
    if (v.x > HOLY_FOOT.minX && v.x < HOLY_FOOT.maxX && v.z > HOLY_FOOT.minZ && v.z < HOLY_FOOT.maxZ && v.y > HOLY_FOOT.minY) { holyOldTownColour(c, i >> 6); changed++; }
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  if (!changed) return;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.userData.holyOldTown = true;
  o.geometry = geo;
  const swap = m => { const cl = m.clone(); cl.vertexColors = true; cl.color.setHex(0xffffff); return cl; };
  o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
}
export function applyOldTownPalace(castle) {
  if (!castle || holyStyleRound() < 5) return null;
  const again = !!castle.userData.holyOldTownPalace;   // later passes only pick up meshes built after the first
  castle.updateMatrixWorld(true);
  const inv = castle.matrixWorld.clone().invert();
  const foundation = castle.getObjectByName('highland-town-foundation-platform');
  const report = {recoloured: 0, vertexColoured: 0};
  const matClones = new Map(), pending = [];
  castle.traverse(o => {
    if (!o.isMesh || o.userData.isOutline || o === foundation || o.userData.holyOldTownDone) return;
    // Delayed sweeps also see newly installed authored candidates. Respect their
    // ownership before either material replacement or shared vertex-colour edits.
    const ownedMaterials = Array.isArray(o.material) ? o.material : [o.material];
    if (ownedMaterials.some(m => preservesCitadelMaterial(o, m))) return;
    // Own name and parent use the full skip list; higher ancestors only exclude
    // vegetation/cloud/light groups (every building sits under a *-mountain-* assembly).
    if (OLD_TOWN_SKIP.test(o.name) || OLD_TOWN_SKIP.test(o.parent?.name || '')) return;
    let a = o.parent?.parent; while (a && a !== castle) { if (OLD_TOWN_GROUP_SKIP.test(a.name)) return; a = a.parent; }
    // Everything under the old-town terrace groups / sacred tower is old town by construction.
    let owned = false; for (let q = o.parent; q && q !== castle; q = q.parent) if (/^town-terrace-|^highland-central-sacred-tower$|^highland-town-/.test(q.name)) { owned = true; break; }
    if (!owned && !holyInOldTown(o, castle, inv)) { if (holyStraddlesOldTown(o, inv)) { holySplitRecolour(o, castle, inv); report.split = (report.split || 0) + 1; } return; }
    o.userData.holyOldTownDone = true;
    const salt = (o.id * 2654435761) >>> 0;
    const swap = m => {
      if (!m || !m.color || m.isShaderMaterial) return m;
      if (!matClones.has(m)) { const c = m.clone(); if (c.map) { const orig = c.map, t = holyOldTownTexture(orig); if (t) c.map = t; else pending.push([c, orig]); c.color.setHex(0xffffff); } else holyOldTownColour(c.color, salt); if (c.emissive && c.emissive.getHex() !== 0) c.emissive.multiplyScalar(0.8); matClones.set(m, c); report.recoloured++; }
      return matClones.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    // Materials that expect vertex colours on geometry without a colour attribute
    // render black (+ sky specular = the old "slate" roofs): give them white.
    const wantsVc = (Array.isArray(o.material) ? o.material : [o.material]).some(m => m?.vertexColors);
    if (wantsVc && o.geometry?.attributes?.position && !o.geometry.attributes.color) {
      o.geometry = o.geometry.clone();
      o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 3).fill(1), 3));
      o.geometry.userData.holyOldTown = true; report.filledVc = (report.filledVc || 0) + 1;
    }
    const col = o.geometry?.attributes?.color;
    if (col && !o.geometry.userData.holyOldTown) {
      o.geometry = o.geometry.clone(); o.geometry.userData.holyOldTown = true;
      const attr = o.geometry.attributes.color, tmp = new THREE.Color();
      for (let i = 0; i < attr.count; i++) { tmp.setRGB(attr.getX(i), attr.getY(i), attr.getZ(i)); holyOldTownColour(tmp, salt + (i >> 5)); attr.setXYZ(i, tmp.r, tmp.g, tmp.b); }
      attr.needsUpdate = true; report.vertexColoured++;
    }
  });
  if (!again && foundation?.material?.color) { foundation.material = foundation.material.clone(); foundation.material.color.setHex(0xd8ccb0); }
  if (!again && holyStyleRound() >= 6 && foundation) report.rampart = addOldTownRampart(foundation);
  if (!again && holyStyleRound() >= 7 && foundation) report.waterfall = addOldTownWaterfall(foundation, castle);
  if (!again && holyStyleRound() >= 8 && foundation) report.roofDomes = addOldTownRoofDomes(foundation, castle);
  applyAshleyPalette(castle);
  applyHistoricStone(castle);
  if (again) { const prev = castle.userData.holyOldTownPalace; prev.latePasses = (prev.latePasses || 0) + 1; prev.lateRecoloured = (prev.lateRecoloured || 0) + report.recoloured + report.vertexColoured; return prev; }
  // Some old-town meshes are rebuilt/merged after this task runs: sweep again later.
  if (typeof setTimeout === 'function') for (const ms of [1500, 5000]) setTimeout(() => applyOldTownPalace(castle), ms);
  // Retry facade textures that were still loading (every 0.5 s, up to 20 s).
  report.pendingTextures = pending.length;
  if (pending.length && typeof setTimeout === 'function') {
    let tries = 0;
    const retry = () => {
      for (let i = pending.length - 1; i >= 0; i--) {
        const [mat, orig] = pending[i], t = holyOldTownTexture(orig);
        if (t) { mat.map = t; mat.needsUpdate = true; pending.splice(i, 1); }
      }
      report.pendingTextures = pending.length;
      if (pending.length && ++tries < 40) setTimeout(retry, 500);
    };
    setTimeout(retry, 500);
  }
  castle.userData.holyOldTownPalace = report;
  return report;
}
function addOldTownRampart(foundation) {
  const side = foundation.getObjectByName('highland-town-foundation-platform-side');
  if (!side) return null;
  const pos = side.geometry.attributes.position, n = pos.count / 2, ring = [];
  for (let i = 0; i < n; i++) ring.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  const top = ring[0].y;
  const stone = new THREE.MeshStandardMaterial({color: 0xeee4cc, roughness: .94});
  const shade = new THREE.MeshStandardMaterial({color: 0xd9ccb0, roughness: .95});
  const domeMat = new THREE.MeshStandardMaterial({color: 0xdcc596, roughness: .9});
  const root = new THREE.Group(); root.name = 'holy-old-town-rampart'; foundation.add(root);
  const add = (g, m, name, p, q) => { const o = new THREE.Mesh(g, m); o.name = name; o.position.copy(p); if (q) o.quaternion.copy(q); o.castShadow = true; o.receiveShadow = true; root.add(o); return o; };
  const WALL_H = 1.25, WALL_T = 0.55, MERLON = 0.7, GAP = 0.55;
  const centre = ring.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
  let corners = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], len = a.distanceTo(b);
    if (len < 0.5) continue;
    const dir = b.clone().sub(a).setY(0).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    // Pull the wall 0.3 m inside the rim so it sits on the terrace edge.
    const inward = centre.clone().sub(a.clone().lerp(b, .5)).setY(0).normalize().multiplyScalar(.3);
    add(new THREE.BoxGeometry(len + WALL_T, WALL_H, WALL_T), stone, 'old-town-rampart-wall', a.clone().lerp(b, .5).add(inward).setY(top + WALL_H / 2), q);
    for (let s = MERLON / 2; s < len - MERLON / 2; s += MERLON + GAP)
      add(new THREE.BoxGeometry(MERLON, .6, WALL_T + .06), stone, 'old-town-rampart-merlon', a.clone().addScaledVector(dir, s).add(inward).setY(top + WALL_H + .3), q);
    // Corner pavilion where the outline turns sharply.
    const prev = ring[(i - 1 + n) % n], d0 = a.clone().sub(prev).setY(0).normalize();
    if (d0.dot(dir) < 0.55 && corners < 6) {
      corners++;
      const c = a.clone().add(centre.clone().sub(a).setY(0).normalize().multiplyScalar(1.6)).setY(top);
      add(new THREE.BoxGeometry(3.4, .5, 3.4), shade, 'old-town-chhatri-plinth', c.clone().setY(top + WALL_H + .25));
      for (let k = 0; k < 4; k++) {
        const ang = k * Math.PI / 2 + Math.PI / 4, off = new THREE.Vector3(Math.cos(ang) * 1.25, 0, Math.sin(ang) * 1.25);
        add(new THREE.CylinderGeometry(.13, .16, 2.2, 10), stone, 'old-town-chhatri-column', c.clone().add(off).setY(top + WALL_H + .5 + 1.1));
      }
      add(new THREE.CylinderGeometry(1.75, 1.75, .3, 20), stone, 'old-town-chhatri-cornice', c.clone().setY(top + WALL_H + 2.85));
      const dome = add(new THREE.SphereGeometry(1.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, 'old-town-chhatri-dome', c.clone().setY(top + WALL_H + 3.0));
      dome.scale.y = 0.95;
      add(new THREE.ConeGeometry(.09, .7, 8), domeMat, 'old-town-chhatri-finial', c.clone().setY(top + WALL_H + 4.8));
    }
  }
  return {segments: n, pavilions: corners};
}

// r07: a waterfall leaves the plateau rim on the bay side and falls into a jade
// pool at sea level (reference: waterfall below the cliff palace). The rim point
// is the southern-most outline vertex away from the harbour stair.
function addOldTownWaterfall(foundation, castle, R = 160) {
  const side = foundation.getObjectByName('highland-town-foundation-platform-side');
  if (!side) return null;
  const pos = side.geometry.attributes.position, n = pos.count / 2, ring = [];
  for (let i = n; i < pos.count; i++) ring.push(new THREE.Vector3().fromBufferAttribute(pos, i));
  const top = new THREE.Vector3().fromBufferAttribute(pos, 0).y;
  foundation.updateWorldMatrix(true, false);
  const toCastle = new THREE.Matrix4().copy(castle.matrixWorld).invert().multiply(foundation.matrixWorld);
  const toLocal = toCastle.clone().invert();
  const stair = (castle.userData.oldShoreApproach?.route || []).map(p => new THREE.Vector3(...p).applyMatrix4(toLocal));
  const centre = ring.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / ring.length);
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], m = a.clone().lerp(b, .5);
    const cz = m.clone().applyMatrix4(toCastle).z;
    // Only stair segments near the plateau top can collide with the fall's lip.
    const nearTop = stair.filter(r => Math.abs(r.y - top) < 5);
    const stairDist = nearTop.length ? Math.min(...nearTop.map(r => Math.hypot(r.x - m.x, r.z - m.z))) : 99;
    const cx = m.clone().applyMatrix4(toCastle).x;
    const score = cz - (stairDist < 8 ? 100 : 0);   // front (bay-facing) face, clear of the stair's upper flight
    if (score > bestScore) { bestScore = score; best = {m, dir: b.clone().sub(a).setY(0).normalize()}; }
  }
  if (!best) return null;
  const out = best.m.clone().sub(centre).setY(0).normalize();
  const world = best.m.clone().applyMatrix4(foundation.matrixWorld);
  const alt = world.length() - R;
  const lip = best.m.clone().addScaledVector(out, 2.9);          // clear of the battered plinth wall
  const waterline = top - alt + 0.2;
  const fall = createMangaWaterfall({topY: top + 0.15, waterlineY: waterline, seed: 20260925});
  fall.name = 'holy-old-town-waterfall';
  fall.position.set(lip.x, 0, lip.z);
  fall.rotation.y = Math.atan2(out.x, out.z);                     // curtain faces out over the bay
  fall.scale.set(1.6, 1, 1.1);
  foundation.add(fall);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), new THREE.MeshStandardMaterial({color: 0x5cc4b0, roughness: .25, metalness: .05, transparent: true, opacity: .82}));
  pool.name = 'holy-old-town-jade-pool';
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(lip.x + out.x * 2.2, waterline + 0.05, lip.z + out.z * 2.2);
  foundation.add(pool);
  let last = null;
  const driver = fall.children.find(c => c.isMesh) || fall;
  const tick = () => { const t = performance.now() / 1000; fall.userData.update?.(last == null ? 0 : Math.min(.1, t - last), t); last = t; };
  pool.onBeforeRender = tick;
  return {rimCastleLocal: best.m.clone().applyMatrix4(toCastle).toArray().map(v => Math.round(v * 10) / 10), height: Math.round(alt * 10) / 10};
}

// r08: a cluster of small domed pavilions on the highest old-town roofs gives the
// palace its dome skyline (reference: stacked arcaded drums with pale domes).
function addOldTownRoofDomes(foundation, castle) {
  const tower = castle.getObjectByName('highland-central-sacred-tower');
  const towerPos = tower ? castle.worldToLocal(tower.getWorldPosition(new THREE.Vector3())) : null;
  // Geometry scan (merged static meshes have raycasting disabled): upward-facing
  // triangles of the visible old-town buildings, bucketed on a 2 m grid.
  const visible = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const roofs = [];
  castle.traverse(o => { if (o.isMesh && !o.userData.isOutline && /^town-terrace-/.test(o.parent?.name || '') && visible(o)) roofs.push(o); });
  if (!roofs.length) return null;
  castle.updateMatrixWorld(true);
  const toCastle = new THREE.Matrix4(), inv = castle.matrixWorld.clone().invert();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3(), cells = new Map();
  for (const o of roofs) {
    toCastle.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position, idx = o.geometry.index, tri = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(toCastle); b.fromBufferAttribute(pos, i1).applyMatrix4(toCastle); c.fromBufferAttribute(pos, i2).applyMatrix4(toCastle);
      nrm.subVectors(b, a).cross(c.clone().sub(a));
      const area = nrm.length() / 2; if (area < 0.6) continue;
      nrm.normalize(); if (nrm.y < 0.92) continue;                     // flat, upward faces only
      const x = (a.x + b.x + c.x) / 3, y = (a.y + b.y + c.y) / 3, z = (a.z + b.z + c.z) / 3;
      const key = Math.round(x / 2) + ',' + Math.round(z / 2), prev = cells.get(key);
      if (!prev || y > prev.y) cells.set(key, new THREE.Vector3(x, y, z));
    }
  }
  const peaks = [...cells.values()].map(p => ({p, n: 1}));
  peaks.sort((a, b) => b.p.y - a.p.y);
  const picked = [];
  for (const k of peaks) {
    if (picked.length >= 6) break;
    if (k.n < 0.85) continue;                                            // flat roof tops only
    if (towerPos && Math.hypot(k.p.x - towerPos.x, k.p.z - towerPos.z) < 9) continue;
    if (picked.some(q => Math.hypot(q.x - k.p.x, q.z - k.p.z) < 10)) continue;
    picked.push(k.p);
  }
  const stone = new THREE.MeshStandardMaterial({color: 0xf0e7d2, roughness: .94});
  const domeMat = new THREE.MeshStandardMaterial({color: 0xdcc596, roughness: .9});
  const root = new THREE.Group(); root.name = 'holy-old-town-roof-domes'; castle.add(root);
  const add = (g, m, n, x, y, z) => { const o = new THREE.Mesh(g, m); o.name = n; o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; root.add(o); return o; };
  picked.forEach((p, i) => {
    const r = i < 2 ? 1.6 : 1.1, y = p.y;
    add(new THREE.CylinderGeometry(r * 1.15, r * 1.2, .35, 16), stone, 'old-town-roof-dome-base', p.x, y + .17, p.z);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; add(new THREE.CylinderGeometry(.09, .11, r * 1.1, 8), stone, 'old-town-roof-dome-column', p.x + Math.cos(a) * r * .9, y + .35 + r * .55, p.z + Math.sin(a) * r * .9); }
    add(new THREE.CylinderGeometry(r * 1.05, r * 1.05, .22, 16), stone, 'old-town-roof-dome-cornice', p.x, y + .35 + r * 1.1 + .11, p.z);
    const d = add(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, 'old-town-roof-dome', p.x, y + .35 + r * 1.1 + .22, p.z); d.scale.y = 1.05;
    add(new THREE.ConeGeometry(.07, r * .5, 8), domeMat, 'old-town-roof-dome-finial', p.x, y + .35 + r * 1.1 + .22 + r * 1.05 + r * .22, p.z);
  });
  return {domes: picked.length, at: picked.map(p => p.toArray().map(v => Math.round(v)))};
}
