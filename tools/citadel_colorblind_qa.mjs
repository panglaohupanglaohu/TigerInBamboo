#!/usr/bin/env node
// =====================================================================
//  V6-G12 可读性与无障碍 QA · 纯图像分析（不 import three，纯 Node）
//  - PNG 编解码与灰度/色盲模拟在 tools/lib/colorblindSim.mjs（Machado 2009 severity=1.0）
//  - 分析：①灰度对比 token 对 ②三色盲下敌我 ΔE00 衰减 ③深夜火炬局部性
//    ④雨雾路径可读性 ⑤阳台花砖 vs 草地
//  输出：tools/out/colorblind_qa/{模拟 PNG, report.md, report.json}
// =====================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rgbToLab, deltaE00, luminance255, hexToRgb } from "./lib/pixelStats.mjs";
import { decodePng, encodePng, simulateCvd, toGray, mapImage, CVD_MATRICES } from "./lib/colorblindSim.mjs";
import { THEME, finalColor } from "../TigerMessenger/src/world/citadel/visualTheme.js";
import { CITADEL_V3_TOKENS as V3 } from "../TigerMessenger/src/world/citadelVisualTheme.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "tools/out/colorblind_qa");
const V6 = path.join(ROOT, "tools/out/citadel_v4_gpu/v6");
const V5AB = path.join(ROOT, "tools/out/lighting_v5_ab");
const K4 = path.join(ROOT, "tools/out/local_lights");
fs.mkdirSync(OUT, { recursive: true });

// ---------- 图像区域统计助手 ----------
// maskFn(r,g,b,x,y)→bool；返回 {count, bbox:[x0,y0,x1,y1], meanLab, meanY}
function regionStats(img, maskFn) {
  let count = 0, x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  let sL = 0, sa = 0, sb = 0, sY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      if (!maskFn(r, g, b, x, y)) continue;
      count++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      const lab = rgbToLab(r, g, b);
      sL += lab.L; sa += lab.a; sb += lab.b; sY += luminance255(r, g, b);
    }
  }
  if (!count) return { count: 0 };
  return {
    count,
    bbox: [x0, y0, x1, y1],
    bboxAreaFrac: +(((x1 - x0 + 1) * (y1 - y0 + 1)) / (img.width * img.height)).toFixed(4),
    meanLab: { L: +(sL / count).toFixed(2), a: +(sa / count).toFixed(2), b: +(sb / count).toFixed(2) },
    meanY: +(sY / count).toFixed(2),
  };
}
// 明度分位数（全图或下 40% 地带）
function lumaQuantiles(img, band) {
  const ys = [];
  const yStart = band === "bottom" ? Math.floor(img.height * 0.6) : 0;
  for (let y = yStart; y < img.height; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * 4;
      ys.push(luminance255(img.data[i], img.data[i + 1], img.data[i + 2]));
    }
  }
  ys.sort((p, q) => p - q);
  const q = (p) => +ys[Math.min(ys.length - 1, Math.floor(ys.length * p))].toFixed(1);
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  const std = Math.sqrt(ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length);
  return { p10: q(0.1), p50: q(0.5), p90: q(0.9), std: +std.toFixed(2) };
}
const readPng = (p) => decodePng(fs.readFileSync(p));
const nearColor = (hex, maxDE) => {
  const { r, g, b } = hexToRgb(hex);
  const t = rgbToLab(r, g, b);
  return (pr, pg, pb) => deltaE00(rgbToLab(pr, pg, pb), t) <= maxDE;
};
// 暖橙火炬像素判定：与 tools/e2e/local_lights_e2e.mjs measureWarmShare 完全同规则
// （r>140 且 0.3r<g<0.75r 且 b<0.35r 且 r-b>80；橙焰 #FF8A32 系，排除鲑鱼粉屋顶 b≈0.4r）
function isTorchPixel(r, g, b) {
  return r > 140 && g > 0.3 * r && g < 0.75 * r && b < 0.35 * r && r - b > 80;
}
// 局部性：8×5 网格中暖橙占比 ≥2 倍全图均值的“热格”数与热格暖橙占比集中度
function torchLocality(img) {
  const GX = 8, GY = 5;
  const cellWarm = new Array(GX * GY).fill(0);
  const cellTotal = new Array(GX * GY).fill(0);
  let warm = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const c = Math.min(GY - 1, Math.floor((y / img.height) * GY)) * GX + Math.min(GX - 1, Math.floor((x / img.width) * GX));
      cellTotal[c]++;
      if (isTorchPixel(img.data[i], img.data[i + 1], img.data[i + 2])) {
        cellWarm[c]++;
        warm++;
      }
    }
  }
  const total = img.width * img.height;
  const share = warm / total;
  let hotCells = 0, hotWarm = 0;
  for (let c = 0; c < GX * GY; c++) {
    if (cellTotal[c] && cellWarm[c] / cellTotal[c] >= 2 * share && cellWarm[c] > 20) {
      hotCells++;
      hotWarm += cellWarm[c];
    }
  }
  return { share, hotCells, hotWarmFrac: warm ? hotWarm / warm : 0 };
}

// ---------- 主题色：V4 THEME（v6 截图实际管线）+ V3 补充 ----------
const graded = (token, weather, timeBand) => finalColor(token, { weather, timeBand });
const GRADE_CTX = {
  clear: ["clear", "day"],
  night: ["night", "night"],
  rain: ["rain", "day"],
  sunset: ["sunset", "dusk"],
};
const tokenOf = (t) => THEME[t] || V3[t];
const f2 = (v) => +v.toFixed(2);

// ---------- 分析 ①：灰度对比（token 对 ΔL* / ΔY） ----------
const GRAY_PAIRS = [
  ["敌我主色", "unitDefenderMain", "unitAttackerMain"],
  ["枪尖 vs 守军盾面", "unitSteel", "unitDefenderMain"],
  ["枪尖 vs 攻方主色", "unitSteel", "unitAttackerMain"],
  ["黄铜盔 vs 守军蓝", "unitMetal", "unitDefenderMain"],
  ["火炬 vs 深夜天空", "unitTorch", "envSkyTop"],
  ["门洞焦点 vs 门洞暗部", "castleGateFocus", "castleWindow"],
  ["台阶铺装 vs 主墙", "castlePlaza", "castleWallChalk"],
  ["瀑布水沫 vs 主水色", "envFoam", "envWater"],
  ["瀑布水沫 vs 深潭", "envFoam", "envWaterDeep"],
];
const grayRows = [];
for (const [label, ta, tb] of GRAY_PAIRS) {
  for (const g of Object.keys(GRADE_CTX)) {
    const ctx = { weather: GRADE_CTX[g][0], timeBand: GRADE_CTX[g][1] };
    // V3 补充 token（unitSteel/unitMetal/envFoam/envWaterDeep）无 grade 管线，用原色
    const ha = THEME[ta] ? finalColor(ta, ctx) : V3[ta];
    const hb = THEME[tb] ? finalColor(tb, ctx) : V3[tb];
    const ca = hexToRgb(ha), cb = hexToRgb(hb);
    const dL = Math.abs(rgbToLab(ca.r, ca.g, ca.b).L - rgbToLab(cb.r, cb.g, cb.b).L);
    const dY = Math.abs(luminance255(ca.r, ca.g, ca.b) - luminance255(cb.r, cb.g, cb.b));
    grayRows.push({ pair: label, a: ta, b: tb, grade: g, hexA: ha, hexB: hb, dL: f2(dL), dY: f2(dY) });
  }
}

// ---------- 分析 ②：三色盲下识别色 ΔE00 衰减 ----------
const CVD_PAIRS = [
  ["敌我主色", "unitDefenderMain", "unitAttackerMain"],
  ["敌船 vs 守军蓝", "shipEnemyHull", "unitDefenderMain"],
  ["花砖coral vs 草地", "#C89082", "envGrass"],
  ["花砖sage vs 草地", "#7FA98C", "envGrass"],
  ["花砖mustard vs 干草", "#B4A06B", "envDryGrass"],
  ["火炬 vs 血迹", "unitTorch", "battleBloodFresh"],
];
const cvdRows = [];
for (const [label, ta, tb] of CVD_PAIRS) {
  for (const g of ["clear", "night"]) {
    const ctx = { weather: GRADE_CTX[g][0], timeBand: GRADE_CTX[g][1] };
    const colOf = (t) => (t.startsWith("#") ? hexToRgb(t) : hexToRgb(THEME[t] ? finalColor(t, ctx) : V3[t]));
    const ca = colOf(ta), cb = colOf(tb);
    const row = { pair: label, grade: g, normal: f2(deltaE00(rgbToLab(ca.r, ca.g, ca.b), rgbToLab(cb.r, cb.g, cb.b))) };
    for (const type of Object.keys(CVD_MATRICES)) {
      const sa = simulateCvd(ca.r, ca.g, ca.b, type), sb = simulateCvd(cb.r, cb.g, cb.b, type);
      const de = deltaE00(rgbToLab(sa.r, sa.g, sa.b), rgbToLab(sb.r, sb.g, sb.b));
      row[type] = f2(de);
      row[type + "DecayPct"] = f2((1 - de / Math.max(0.01, row.normal)) * 100);
    }
    cvdRows.push(row);
  }
}

// ---------- 截图像素级分析 ----------
const sim = { shots: [], torch: [], rain: [], tiles: null, faction: [] };
const shot = (dir, name) => readPng(path.join(dir, name));

// ②b 选定截图生成模拟 PNG（灰度 + 三色盲）
const SIM_SHOTS = [
  [V6, "clear_siege-clash.png", "v6/clear/siege-clash"],
  [V6, "night_siege-clash.png", "v6/night/siege-clash"],
  [V6, "rain_trojan-infil.png", "v6/rain/trojan-infil"],
  [V6, "clear_citadel-overview.png", "v6/clear/citadel-overview"],
  [V5AB, "v5_night_trojan-infil.png", "v5/night/trojan-infil"],
  [K4, "on_trojan-infil.png", "k4/on/trojan-infil"],
];
for (const [dir, name, camId] of SIM_SHOTS) {
  const img = shot(dir, name);
  const base = name.replace(/\.png$/, "");
  fs.writeFileSync(path.join(OUT, `${base}__gray.png`), encodePng(img.width, img.height, mapImage(img, toGray).data));
  for (const type of Object.keys(CVD_MATRICES)) {
    fs.writeFileSync(
      path.join(OUT, `${base}__${type}.png`),
      encodePng(img.width, img.height, mapImage(img, (r, g, b) => simulateCvd(r, g, b, type)).data)
    );
  }
  sim.shots.push({ camera: camId, file: name });
}

// ②c 敌我像素检测（v6 晴/夜 siege-clash）：色度匹配 graded token（ΔE00≤18）
// 并加通道方向约束排除近色背景（守军蓝 b>r；攻方酒紫 r≥b），防止宽松阈值把天空/暗部全算进来
for (const g of ["clear", "night"]) {
  const img = shot(V6, `${g}_siege-clash.png`);
  const ctx = { weather: GRADE_CTX[g][0], timeBand: GRADE_CTX[g][1] };
  const nearDef = nearColor(finalColor("unitDefenderMain", ctx), 18);
  const nearAtt = nearColor(finalColor("unitAttackerMain", ctx), 18);
  const def = regionStats(img, (r, gg, b) => b > r && nearDef(r, gg, b));
  const att = regionStats(img, (r, gg, b) => r >= b && nearAtt(r, gg, b));
  const entry = { camera: `v6/${g}/siege-clash`, file: `${g}_siege-clash.png`, defender: def, attacker: att };
  if (def.count >= 500 && att.count >= 500) {
    entry.grayDL = f2(Math.abs(def.meanLab.L - att.meanLab.L));
    entry.meanDE = f2(deltaE00(def.meanLab, att.meanLab));
  } else entry.note = "像素检出量不足（<500），对间距离不可靠，以 token 级为准";
  sim.faction.push(entry);
}

// ③ 深夜火炬局部性：K4 on/off 对照 + v5/v6 深夜木马
for (const [dir, name, camId] of [
  [K4, "on_trojan-infil.png", "k4/on/trojan-infil"],
  [K4, "off_trojan-infil.png", "k4/off/trojan-infil"],
  [V5AB, "v5_night_trojan-infil.png", "v5/night/trojan-infil"],
  [V6, "night_trojan-infil.png", "v6/night/trojan-infil"],
]) {
  const img = shot(dir, name);
  const warm = regionStats(img, isTorchPixel);
  const rest = regionStats(img, (r, g, b) => !isTorchPixel(r, g, b));
  const loc = torchLocality(img);
  sim.torch.push({
    camera: camId,
    file: name,
    warmShare: +(loc.share * 100).toFixed(2),
    hotCells: `${loc.hotCells}/40`,
    hotWarmFrac: +loc.hotWarmFrac.toFixed(3),
    bboxAreaFrac: warm.bboxAreaFrac ?? null,
    warmL: warm.meanLab ? warm.meanLab.L : null,
    restL: rest.meanLab ? rest.meanLab.L : null,
    graySeparationDL: warm.meanLab && rest.meanLab ? f2(Math.abs(warm.meanLab.L - rest.meanLab.L)) : null,
  });
}

// ④ 雨雾路径可读性：晴/雨同机位对照（v6）
for (const cam of ["citadel-overview", "trojan-infil", "harbor", "waterfall-l1"]) {
  const clearImg = shot(V6, `clear_${cam}.png`);
  const rainImg = shot(V6, `rain_${cam}.png`);
  const cQ = lumaQuantiles(clearImg), rQ = lumaQuantiles(rainImg);
  const cB = lumaQuantiles(clearImg, "bottom"), rB = lumaQuantiles(rainImg, "bottom");
  const fogNear = nearColor(THEME.envFog, 14);
  sim.rain.push({
    camera: `v6/rain/${cam}`,
    file: `rain_${cam}.png`,
    fogFracPct: +((regionStats(rainImg, fogNear).count / (rainImg.width * rainImg.height)) * 100).toFixed(1),
    clearFogFracPct: +((regionStats(clearImg, fogNear).count / (clearImg.width * clearImg.height)) * 100).toFixed(1),
    clearContrast: f2(cQ.p90 / Math.max(1, cQ.p10)),
    rainContrast: f2(rQ.p90 / Math.max(1, rQ.p10)),
    contrastRatio: f2(rQ.p90 / Math.max(1, rQ.p10) / (cQ.p90 / Math.max(1, cQ.p10))),
    bottomStdClear: cB.std,
    bottomStdRain: rB.std,
    bottomStdRatio: f2(rB.std / Math.max(0.01, cB.std)),
  });
}

// ⑤ 阳台花砖 vs 草地（v6 晴 citadel-overview，token 级 + 像素级）
const tileHexes = ["#C89082", "#7FA6AC", "#B4A06B", "#7FA98C"];
const tileNames = ["coral", "teal", "mustard", "sage"];
const grassLab = (() => { const c = hexToRgb(THEME.envGrass); return rgbToLab(c.r, c.g, c.b); })();
const tileTokenRows = tileHexes.map((hex, i) => {
  const c = hexToRgb(hex);
  const lab = rgbToLab(c.r, c.g, c.b);
  return { tile: tileNames[i], hex, dE00: f2(deltaE00(lab, grassLab)), dL: f2(Math.abs(lab.L - grassLab.L)) };
});
{
  const img = shot(V6, "clear_citadel-overview.png");
  const grass = regionStats(img, nearColor(THEME.envGrass, 12));
  const tiles = tileHexes.map((hex, i) => ({ tile: tileNames[i], ...regionStats(img, nearColor(hex, 12)) }));
  sim.tiles = {
    camera: "v6/clear/citadel-overview",
    file: "clear_citadel-overview.png",
    tokenLevel: tileTokenRows,
    pixels: { grass, tiles },
  };
  for (const t of tiles) {
    if (t.count && grass.count) {
      t.vsGrassDE = f2(deltaE00(t.meanLab, grass.meanLab));
      t.vsGrassDL = f2(Math.abs(t.meanLab.L - grass.meanLab.L));
    }
  }
}

// ---------- 缺陷分级（规则先行，只对测得证据出条目） ----------
const defects = [];
// P0：敌我任一色盲下 ΔE00<8 或灰度 ΔL*<4
for (const r of cvdRows.filter((x) => x.pair === "敌我主色")) {
  for (const t of ["protanopia", "deuteranopia", "tritanopia"]) {
    if (r[t] < 8) defects.push({ level: "P0", item: `敌我识别色 ${t} 下近乎不可分`, evidence: `${r.grade} ΔE00=${r[t]}（正常 ${r.normal}）`, camera: "token 级", suggestion: "攻/守阵营需引入明度或形状冗余编码（如盾形/描边 token），unitAttackerMain/unitDefenderMain 色板调整" });
    else if (r[t] < 15) defects.push({ level: "P1", item: `敌我识别色 ${t} 下区分度弱`, evidence: `${r.grade} ΔE00=${r[t]}（正常 ${r.normal}，衰减 ${r[t + "DecayPct"]}%）`, camera: "token 级", suggestion: "提高两阵营 L* 间距至 ≥15" });
  }
}
for (const r of grayRows.filter((x) => x.pair === "敌我主色")) {
  if (r.dL < 4) defects.push({ level: "P0", item: "敌我灰度不可分", evidence: `${r.grade} ΔL*=${r.dL}`, camera: "token 级", suggestion: "同上色板调整" });
  else if (r.dL < 8) defects.push({ level: "P1", item: "敌我灰度区分度弱", evidence: `${r.grade} ΔL*=${r.dL}`, camera: "token 级", suggestion: "拉开明度差" });
}
for (const r of grayRows) {
  if (r.pair !== "敌我主色" && r.dL < 4)
    defects.push({ level: "P2", item: `灰度弱区分：${r.pair}`, evidence: `${r.grade} ΔL*=${r.dL}（${r.hexA} vs ${r.hexB}）`, camera: "token 级", suggestion: "检查该语义对在灰度下是否承担导航职责" });
}
for (const r of sim.rain) {
  if (r.contrastRatio < 0.6 && r.fogFracPct > 45)
    defects.push({ level: "P1", item: "雨雾吞没路径风险", evidence: `${r.camera} 对比度比=${r.contrastRatio}，雾色占比=${r.fogFracPct}%（晴 ${r.clearFogFracPct}%），地表明度 std 比=${r.bottomStdRatio}`, camera: r.camera, suggestion: "雨 grade 下提高路径 plaza 的 route-facing 提亮或降低雾不透明度" });
  else if (r.bottomStdRatio < 0.7)
    defects.push({ level: "P2", item: "雨天近地细节压缩", evidence: `${r.camera} 地表明度 std 比=${r.bottomStdRatio}`, camera: r.camera, suggestion: "关注路径可读性，必要时雨天增强 plaza/描边对比" });
}
if (sim.tiles) {
  for (const t of sim.tiles.tokenLevel) {
    if (t.dL < 6 && t.dE00 < 12)
      defects.push({ level: "P2", item: `花砖 ${t.tile} 与草地灰度/色度接近`, evidence: `token ΔL*=${t.dL} ΔE00=${t.dE00}`, camera: sim.tiles.camera, suggestion: "花砖面积小则风险低；若大面积铺地需拉开与 envGrass 的 L*" });
  }
}
// 色盲下花砖误读为草地/干草：正常可分（ΔE00≥15）但某色盲下 ΔE00<8
for (const r of cvdRows.filter((x) => x.pair.includes("花砖"))) {
  for (const t of ["protanopia", "deuteranopia", "tritanopia"]) {
    if (r.normal >= 15 && r[t] < 8)
      defects.push({ level: "P2", item: `${r.pair} 在 ${t} 下误读`, evidence: `${r.grade} 正常 ΔE00=${r.normal} → ${t} ΔE00=${r[t]}（衰减 ${r[t + "DecayPct"]}%）`, camera: "v6/clear/citadel-overview", suggestion: "阳台花砖为装饰元素，风险低；若用于可行走面提示需加明度/纹理冗余" });
  }
  if (r.normal < 10)
    defects.push({ level: "P2", item: `${r.pair} 正常视觉即近似`, evidence: `${r.grade} 正常 ΔE00=${r.normal}`, camera: "v6/clear/citadel-overview", suggestion: "同上，装饰元素低风险" });
}
for (const t of sim.torch) {
  if (t.camera.startsWith("k4/off")) continue;
  if (t.graySeparationDL != null && t.graySeparationDL < 10)
    defects.push({ level: "P2", item: "火炬引导区灰度分离度不足", evidence: `${t.camera} 引导区与背景 ΔL*=${t.graySeparationDL}`, camera: t.camera, suggestion: "提高火炬光池强度或压暗周边" });
  if (typeof t.hotWarmFrac === "number" && t.hotWarmFrac < 0.4)
    defects.push({ level: "P2", item: "深夜火炬暖橙分散、非局部引导", evidence: `${t.camera} 热格集中度=${t.hotWarmFrac}，bbox占画面=${t.bboxAreaFrac}`, camera: t.camera, suggestion: "收敛火炬光池半径或削减环境暖色" });
}

// ---------- 输出 report.json / report.md ----------
const report = { grayRows, cvdRows, sim, defects };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
const md = [];
md.push("# V6-G12 可读性与无障碍 QA（纯图像分析）\n");
md.push("方法：CIE L* / CIEDE2000（tools/lib/pixelStats.mjs）；灰度=ITU-R BT.709 luma；");
md.push("色盲模拟=Machado et al. 2009 severity=1.0 三矩阵（线性 sRGB 域，仅全色盲无中间型）。\n");
md.push("注意：①② 的 night grade 经 finalColor 双重 lift（weather −0.18 + timeBand −0.12），token 值比实际渲染更暗，night 行仅供相对比较；");
md.push("像素级色度匹配受光照/雾影响，检出量不足时以 token 级为准；teal/sage 花砖 mask 与雾/水面近色有污染，质心距离仅供参考。\n");
md.push("## ① 灰度对比（token 对 ΔL* / ΔY）\n");
md.push("| 语义对 | grade | 色A | 色B | ΔL* | ΔY | 判定 |");
md.push("|---|---|---|---|---|---|---|");
for (const r of grayRows)
  md.push(`| ${r.pair} | ${r.grade} | ${r.hexA} | ${r.hexB} | ${r.dL} | ${r.dY} | ${r.dL >= 10 ? "清晰" : r.dL >= 4 ? "弱" : "不可分"} |`);
md.push("\n## ② 三色盲下识别色 ΔE00 衰减\n");
md.push("| 色对 | grade | 正常 | protan | deutan | tritan | 最大衰减 |");
md.push("|---|---|---|---|---|---|---|");
const fmtDecay = (v) => (v >= 0 ? `-${v}%` : `+${-v}%`); // 负衰减=模拟后距离反而增大
for (const r of cvdRows) {
  const worst = Math.max(0, r.protanopiaDecayPct, r.deuteranopiaDecayPct, r.tritanopiaDecayPct);
  md.push(`| ${r.pair} | ${r.grade} | ${r.normal} | ${r.protanopia} (${fmtDecay(r.protanopiaDecayPct)}) | ${r.deuteranopia} (${fmtDecay(r.deuteranopiaDecayPct)}) | ${r.tritanopia} (${fmtDecay(r.tritanopiaDecayPct)}) | ${worst > 0 ? `-${worst}%` : "无衰减"} |`);
}
md.push("\n模拟 PNG 输出于 tools/out/colorblind_qa/（`__gray/__protanopia/__deuteranopia/__tritanopia`）：");
for (const s of sim.shots) md.push(`- ${s.camera} → ${s.file}`);
md.push("\n### 敌我像素检测（v6 siege-clash，ΔE00≤18 + 通道方向约束）\n");
for (const f of sim.faction)
  md.push(`- ${f.camera}（${f.file}）：守军像素 ${f.defender.count}${f.defender.bbox ? ` bbox=${f.defender.bbox}` : ""}；攻方像素 ${f.attacker.count}${f.attacker.bbox ? ` bbox=${f.attacker.bbox}` : ""}${f.grayDL != null ? `；灰度 ΔL*=${f.grayDL}，色度 ΔE00=${f.meanDE}` : `；${f.note}`}`);
md.push("\n## ③ 深夜火炬局部性（暖橙判定与 K4 measureWarmShare 同规则）\n");
md.push("| camera | 文件 | 暖橙占比% | 热格数/40 | 热格集中度 | 暖橙bbox占画面 | 引导区L* | 背景L* | 灰度分离ΔL* |");
md.push("|---|---|---|---|---|---|---|---|---|");
for (const t of sim.torch)
  md.push(`| ${t.camera} | ${t.file} | ${t.warmShare} | ${t.hotCells} | ${t.hotWarmFrac} | ${t.bboxAreaFrac ?? "-"} | ${t.warmL ?? "-"} | ${t.restL != null ? t.restL.toFixed(1) : "-"} | ${t.graySeparationDL ?? "-"} |`);
{
  const on = sim.torch.find((t) => t.camera === "k4/on/trojan-infil");
  const off = sim.torch.find((t) => t.camera === "k4/off/trojan-infil");
  if (on && off)
    md.push(`\nK4 on/off 对照：暖橙占比 ${on.warmShare}% vs ${off.warmShare}%（开灯净增 ${f2(on.warmShare - off.warmShare)} 个百分点；K4 e2e 报告 on=6.07%，本脚本全分辨率同规则复测）。`);
}
md.push("\n## ④ 雨雾路径可读性（晴/雨同机位）\n");
md.push("| camera | 雾色占比雨/晴% | 对比度p90/p10 雨 | 晴 | 对比度比 | 地表std 雨/晴 | std比 |");
md.push("|---|---|---|---|---|---|---|");
for (const r of sim.rain)
  md.push(`| ${r.camera} | ${r.fogFracPct}/${r.clearFogFracPct} | ${r.rainContrast} | ${r.clearContrast} | ${r.contrastRatio} | ${r.bottomStdRain}/${r.bottomStdClear} | ${r.bottomStdRatio} |`);
md.push("\n## ⑤ 阳台花砖 vs 草地\n");
md.push(`camera: ${sim.tiles.camera}（${sim.tiles.file}）\n`);
md.push("token 级：");
md.push("| 花砖 | hex | vs envGrass ΔE00 | ΔL* |");
md.push("|---|---|---|---|");
for (const t of sim.tiles.tokenLevel) md.push(`| ${t.tile} | ${t.hex} | ${t.dE00} | ${t.dL} |`);
md.push("\n像素级（ΔE00≤12 色度匹配，阈值收紧以排除近似背景）：");
md.push(`- 草地像素 ${sim.tiles.pixels.grass.count}${sim.tiles.pixels.grass.bbox ? ` bbox=${sim.tiles.pixels.grass.bbox}` : ""}`);
for (const t of sim.tiles.pixels.tiles)
  md.push(`- 花砖 ${t.tile}：像素 ${t.count}${t.bbox ? ` bbox=${t.bbox}` : ""}${t.vsGrassDE != null ? `；vs 草地质心 ΔE00=${t.vsGrassDE} ΔL*=${t.vsGrassDL}` : ""}`);
md.push("\n## 缺陷表（P0>P1>P2，仅列有测量证据项）\n");
if (!defects.length) md.push("（无）");
else {
  md.push("| 级别 | 缺陷 | 证据 | camera | 建议 |");
  md.push("|---|---|---|---|---|");
  for (const d of [...defects].sort((a, b) => a.level.localeCompare(b.level)))
    md.push(`| ${d.level} | ${d.item} | ${d.evidence} | ${d.camera} | ${d.suggestion} |`);
}
md.push("\n## 素材\n- v6 固定镜头：tools/out/citadel_v4_gpu/v6/（camera ID 见 citadel_v4_gpu_matrix_v6.json）");
md.push("- V5 光照 A/B：tools/out/lighting_v5_ab/；K4 局部灯：tools/out/local_lights/\n");
fs.writeFileSync(path.join(OUT, "report.md"), md.join("\n"));
console.log(`完成：${OUT}`);
console.log(`缺陷条目：P0=${defects.filter((d) => d.level === "P0").length} P1=${defects.filter((d) => d.level === "P1").length} P2=${defects.filter((d) => d.level === "P2").length}`);
