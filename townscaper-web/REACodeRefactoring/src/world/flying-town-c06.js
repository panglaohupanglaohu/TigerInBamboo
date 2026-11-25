/**
 * flying-town-c06.js — 第 56 批 C06：1313837640366596096 "You can now build flying towns (if you find any of the
 * perfect loops I've scattered across the grid)"。
 * 主场景 ?flying=1（默认关）：在共享网格上找完美环（core/loop-lift.js findLoops → grid.js 拓扑直线回到起点），
 * 环内格子的整列体素（地形 + 建筑）一起抬高 lift 层 → 同一 World/WorldMesh 直接渲染成悬空的镇子（建筑随岛抬升）。
 *
 * 第 127 轮按原片原尺寸帧重做形制（315 帧逐帧核过）：
 *  - 船壳：环周一圈**黄色鼓边 + 上面一条红舷缘 + 舷窗小方窗**（原来环下周是裸岩崖面）；
 *  - 外沿白色构件：**黄色短舱 + 4 片白色桨叶**（原片 0300 帧 3 倍放大：桨毂是黄色，叶片 4 片、十字张开向外），
 *    原来只是一组两片小方板（「蝶形」误读）；
 *  - 腿：**锥形柱 + 两根斜撑**（原片 0060 帧：每根腿顶部有两条 45° 斜杆撑到船壳，像树根/马凳），
 *    原来是一根等粗细的细杆；落脚涟漪圈放大（原片涟漪直径≈船壳宽的 1/8）。
 * 编辑：环内新建的方块同样处在抬升后的层上（直接点悬空的岛建造）。
 */
import * as THREE from 'three';
import { findLoops, supportLegs, hullDepth } from '../core/loop-lift.js';
import { MAX_LEVEL } from '../core/world.js';

/** 把 region 里每格的整列体素上移 lift 层（纯数据操作，可单测）。返回移动的体素数。
 *  out（可选）累计 { columns, blocks, rocks } —— blocks 就是「跟着岛一起抬升的建筑体素」。 */
export function liftColumns(world, cellIds, lift, out = null) {
  let moved = 0, blocks = 0, rocks = 0;
  for (const id of cellIds) {
    const c = world.grid.cells[id], col = [];
    for (let l = 1; l <= MAX_LEVEL; l++) col.push(world.isSolid(c, l) ? ((world.rock[c.id] >> (l - 1)) & 1 ? 'rock' : 'block') : null);
    const top = col.findLastIndex(Boolean) + 1;
    if (top + lift > MAX_LEVEL) throw new RangeError('lift exceeds MAX_LEVEL for cell ' + id);
    for (let l = 1; l <= MAX_LEVEL; l++) world.setSolid(c, l, false);
    // 底下补一层「船壳」实心（原来是空列/水面的格，抬起后至少有一块板，岛才连成一片）
    if (!col.some(Boolean)) col[0] = 'rock';
    col.forEach((k, i) => {
      if (k) {
        world.setSolid(c, i + 1 + lift, true, { rock: k === 'rock' });
        moved++;
        if (k === 'block') blocks++; else rocks++;
      }
    });
    world.river[c.id] = 0;
  }
  if (out) { out.columns = (out.columns || 0) + cellIds.length; out.blocks = (out.blocks || 0) + blocks; out.rocks = (out.rocks || 0) + rocks; }
  world.touch();
  return moved;
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

function centroid(poly) {
  let cx = 0, cz = 0;
  for (const p of poly) { cx += p[0]; cz += p[1]; }
  return [cx / poly.length, cz / poly.length];
}

/** 环多边形的外法线（朝远离质心的一侧）。纯函数，可单测。 */
export function outwardNormal(poly, i, c = centroid(poly)) {
  const a = poly[i], b = poly[(i + 1) % poly.length];
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
  let nx = dz / len, nz = -dx / len;
  const mx = (a[0] + b[0]) / 2 - c[0], mz = (a[1] + b[1]) / 2 - c[1];
  if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
  return [nx, nz, len];
}

/**
 * 船壳皮：沿环多边形生成「鼓边带 + 舷缘条 + 舷窗方窗」的三角形数组（世界坐标，平面法线朝外）。
 * 纯函数：只出 Float32Array，由 attachFlyingTown 装进 BufferGeometry。
 */
export function hullSkin(poly, { y0 = 1.5, bandH = 0.42, rimH = 0.06, out = 0.02, portholeEvery = 0.62, porthole = [0.08, 0.07] } = {}) {
  if (!Array.isArray(poly) || poly.length < 3) throw new TypeError('poly must be a closed ring');
  const c = centroid(poly);
  const band = [], rim = [], holes = [];
  let perimeter = 0, nHoles = 0;
  const [pw, ph] = porthole, po = out + 0.012;
  const rows = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const [nx, nz, len] = outwardNormal(poly, i, c);
    rows.push({ a, b, nx, nz, len, start: perimeter });
    perimeter += len;
    const ax = a[0] + nx * out, az = a[1] + nz * out, bx = b[0] + nx * out, bz = b[1] + nz * out;
    const yBot = y0 - bandH, yTop = y0;
    // 鼓边带（黄）
    band.push(ax, yBot, az, bx, yBot, bz, bx, yTop, bz, ax, yBot, az, bx, yTop, bz, ax, yTop, az);
    // 舷缘条（红）
    rim.push(ax, yTop, az, bx, yTop, bz, bx, yTop + rimH, bz, ax, yTop, az, bx, yTop + rimH, bz, ax, yTop + rimH, az);
  }
  // 舷窗：沿**整圈弧长**等距（不是逐边取模——短边会比间距还短，逐边写法会一个都不出）
  let row = 0;
  for (let t = portholeEvery * 0.5; t < perimeter; t += portholeEvery) {
    while (row < rows.length - 1 && t > rows[row].start + rows[row].len) row++;
    const e = rows[row];
    const u = Math.min(e.len, Math.max(0, t - e.start));
    const tx = (e.b[0] - e.a[0]) / (e.len || 1), tz = (e.b[1] - e.a[1]) / (e.len || 1);
    const cxp = e.a[0] + tx * u + e.nx * po, czp = e.a[1] + tz * u + e.nz * po, cy = y0 - bandH * 0.45;
    const hx = tx * pw * 0.5, hz = tz * pw * 0.5, hy = ph * 0.5;
    const p1 = [cxp - hx, cy - hy, czp - hz], p2 = [cxp + hx, cy - hy, czp + hz], p3 = [cxp + hx, cy + hy, czp + hz], p4 = [cxp - hx, cy + hy, czp - hz];
    holes.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
    nHoles++;
  }
  return {
    band: new Float32Array(band), rim: new Float32Array(rim), holes: new Float32Array(holes),
    perimeter: +perimeter.toFixed(4), bandH, rimH, portholes: nHoles, edges: poly.length,
    bandArea: +(perimeter * bandH).toFixed(4), rimArea: +(perimeter * rimH).toFixed(4),
  };
}

/** 斜撑：每根腿两条，从腿身 3/4 高处斜撑到船壳底（原片 0060 帧的“树根”形）。纯函数。 */
export function legBraces(leg, { y0 = 1.5, depth = 0.9, reach = 0.42, from = 0.72 } = {}) {
  const yA = y0 - depth * from, yB = y0 - depth * 0.06;
  const tangentX = leg.tx ?? 1, tangentZ = leg.tz ?? 0;
  return [-1, 1].map((s) => {
    const ax = leg.x, az = leg.z, bx = leg.x + tangentX * reach * s, bz = leg.z + tangentZ * reach * s;
    const mid = [(ax + bx) / 2, (yA + yB) / 2, (az + bz) / 2];
    const dx = bx - ax, dy = yB - yA, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    return { mid, dir: [dx / len, dy / len, dz / len], len, side: s };
  });
}

/** 外沿桨位：每 every 根腿设一个短舱（原片沿船壳等弧长分布）。纯函数。 */
export function propSlots(legs, every = 2) {
  const step = Math.max(1, Math.round(every));
  const slots = [];
  for (let i = 0; i < legs.length; i += step) {
    const leg = legs[i];
    const nx = leg.nx ?? 1, nz = leg.nz ?? 0;
    slots.push({ x: leg.x, z: leg.z, angle: Math.atan2(nx, nz), nx, nz });
  }
  return slots;
}

function quadGeometry(arr) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(arr);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const n = pos.length / 3;
  g.setIndex(null);
  g.userData.tris = n / 3;
  return g;
}

export function attachFlyingTown(view, world, grid, { lift = 3, loop = 0, spacing = 1.1, props = true, hull = true, braces = true, cradle = true } = {}) {
  const loops = findLoops(grid);
  if (!loops.length) return { ok: false, reason: 'no perfect loop on this grid' };
  const L = loops[Math.min(loop, loops.length - 1)];
  const region = L.region ?? L;
  const ids = (region.cells ?? []).map((c) => (typeof c === 'number' ? c : c.id));
  const liftStats = { columns: 0, blocks: 0, rocks: 0 };
  const moved = liftColumns(world, ids, lift, liftStats);
  view.changed();
  const y0 = lift * view.levelHeight, depth = hullDepth(region.area ?? 4);
  const group = new THREE.Group(); group.name = 'flying-town-c06';
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2d3440, roughness: .6 });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: .55 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: .45 });
  const nacelleMat = new THREE.MeshStandardMaterial({ color: 0xe6d78d, roughness: .55 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xf0e2a4, roughness: .62, side: THREE.DoubleSide });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcd4f42, roughness: .6, side: THREE.DoubleSide });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x3c4b5c, side: THREE.DoubleSide });
  const poly = region.polygon;

  const legs = supportLegs(region, { spacing, depth: 0 }).legs;
  // 切线方向（斜撑往切线两侧张开）+ 外法线（桨叶朝向船壳外）
  const ctr = poly ? centroid(poly) : [0, 0];
  for (let i = 0; i < legs.length; i++) {
    const a = poly ? poly[i % poly.length] : null, b = poly ? poly[(i + 1) % poly.length] : null;
    if (a && b) {
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      legs[i].tx = dx / l; legs[i].tz = dz / l;
      const [nx, nz] = outwardNormal(poly, i % poly.length, ctr);
      legs[i].nx = nx; legs[i].nz = nz;
    }
  }

  const legGroup = new THREE.Group(); legGroup.name = 'legs';
  const legGeo = new THREE.CylinderGeometry(.042, .055, y0 - .02, 7);
  const legMesh = new THREE.InstancedMesh(legGeo, legMat, legs.length);
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), scl = new THREE.Vector3(1, 1, 1);
  legs.forEach((leg, i) => { mat4.compose(_v1.set(leg.x, (y0 - .02) / 2, leg.z), q.identity(), scl); legMesh.setMatrixAt(i, mat4); });
  legGroup.add(legMesh);
  const ringGeo = new THREE.RingGeometry(.26, .34, 22);
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, legs.length);
  const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  legs.forEach((leg, i) => { mat4.compose(_v1.set(leg.x, .03, leg.z), qFlat, scl); rings.setMatrixAt(i, mat4); });
  legGroup.add(rings);

  // 斜撑（每腿两条）
  const braceList = legs.flatMap((leg) => legBraces(leg, { y0, depth, reach: 0.42 }));
  const braceMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), legMat, braceList.length);
  braceList.forEach((b, i) => {
    const dir = _v2.set(...b.dir);
    const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    mat4.compose(_v3.set(...b.mid), rot, new THREE.Vector3(b.len, .045, .045));
    braceMesh.setMatrixAt(i, mat4);
  });
  braceMesh.visible = !!braces;
  legGroup.add(braceMesh);

  // 船壳皮（鼓边 + 舷缘 + 舷窗）
  const hullGroup = new THREE.Group(); hullGroup.name = 'hull';
  let skin = null;
  if (poly && poly.length >= 3) {
    skin = hullSkin(poly, { y0, bandH: Math.min(0.42, depth * 0.45), rimH: 0.06 });
    hullGroup.add(new THREE.Mesh(quadGeometry(Array.from(skin.band)), bandMat));
    hullGroup.add(new THREE.Mesh(quadGeometry(Array.from(skin.rim)), rimMat));
    hullGroup.add(new THREE.Mesh(quadGeometry(Array.from(skin.holes)), holeMat));
  }
  hullGroup.visible = !!hull;
  group.add(hullGroup);

  // 外沿短舱 + 4 片白桨叶
  const propGroup = new THREE.Group(); propGroup.name = 'props';
  const slots = propSlots(legs, 2);
  const nacelle = new THREE.InstancedMesh(new THREE.ConeGeometry(.085, .17, 8), nacelleMat, slots.length);
  const bladeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.30, .05, .02), bladeMat, slots.length * 4);
  slots.forEach((s, si) => {
    const n = _v2.set(s.nx, 0, s.nz).normalize();
    // 短舱挂在鼓边带**下沿之外**（桨叶半径 0.31，外推 0.34 才不穿进船壳皮）
    const cx0 = s.x + s.nx * .20, cz0 = s.z + s.nz * .20, cy0 = y0 - (skin?.bandH ?? 0.42) + 0.10;
    const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    mat4.compose(_v1.set(cx0, cy0, cz0), rot, new THREE.Vector3(1, 1, 1));
    nacelle.setMatrixAt(si, mat4);
    const up = new THREE.Vector3(0, 1, 0), tan = new THREE.Vector3().crossVectors(n, up).normalize();
    for (let k = 0; k < 4; k++) {
      const t = (k * Math.PI) / 2;
      const dir = new THREE.Vector3().addScaledVector(up, Math.cos(t)).addScaledVector(tan, Math.sin(t)).normalize();
      const qb = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      const c = new THREE.Vector3(cx0, cy0, cz0).addScaledVector(dir, .16);
      mat4.compose(c, qb, new THREE.Vector3(1, 1, 1));
      bladeMesh.setMatrixAt(si * 4 + k, mat4);
    }
  });
  propGroup.add(nacelle, bladeMesh);
  propGroup.visible = !!props;
  group.add(propGroup);

  // 船壳下的桁架摇篮（相邻腿之间一榀 X 撑，原片 0300 帧船壳下沿的深灰格构）
  const cradleGroup = new THREE.Group(); cradleGroup.name = 'cradle';
  const bayList = [];
  for (let i = 0; i < legs.length; i++) {
    const a = legs[i], b = legs[(i + 1) % legs.length];
    const y = y0 - depth * 0.62;
    bayList.push({ a: [a.x, y, a.z], b: [b.x, y, b.z] });
  }
  const barGeo = new THREE.BoxGeometry(1, .03, .03);
  const cradleMesh = new THREE.InstancedMesh(barGeo, legMat, bayList.length * 3);
  let barIndex = 0;
  bayList.forEach((bay) => {
    const seg = (ra, rb) => {
      const mid = [(ra[0] + rb[0]) / 2, (ra[1] + rb[1]) / 2, (ra[2] + rb[2]) / 2];
      const d = _v2.set(rb[0] - ra[0], rb[1] - ra[1], rb[2] - ra[2]);
      const len = d.length();
      const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
      mat4.compose(_v3.set(...mid), rot, new THREE.Vector3(len, 1, 1));
      cradleMesh.setMatrixAt(barIndex++, mat4);
    };
    seg(bay.a, bay.b);                                                     // 下弦
    seg([bay.a[0], bay.a[1] + .16, bay.a[2]], [bay.b[0], bay.b[1] + .16, bay.b[2]]); // 上弦
    seg([bay.a[0], bay.a[1] + .16, bay.a[2]], [bay.b[0], bay.b[1], bay.b[2]]);       // 斜撑
  });
  cradleGroup.add(cradleMesh);
  cradleGroup.visible = !!cradle;
  group.add(cradleGroup);

  group.add(legGroup);
  view.scene.add(group);

  const parts = {
    legs: legs.length, braces: braceList.length, props: slots.length, blades: slots.length * 4,
    cradleBays: bayList.length, cradleBars: bayList.length * 3,
    portholes: skin?.portholes ?? 0, bandEdges: skin?.edges ?? 0,
    bandTris: skin ? skin.band.length / 9 : 0, rimTris: skin ? skin.rim.length / 9 : 0,
    bandH: +(skin?.bandH ?? 0).toFixed(3), rimH: +(skin?.rimH ?? 0).toFixed(3),
    bandArea: skin?.bandArea ?? 0, rimArea: skin?.rimArea ?? 0,
  };
  return {
    ok: true, loops: loops.length, cells: ids.length, moved, legs: legs.length, lift, y0, depth, area: region.area,
    cellIds: ids, parts, lifted: { ...liftStats }, perimeter: +(skin?.perimeter ?? 0),
    propPositions: slots.map((s) => ({ x: +(s.x + s.nx * .20).toFixed(3), z: +(s.z + s.nz * .20).toFixed(3), nx: +s.nx.toFixed(3), nz: +s.nz.toFixed(3), y: +(y0 - (skin?.bandH ?? 0.42) + 0.10).toFixed(3) })),
    legPositions: legs.map((l) => ({ x: +l.x.toFixed(3), z: +l.z.toFixed(3) })),
    parts_objects: { legs: legGroup, hull: hullGroup, props: propGroup, cradle: cradleGroup },
    setParts(vis = {}) {
      for (const [k, g] of Object.entries(this.parts_objects)) if (k in vis) g.visible = !!vis[k];
      view.render?.(0);
    },
    dispose() {
      view.scene.remove(group);
      group.traverse((o) => { o.geometry?.dispose(); });
      for (const m of [legMat, ringMat, bladeMat, nacelleMat, bandMat, rimMat, holeMat]) m.dispose();
    },
  };
}
