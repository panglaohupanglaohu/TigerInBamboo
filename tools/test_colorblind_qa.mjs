#!/usr/bin/env node
// =====================================================================
//  tools/lib/colorblindSim.mjs 单元测试（纯 Node，无浏览器/GPU）
//  覆盖：灰度 ITU-R BT.709 系数、Machado 2009 三矩阵已知映射、
//  灰阶恒等不变性、PNG 编解码往返、CIEDE2000 基准值。
// =====================================================================
import { simulateCvd, toGray, encodePng, decodePng, CVD_MATRICES, mapImage } from "./lib/colorblindSim.mjs";
import { rgbToLab, deltaE00, luminance255 } from "./lib/pixelStats.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const pxNear = (c, e, tol = 2) => near(c.r, e[0], tol) && near(c.g, e[1], tol) && near(c.b, e[2], tol);

// ---------- 1. 灰度 ITU-R BT.709 系数 ----------
console.log("[1] 灰度转换 ITU-R BT.709");
check("纯白 → 255", toGray(255, 255, 255).r === 255);
check("纯黑 → 0", toGray(0, 0, 0).r === 0);
check("纯红 → 0.2126*255≈54", toGray(255, 0, 0).r === Math.round(0.2126 * 255), `got ${toGray(255, 0, 0).r}`);
check("纯绿 → 0.7152*255≈182", toGray(0, 255, 0).r === Math.round(0.7152 * 255), `got ${toGray(0, 255, 0).r}`);
check("纯蓝 → 0.0722*255≈18", toGray(0, 0, 255).r === Math.round(0.0722 * 255), `got ${toGray(0, 0, 255).r}`);
{
  const g = toGray(65, 159, 210);
  check("灰度输出三通道相等", g.r === g.g && g.g === g.b);
  check("灰度值与 luminance255 一致", g.r === Math.round(luminance255(65, 159, 210)));
}

// ---------- 2. 色盲模拟：灰阶恒等（Machado 矩阵行和=1 → 无彩色保持不变） ----------
console.log("[2] 灰阶恒等（三种色盲）");
for (const type of Object.keys(CVD_MATRICES)) {
  for (const v of [0, 64, 128, 200, 255]) {
    const c = simulateCvd(v, v, v, type);
    check(`${type} 灰阶 ${v} 不变`, pxNear(c, [v, v, v], 1), `got ${c.r},${c.g},${c.b}`);
  }
}

// ---------- 3. 已知色对的预期映射（手工按矩阵推算的参考值） ----------
console.log("[3] 已知映射参考值");
// deuteranopia 纯红 #FF0000：线性 (1,0,0) → (0.367322, 0.280085, -0.01182→clamp 0)
// sRGB 编码后 ≈ (163, 144, 0)
check("deutan 红 → (163,144,0)", pxNear(simulateCvd(255, 0, 0, "deuteranopia"), [163, 144, 0]), JSON.stringify(simulateCvd(255, 0, 0, "deuteranopia")));
// protanopia 纯红：(0.152286, 0.114503, -0.003882→0) → ≈ (109, 95, 0)
check("protan 红 → (109,95,0)", pxNear(simulateCvd(255, 0, 0, "protanopia"), [109, 95, 0]), JSON.stringify(simulateCvd(255, 0, 0, "protanopia")));
// tritanopia 纯蓝 #0000FF：线性 (0,0,1) → (-0.178779→0, 0.147602, 0.3039) → ≈ (0, 107, 150)
check("tritan 蓝 → (0,107,150)", pxNear(simulateCvd(0, 0, 255, "tritanopia"), [0, 107, 150]), JSON.stringify(simulateCvd(0, 0, 255, "tritanopia")));
// 纯绿 #00FF00 在 protan/deutan 下应与纯红模拟结果显著接近（红绿混淆轴）
{
  const dRed = deltaE00(rgbToLab(...Object.values(simulateCvd(255, 0, 0, "deuteranopia"))), rgbToLab(...Object.values(simulateCvd(0, 255, 0, "deuteranopia"))));
  const pRed = deltaE00(rgbToLab(...Object.values(simulateCvd(255, 0, 0, "protanopia"))), rgbToLab(...Object.values(simulateCvd(0, 255, 0, "protanopia"))));
  const normal = deltaE00(rgbToLab(255, 0, 0), rgbToLab(0, 255, 0));
  check("deutan 红绿混淆（ΔE00 大幅低于正常）", dRed < normal * 0.6, `sim=${dRed.toFixed(1)} normal=${normal.toFixed(1)}`);
  check("protan 红绿混淆（ΔE00 大幅低于正常）", pRed < normal * 0.6, `sim=${pRed.toFixed(1)} normal=${normal.toFixed(1)}`);
}
// 蓝-黄为 protan/deutan 的保留轴：模拟后 ΔE00 应保持较大
{
  const keep = deltaE00(rgbToLab(...Object.values(simulateCvd(0, 0, 255, "deuteranopia"))), rgbToLab(...Object.values(simulateCvd(255, 255, 0, "deuteranopia"))));
  check("deutan 蓝黄仍可分（ΔE00>40）", keep > 40, `got ${keep.toFixed(1)}`);
}

// ---------- 4. PNG 编解码往返 ----------
console.log("[4] PNG 编解码往返");
{
  const w = 17, h = 9;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = (i * 7) % 256;
    rgba[i * 4 + 1] = (i * 13) % 256;
    rgba[i * 4 + 2] = (i * 29) % 256;
    rgba[i * 4 + 3] = 255;
  }
  const png = encodePng(w, h, rgba);
  const back = decodePng(png);
  check("往返尺寸一致", back.width === w && back.height === h);
  let same = true;
  for (let i = 0; i < w * h * 4; i++) if (back.data[i] !== rgba[i]) same = false;
  check("往返像素一致", same);
  check("PNG 魔数正确", png.readUInt32BE(0) === 0x89504e47);
}
// 真实截图解码（验证 unfilter 对非 filter0 内容的正确性）
{
  const fs = await import("node:fs");
  const p = new URL("./out/local_lights/off_trojan-infil.png", import.meta.url);
  const img = decodePng(fs.readFileSync(p));
  check("真实截图解码尺寸 1280x800", img.width === 1280 && img.height === 800);
  // 内容非全零、非全同值（验证滤波重建确实产生了图像结构）
  const first = img.data.slice(0, 4).join(",");
  let varied = false;
  for (let i = 4; i < img.data.length; i += 4) {
    if (img.data.slice(i, i + 3).join(",") !== first.slice(0, first.lastIndexOf(","))) { varied = true; break; }
  }
  check("真实截图像素有变化", varied);
}

// ---------- 5. CIEDE2000 / L* 基准 ----------
console.log("[5] CIEDE2000 基准");
check("黑 vs 白 ΔE00 = 100", near(deltaE00(rgbToLab(0, 0, 0), rgbToLab(255, 255, 255)), 100, 0.01));
check("同色 ΔE00 = 0", deltaE00(rgbToLab(65, 159, 210), rgbToLab(65, 159, 210)) === 0);
// Sharma 测试集经典对：Lab(50, 2.6772, -79.7751) vs Lab(50, 0, -82.7485) → ΔE00 = 2.0425
check("Sharma 基准对 ΔE00=2.0425", near(deltaE00({ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 }), 2.0425, 0.001));

// ---------- 6. mapImage 形状 ----------
{
  const img = { width: 2, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]) };
  const g = mapImage(img, toGray);
  check("mapImage 输出尺寸一致", g.width === 2 && g.height === 2 && g.data.length === 16);
  check("mapImage 灰度首像素", g.data[0] === 54 && g.data[1] === 54 && g.data[2] === 54);
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
