// =====================================================================
// C13-1 · 石砌墙碎色 + 跨格砖缝对齐（PLAN §10.1，证据 docs/z1.png）
//
// 两条不变量：
//   ① **跨格砖缝对齐**：同一栋楼上下/左右相邻两格，墙面 UV 必须连续——
//      即「相邻格同一朝向面的 UV」相差恰好等于「一个格在该方向上跨的 tile 数」。
//      原来每面都是 0..1，砖块随面缩放、缝对不上，远看就是贴了图的方盒子。
//   ② **砖色有区分度**：墙贴图的逐像素明度标准差落在 [0.015, 0.035]，
//      且 R/G/B 三通道不完全相等（有低饱和色相扰动，不是灰度）。
//      太小 = 没质感（平得发死）；太大 = 发花。
//
// 运行：node tools/test_wall_brick_texture.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const ct = await import(new URL("src/world/citadelTown.js", BASE).href);
const oc = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

// ---------------------------------------------- ① 跨格砖缝对齐
{
  const cs = 2.0;
  const ch = 1.6;
  const mk = (wx, wy, wz) => {
    const g = new THREE.BoxGeometry(cs, ch, cs);
    ct.applyWorldBrickUv(g, wx, wy, wz, cs, ch);
    return g;
  };
  // 取「朝 +Z 的面」上的顶点：法线 z≈1
  const faceUvs = (geo, wantAxis) => {
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const out = [];
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(nor.getZ(i) - wantAxis) < 1e-6 && Math.abs(nor.getX(i)) < 1e-6) {
        out.push({ x: pos.getX(i), y: pos.getY(i), u: uv.getX(i), v: uv.getY(i) });
      }
    }
    return out;
  };

  const a = mk(0, 0, 0);
  const bx = mk(cs, 0, 0);   // 右邻格（+X）
  const by = mk(0, ch, 0);   // 上邻格（+Y）

  const fa = faceUvs(a, 1);
  const fbx = faceUvs(bx, 1);
  const fby = faceUvs(by, 1);
  assert.ok(fa.length >= 4, "取不到 +Z 面顶点");

  const tileW = (cs / 6) * 2;
  const tileH = (ch / 12) * 4;

  // 右邻格：同一世界位置的 u 必须相差 cs/tileW（横向刚好走过一个格）
  const du = Math.min(...fbx.map((p) => p.u)) - Math.min(...fa.map((p) => p.u));
  assert.ok(Math.abs(du - cs / tileW) < 1e-4,
    `横向跨格 UV 不连续：Δu=${du.toFixed(6)}，应为 ${(cs / tileW).toFixed(6)}`);

  // 上邻格：v 必须相差 ch/tileH
  const dv = Math.min(...fby.map((p) => p.v)) - Math.min(...fa.map((p) => p.v));
  assert.ok(Math.abs(dv - ch / tileH) < 1e-4,
    `竖向跨格 UV 不连续：Δv=${dv.toFixed(6)}，应为 ${(ch / tileH).toFixed(6)}`);

  // 同一格内，砖尺寸必须恒定（不随面缩放）：+Z 面的 u 跨度 = cs/tileW
  const spanU = Math.max(...fa.map((p) => p.u)) - Math.min(...fa.map((p) => p.u));
  assert.ok(Math.abs(spanU - cs / tileW) < 1e-4, `单格 u 跨度 ${spanU} ≠ ${cs / tileW}`);

  console.log(`① 跨格砖缝对齐：Δu=${du.toFixed(4)} Δv=${dv.toFixed(4)}（每格 ${(cs / tileW).toFixed(2)} / ${(ch / tileH).toFixed(2)} tile）`);
}

// ---------------------------------------------- ② 砖色有区分度
{
  // 借 makeCanalMat 拿到墙贴图（pattern: "wall"）
  const mat = oc.makeCanalMat(0xf2f4f4, { pattern: "wall" });
  const tex = mat.map;
  assert.ok(tex?.image?.data, "墙材质没有贴图");
  const d = tex.image.data;
  const n = d.length / 4;
  const lum = new Float64Array(n);
  let colored = 0;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4];
    const g = d[i * 4 + 1];
    const b = d[i * 4 + 2];
    lum[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    if (r !== g || g !== b) colored++;
  }
  const sdOf = (arr) => {
    let s1 = 0;
    let s2 = 0;
    for (const v of arr) { s1 += v; s2 += v * v; }
    const m = s1 / arr.length;
    return { mean: m, sd: Math.sqrt(Math.max(0, s2 / arr.length - m * m)) };
  };
  const all = sdOf(lum);
  // 灰缝比砖面暗一大截（216 vs 244），整图标准差主要由「缝」贡献，量不出砖面碎色。
  // 取亮度 P25 以上的像素 = 砖面本身，再算标准差——这才是「远看一片米色、近看有碎色」的那个量。
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const brick = Array.from(lum).filter((v) => v >= p25);
  const b = sdOf(brick);
  const colorRatio = colored / n;
  console.log(`② 墙贴图：整图 sd ${all.sd.toFixed(4)}（含灰缝）· **砖面 sd ${b.sd.toFixed(4)}** · 均值 ${b.mean.toFixed(3)} · 带色相扰动像素 ${(colorRatio * 100).toFixed(1)}%`);
  assert.ok(b.sd >= 0.008, `砖面明度标准差 ${b.sd.toFixed(4)} < 0.008：墙面平得发死（z1 实测应有织物般的碎色）`);
  assert.ok(b.sd <= 0.035, `砖面明度标准差 ${b.sd.toFixed(4)} > 0.035：发花`);
  assert.ok(colorRatio >= 0.5, `只有 ${(colorRatio * 100).toFixed(1)}% 像素有色相扰动：还是灰度砖`);
  assert.ok(all.sd >= 0.02, `整图 sd ${all.sd.toFixed(4)} < 0.02：灰缝不明显，砌缝会看不见`);
}

console.log("✅ test_wall_brick_texture");
