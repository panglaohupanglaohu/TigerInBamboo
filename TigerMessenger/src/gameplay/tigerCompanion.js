import * as THREE from 'three';
// 虎虎同行（用户 2026-10-10）：靠近湖沼之虎按 E 和它说话，再按 E 它就跟着信使——
// 信使步行它步行，信使上飞艇 / 坐电车 / 乘船，它也一起"上去"贴在身边随行。
// 同行中靠近它按 E 说话，再按 E 让它回湖沼。救援主线接回虎虎后（rescuedTiger）由主线护送接管，本模块让位。
const TALK_R = 5.5, LINGER = 8;
export function createTigerCompanion({scene = null, player, findTiger, groundRadius, isRiding, isStarted, toast, rescueOwnsTiger = () => false, rescueWantsE = () => false, getRideSpot = null}) {
  const report = {version: 1, following: false, mode: 'idle', talk: 0};
  let tiger = null, following = false, talkUntil = 0, clock = 0, hinted = false;
  const world = new THREE.Vector3(), target = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(),
    dir = new THREE.Vector3(), basis = new THREE.Matrix4(), q = new THREE.Quaternion(), pq = new THREE.Quaternion(), local = new THREE.Vector3(), prev = new THREE.Vector3();
  let home = null;
  let homeParent = null;
  const getTiger = () => { if (!tiger?.parent) tiger = findTiger?.() || null; return tiger; };
  const tigerWorld = (out) => { const t = getTiger(); if (!t) return null; t.updateWorldMatrix(true, false); return t.getWorldPosition(out); };
  function near() { const t = getTiger(); if (!t || !isStarted?.()) return false; tigerWorld(world); return world.distanceTo(player.position) < TALK_R; }
  function say(text, s = 4) { toast?.(text, s); }
  function startFollow() {
    const t = getTiger(); if (!t) return;
    if (!home) home = { pos: t.position.clone(), quat: t.quaternion.clone(), rotY: t.rotation.y };
    // travel in world space: leaving the swamp group means the swamp's culling / clipping never hides it far from home
    if (scene && t.parent !== scene) { homeParent = t.parent; scene.attach(t); }
    following = true; t.userData._companion = true; t.userData._followCourier = true; tigerWorld(prev);
    say('虎虎跟上了你 · 走路、乘飞艇、坐电车它都一起（想让它回湖沼按 Shift+E）', 4);
  }
  function stopFollow() {
    const t = getTiger(); following = false; if (!t) return;
    t.userData._companion = false; t.userData._followCourier = false; t.userData._walking = false;
    if (homeParent && t.parent !== homeParent) { homeParent.add(t); homeParent = null; }
    if (home) { t.position.copy(home.pos); t.quaternion.copy(home.quat); t.rotation.y = home.rotY; t.userData._baseY = home.pos.y; }
    say('虎虎：那我回湖沼等你，送完信再来找我。', 3.5);
  }
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || e.repeat || e.ctrlKey || e.metaKey || e.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (rescueOwnsTiger() || rescueWantsE() || !near()) return;
    // 2026-10-12 用户：随行中的虎虎总在身边，不能再吞掉 E——否则走到红狐、
    // 收信人身边也触发不了互动。随行时普通 E 直接让给其他交互；
    // 只有 Shift+E 才是对虎虎说“回湖沼”。
    if (following && !e.shiftKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const talking = clock < talkUntil;
    if (!following) {
      if (!talking) { talkUntil = clock + LINGER; report.talk++; say('虎虎：嗷呜——你要去送信吗？我陪你走一程。（再按 E 让虎虎跟着你）', 5); }
      else { talkUntil = 0; startFollow(); }
    } else {
      if (!talking) { talkUntil = clock + LINGER; report.talk++; say('虎虎：累了吗？要我先回湖沼等你吗？（再按 Shift+E 让虎虎回去）', 5); }
      else { talkUntil = 0; stopFollow(); }
    }
  }, {capture: true});

  function place(t, pos, facing, dt) {
    // world position + upright on the planet, facing along `facing`
    up.copy(pos).normalize();
    fwd.copy(facing).addScaledVector(up, -facing.dot(up)); if (fwd.lengthSq() < 1e-6) fwd.copy(player.forward).addScaledVector(up, -player.forward.dot(up)); fwd.normalize();
    side.crossVectors(up, fwd).normalize();
    basis.makeBasis(side, up, fwd); q.setFromRotationMatrix(basis);
    t.parent.getWorldQuaternion(pq); q.premultiply(pq.invert());
    t.quaternion.slerp(q, 1 - Math.exp(-dt * 8));
    local.copy(pos); t.parent.worldToLocal(local);
    t.position.copy(local); t.userData._baseY = local.y;
  }
  return {report, update(dt) {
    clock += dt;
    const t = getTiger();
    if (rescueOwnsTiger()) { if (following) { following = false; } report.following = false; report.mode = 'rescue'; return; }
    if (!t) return;
    if (!following) {
      report.following = false; report.mode = 'idle';
      if (isStarted?.() && near()) { if (!hinted) { hinted = true; say('按 E 和虎虎说话', 2.5); } } else hinted = false;
      return;
    }
    report.following = true;
    t.userData._companion = true;
    tigerWorld(world);
    up.copy(player.position).normalize();
    fwd.copy(player.forward).addScaledVector(up, -player.forward.dot(up)).normalize();
    side.crossVectors(up, fwd).normalize();
    if (isRiding?.() && getRideSpot?.(-1, target, dir)) {
      // airship: stand on the gondola roof beside the courier, facing the bow
      report.mode = 'on-deck';
      world.lerp(target, 1 - Math.exp(-dt * 10));
      place(t, world, dir, dt);
      t.userData._walking = false;
    } else if (isRiding?.()) {
      // on a vehicle: ride along right beside the courier
      report.mode = 'riding';
      target.copy(player.position).addScaledVector(fwd, -1.7).addScaledVector(side, 1.1).setLength(player.position.length() + .06);
      world.lerp(target, 1 - Math.exp(-dt * 5));
      place(t, world, fwd, dt);
      t.userData._walking = false;
    } else {
      report.mode = 'walking';
      target.copy(player.position).addScaledVector(fwd, -2.4).addScaledVector(side, 1.3);
      const d = world.distanceTo(target);
      if (d > 30) world.copy(target);// left far behind (teleport, landing, new scene): catch up at once
      else {
        const speed = Math.min(14, 2.2 + d * 1.6), step = Math.min(d, speed * dt);
        if (d > 1e-4) dir.subVectors(target, world).multiplyScalar(step / d); else dir.set(0, 0, 0);
        world.add(dir);
      }
      let g = null; try { g = groundRadius?.(world); } catch { g = null; }
      if (Number.isFinite(g)) world.setLength(g + .02);
      const moved = world.distanceTo(prev);
      dir.subVectors(world, prev);
      place(t, world, moved > .01 ? dir : fwd, dt);
      t.userData._walking = moved / Math.max(dt, 1e-3) > .6;
    }
    prev.copy(world);
  }, isFollowing: () => following, stop: stopFollow};
}
