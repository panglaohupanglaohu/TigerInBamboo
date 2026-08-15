// 运河交汇古堡（第二城堡实例）单元测试：
//   实例化 / 存档键隔离 / 双实例并存 / 重建回切（node 直跑）
// 运行：node tools/test_canal_citadel.mjs
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const el = () => ({ classList: { toggle() {} }, setAttribute() {}, addEventListener() {} });
globalThis.document = { getElementById: el, querySelector: el, createElement: el };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.document.createElement = (tag) => {
  if (tag === "canvas") {
    const ctx2d = new Proxy({}, { get(t, k) {
      if (k === "canvas") return { width: 256, height: 256 };
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
      if (k === "measureText") return () => ({ width: 0 });
      if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      if (k === "createImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      return typeof k === "string" ? () => {} : undefined;
    }});
    return { width: 256, height: 256, getContext: () => ctx2d };
  }
  return el();
};

const BASE = new URL("../TigerMessenger/", import.meta.url);
const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const {
  buildOdysseyCitadel,
  rebuildCitadelTown,
  trimCitadelTownToTerrain,
  citadelTerrainKey,
  citadelTerrainObjectsKey,
} = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const { normalizeCitadelTerraceLayout, CITADEL_TOWN_SPEC, citadelLevelsKey } = await import(
  new URL("src/world/citadelTown.js", BASE).href
);

let pass = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };

// ---------- 1. 存档键隔离 ----------
{
  assert.equal(citadelLevelsKey(null), "tm.citadel.levels.v1", "默认实例用旧键");
  assert.equal(citadelLevelsKey("canal-junction"), "tm.citadel.levels.canal-junction.v1");
  assert.notEqual(citadelLevelsKey("canal-junction"), citadelLevelsKey(null));
  assert.notEqual(citadelTerrainKey("canal-junction"), citadelTerrainKey(null));
  assert.notEqual(citadelTerrainObjectsKey("canal-junction"), citadelTerrainObjectsKey(null));
  ok("实例存档键隔离（levels/terrain/objects 各带 id 后缀）");
}

// ---------- 2. 双实例并存：高山 + 运河交汇 ----------
{
  const dir1 = new THREE.Vector3(0.6, 0.3, 0.74).normalize();
  const dir2 = new THREE.Vector3(-0.5, 0.4, 0.77).normalize();
  const alpine = buildOdysseyCitadel({ dir: dir1, planetRadius: 160, groundRadius: 160, seed: 20260808 });
  const canalJunction = buildOdysseyCitadel({
    dir: dir2, planetRadius: 160, groundRadius: 160, seed: 918273,
    instanceId: "canal-junction",
    // 运河交汇处初始为空地基（堤岸方框），城堡由玩家自建
    spec: { terraces: [] },
  });
  assert.equal(alpine.userData.instanceId ?? null, null, "高山默认实例");
  assert.equal(canalJunction.userData.instanceId, "canal-junction");
  assert(alpine.userData.townStats?.cellCount >= 150, "高山建筑格");
  assert.equal(canalJunction.userData.townStats?.cellCount, 0, "运河古堡初始为空地基（玩家自建）");
  // 位置分离（不重叠）
  const p1 = alpine.position.clone();
  const p2 = canalJunction.position.clone();
  assert(p1.distanceTo(p2) > 30, "两实例应相距 30+（避免重叠）");
  ok(`双实例并存：高山(${p1.length().toFixed(0)}, ${alpine.userData.townStats.cellCount} 格) ⇄ 运河古堡(${p2.length().toFixed(0)}, 空地基)`);
}

// ---------- 3. 第二实例重建（rebuildCitadelTown 按容器实例化） ----------
{
  const canalJunction = buildOdysseyCitadel({
    dir: new THREE.Vector3(-0.5, 0.4, 0.77).normalize(),
    planetRadius: 160, groundRadius: 160, seed: 918273,
    instanceId: "canal-junction",
  });
  const spec = normalizeCitadelTerraceLayout(CITADEL_TOWN_SPEC);
  const stats = rebuildCitadelTown(canalJunction, spec);
  assert(stats && stats.cellCount >= 150, "第二实例重建返回统计");
  assert.equal(canalJunction.userData.instanceId, "canal-junction", "重建保留实例 id");
  assert(canalJunction.userData.townStats?.cellCount >= 150, "重建后建筑格");
  ok("第二实例热重建（rebuildCitadelTown）正常工作且保留 instanceId");
}

// ---------- 4. 12 层城堡（floors 参数化） ----------
{
  const canalJunction = buildOdysseyCitadel({
    dir: new THREE.Vector3(-0.5, 0.4, 0.77).normalize(),
    planetRadius: 160, groundRadius: 160, seed: 918273,
    instanceId: "canal-junction",
    floors: 12,
  });
  assert.equal(canalJunction.userData.floors, 12, "12 层实例");
  // 默认 SPEC 只有 5 层布局，normalize 会补齐到 12 层（空层）
  const spec = normalizeCitadelTerraceLayout(CITADEL_TOWN_SPEC, 12);
  assert.equal(spec.terraces[0].levels.length, 12, "布局 normalize 到 12 层");
  const stats = rebuildCitadelTown(canalJunction, spec);
  assert(stats && stats.cellCount >= 150, "12 层重建");
  // 高塔：第 11 层应有组（层级组数 = 12）
  const layers = canalJunction.userData.layers;
  assert(layers.length >= 12, `物理层组数应 ≥12（实际 ${layers.length}）`);
  ok(`运河交汇古堡 12 层：物理层组 ${layers.length} · 建筑格 ${stats.cellCount}`);
}

// ---------- 5. 运河堤岸方框（地基） ----------
{
  const { buildCanalJunctionBox } = await import(new URL("src/world/canalSystem.js", BASE).href);
  const scene = new THREE.Scene();
  const dir = new THREE.Vector3(0.6, 0.3, 0.74).normalize();
  const box = buildCanalJunctionBox(scene, 160, {
    centerDir: dir,
    forwardDir: new THREE.Vector3(0, 1, 0),
    halfLength: 22,
    halfWidth: 18,
  });
  let glow = 0, lamps = 0, walls = 0, water = 0, solid = 0, zone = 0;
  // 平台顶面高度与球面贴合校验：直接用平台网格顶点沿 up 投影取最大/最小
  let solidTopH = null;
  let solidBottomH = null;
  const _upDir = dir.clone();
  const _v3 = new THREE.Vector3();
  box.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === "canal-junction-glow") glow++;
    if (o.name === "canal-junction-corner-lamp") lamps++;
    if (/^canal-junction-wall-\d+$/.test(o.name)) walls++;
    if (o.name === "canal-junction-water") water++;
    if (o.name === "canal-junction-solid-platform") {
      solid++;
      o.updateWorldMatrix(true, false);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        _v3.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const h = _v3.dot(_upDir);
        if (solidTopH == null || h > solidTopH) solidTopH = h;
        if (solidBottomH == null || h < solidBottomH) solidBottomH = h;
      }
    }
    if (o.name === "canal-junction-build-zone") zone++;
  });
  assert.equal(glow, 4, "四边高亮描边");
  assert.equal(lamps, 4, "四角灯塔");
  assert.equal(walls, 4, "四边立壁");
  assert.equal(water, 0, "内部水面已移除（平台为干台面）");
  assert.equal(solid, 1, "实心平台垫层（盖住原地貌）");
  assert(zone >= 15, `高亮构建区（光罩+双亮线+空中方框 4 光柱+4 角球+4 顶线，实际 ${zone}）`);
  assert(Math.abs(box.position.length() - 160) < 1, "方框贴球面");
  // 平台顶面 = 水平平面（R + waterLift + 0.3 ≈ 160.9），底面深入球面以下（贴合）
  assert(solidTopH != null && Math.abs(solidTopH - 160.9) < 0.5, `平台顶面水平（${solidTopH?.toFixed(2)} ≈ 160.9）`);
  assert(solidBottomH != null && solidBottomH < 158.5, `平台底面深入球面（${solidBottomH?.toFixed(2)} < 158.5，边缘不悬空）`);
  ok(`运河堤岸方框：4 立壁 + 4 高亮 + 4 角灯 + 平顶贴球平台 + 空中高亮方框（r=${box.position.length().toFixed(1)}）`);
}

// ---------- 6. 无台地模式（skipOuterTerrain：堤岸方框即地基） ----------
{
  const canalJunction = buildOdysseyCitadel({
    dir: new THREE.Vector3(-0.5, 0.4, 0.77).normalize(),
    planetRadius: 160, groundRadius: 160, seed: 918273,
    instanceId: "canal-junction",
    floors: 12,
    skipOuterTerrain: true,
    townBaseLift: 0.62,
    // 运河交汇处初始为空地基（堤岸方框），城堡由玩家自建
    spec: { terraces: [] },
  });
  assert.equal(canalJunction.userData.skipOuterTerrain, true, "flat 模式标记");
  // 无外围台地（原 buildOuterCitadelTerrain 产物 contour-step 不应存在）
  let contourSteps = 0;
  canalJunction.traverse((o) => { if (o.name?.startsWith("contour-step")) contourSteps++; });
  assert.equal(contourSteps, 0, `无台地模式不应有 contour-step（实际 ${contourSteps}）`);
  // 基座全部 = 方框水面平台抬升
  assert(canalJunction.userData.townBaseYs.every((y) => Math.abs(y - 0.62) < 1e-9), "基座统一 0.62");
  // 默认空地基：建筑格 0（玩家自建；堤岸方框仍在）
  assert.equal(canalJunction.userData.townStats?.cellCount, 0, "flat 模式默认空地基");
  assert.equal(canalJunction.userData.layers.length, 12, "12 物理层组");
  // 玩家放一块 → 建筑格 1
  const one = normalizeCitadelTerraceLayout(
    { terraces: [{ levels: [["0......................."]] }] },
    12
  );
  const stats1 = rebuildCitadelTown(canalJunction, one);
  assert(stats1?.cellCount >= 1, "玩家放置后建筑格 ≥1");
  // trim 闭环在 flat 模式不裁剪（方框内全可放置）
  const trim = trimCitadelTownToTerrain(canalJunction, { terraces: [] });
  assert.equal(trim.trimmed, 0, "flat 模式不裁剪");
  ok(`无台地模式：0 contour-step · 基座 0.62 · 12 层 · 空地基可自建 · trim 不裁剪`);
}

console.log(`\n结果：${pass}/6 通过`);
process.exit(0);
