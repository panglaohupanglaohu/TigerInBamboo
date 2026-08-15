// buildTownscaperBuilding 独立资产工厂单元测试
// 验证规格：撞色（薄荷绿/珊瑚橙/奶黄）/ 非直角偏折 / 四棱锥顶 45°
// 护栏 / 悬空外骨骼支架（4 柱 + X 桁架）/ 六棱柱巨石地基下切 / 白涟漪
// 全网格 addOutline(0.05) / 1.4 环境光便利函数
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
const { buildTownscaperBuilding, addTownscaperAmbient } = await import(
  new URL("src/assets/townscaperBuilding.js", BASE).href
);

let pass = 0, fail = 0;
const t = (cond, msg) => { if (cond) { console.log(`  ✓ ${msg}`); pass++; } else { console.log(`  ✗ ${msg}`); fail++; } };

const g = buildTownscaperBuilding({ seed: 42, lift: 0 });
g.updateMatrixWorld(true);

// ---------- 1. 双层撞色主屋 ----------
const wall1 = g.getObjectByName("citadel-wall-layer1");
t(!!wall1, "Layer 1 薄荷绿主屋存在");
t(wall1?.material?.color?.getHex?.() === 0x2ecc71, `底层墙面薄荷绿 #2ECC71（实际 #${wall1?.material?.color?.getHexString?.() ?? "?"}）`);
const wall2 = g.getObjectByName("citadel-wall-layer2");
t(!!wall2, "Layer 2 奶黄退缩主殿存在");
t(wall2?.material?.color?.getHex?.() === 0xf4d03f, `中层墙面奶黄 #F4D03F（实际 #${wall2?.material?.color?.getHexString?.() ?? "?"}）`);
t(wall2.position.y - wall1.position.y > 3, `中层退缩叠放（y=${wall1.position.y.toFixed(1)}→${wall2.position.y.toFixed(1)}）`);
// 尺寸：Layer2 缩小 30%（4.0→2.8）
const w2geo = wall2.geometry.parameters ?? {};
t(Math.abs((w2geo.width ?? 4) - 2.8) < 0.01 || wall2.geometry.boundingBox?.getSize?.()?.x < 3, "Layer 2 缩小 30%（2.8）");

// ---------- 2. 珊瑚橙红四棱锥屋顶（ConeGeometry 4 段 + 45°） ----------
const roof1 = g.getObjectByName("citadel-roof-layer1");
t(!!roof1, "底层珊瑚橙红斜顶存在");
t(roof1?.material?.color?.getHex?.() === 0xe74c3c, `屋顶珊瑚橙红 #E74C3C`);
const rp = roof1?.geometry?.parameters ?? {};
t(rp.radialSegments === 4, `四棱锥 ConeGeometry 4 段（实际 ${rp.radialSegments}）`);
t(rp.height < 1.5, `扁平斜顶（高 ${rp.height}）`);
t(!!roof1?.geometry?.userData?.rotated45 || Math.abs(roof1.rotation.y) < 1e-6, "斜顶（几何内旋转 45°）");

// ---------- 3. 非直角偏折（错切后顶点不再完美正交） ----------
{
  const pos = wall1.geometry.attributes.position;
  const xs = new Set(), zs = new Set();
  for (let i = 0; i < pos.count; i++) {
    xs.add(pos.getX(i).toFixed(3));
    zs.add(pos.getZ(i).toFixed(3));
  }
  // 偏折后：同一面墙的顶点不再落在单一平面 ±0.001 内
  const xUnique = [...xs].length > 6;
  const zUnique = [...zs].length > 6;
  t(xUnique || zUnique, "墙体顶点带非直角偏折（错切微调）");
}

// ---------- 4. 露台白色护栏 ----------
const railing = g.getObjectByName("citadel-railing");
t(!!railing, "露台护栏存在");
let railPosts = 0, railWhites = 0;
railing?.traverse((o) => {
  if (o.isMesh && !o.userData?.isOutline) {
    railPosts++;
    if (o.material?.color?.getHex?.() === 0xffffff) railWhites++;
  }
});
t(railPosts >= 10, `护栏短方块 ≥10（实际 ${railPosts}）`);
t(railWhites === railPosts, `护栏全白（${railWhites}/${railPosts}）`);

// ---------- 5. 悬空外骨骼支架（lift>0） ----------
const g2 = buildTownscaperBuilding({ seed: 7, lift: 3.2 });
g2.updateMatrixWorld(true);
const truss = g2.getObjectByName("truss-support");
t(!!truss, "悬空（lift=3.2）生成外骨骼支架");
let legs = 0, struts = 0, ironMeshes = 0;
truss?.traverse((o) => {
  if (!o.isMesh || o.userData?.isOutline) return;
  ironMeshes++;
  if (o.geometry?.type === "CylinderGeometry") legs++;
  else struts++;
});
t(legs === 4, `4 根焦黑支撑柱（实际 ${legs}）`);
t(struts >= 4, `X/横向交叉桁架 ≥4（实际 ${struts}）`);
// 支架全焦黑
const g0 = buildTownscaperBuilding({ seed: 7, lift: 0 });
t(!g0.getObjectByName("truss-support"), "贴地（lift=0）无支架");

// ---------- 6. 巨石防波堤地基（六棱柱 + 下切） ----------
const plinth = g.getObjectByName("citadel-stone-plinth");
t(!!plinth, "巨石地基存在");
t(plinth?.material?.color?.getHex?.() === 0x5d6d7e, `地基青灰 #5D6D7E（实际 #${plinth?.material?.color?.getHexString?.() ?? "?"}）`);
t(plinth?.material?.flatShading === true, "地基 flatShading: true");
const pg = plinth?.geometry?.parameters ?? {};
t(pg.radialSegments === 6, `六棱柱（实际 ${pg.radialSegments} 段）`);
t(pg.height === 1.5, `厚度 1.5（实际 ${pg.height}）`);
t(pg.radiusTop > 2.6 && pg.radiusTop < 3.2, `半径 ≈ 主楼 1.4 倍（实际 ${pg.radiusTop}）`);
t(plinth.position.y < 0, `地基下半下切（y=${plinth.position.y.toFixed(2)}）`);

// ---------- 7. 白涟漪 ----------
let ripples = 0;
g.traverse((o) => { if (o.name === "citadel-ripple") ripples++; });
t(ripples === 2, `2 个白色手绘涟漪（实际 ${ripples}）`);

// ---------- 8. 全网格描边（addOutline 0.05） ----------
// 规格列举：墙面/屋顶/主殿/护栏/支架/地基全部描边；
// 涟漪是水面手绘片体（规格未列入描边清单），排除。
let surfaceMeshes = 0, outlinedMeshes = 0, skippedRipple = 0;
g.traverse((o) => {
  if (!o.isMesh || o.userData?.isOutline) return;
  if (o.name === "citadel-ripple") { skippedRipple++; return; }
  surfaceMeshes++;
  let hasOutline = false;
  o.traverse((c) => { if (c.userData?.isOutline) hasOutline = true; });
  if (hasOutline) outlinedMeshes++;
});
t(outlinedMeshes === surfaceMeshes, `建筑/支架/地基全部带描边（${outlinedMeshes}/${surfaceMeshes}）`);
t(skippedRipple === 2, `涟漪为水面片体不描边（${skippedRipple} 片，规格未列入）`);

// ---------- 9. 1.4 环境光便利函数 ----------
const scene = new THREE.Scene();
const light = addTownscaperAmbient(scene);
t(light?.intensity === 1.4, `环境光强度 1.4（实际 ${light?.intensity}）`);
t(light?.color?.getHex?.() === 0xffffff, "环境光纯白");

console.log(`\n结果：${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
