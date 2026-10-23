import * as THREE from 'three';
import {createSwampCliffSampler} from './swampNaturalCliff.js';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';
import {installSwampMonkeyRepair} from './swampMonkeyRepair.js';

// 湖沼目标图（2026-10-11 定稿）左下角：木栈桥伸进水里 + 带帆木船靠码头 + 船上紫灰猴，
// 以及画面四周被深青绿大叶包住。居住逻辑（Vito Salamone 式）：只把已有的修船故事
// "露出来、补完整"，不搬船、不改剧情时间线。
//
// 1) 正式页 pruneTaggedOfficialOceanOccludeds() 按"低于海壳半径"把两艘战船从场景树摘掉了，
//    但湖沼坑上方的海面已被 clearSwampCavity 清空，战船其实在画面里——这里把它们挂回 inner，
//    并撤掉可剪除标记（不改 moebiusSwamp.js）。
// 2) 修船 A 的备用桅（mastPivot）挂一面三角纵帆：桅杆放平时收拢，竖起后升帆（随原 16s 换桅循环）。
// 3) 码头：从原岸边工作台（greg-shore-dock）沿岸接一段栈道，再沿船 A 面向对照机位的一舷
//    伸出一条带桩柱的指状栈桥，两根缆绳系到船舷。装饰件，不声明可走（不接主步道）。
// 4) 坑缘一圈补大叶（monstera 宽叶丛 + 芭蕉桨叶），只填原 understory 留下的空档，
//    同样走 inspectPlant 避让 + 坑缘步道带 r∈(35.4,39.4) 全顶点排除 + 对照机位中心排除。
// 所有坐标为 inner-local（1 单位 = 世界 .5）。?swampHarbor=0 关闭。

const widthWorld = (inner,width) => inner.getWorldScale(new THREE.Vector3()).x * width;
const WATER_Y = 25, DECK_Y = 26.34;
const WOOD = new THREE.Color(0xb58a66), WOOD_DARK = new THREE.Color(0x806451), WOOD_LIGHT = new THREE.Color(0xc99f78);
const LEAF_DARK = new THREE.Color(0x1f5c58), LEAF_MID = new THREE.Color(0x2f7f6c), LEAF_LIGHT = new THREE.Color(0x4f9f82);
// 对照机位（overview.js：az=1.1 pitch=.62 dist=66 看 (0,26,0) fov40 1.6:1）——补叶不得进入其中心区。
export const HARBOR_OVERVIEW = {az: 1.1, pitch: .62, dist: 66, target: [0, 26, 0], fov: 40, aspect: 1.6, centre: {x0: .2, x1: .8, y0: .14, y1: .7}};
const RIBBON = [35.4, 39.4]; // 坑缘巡游/玩家步道带（与 swampCoralUnderstory 同一口径）
const ENTRANCE = [0.12, 0.9]; // 入口石阶 + 虎饮水路线（entranceAngle .5）

export function overviewCamera() {
  const {az, pitch, dist, target, fov, aspect} = HARBOR_OVERVIEW;
  const cam = new THREE.PerspectiveCamera(fov, aspect, .3, 1000);
  cam.position.set(target[0] + Math.cos(az) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.sin(az) * Math.cos(pitch) * dist);
  cam.lookAt(...target); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  return cam;
}

/* ---------------- geometry helpers ---------------- */
function Builder() {
  const pos = [], col = [];
  return {
    pos, col,
    box(centre, size, yaw, color, pitch = 0) {
      const g = new THREE.BoxGeometry(...size).toNonIndexed();
      const m = new THREE.Matrix4().compose(centre, new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m); const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); const shade = .86 + .14 * Math.max(0, n.getY(i)) + .05 * n.getX(i); col.push(color.r * shade, color.g * shade, color.b * shade); }
      g.dispose();
    },
    cyl(a, b, radius, color, seg = 6) {
      const d = b.clone().sub(a), len = d.length(); if (len < 1e-4) return;
      const g = new THREE.CylinderGeometry(radius * .88, radius, len, seg).toNonIndexed();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), q, new THREE.Vector3(1, 1, 1)));
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); const shade = .82 + .18 * Math.max(0, n.getX(i) * .6 + n.getY(i) * .4 + .4); col.push(color.r * shade, color.g * shade, color.b * shade); }
      g.dispose();
    },
    mesh(name, material) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, material); m.name = name; return m;
    },
  };
}

// Broad split-leaf clump (monstera) or tall paddle clump (banana). Leaves fan
// toward local +z, so yaw decides which way the clump leans (in to the lake or out).
function leafClumpTemplate(kind) {
  const pos = [], col = [], uv = [];
  const leaves = kind === 'banana' ? 5 : 7, steps = kind === 'banana' ? 9 : 8;
  const push = (v, c, u, w) => { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); uv.push(u, w); };
  for (let f = 0; f < leaves; f++) {
    const s = f / (leaves - 1) - .5, a = s * (kind === 'banana' ? 1.9 : 2.5) + .13 * Math.sin(f * 2.3);
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const reach = kind === 'banana' ? .45 + .25 * (.5 + .5 * Math.cos(f * 1.7)) : .82 + .26 * (.5 + .5 * Math.sin(f * 2.1 + .4));
    const rise = kind === 'banana' ? 1.05 + .45 * (.5 + .5 * Math.sin(f * 1.3 + 1)) : .5 + .22 * (.5 + .5 * Math.cos(f * 1.9));
    const width = kind === 'banana' ? .2 : .36;
    const tint = f % 2 ? LEAF_MID : LEAF_DARK;
    // stem
    const stemTop = dir.clone().multiplyScalar(reach * .32).setY(rise * .78);
    const sw = .025;
    for (const [p0, p1] of [[new THREE.Vector3(), stemTop]]) {
      const o = side.clone().multiplyScalar(sw);
      push(p0.clone().sub(o), LEAF_DARK, 0, .5); push(p1.clone().sub(o), LEAF_DARK, 0, .5); push(p0.clone().add(o), LEAF_DARK, 0, .5);
      push(p0.clone().add(o), LEAF_DARK, 0, .5); push(p1.clone().sub(o), LEAF_DARK, 0, .5); push(p1.clone().add(o), LEAF_DARK, 0, .5);
    }
    const blade = t => {
      const out = reach * (.32 + .68 * t), y = rise * (.78 + .22 * Math.sin(Math.PI * t * .9)) - (kind === 'banana' ? .32 : .42) * t * t;
      return dir.clone().multiplyScalar(out).setY(kind === 'banana' ? rise * (.78 + .4 * t) - .5 * t * t * t : y);
    };
    const halfWidth = t => {
      const body = Math.pow(Math.sin(Math.PI * Math.min(1, t * (kind === 'banana' ? 1 : 1.08))), kind === 'banana' ? .45 : .62);
      const split = kind === 'banana' ? 1 : 1 - .32 * (Math.abs(Math.sin(t * Math.PI * 4.5 + f)) > .82 ? 1 : 0); // monstera notches
      return width * body * split;
    };
    for (let j = 0; j < steps; j++) {
      const t0 = j / steps, t1 = (j + 1) / steps, c0 = blade(t0), c1 = blade(t1), w0 = halfWidth(t0), w1 = halfWidth(t1);
      const droop = s => new THREE.Vector3(0, -.08 * s * s, 0);
      for (const sgn of [-1, 1]) {
        const e0 = c0.clone().addScaledVector(side, sgn * w0).add(droop(w0 / width)), e1 = c1.clone().addScaledVector(side, sgn * w1).add(droop(w1 / width));
        const edge = sgn < 0 ? LEAF_LIGHT : tint, mid = LEAF_DARK;
        push(c0, mid, t0, .5); push(c1, mid, t1, .5); push(e0, edge, t0, sgn < 0 ? 0 : 1);
        push(e0, edge, t0, sgn < 0 ? 0 : 1); push(c1, mid, t1, .5); push(e1, edge, t1, sgn < 0 ? 0 : 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

/* ---------------- 1) restore pruned warships ---------------- */
function restoreWarships(inner, yard, departureMode) {
  const restored = [];
  const B = yard?.departure;
  if (B && departureMode !== 'original') {
    // Round 2 (lead review): the 26-oar departure galley reads as an orange-red box
    // in the middle of the overview (seen almost bow-on, coral palette, 98k tris).
    // Keep its voyage/escort logic running but out of the render tree; a small wooden
    // longboat on the far shore carries the "boat out on the lake" beat instead.
    B.userData.officialOceanOcclusionCandidate = false;
    B.userData.officialOceanOccluded = false; // moebiusSwamp skips the whole shipyard while this is true
    B.removeFromParent(); B.userData.harborHidden = true;
  }
  for (const ship of [yard?.dock, departureMode === 'original' ? B : null]) {
    if (!ship) continue;
    ship.userData.officialOceanOcclusionCandidate = false; // a later prune pass must not re-detach it
    if (!ship.parent || ship.userData.officialOceanOccluded) {
      inner.add(ship); ship.visible = true; ship.userData.officialOceanOccluded = false;
      ship.userData.harborRestored = true; restored.push(ship.name);
    }
  }
  return restored;
}

/* ---------------- 2) sail on the spare mast ---------------- */
function installSpareSail(yard) {
  const pivot = yard?.mastPivot; if (!pivot) return null;
  // Fore-aft triangle on the -x (aft) side of the spare mast, +z belly; clear of the
  // top worker (x>0), the hoist rope grip (0,2.75,0) and the tripod legs (z<=0).
  const luffX = -.12, foot = 1.18, head = 3.22, clewX = -1.72, rows = 6, cols = 5, pos = [], col = [];
  const cloth = new THREE.Color(0xeee6cf), seam = new THREE.Color(0xd9ccb0);
  const P = (u, v) => { // u: luff→leech (0..1), v: foot→head (0..1)
    const y = foot + (head - foot) * v, leech = luffX + (clewX - luffX) * (1 - v);
    const x = luffX + (leech - luffX) * u;
    return new THREE.Vector3(x, y, .05 + .22 * Math.sin(Math.PI * u) * (1 - v * .7));
  };
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const a = P(i / cols, j / rows), b = P((i + 1) / cols, j / rows), c = P(i / cols, (j + 1) / rows), d = P((i + 1) / cols, (j + 1) / rows);
    const tint = j % 2 ? seam : cloth;
    for (const v of [a, b, c, c, b, d]) { pos.push(v.x, v.y, v.z); col.push(tint.r, tint.g, tint.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  const sail = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.DoubleSide}));
  sail.name = 'swamp-harbor-spare-sail';
  const edge = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([P(0, 0), P(1, 0), P(1, 0), P(0, 1), P(0, 1), P(0, 0)]), new THREE.LineBasicMaterial({color: 0x66504b, transparent: true, opacity: .7}));
  edge.name = 'swamp-harbor-spare-sail-edge'; sail.add(edge);
  // Scale toward the luff (x = luffX) so the furled sail hugs the mast.
  const holder = new THREE.Group(); holder.name = 'swamp-harbor-spare-sail-furl'; holder.position.x = luffX; sail.position.x = -luffX; holder.add(sail); pivot.add(holder);
  const report = {sail, holder, set: 0};
  report.update = t => {
    const liftK = THREE.MathUtils.clamp(1 - pivot.rotation.z / (Math.PI / 2), 0, 1);
    const k = THREE.MathUtils.smoothstep(liftK, .55, .98);
    report.set = k;
    holder.scale.set(.06 + .94 * k, .35 + .65 * k, 1);
    holder.position.y = foot * (1 - (.35 + .65 * k)) * 0; // furl stays seated on its foot
    sail.rotation.y = .05 * Math.sin(t * 1.3) * k; // a light breathing of the cloth
  };
  report.update(0);
  return report;
}

/* ---------------- 3) pier ---------------- */
function installPier(inner, yard, dockReport) {
  const ship = yard?.dock; if (!ship || !dockReport?.ok) return null;
  const wallAt = createSwampCliffSampler(inner), rockAt = createSwampCliffSampler(inner, inner.getObjectByName('greg-natural-cliff-rock'));
  const shoreR = a => { let r = Infinity; for (const y of [DECK_Y]) for (const s of [wallAt, rockAt]) { const h = s?.(a, y); if (h) r = Math.min(r, Math.hypot(h.x, h.z)); } return r; };
  const yaw = ship.rotation.y, axis = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), side = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  // Pick the ship side that faces the overview camera (+side for the shipped berth).
  const cam = overviewCamera().position, toCam = cam.clone().sub(ship.position).setY(0);
  const s = Math.sign(toCam.dot(side)) || 1, camSide = side.clone().multiplyScalar(s);
  const half = ship.scale.x, beam = 2.36 * ship.scale.z; // measured ship-local half beam incl. oars
  const offset = beam + 1.35, width = 4.2; // 2.1 world metres at the formal .5 scale
  const base = ship.position.clone().setY(DECK_Y);
  const fingerA = base.clone().addScaledVector(camSide, offset).addScaledVector(axis, -2.85 * half - .2); // shore end, level with the stern
  const fingerB = base.clone().addScaledVector(camSide, offset).addScaledVector(axis, .2 * half); // lake end, just past amidships (the departing ship's loop starts beyond)
  const deckCentre = new THREE.Vector3(...dockReport.deckCentre); deckCentre.y = DECK_Y;
  const pier = Builder(), piles = Builder(), segments = [], posts = [], footings = [];
  const supportMeshes = [inner.getObjectByName('swamp-lake-floor'), inner.getObjectByName('swamp-sinkhole-wall')].filter(Boolean);
  const supportRay = new THREE.Raycaster();
  inner.updateWorldMatrix(true, true);
  const down = new THREE.Vector3(0,-1,0).transformDirection(inner.matrixWorld);
  function support(p) {
    const origin = new THREE.Vector3(p.x, DECK_Y-.2, p.z);
    supportRay.set(inner.localToWorld(origin), down);supportRay.far=100;
    const h=supportRay.intersectObjects(supportMeshes,false)[0];
    return h ? inner.worldToLocal(h.point.clone()) : null;
  }
  function walk(A, B, w, name) {
    const d = B.clone().sub(A).setY(0), len = d.length(), dir = d.clone().normalize(), across = new THREE.Vector3(-dir.z, 0, dir.x), yawSeg = Math.atan2(dir.x, dir.z);
    // planks across the walk with small gaps; two stringers below
    const n = Math.max(2, Math.round(len / .46));
    for (let i = 0; i < n; i++) {
      const c = A.clone().addScaledVector(dir, (i + .5) * len / n); c.y = DECK_Y - .09;
      const tone = i % 3 === 0 ? WOOD_LIGHT : i % 3 === 1 ? WOOD : WOOD_DARK.clone().lerp(WOOD, .55);
      pier.box(c, [w + .08 * Math.sin(i * 2.7), .18, len / n - .07], yawSeg, tone);
    }
    for (const k of [-.36, .36]) { const c = A.clone().add(B).multiplyScalar(.5).addScaledVector(across, k * w); c.y = DECK_Y - .28; piles.box(c, [.16, .2, len], yawSeg, WOOD_DARK); }
    // posts every ~1.7 along both edges: piles into the water, railing knobs above deck
    const m = Math.max(1, Math.round(len / 1.7));
    for (let i = 0; i <= m; i++) for (const k of [-1, 1]) {
      const p = A.clone().addScaledVector(dir, i * len / m).addScaledVector(across, k * (w / 2 + .06));
      const tall = (i % 2 === 0) ? .78 : .5;
      const foot = support(p);
      if(foot) {const embedded=foot.clone();embedded.y-=.2;piles.cyl(embedded,new THREE.Vector3(p.x,DECK_Y+tall,p.z),.13,WOOD_DARK,7);footings.push({top:[p.x,DECK_Y+tall,p.z],foot:foot.toArray(),embedded:.2});}
      posts.push([p.x, DECK_Y + tall, p.z]);
    }
    segments.push({name, from: A.toArray(), to: B.toArray(), width: w, length: len});
  }
  // Follow the actual cliff face rather than extending a finger into open lake.
  // The original stern-quarter gangway still boards the same repair ship.
  const shoreAngle = Math.atan2(dockReport.shore[2], dockReport.shore[0]);
  const lowShip=[];inner.updateWorldMatrix(true,true);
  const inv=inner.matrixWorld.clone().invert();
  ship.traverse(o=>{if(!o.isMesh||o.userData.isOutline||!o.geometry?.attributes.position)return;let visible=true;for(let p=o;p&&p!==ship;p=p.parent)if(!p.visible)visible=false;if(!visible)return;
    const m=inv.clone().multiply(o.matrixWorld),p=o.geometry.attributes.position;
    for(let k=0;k<p.count;k+=3){const v=new THREE.Vector3().fromBufferAttribute(p,k).applyMatrix4(m);if(v.y<27.2)lowShip.push(v);}
  });
  const dist=(p,A,B)=>{const d=B.clone().sub(A).setY(0),t=THREE.MathUtils.clamp(p.clone().sub(A).setY(0).dot(d)/d.lengthSq(),0,1);return Math.hypot(p.x-A.x-t*d.x,p.z-A.z-t*d.z)-width/2;};
  let cliffPoints=[],shipClearance=-Infinity,bestCombined=-Infinity;
  const navigation=inner.userData.flowerBoyActivities?.navigation?.records||[];
  // The widened two-metre quay uses the adjacent cliff bay, never the ship's
  // original oar corridor. Search actual transformed hull/crew/oar vertices.
  for(const shift of [0,.22,-.22,.4,-.4,.58,-.58,.76,-.76]){
    const candidate=[];
    for(let i=0;i<=8;i++){const a=shoreAngle+shift-.18+i*.36/8,radius=shoreR(a);if(!Number.isFinite(radius))continue;
      candidate.push(new THREE.Vector3(Math.cos(a)*(radius-width/2-.18),DECK_Y,Math.sin(a)*(radius-width/2-.18)));}
    if(candidate.length!==9)continue;
    let clearance=Infinity;for(let j=1;j<candidate.length;j++)for(const p of lowShip)clearance=Math.min(clearance,dist(p,candidate[j-1],candidate[j]));
    const nearest=candidate.reduce((best,p)=>p.distanceToSquared(deckCentre)<best.distanceToSquared(deckCentre)?p:best);
    const conn=deckCentre.clone().addScaledVector(deckCentre.clone().setY(0).normalize(),-.20);
    let boatGap=Infinity;
    for(const r of navigation){const p=new THREE.Vector3(r.x,DECK_Y,r.z);for(let j=1;j<candidate.length;j++)boatGap=Math.min(boatGap,dist(p,candidate[j-1],candidate[j])-r.radius-.71);boatGap=Math.min(boatGap,dist(p,conn,nearest)-r.radius-.71);}
    const combined=Math.min(clearance,boatGap);
    if(combined>bestCombined){cliffPoints=candidate;shipClearance=clearance;bestCombined=combined;}
    if(combined>.30)break;
  }
  for (let i = 1; i < cliffPoints.length; i++) walk(cliffPoints[i - 1], cliffPoints[i], width, 'cliff-work-quay');
  if (cliffPoints.length) {
    const nearest = cliffPoints.reduce((best, p) => p.distanceToSquared(deckCentre) < best.distanceToSquared(deckCentre) ? p : best);
    const connectorStart=deckCentre.clone().addScaledVector(deckCentre.clone().setY(0).normalize(),-.20);
    walk(connectorStart, nearest, width, 'shore-work-connector');
    fingerA.copy(cliffPoints[0]); fingerB.copy(cliffPoints[cliffPoints.length - 1]);
  }
  // shore clearance audit
  let minShoreGap = Infinity;
  for (const seg of segments) { const A = new THREE.Vector3(...seg.from), B = new THREE.Vector3(...seg.to); for (let i = 0; i <= 20; i++) { const p = A.clone().lerp(B, i / 20), a = Math.atan2(p.z, p.x); minShoreGap = Math.min(minShoreGap, shoreR(a) - Math.hypot(p.x, p.z) - seg.width / 2); } }
  const deck = pier.mesh('swamp-harbor-pier-deck', new THREE.MeshBasicMaterial({vertexColors: true}));
  const struct = piles.mesh('swamp-harbor-pier-piles', new THREE.MeshBasicMaterial({vertexColors: true}));
  for (const m of [deck, struct]) { m.userData.gregWalkable = m === deck; m.userData.harborDecor = true; inner.add(m); }
  // Mooring lines: two finger posts → ship gunwale cleats on the same side.
  ship.updateWorldMatrix(true, false); inner.updateWorldMatrix(true, false);
  const toInner = inner.matrixWorld.clone().invert().multiply(ship.matrixWorld);
  const linePts = [];
  for (const [lx, post] of [[-2.1, .14], [.6, .9]]) {
    const cleat = new THREE.Vector3(lx, .95, s * .92).applyMatrix4(toInner);
    const p = fingerA.clone().lerp(fingerB, post).addScaledVector(camSide, -width / 2 - .06); p.y = DECK_Y + .7;
    const mid = p.clone().lerp(cleat, .5); mid.y -= .35;
    linePts.push(p, mid, mid, cleat);
  }
  const ropes = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({color: 0x5b4a3c}));
  ropes.name = 'swamp-harbor-mooring-lines'; inner.add(ropes);
  return {meshes: [deck, struct], walkMeshes:[deck], shipClearance, footings, ropes, segments, posts: posts.length, side: s, offset, minShoreGap,
    triangles: (deck.geometry.attributes.position.count + struct.geometry.attributes.position.count) / 3};
}

/* ---------------- 4) rim big leaves ---------------- */
function installRimLeaves(inner) {
  const rim = inner.userData.gregCoralRim?.walkMeshes?.[0], constraints = createSwampLivingPathConstraints(inner), wallAt = createSwampCliffSampler(inner);
  if (!rim || !constraints || !wallAt) return {ok: false, reason: 'rim walk mesh, living-path constraints and cliff sampler required', count: 0};
  inner.updateWorldMatrix(true, true);
  const existing = (inner.userData.gregUnderstory?.records || []).filter(r => r.source === 'rim').map(r => ({a: Math.atan2(r.position[2], r.position[0]), outer: r.rimSide === 'outer'}));
  const flowers = (inner.userData.giantFlowers || []).map(f => inner.worldToLocal(f.getWorldPosition(new THREE.Vector3())));
  const templates = {monstera: leafClumpTemplate('monstera'), banana: leafClumpTemplate('banana')};
  const cam = overviewCamera(), C = HARBOR_OVERVIEW.centre;
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0).transformDirection(inner.matrixWorld);
  const records = {monstera: [], banana: []}, rejected = {};
  const reject = r => { rejected[r] = (rejected[r] || 0) + 1; };
  const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const v = new THREE.Vector3();
  function tryPlant(kind, a, rimSide, scale, heightRatio, index) {
    const edge = wallAt(a, 39.9999); if (!edge) return reject('no-wall-edge');
    const r = rimSide === 'inner' ? Math.hypot(edge.x, edge.z) + .12 + .22 * (.5 + .5 * Math.sin(index * 1.7)) : RIBBON[1] + .35 + .5 * (.5 + .5 * Math.cos(index * 2.1));
    const point = new THREE.Vector3(Math.cos(a) * r, 42, Math.sin(a) * r);
    ray.set(inner.localToWorld(point.clone()), down); ray.far = 4;
    const hit = ray.intersectObject(rim, false)[0]; if (!hit) return reject('no-rim-support');
    point.copy(inner.worldToLocal(hit.point.clone())); point.y += .02;
    const yaw = rimSide === 'inner' ? Math.atan2(-Math.cos(a), -Math.sin(a)) + .25 * Math.sin(index * 2.399) : Math.atan2(Math.cos(a), Math.sin(a)) + .3 * Math.sin(index * 1.3);
    for (const shrink of [1, .8, .64]) {
      const sc = scale * shrink, m = new THREE.Matrix4().compose(point, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(sc, sc * heightRatio, sc));
      const p = templates[kind].attributes.position; let minY = Infinity, maxY = -Infinity, rad = 0, ribbon = false, centre = false;
      for (let i = 0; i < p.count; i += 2) {
        v.fromBufferAttribute(p, i).applyMatrix4(m);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); rad = Math.max(rad, Math.hypot(v.x - point.x, v.z - point.z));
        const rr = Math.hypot(v.x, v.z); if (rr > RIBBON[0] && rr < RIBBON[1]) { ribbon = true; break; }
        const q = v.clone().project(cam), sx = (q.x + 1) / 2, sy = (1 - q.y) / 2;
        if (q.z < 1 && sx > C.x0 && sx < C.x1 && sy > C.y0 && sy < C.y1) { centre = true; break; }
      }
      if (ribbon) { reject('rim-walking-ribbon'); continue; }
      if (centre) { reject('overview-centre'); continue; }
      const clearance = constraints.inspectPlant({position: [point.x, minY - .015, point.z], radius: rad + .02, height: maxY - minY + .03});
      if (!clearance.allowed) { reject('protected:' + clearance.reasons.join('+')); continue; }
      if (flowers.some(f => Math.hypot(f.x - point.x, f.z - point.z) < 2.2 + rad * .5 && f.y < maxY + 6)) { reject('giant-flower'); continue; }
      records[kind].push({matrix: m, position: point.toArray(), angle: a, rimSide, scale: sc, kind});
      return true;
    }
    return false;
  }
  // Fill only the angular gaps the existing understory left, at a regular-but-jittered pitch.
  let index = 0;
  for (const rimSide of ['inner', 'outer']) {
    const step = rimSide === 'inner' ? .085 : .11, gap = rimSide === 'inner' ? .1 : .12;
    for (let a0 = 0; a0 < Math.PI * 2; a0 += step) {
      const a = a0 + .025 * Math.sin(index * 3.1);
      index++;
      const norm = (a + Math.PI * 2) % (Math.PI * 2);
      if (norm > ENTRANCE[0] && norm < ENTRANCE[1]) { reject('entrance'); continue; }
      if (existing.some(e => e.outer === (rimSide === 'outer') && angDist(e.a, a) < gap)) { reject('existing-understory'); continue; }
      if ([...records.monstera, ...records.banana].some(r => r.rimSide === rimSide && angDist(r.angle, a) < step * .6)) { reject('spacing'); continue; }
      const banana = index % 4 === 0;
      const scale = banana ? 1.9 + .7 * (.5 + .5 * Math.sin(index * 1.37)) : 1.9 + 1.0 * (.5 + .5 * Math.sin(index * 2.11));
      // Bowed roots and stair boxes own their space: slide along the lip before giving up.
      for (const shift of [0, .035, -.035, .07, -.07]) {
        if (existing.some(e => e.outer === (rimSide === 'outer') && angDist(e.a, a + shift) < gap)) continue;
        if (tryPlant(banana ? 'banana' : 'monstera', a + shift, rimSide, scale, banana ? 1.25 + .25 * Math.sin(index) : .9 + .2 * Math.cos(index * 1.9), index)) break;
      }
    }
  }
  const material = new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.DoubleSide, toneMapped: false});
  const meshes = [];
  for (const kind of ['monstera', 'banana']) {
    const list = records[kind]; if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(templates[kind], material, list.length);
    mesh.name = `swamp-harbor-rim-${kind}-leaves`; mesh.userData.gregVisualRole = 'foliage';
    list.forEach((r, i) => { mesh.setMatrixAt(i, r.matrix); const t = .86 + .22 * (.5 + .5 * Math.sin(i * 2.399)); mesh.setColorAt(i, new THREE.Color().setRGB(t, t * 1.02, t)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox?.(); mesh.computeBoundingSphere?.();
    inner.add(mesh); meshes.push(mesh);
  }
  const all = [...records.monstera, ...records.banana];
  return {ok: true, templates, material, meshes, records: all, count: all.length, counts: {monstera: records.monstera.length, banana: records.banana.length, inner: all.filter(r => r.rimSide === 'inner').length, outer: all.filter(r => r.rimSide === 'outer').length}, rejected,
    triangles: Object.entries(records).reduce((s, [k, l]) => s + l.length * templates[k].attributes.position.count / 3, 0)};
}

/* ---------------- round 2: larger repair monkeys ---------------- */
// Uniform scale about each worker's own foot origin: feet stay on the deck / mast
// perch, tails stay above the foot plane, and the live hoist rope + mallet reach
// (swampFlowerActivities.installRepairWork) already read arm tips and top.scale.
function enlargeWorkers(yard, factor) {
  const [lift, top] = yard?.workers || []; if (!lift || !top || factor === 1) return null;
  const before = {lift: lift.scale.x, top: top.scale.x, topX: top.position.x};
  lift.scale.setScalar(before.lift * factor);
  top.scale.setScalar(before.top * factor);
  // Body half-width grows with scale; slide the mast-top worker out so it grips, not swallows, the mast.
  top.position.x = before.topX + .18 * before.top * (factor - 1);
  return {factor, before, after: {lift: lift.scale.x, top: top.scale.x, topX: top.position.x}};
}

/* ---------------- round 2: far-shore wooden longboat ---------------- */
// a/r chosen by sweep (a 4.2–5.9, r 12–22): the far-shore slot that is both clear of the lotus
// boats (+their reserved radii), both whales, the world-tree trunk and the bank walkway, AND
// not hidden from the overview camera. a≈4.5 (the target's top-centre spot) is either inside
// lotus 2/3 clearance or behind the walkway that descends to the water there.
const FAR_BOAT = {angle: 5.52, radius: 21.2, length: 4.4, beam: 1.1, drift: .3, period: 26, oarReach: .7};
function buildLongboat() {
  const g = new THREE.Group(); g.name = 'swamp-harbor-far-longboat';
  const L = FAR_BOAT.length, B = FAR_BOAT.beam, N = 14, pos = [], col = [];
  const outer = new THREE.Color(0x7a5236), band = new THREE.Color(0xa9784f), innerC = new THREE.Color(0x5a3d2a);
  const section = x => { const u = 2 * x / L, w = B / 2 * Math.pow(Math.max(0, 1 - u * u), .55), sheer = .5 + .38 * u ** 4, keel = -.32 * (1 - u * u);
    return [[-w, sheer], [-w * .86, sheer * .45], [-w * .5, keel * .7], [0, keel], [w * .5, keel * .7], [w * .86, sheer * .45], [w, sheer]]; };
  const quad = (a, b, c, d, color) => { for (const v of [a, b, c, c, b, d]) { pos.push(...v); col.push(color.r, color.g, color.b); } };
  for (let i = 0; i < N; i++) {
    const x0 = -L / 2 + L * i / N, x1 = -L / 2 + L * (i + 1) / N, s0 = section(x0), s1 = section(x1);
    for (let k = 0; k < s0.length - 1; k++) {
      const c = (k === 0 || k === s0.length - 2) ? band : outer;
      quad([x0, s0[k][1], s0[k][0]], [x1, s1[k][1], s1[k][0]], [x0, s0[k + 1][1], s0[k + 1][0]], [x1, s1[k + 1][1], s1[k + 1][0]], c);
    }
  }
  const hullGeo = new THREE.BufferGeometry(); hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hullGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.DoubleSide})); hull.name = 'swamp-harbor-far-longboat-hull'; g.add(hull);
  const wood = new THREE.MeshBasicMaterial({color: 0x6a4630}), cloth = new THREE.MeshBasicMaterial({color: 0xeee6cf, side: THREE.DoubleSide});
  // thwarts, raised stem/stern posts, short mast with a small square sail
  for (const x of [-1.2, -.4, .4, 1.2]) { const t = new THREE.Mesh(new THREE.BoxGeometry(.14, .07, B * .82), new THREE.MeshBasicMaterial({color: 0x8c6242})); t.position.set(x, .32, 0); g.add(t); }
  for (const sgn of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, .8, 6), wood); post.position.set(sgn * (L / 2 - .05), .78, 0); post.rotation.z = -sgn * .45; g.add(post); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.04, .055, 2.2, 6), wood); mast.position.set(.3, 1.3, 0); g.add(mast);
  const yardArm = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.5, 5), wood); yardArm.rotation.z = Math.PI / 2; yardArm.position.set(.3, 2.25, 0); g.add(yardArm);
  const sailGeo = new THREE.PlaneGeometry(1.3, 1.2, 3, 3); const sp = sailGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, .12 * Math.cos(sp.getX(i) / .65 * Math.PI / 2) * (1 - (sp.getY(i) + .6) / 1.2 * .5));
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, cloth); sail.name = 'swamp-harbor-far-longboat-sail'; sail.position.set(.3, 1.6, .06); g.add(sail);
  // four oars a side; pivot at the gunwale, blade in the water
  const oars = [];
  const R = FAR_BOAT.oarReach, drop = .55, oarLen = Math.hypot(R, drop);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group(); pivot.position.set(-1.0 + i * 1.0, .48, side * B / 2);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, oarLen, 5), new THREE.MeshBasicMaterial({color: 0x9a7350}));
    shaft.rotation.x = side * Math.atan2(R, drop); shaft.position.set(0, -drop / 2, side * R / 2); pivot.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, .26), new THREE.MeshBasicMaterial({color: 0x9a7350})); blade.position.set(0, -drop, side * (R - .1)); pivot.add(blade);
    pivot.userData.side = side; g.add(pivot); oars.push(pivot);
  }
  g.userData.oars = oars; return g;
}
function installFarLongboat(inner) {
  const boat = buildLongboat(), {angle, radius} = FAR_BOAT;
  const centre = new THREE.Vector3(Math.cos(angle) * radius, WATER_Y, Math.sin(angle) * radius);
  const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
  boat.rotation.y = Math.atan2(-tangent.z, tangent.x); // local +x along the shore
  inner.add(boat);
  const state = {boat, centre, tangent, speed: 0};
  state.update = t => {
    const ph = t / FAR_BOAT.period * Math.PI * 2, s = Math.sin(ph) * FAR_BOAT.drift;
    state.speed = Math.cos(ph);
    boat.position.copy(centre).addScaledVector(tangent, s); boat.position.y = WATER_Y + .02 + .05 * Math.sin(t * 1.1);
    boat.rotation.z = .015 * Math.sin(t * .8);
    const dir = Math.sign(state.speed) || 1, stroke = t * 2.4;
    for (const o of boat.userData.oars) { o.rotation.y = o.userData.side * dir * .35 * Math.sin(stroke) * Math.min(1, Math.abs(state.speed) * 2); o.rotation.x = o.userData.side * .12 * Math.max(0, Math.cos(stroke)); }
  };
  state.update(0);
  return state;
}

/* ---------------- round 2: near-camera foreground leaves ---------------- */
// The rim top facing the overview camera (a≈0.9–2.0) still read bare. Plant tall
// clumps outside the walking ribbon and size each one by projection, so its crown
// reaches up into the bottom ~15–22% of the overview frame and never above 70%.
function installForegroundLeaves(inner, leafPass) {
  const rim = inner.userData.gregCoralRim?.walkMeshes?.[0], constraints = createSwampLivingPathConstraints(inner);
  if (!rim || !constraints || !leafPass?.templates) return {ok: false, count: 0, records: []};
  const cam = overviewCamera(), ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0).transformDirection(inner.matrixWorld), v = new THREE.Vector3();
  const flowers = (inner.userData.giantFlowers || []).map(f => inner.worldToLocal(f.getWorldPosition(new THREE.Vector3())));
  const records = {monstera: [], banana: []}, rejected = {}; const reject = r => { rejected[r] = (rejected[r] || 0) + 1; };
  let index = 0;
  for (let a = .93; a <= 2.05; a += .055) for (const r0 of [40.1, 41.9, 43.6]) {
    index++;
    const kind = index % 3 === 0 ? 'banana' : 'monstera', tpl = leafPass.templates[kind];
    const aj = a + .018 * Math.sin(index * 2.7), r = r0 + .4 * Math.sin(index * 1.9);
    const point = new THREE.Vector3(Math.cos(aj) * r, 44, Math.sin(aj) * r);
    ray.set(inner.localToWorld(point.clone()), down); ray.far = 8;
    const hit = ray.intersectObject(rim, false)[0]; if (!hit) { reject('no-rim-support'); continue; }
    point.copy(inner.worldToLocal(hit.point.clone())); point.y += .02;
    // Crown fans outward (toward the overview camera) so no blade reaches back over the ribbon.
    const yaw = Math.atan2(Math.cos(aj), Math.sin(aj)) + .5 * Math.sin(index * 2.399);
    const goal = .76 + .07 * (.5 + .5 * Math.sin(index * 1.37)) + (r0 > 43 ? .05 : r0 > 41 ? .025 : 0); // target top in frame (fraction of height)
    const hr = kind === 'banana' ? 1.5 : 1.05;
    let placed = false;
    for (let sc = 6.5; sc >= 1.6; sc *= .9) {
      const m = new THREE.Matrix4().compose(point, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(sc, sc * hr, sc));
      const p = tpl.attributes.position; let top = 1, bad = null, minY = Infinity, maxY = -Infinity, rad = 0;
      for (let i = 0; i < p.count; i += 2) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); const rr = Math.hypot(v.x, v.z);
        if (rr > RIBBON[0] && rr < RIBBON[1]) { bad = 'rim-walking-ribbon'; break; }
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); rad = Math.max(rad, Math.hypot(v.x - point.x, v.z - point.z));
        const q = v.clone().project(cam); if (q.z < 1) top = Math.min(top, (1 - q.y) / 2);
      }
      if (bad) { reject(bad); continue; }
      if (top < goal) continue; // still too tall for the frame: shrink
      if (top > .995) { reject('below-frame'); break; }
      const clearance = constraints.inspectPlant({position: [point.x, minY - .015, point.z], radius: rad + .02, height: maxY - minY + .03});
      if (!clearance.allowed) { reject('protected:' + clearance.reasons.join('+')); continue; }
      if (flowers.some(f => Math.hypot(f.x - point.x, f.z - point.z) < 2.2 + rad * .5)) { reject('giant-flower'); break; }
      records[kind].push({matrix: m, position: point.toArray(), angle: aj, rimSide: 'outer-foreground', scale: sc, kind, frameTop: +top.toFixed(3)}); placed = true; break;
    }
    if (!placed) reject('unplaced');
  }
  // User direction: retain the accepted giant blades and lift their crowns
  // above the normal shore camera. Continuous petioles connect every old root
  // to the lifted crown; small original understory remains unchanged.
  const stems = Builder();
  for (const list of Object.values(records)) for (const r of list) {
    const root = new THREE.Vector3(...r.position), crown = root.clone();crown.y += 26;
    r.rootPosition=root.toArray();r.position=crown.toArray();r.crownLift=26;r.minimumCrownY=crown.y;
    r.matrix.setPosition(crown);stems.cyl(root,crown,.012,new THREE.Color(0x9eb9a5),5);
  }
  const meshes = [];
  for (const kind of ['monstera', 'banana']) {
    const list = records[kind]; if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(leafPass.templates[kind], leafPass.material, list.length);
    mesh.name = `swamp-harbor-foreground-${kind}-leaves`; mesh.userData.gregVisualRole = 'foliage';
    list.forEach((r, i) => { mesh.setMatrixAt(i, r.matrix); const t = .72 + .16 * (.5 + .5 * Math.sin(i * 2.399)); mesh.setColorAt(i, new THREE.Color().setRGB(t * .95, t, t)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere?.();
    inner.add(mesh); meshes.push(mesh);
  }
  const petioles=stems.mesh('swamp-harbor-lifted-leaf-petioles',new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.35,depthWrite:false}));inner.add(petioles);meshes.push(petioles);
  const all = [...records.monstera, ...records.banana];
  return {ok: true, crownLift:26, meshes, records: all, count: all.length, counts: {monstera: records.monstera.length, banana: records.banana.length}, rejected,
    triangles: Object.entries(records).reduce((s, [k, l]) => s + l.length * leafPass.templates[k].attributes.position.count / 3, 0)};
}

export function installSwampHarborScene({swamp, enabled = new URLSearchParams(globalThis.location?.search || '').get('swampHarbor') !== '0',
  departure = new URLSearchParams(globalThis.location?.search || '').get('swampHarborDeparture') || 'proxy', workerScale = 1.6} = {}) {
  const inner = swamp?.userData?.inner || swamp;
  const report = {enabled, version: 3, frame: 'inner-swamp-local', departureMode: departure};
  if (!enabled || !inner?.userData) return {report, update() {}};
  if (inner.userData.swampHarborScene) return inner.userData.swampHarborScene;
  const yard = inner.userData.shipyard;
  report.restoredShips = restoreWarships(inner, yard, departure);
  report.workers = enlargeWorkers(yard, workerScale);
  const sail = installSpareSail(yard);
  const pier = installPier(inner, yard, inner.userData.gregShoreDock);
  const monkeyRepair = installSwampMonkeyRepair(inner, {pier});
  const leaves = installRimLeaves(inner);
  const foreground = installForegroundLeaves(inner, leaves);
  const farBoat = departure === 'original' ? null : installFarLongboat(inner);
  const ship = yard?.dock;
  Object.assign(report, {
    ship: ship && {name: ship.name, position: ship.position.toArray().map(v => +v.toFixed(2)), angle: +Math.atan2(ship.position.z, ship.position.x).toFixed(3), radius: +Math.hypot(ship.position.x, ship.position.z).toFixed(2), workers: (yard.workers || []).map(w => w.name)},
    sail: sail ? {name: sail.sail.name} : null,
    pier: pier && {segments: pier.segments, posts: pier.posts, side: pier.side, footings:pier.footings, walkWidthWorld:widthWorld(inner,4.2), minShoreGap: +pier.minShoreGap.toFixed(2), triangles: pier.triangles},
    leaves: leaves && {ok: leaves.ok, count: leaves.count, counts: leaves.counts, rejected: leaves.rejected, triangles: leaves.triangles, reason: leaves.reason},
    foreground: foreground && {count: foreground.count, counts: foreground.counts, rejected: foreground.rejected, triangles: foreground.triangles},
    farBoat: farBoat && {name: farBoat.boat.name, centre: farBoat.centre.toArray().map(v => +v.toFixed(2)), angle: FAR_BOAT.angle, radius: FAR_BOAT.radius, length: FAR_BOAT.length, drift: FAR_BOAT.drift},
  });
  report.monkeyRepair = monkeyRepair.report;
  const api = {report, sail, pier, leaves, foreground, farBoat, monkeyRepair,
    update(t = 0) {
      sail?.update(t); farBoat?.update(t); monkeyRepair.update(t);
      const B = yard?.departure; if (B && departure !== 'original' && B.parent) B.removeFromParent();
    },
    dispose() {
      monkeyRepair.dispose();
      for (const m of [...(pier?.meshes || []), pier?.ropes, ...(leaves?.meshes || []), ...(foreground?.meshes || [])].filter(Boolean)) { m.removeFromParent(); m.geometry?.dispose(); }
      farBoat?.boat.removeFromParent();
      sail?.holder.removeFromParent(); delete inner.userData.swampHarborScene;
    }};
  inner.userData.swampHarborScene = api;
  return api;
}
