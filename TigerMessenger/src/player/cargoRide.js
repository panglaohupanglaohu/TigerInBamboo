// 信使 F 抓货登船（2026-11-09，规划 §3.2，P2）。
// 维京远征集结时，李白号码头吊车改为「装船」（bookshopFactoryBase：harbor-cargo-trolley.userData.loading → 吊运循环倒放，码头 → 船）。
//   信使走到吊货 3 米内按 F：站上货箱，跟着吊车走；货箱落到船上卸点（或吊车走空）时松手 → 信使登上李白号（信使不变维京人，也不计入 150 人）。
//   Duke 号：走上跳板甲板端即登船，不用按键。
//   船上（发船前）按 F 下船，回到码头；发船后随船（player.riding，位置每帧跟船走）。
// 复用：乘具的通用做法（player.riding = true + 每帧写 player.position，同 player/boatRide.js），吊车自己的吊运循环。
import * as THREE from 'three';

export function createCargoRide({ player, scene, cargo, trolley, leebai, duke, dukeGangway = null, isMustering = () => false, toast = () => {} }) {
  let state = 'idle', ship = null, cargoWasVisible = true;
  const offset = new THREE.Vector3(), tmp = new THREE.Vector3(), quayReturn = new THREE.Vector3();
  const cargoTop = () => cargo.localToWorld(tmp.set(0, 1.25, 0));
  const gangDeck = () => { if (!dukeGangway) return null; dukeGangway.updateWorldMatrix(true, false); const a = new THREE.Vector3(-0.55, 0.15, 0).applyMatrix4(dukeGangway.matrixWorld), b = new THREE.Vector3(0.55, 0.15, 0).applyMatrix4(dukeGangway.matrixWorld); return a.length() > b.length() ? a : b; };

  function boardShip(target, at) {
    if (state === 'idle') quayReturn.copy(player.position);   // 抓货时已记下码头位置（F 下船回这里）
    ship = target; state = 'aboard';
    target.updateWorldMatrix(true, true);
    // 落到船上：从上方沿「下」打到船体，站在甲板 / 舱顶上（吊货最后一帧还在半空时也不会悬着）
    { const meshes = []; target.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); }); const up = at.clone().normalize();
      const hit = new THREE.Raycaster(at.clone().addScaledVector(up, 3), up.clone().negate(), 0, 40).intersectObjects(meshes, false)[0];
      if (hit) at = hit.point.clone().addScaledVector(up, 0.05); }
    offset.copy(at).applyMatrix4(target.matrixWorld.clone().invert());
    player.riding = true; player.velocity?.set(0, 0, 0);
    toast(target === leebai ? '信使登上李白号（按 F 下船）' : '信使登上 Duke 号（按 F 下船）');
  }
  function onKey(e) {
    if (e.repeat || e.code !== 'KeyF' || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
    if (state === 'idle' && isMustering() && cargo.visible && !player.riding && player.position.distanceTo(cargoTop()) < 3.2) {
      state = 'hanging'; player.riding = true; player.velocity?.set(0, 0, 0); quayReturn.copy(player.position); cargoWasVisible = true;
      toast('抓住吊货：跟着吊车上李白号'); e.preventDefault(); e.stopImmediatePropagation();
    } else if (state === 'aboard' && !api.departed) {
      state = 'idle'; ship = null; player.riding = false; player.position.copy(quayReturn); toast('信使回到码头');
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }
  window.addEventListener('keydown', onKey, true);
  const api = {
    departed: false,
    get state() { return state; }, get ship() { return ship === leebai ? 'leebai' : ship === duke ? 'duke' : null; },
    update() {
      if (trolley) trolley.userData.loading = !!isMustering();
      if (state === 'hanging') {
        player.position.copy(cargoTop());
        // 装船循环（倒放）里货箱「放到船上卸点」的那一刻正好消失（下一段吊车空着回码头）：以这个瞬间为松手登船
        const nowVisible = cargo.visible;
        if (cargoWasVisible && !nowVisible) boardShip(leebai, player.position.clone());
        cargoWasVisible = nowVisible;
      } else if (state === 'aboard' && ship) {
        ship.updateWorldMatrix(true, false); player.position.copy(offset).applyMatrix4(ship.matrixWorld); player.velocity?.set(0, 0, 0);
      } else if (state === 'idle' && isMustering() && !player.riding) {
        const g = gangDeck(); if (g && duke && player.position.distanceTo(g) < 1.4) boardShip(duke, g);
      }
    },
    dispose() { window.removeEventListener('keydown', onKey, true); if (state !== 'idle') player.riding = false; },
  };
  globalThis.__tmCargoRide = api;
  return api;
}
