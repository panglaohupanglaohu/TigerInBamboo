// 书店镇维京远征 · 登船（2026-11-09，规划 docs/plans/2026-11-09-vikings-dragon-banner-citadel-ink.md §3.1，P1）。
// 书店镇全部行人（bookshopPedestrians 的 actors，信使不在其中）分两队走到两条船：
//   Duke 号：沿行人路网走到离跳板最近的路点 → 走到跳板码头端 → 走上跳板 → 上甲板；
//   李白号：走到离船最近的码头路点 → 跨上船舷（Bad North 维京人下船也是这么一跳）。
// 一上甲板就「变成维京人」：原人物隐藏，船上计数 +1；甲板上画一排 REACodeRefactoring 维京人的样子
//   （badnorth/battle.js 的维京外观：红衣 #8e3b3b、奶白头、橙色圆盾 #f0a35e；身体 / 头 / 盾的比例同它的几何体），
//   其余记作「舱内」。书店镇人不够 300 时，从镇民家门口（行人的家）持续走出补足的镇民（复制行人模型），直到两船各 150 人。
// 两船都满 → 收跳板、解缆 → 同一帧离港（departedFrame 相同）；离港后先沿船头方向驶出港口，航线交给 vikingVoyage（P3）。
import * as THREE from 'three';
import { sfxShipWhistle } from '../../audio/worldSfx.js';

const CAP = 150, DECK_SHOWN = 14, VIKING = { body: 0x8e3b3b, head: 0xe8dcc0, shield: 0xf0a35e };
const UP = new THREE.Vector3(), FWD = new THREE.Vector3(), RIGHT = new THREE.Vector3(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), QB = new THREE.Quaternion();

/** 把物体放在世界点 p，朝向 dir（切平面内），头朝星球外 */
function seatAt(obj, p, dir) {
  UP.copy(p).normalize(); FWD.copy(dir).addScaledVector(UP, -dir.dot(UP)); if (FWD.lengthSq() < 1e-8) FWD.set(1, 0, 0).addScaledVector(UP, -UP.x); FWD.normalize();
  RIGHT.crossVectors(UP, FWD).normalize();
  M.makeBasis(RIGHT, UP, FWD); Q.setFromRotationMatrix(M);
  const parent = obj.parent; parent.updateWorldMatrix(true, false);
  obj.position.copy(parent.worldToLocal(p.clone()));
  parent.getWorldQuaternion(QB).invert(); obj.quaternion.copy(QB.multiply(Q));
  obj.updateMatrix();
}

/** 船上的甲板位：沿船长轴在中段均匀取点，从上往下打到船体上（取第一个命中的面 = 甲板 / 舱顶） */
function deckSlots(ship, n) {
  ship.updateWorldMatrix(true, true);
  const inv = ship.matrixWorld.clone().invert(), box = new THREE.Box3(), v = new THREE.Vector3();
  ship.traverse((o) => { if (!o.isMesh || !o.geometry?.attributes?.position) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); box.expandByPoint(v); } });
  const size = box.getSize(new THREE.Vector3()), long = size.z >= size.x ? 'z' : 'x', c = box.getCenter(new THREE.Vector3());
  const meshes = []; ship.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const ray = new THREE.Raycaster(), out = [];
  for (let i = 0; i < n; i++) {
    const t = -0.32 + 0.64 * (i + 0.5) / n, side = (i % 2 ? 1 : -1) * 0.18;
    const local = new THREE.Vector3(c.x, box.max.y + 2, c.z);
    local[long] += t * size[long]; local[long === 'z' ? 'x' : 'z'] += side * size[long === 'z' ? 'x' : 'z'];
    const from = local.clone().applyMatrix4(ship.matrixWorld), down = from.clone().normalize().negate();
    ray.set(from, down); ray.far = size.y + 6;
    const hit = ray.intersectObjects(meshes, false)[0];
    out.push(hit ? hit.point.clone().applyMatrix4(inv) : new THREE.Vector3(local.x, c.y, local.z));
  }
  const bowLocal = new THREE.Vector3(); bowLocal[long] = 1;
  return { slots: out, bowLocal, length: size[long] };
}

/** 一船甲板上的维京人（REA 维京外观，按世界尺寸放大）；每帧按船的位姿重写实例矩阵 */
function deckCrew(scene, n, scale) {
  const body = new THREE.CylinderGeometry(0.035, 0.055, 0.12, 7).translate(0, 0.06, 0);
  const head = new THREE.SphereGeometry(0.035, 8, 6).translate(0, 0.145, 0);
  const shield = new THREE.CylinderGeometry(0.04, 0.04, 0.01, 10).rotateX(Math.PI / 2).translate(0, 0.07, 0.05);
  const mk = (g, c) => { const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }), n); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.raycast = () => {}; scene.add(m); return m; };
  const parts = [mk(body, VIKING.body), mk(head, VIKING.head), mk(shield, VIKING.shield)];
  const s = new THREE.Vector3(scale, scale, scale), m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion();
  return {
    parts,
    draw(ship, slots, count) {
      const k = Math.min(count, slots.length);
      ship.updateWorldMatrix(true, false); ship.getWorldQuaternion(q);
      for (let i = 0; i < k; i++) {
        p.copy(slots[i]).applyMatrix4(ship.matrixWorld);
        // 面朝船舷外（Bad North 长船上维京人举盾朝外）
        const face = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i % 2 ? Math.PI / 2 : -Math.PI / 2);
        m4.compose(p, q.clone().multiply(face), s);
        for (const part of parts) part.setMatrixAt(i, m4);
      }
      for (const part of parts) { part.count = k; part.instanceMatrix.needsUpdate = true; }
    },
    dispose() { for (const m of parts) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); } },
  };
}

/** 汽笛口的一团白汽：一串白色小球从汽笛口往上冒、变大变淡，持续 dur 秒（跟着船走） */
function steamPuff(scene, src, dur) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
  const geo = new THREE.SphereGeometry(0.5, 8, 6), puffs = [], t0 = performance.now();
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(geo, mat.clone()); m.visible = false; m.raycast = () => {}; scene.add(m); puffs.push({ m, born: i * (dur / 14) }); }
  const p = new THREE.Vector3(), up = new THREE.Vector3();
  const tick = () => {
    const t = (performance.now() - t0) / 1000; src.getWorldPosition(p); up.copy(p).normalize();
    let alive = false;
    for (const q of puffs) {
      const a = t - q.born; if (a < 0) { alive = true; continue; } if (a > 2.2) { q.m.visible = false; continue; }
      alive = true; q.m.visible = true; q.m.position.copy(p).addScaledVector(up, 0.6 + a * 2.2); q.m.scale.setScalar(0.5 + a * 1.4); q.m.material.opacity = 0.75 * (1 - a / 2.2);
    }
    if (alive) requestAnimationFrame(tick); else { for (const q of puffs) { q.m.removeFromParent(); q.m.material.dispose(); } geo.dispose(); }
  };
  requestAnimationFrame(tick);
}

export function createBookshopBoarding({ scene, pedestrians, duke, leebai, dukeGangway = null, quay = null, capacity = CAP, walkSpeed = 2.4, maxRefillWalkers = 40, vikingScale = 8.5, onDepart = null }) {
  const ships = [
    { id: 'leebai', name: '李白号', root: leebai, count: 0, walkers: 0 },
    { id: 'duke', name: 'Duke 号', root: duke, count: 0, walkers: 0 },
  ];
  for (const s of ships) { Object.assign(s, deckSlots(s.root, DECK_SHOWN)); s.crew = deckCrew(scene, DECK_SHOWN, vikingScale); }
  // 登船点（世界坐标）：Duke 走跳板（码头端 → 甲板端）；李白号从码头最近点跨上船舷
  const gangEnds = (() => {
    if (!dukeGangway) return null; dukeGangway.updateWorldMatrix(true, false);
    const a = new THREE.Vector3(-0.55, 0.1, 0).applyMatrix4(dukeGangway.matrixWorld), b = new THREE.Vector3(0.55, 0.1, 0).applyMatrix4(dukeGangway.matrixWorld);
    return a.length() < b.length() ? { quay: a, deck: b } : { quay: b, deck: a };
  })();
  const deckWorld = (s, i) => s.slots[i % s.slots.length].clone().applyMatrix4(s.root.matrixWorld);
  const shoreFor = (s) => {
    if (s.id === 'duke' && gangEnds) return gangEnds.quay;
    // 李白号：码头上离船中段最近的行人路点
    const mid = deckWorld(s, Math.floor(s.slots.length / 2));
    return pedestrians.groundAt(mid);
  };

  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:16px;top:96px;z-index:6;background:rgba(32,24,22,.82);color:#f6e7cf;border-radius:10px;padding:6px 12px;font:13px/1.5 -apple-system,system-ui,"PingFang SC",sans-serif;display:none;pointer-events:none';
  document.body.appendChild(hud);
  const travellers = [];   // {m, path:[world], i, ship, clone, actor}
  let whistled = false, active = false, departed = false, departedFrame = -1, frame = 0, refillLeft = 0, refillAt = 0, sailT = 0;
  const homes = pedestrians.actors.map((a) => a.m.getWorldPosition(new THREE.Vector3()));
  const model = pedestrians.actors[0]?.m;

  function sendToShip(m, from, actor, clone) {
    const s = ships.reduce((a, b) => (a.count + a.walkers <= b.count + b.walkers ? a : b));
    if (s.count + s.walkers >= capacity) return false;
    const shore = shoreFor(s);
    let path = []; try { path = pedestrians.routeWorld(from, shore) || []; } catch { path = []; }
    path = [...path, shore.clone()];
    if (s.id === 'duke' && gangEnds) path.push(gangEnds.deck.clone());
    path.push(deckWorld(s, s.count + s.walkers));
    s.walkers++;
    travellers.push({ m, path, i: 0, ship: s, actor, clone });
    return true;
  }

  function board(t) {
    const s = t.ship; s.walkers--; s.count++;
    t.m.visible = false;                        // 上甲板 = 变成维京人（原人物退场）
    if (t.clone) { t.m.removeFromParent(); }
  }

  const api = {
    ships, get active() { return active; }, get departed() { return departed; }, get departedFrame() { return departedFrame; },
    start() {
      if (active) return api; active = true; hud.style.display = 'block';
      for (const a of pedestrians.actors) { if (a.m.userData.bookshopDowned) continue; a.m.userData.bookshopBoarding = true; a.path = []; sendToShip(a.m, a.m.getWorldPosition(new THREE.Vector3()), a, false); }
      refillLeft = Math.max(0, capacity * ships.length - travellers.length);
      return api;
    },
    update(dt) {
      frame++; if (!active) return;
      dt = Math.min(dt, 0.1);
      // 补足的镇民：从行人的家门口走出来（复制行人模型），同时在路上的不超过 maxRefillWalkers
      refillAt -= dt;
      if (refillLeft > 0 && model && refillAt <= 0 && travellers.filter((t) => t.clone).length < maxRefillWalkers) {
        refillAt = 0.35;
        const home = homes[Math.floor(Math.random() * homes.length)], m = model.clone(true);
        m.visible = true; m.userData = { townWorker: true, vikingRefill: true }; model.parent.add(m);
        if (sendToShip(m, home, null, true)) { seatAt(m, home, new THREE.Vector3(1, 0, 0)); refillLeft--; } else { m.removeFromParent(); refillLeft = 0; }
      }
      for (let k = travellers.length - 1; k >= 0; k--) {
        const t = travellers[k], here = t.m.getWorldPosition(new THREE.Vector3());
        let step = walkSpeed * dt;
        while (step > 0 && t.i < t.path.length) {
          const goal = t.path[t.i], d = here.distanceTo(goal);
          if (d <= step) { here.copy(goal); step -= d; t.i++; continue; }
          const dir = goal.clone().sub(here).normalize(); here.addScaledVector(dir, step); seatAt(t.m, here, dir); step = 0;
          t.phase = (t.phase || 0) + dt * 9; for (const [j, leg] of (t.actor?.legs || []).entries()) if (leg) leg.rotation.x = Math.sin(t.phase + j * Math.PI) * 0.3;
        }
        if (t.i >= t.path.length) { board(t); travellers.splice(k, 1); }
      }
      for (const s of ships) s.crew.draw(s.root, s.slots, s.count);
      hud.textContent = `维京远征 · ${api.phase || '登船'}　${ships.map((s) => `${s.name} ${s.count}/${capacity}`).join(' · ')}${departed ? ' · 已同时离港' : ''}`;
      if (!departed && ships.every((s) => s.count >= capacity)) api.depart();
      if (departed) { sailT += dt; for (const s of ships) if (!s.voyage) api.sail(s, dt); }   // 航线交给 vikingVoyage 后不再自己直行
    },
    /** 两船同一帧离港：收跳板、解缆，然后沿船头方向驶出 */
    depart() {
      if (departed) return; departed = true; departedFrame = frame;
      for (const s of ships) {
        // 不改船自己的位姿（书店镇的船有自己的起伏动画，写的是父坐标系里的 position.y），而是在船和父节点之间插一个「载具」组，
        // 整体绕星球中心旋转 = 沿大圆航行；起伏照常在载具里进行。
        const parent = s.root.parent; parent.updateWorldMatrix(true, false);
        const carrier = new THREE.Group(); carrier.name = `viking-voyage-carrier-${s.id}`; carrier.matrixAutoUpdate = false; carrier.userData.reaIgnore = true;   // 战场采样地形时不把大船当成陆地
        parent.add(carrier); carrier.add(s.root);
        s.carrier = carrier; s.parentWorld = parent.matrixWorld.clone(); s.parentInv = s.parentWorld.clone().invert(); s.rot = new THREE.Quaternion();
        s.root.updateWorldMatrix(true, false);
        s.bowWorld = s.bowLocal.clone().transformDirection(s.root.matrixWorld);
        s.posWorld = s.root.getWorldPosition(new THREE.Vector3());
        s.speed = 0;
      }
      for (const n of ['duke-gangway', 'duke-mooring']) scene.traverse((o) => { if (o.name === n) o.visible = false; });
      // 离港鸣笛（2026-11-09 用户要求）：两船各拉一长声（启航信号），李白号低沉先响、Duke 号稍高随后；汽笛口冒一团白汽
      ships.forEach((s, k) => {
        const src = s.root.getObjectByName(s.id === 'duke' ? 'duke-whistle' : 'leebai-single-copper-funnel') || s.root;
        setTimeout(() => { const p = src.getWorldPosition(new THREE.Vector3()); try { sfxShipWhistle(p, { pitch: s.id === 'duke' ? 1.18 : 0.82, dur: 3.4, id: `whistle-${s.id}` }); } catch {} steamPuff(scene, src, 3.6); }, k * 600);
      });
      whistled = true;
      onDepart?.({ frame, ships: ships.map((s) => ({ id: s.id, count: s.count })) });
    },
    sail(s, dt) {
      s.speed = Math.min(6, s.speed + dt * 0.8);           // 慢慢加速到 6 m/s
      const up = s.posWorld.clone().normalize(), axis = new THREE.Vector3().crossVectors(up, s.bowWorld).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, (s.speed * dt) / s.posWorld.length());
      s.rot.premultiply(q); s.posWorld.applyQuaternion(q); s.bowWorld.applyQuaternion(q);
      // 载具矩阵（父坐标系）= 父⁻¹ · 绕球心旋转 · 父
      s.carrier.matrix.copy(s.parentInv).multiply(new THREE.Matrix4().makeRotationFromQuaternion(s.rot)).multiply(s.parentWorld);
      s.carrier.matrixWorldNeedsUpdate = true;
    },
    /** 船当前世界位置 / 船头方向（航行、靠泊用） */
    shipPose(id) { const s = ships.find((x) => x.id === id); return s ? { position: s.posWorld?.clone() ?? s.root.getWorldPosition(new THREE.Vector3()), bow: s.bowWorld?.clone() ?? null } : null; },
    stats() { return { whistled, active, departed, departedFrame, refillLeft, walking: travellers.length, ships: ships.map((s) => ({ id: s.id, count: s.count, walkers: s.walkers })) }; },
    dispose() { hud.remove(); for (const s of ships) s.crew.dispose(); },
  };
  globalThis.__tmVikingBoarding = api;
  return api;
}
