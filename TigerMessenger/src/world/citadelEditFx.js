// =====================================================================
//  C13-5 · 编辑涟漪（PLAN §10.5，证据 sheetA 2s / sheet_0）—— Claude 2026-09-04
//
//  Townscaper 每次加/删格都在落点发一个**一次性**的扩散环 + 一小撮白水花。
//  它是**纯表现层**：
//    · 不进 dirty（不影响任何一格的几何判定）
//    · 不进合并块（根节点标 userData.transientFx，geometryMerge 整棵跳过）
//    · 1.2s 自动回收，材质随对象释放；几何是共享常量，不释放
//  换句话说：把这个模块整个删掉，城堡的每一个三角形都不会变。这是它能存在的前提。
//
//  THREE 由调用方注入（headless 测试用 vendor/three.module.js），本文件不 import 它。
//  一切随机量都由序号推导（禁止 Math.random）——同一次编辑两次播放完全一样。
// =====================================================================

/** 涟漪生命周期（秒）。PLAN §10.5 的读数。 */
export const EDIT_RIPPLE_LIFE = 1.2;
/** 每次编辑的白水花片数。 */
export const EDIT_SPLASH_COUNT = 6;

/**
 * @param {typeof import("three")} THREE
 * @param {object} parent 挂载点（THREE.Object3D）
 * @param {{life?:number, splashCount?:number, ringColor?:number,
 *          splashColor?:number, radius?:number, maxLive?:number}} [opts]
 * @returns {{ root, spawn(x,y,z), update(dt), liveCount(), dispose() }}
 */
export function createCitadelEditFx(THREE, parent, {
  life = EDIT_RIPPLE_LIFE,
  splashCount = EDIT_SPLASH_COUNT,
  ringColor = 0xffffff,
  splashColor = 0xffffff,
  radius = 1.0,
  maxLive = 6,
} = {}) {
  const root = new THREE.Group();
  root.name = "citadel-edit-fx";
  // 合并管线看到这个标记就整棵跳过（含子树），所以涟漪永远不会被烘进合并块。
  root.userData.transientFx = true;
  parent.add(root);

  // 共享几何：涟漪只改 scale / opacity，不改顶点，所以一份就够
  const ringGeo = new THREE.RingGeometry(radius * 0.42, radius * 0.5, 28);
  ringGeo.rotateX(-Math.PI / 2); // 躺平在 XZ 面
  const splashGeo = new THREE.PlaneGeometry(radius * 0.1, radius * 0.1);

  const live = [];

  const retire = (entry) => {
    const i = live.indexOf(entry);
    if (i >= 0) live.splice(i, 1);
    root.remove(entry.group);
    entry.ring.material.dispose();
    for (const s of entry.splashes) s.material.dispose();
  };

  /** 在世界坐标 (x,y,z) 发一次涟漪；返回涟漪 Group（一次编辑恰好一个）。 */
  const spawn = (x, y, z) => {
    // 连点时先回收最老的：FX 不许无限堆，也不许让 update 变成 O(点击次数)
    while (live.length >= maxLive) retire(live[0]);

    const group = new THREE.Group();
    group.name = "citadel-edit-ripple";
    group.userData.transientFx = true;
    group.position.set(x, y, z);

    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ring.name = "citadel-edit-ripple-ring";
    ring.userData.transientFx = true;
    group.add(ring);

    const splashes = [];
    for (let i = 0; i < splashCount; i++) {
      const a = (i / splashCount) * Math.PI * 2;
      const s = new THREE.Mesh(
        splashGeo,
        new THREE.MeshBasicMaterial({
          color: splashColor,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      s.name = "citadel-edit-splash";
      s.userData.transientFx = true;
      // 确定性“随机”：按序号推导，同一次编辑两次播放逐帧一致
      s.userData.dirX = Math.cos(a);
      s.userData.dirZ = Math.sin(a);
      s.userData.rise = 0.9 + ((i * 37) % 5) * 0.11;
      s.userData.spin = ((i * 53) % 7) - 3;
      group.add(s);
      splashes.push(s);
    }

    const entry = { group, ring, splashes, t: 0 };
    live.push(entry);
    root.add(group);
    return group;
  };

  /** @param {number} dt 秒 */
  const update = (dt) => {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      e.t += dt;
      if (e.t >= life) { retire(e); continue; }
      const u = e.t / life;
      // 环：外扩 + 二次淡出（尾巴收得快，才像水面而不像光圈）
      const s = 1 + u * 3.2;
      e.ring.scale.set(s, 1, s);
      e.ring.material.opacity = 0.9 * (1 - u) * (1 - u);
      // 水花：抛物线起落 + 外飞 + 缩小
      for (const sp of e.splashes) {
        const r = radius * (0.25 + u * 1.15);
        sp.position.set(
          sp.userData.dirX * r,
          sp.userData.rise * u * (1 - u) * 2.6,
          sp.userData.dirZ * r
        );
        sp.rotation.y = sp.userData.spin * u;
        const k = Math.max(0.05, 1 - u);
        sp.scale.set(k, k, k);
        sp.material.opacity = 0.95 * (1 - u);
      }
    }
  };

  const dispose = () => {
    while (live.length) retire(live[0]);
    parent.remove(root);
    ringGeo.dispose();
    splashGeo.dispose();
  };

  return { root, spawn, update, liveCount: () => live.length, dispose };
}
