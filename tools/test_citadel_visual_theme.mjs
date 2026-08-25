// tools/test_citadel_visual_theme.mjs — V3 语义主题模块验收（PLAN 7.3/7.4/7.5 + C1）
// 运行：node tools/test_citadel_visual_theme.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const bridgeDir = path.join(root, "TigerMessenger/node_modules/three");
if (!fs.existsSync(bridgeDir)) {
  fs.mkdirSync(bridgeDir, { recursive: true });
  fs.writeFileSync(
    path.join(bridgeDir, "package.json"),
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}

const theme = await import(
  new URL("../TigerMessenger/src/world/citadelVisualTheme.js", import.meta.url).href
);
const {
  CITADEL_V3_TOKENS,
  CITADEL_V3_TOKEN_COUNT,
  CITADEL_V3_WALL_WEIGHTS,
  CITADEL_V3_WALL_NEIGHBORS,
  CITADEL_V3_GRADES,
  CITADEL_V3_MATERIALS,
  listV3Tokens,
  isValidV3Hex,
  resolveClusterWallColors,
  jitterLStar,
  jitterForKey,
  routeLightness,
  applyV3Grade,
  v3TokenHex,
  v3HexToRgb,
  v3RgbToLab,
  v3LabToRgb,
  v3HashString,
} = theme;

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

ok("token 完整性：46 项、全部合法 Hex", () => {
  const names = listV3Tokens();
  assert.equal(names.length, CITADEL_V3_TOKEN_COUNT);
  for (const name of names) {
    const v = CITADEL_V3_TOKENS[name];
    if (Array.isArray(v)) {
      assert.equal(name, "castleBalconyTiles");
      assert.equal(v.length, 4);
      v.forEach((hex) => assert.ok(isValidV3Hex(hex), `${name}: ${hex}`));
    } else {
      assert.ok(isValidV3Hex(v), `${name}: ${v}`);
    }
  }
});

ok("墙色权重 = 38/20/17/13/8/4 且和为 1", () => {
  const expected = [0.38, 0.2, 0.17, 0.13, 0.08, 0.04];
  assert.equal(CITADEL_V3_WALL_WEIGHTS.length, 6);
  CITADEL_V3_WALL_WEIGHTS.forEach(([, w], i) => assert.ok(Math.abs(w - expected[i]) < 1e-9));
  const sum = CITADEL_V3_WALL_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

ok("grade 五状态齐备 + 深夜天空/雾 override", () => {
  for (const g of ["clear", "sunset", "rain", "snow", "night"]) {
    assert.ok(CITADEL_V3_GRADES[g], `缺 grade ${g}`);
  }
  assert.equal(CITADEL_V3_GRADES.rain.satMul, 0.82);
  assert.equal(CITADEL_V3_GRADES.rain.charSatMul, 0.92);
  assert.equal(CITADEL_V3_GRADES.snow.charSatMul, 0.88);
  assert.equal(CITADEL_V3_GRADES.night.overrides.envSkyTop, "#1E2D3D");
  assert.equal(CITADEL_V3_GRADES.night.overrides.envFog, "#2B3D4D");
});

ok("材质参数：墙/布/木 0.82~0.95 & metalness 0；黄铜 0.58~0.72 / 0.15~0.28", () => {
  for (const k of ["wall", "cloth", "wood"]) {
    const m = CITADEL_V3_MATERIALS[k];
    assert.ok(m.roughness >= 0.82 && m.roughness <= 0.95, k);
    assert.equal(m.metalness, 0, k);
  }
  const brass = CITADEL_V3_MATERIALS.brass;
  assert.ok(brass.roughness >= 0.58 && brass.roughness <= 0.72);
  assert.ok(brass.metalness >= 0.15 && brass.metalness <= 0.28);
  assert.ok(CITADEL_V3_MATERIALS.water.transparent === true);
});

ok("Lab 往返：rgbToLab→labToRgb 误差 ≤2/255", () => {
  for (const hex of ["#E7ECE7", "#533842", "#A9283C", "#6F9EA4", "#C98778"]) {
    const { r, g, b } = v3HexToRgb(hex);
    const lab = v3RgbToLab(r, g, b);
    const back = v3LabToRgb(lab.L, lab.a, lab.b);
    assert.ok(Math.abs(back.r - r) <= 2, `${hex} r`);
    assert.ok(Math.abs(back.g - g) <= 2, `${hex} g`);
    assert.ok(Math.abs(back.b - b) <= 2, `${hex} b`);
  }
});

ok("建筑簇配色：同 id 稳定、主色在权重表内、辅色必为相邻色", () => {
  const c1 = resolveClusterWallColors("t1-c7");
  const c2 = resolveClusterWallColors("t1-c7");
  assert.deepEqual(c1, c2);
  const mains = new Set(CITADEL_V3_WALL_WEIGHTS.map(([t]) => t));
  for (let i = 0; i < 200; i++) {
    const { main, accent } = resolveClusterWallColors(`cluster-${i}`);
    assert.ok(mains.has(main));
    assert.ok(CITADEL_V3_WALL_NEIGHBORS[main].includes(accent), `${main} → ${accent} 非相邻`);
  }
});

ok("建筑簇主色分布趋近权重（400 簇，粉笔白占比 38%±10%）", () => {
  const counts = {};
  for (let i = 0; i < 400; i++) {
    const { main } = resolveClusterWallColors(`dist-${i}`);
    counts[main] = (counts[main] || 0) + 1;
  }
  const chalkShare = (counts.castleWallChalk || 0) / 400;
  assert.ok(chalkShare > 0.28 && chalkShare < 0.48, `chalk=${chalkShare}`);
});

ok("明度抖动：|ΔL*| ≤ 2.5+ε 且 a/b 通道不变", () => {
  for (const hex of ["#E7ECE7", "#593B47", "#88A779"]) {
    const { r, g, b } = v3HexToRgb(hex);
    const lab0 = v3RgbToLab(r, g, b);
    const j = jitterLStar(hex, 99); // 超限应被夹到 2.5
    const jn = jitterLStar(hex, -99);
    for (const [jh, expect] of [
      [j, 2.5],
      [jn, -2.5],
    ]) {
      const c = v3HexToRgb(jh);
      const lab1 = v3RgbToLab(c.r, c.g, c.b);
      assert.ok(Math.abs(lab1.L - (lab0.L + expect)) < 0.6, `${hex} ΔL=${lab1.L - lab0.L}`);
      assert.ok(Math.abs(lab1.a - lab0.a) < 1.5, `${hex} a 漂移`);
      assert.ok(Math.abs(lab1.b - lab0.b) < 1.5, `${hex} b 漂移`);
    }
  }
});

ok("jitterForKey 确定且落在 [-2.5, 2.5)", () => {
  assert.equal(jitterForKey("wall-1"), jitterForKey("wall-1"));
  for (let i = 0; i < 100; i++) {
    const d = jitterForKey(`k${i}`);
    assert.ok(d >= -2.5 && d < 2.5, `k${i}=${d}`);
  }
});

ok("路线导向明度：route 提亮 ~4 L*，back 压暗 ~3 L*", () => {
  const hex = "#B9C9C7";
  const { r, g, b } = v3HexToRgb(hex);
  const l0 = v3RgbToLab(r, g, b).L;
  const route = v3HexToRgb(routeLightness(hex, "route"));
  const back = v3HexToRgb(routeLightness(hex, "back"));
  const lRoute = v3RgbToLab(route.r, route.g, route.b).L;
  const lBack = v3RgbToLab(back.r, back.g, back.b).L;
  assert.ok(lRoute - l0 > 3 && lRoute - l0 < 5.2, `route ΔL=${lRoute - l0}`);
  assert.ok(l0 - lBack > 2 && l0 - lBack < 4.2, `back ΔL=${l0 - lBack}`);
  assert.equal(routeLightness(hex, "normal"), hex.toUpperCase());
});

ok("grade：雨降饱和、角色保留 92%、火炬豁免、深夜天空 override", () => {
  const grass = "#88A779";
  // 用 Lab 色度（chroma = √(a²+b²)）度量饱和度，避免 (hi-lo)/hi 随明度变化的伪影
  const chroma = (hex) => {
    const { r, g, b } = v3HexToRgb(hex);
    const lab = v3RgbToLab(r, g, b);
    return Math.hypot(lab.a, lab.b);
  };
  const rainEnv = applyV3Grade(grass, "rain");
  const rainChar = applyV3Grade("#416F91", "rain", { character: true });
  assert.ok(chroma(rainEnv) < chroma(grass), "环境雨未降饱和");
  // 角色 charSatMul 0.92 > 环境 0.82：同色相下角色保留更多色度
  const charBase = "#416F91";
  const envBase = applyV3Grade(charBase, "rain");
  assert.ok(chroma(rainChar) > chroma(envBase), "角色保留应高于环境");
  // 火炬豁免降饱和（lift 仍生效）：同色下火炬色度 > 环境 grade 色度
  const rainTorch = applyV3Grade("#FFB347", "rain", { torch: true });
  const rainTorchAsEnv = applyV3Grade("#FFB347", "rain");
  assert.ok(chroma(rainTorch) > chroma(rainTorchAsEnv), "火炬必须豁免降饱和");
  const nightSky = applyV3Grade("#8EADB0", "night", { token: "envSkyTop" });
  assert.equal(nightSky, "#1E2D3D");
});

ok("v3TokenHex 主入口：未知 token 抛错；facing/jitter/grade 组合可用", () => {
  assert.throws(() => v3TokenHex("noSuchToken"));
  const a = v3TokenHex("castleWallMist", { grade: "sunset" });
  assert.ok(isValidV3Hex(a));
  const b = v3TokenHex("castleWallSand", { facing: "route", jitterKey: "cell-9" });
  assert.ok(isValidV3Hex(b));
  assert.equal(
    v3TokenHex("castleWallSand", { facing: "route", jitterKey: "cell-9" }),
    b,
    "同输入必须同输出"
  );
});

// 异步用例：直接 await，不走 ok()
{
  // 直接按绝对 URL 引 vendor three（TigerMessenger/node_modules/three 桥接的同一文件）
  const THREE = await import(
    new URL("../TigerMessenger/vendor/three.module.js", import.meta.url).href
  );
  assert.ok(THREE.ColorManagement.enabled, "r172 默认应启用 ColorManagement");
  for (const name of ["castleWallChalk", "shipEnemyHull", "battleBloodFresh"]) {
    const hex = CITADEL_V3_TOKENS[name];
    const c = new THREE.Color().setHex(parseInt(hex.slice(1), 16)); // 默认按 sRGB 输入转 Linear
    assert.equal(`#${c.getHexString()}`.toUpperCase(), hex, `${name} 往返不一致=重复转换`);
  }
  passed++;
  console.log("✓ 色彩空间只转换一次：THREE.Color.setHex 往返 = 原 hex");
}

ok("hash 稳定：v3HashString 同入同出、32bit", () => {
  assert.equal(v3HashString("abc"), v3HashString("abc"));
  assert.notEqual(v3HashString("abc"), v3HashString("abd"));
  assert.ok(v3HashString("xyz") >= 0 && v3HashString("xyz") <= 0xffffffff);
});

// ---------- C2 建筑簇划分（citadelTown.js） ----------
const { computeTownClusters, townCellFacing } = await import(
  new URL("../TigerMessenger/src/world/citadelTown.js", import.meta.url).href
);

function gridOf(levels) {
  const g = new Map();
  levels.forEach((rows, iy) =>
    rows.forEach((row, iz) =>
      [...row].forEach((c, ix) => {
        if (c !== ".") g.set(`${ix},${iy},${iz}`, c);
      })
    )
  );
  return g;
}

ok("簇划分：同字符 4 连通成一簇、异字符分簇、竖柱同簇", () => {
  const g = gridOf([
    [
      "001",
      "0.1",
      "221",
    ],
    [
      "0..", // 二层叠在 (0,0) 上：竖柱同户
      "...",
      "...",
    ],
  ]);
  const { clusterOf, baseChar } = computeTownClusters(g);
  // 三簇：0 簇（(0,0),(1,0),(0,1)）、1 簇（(2,0..2)）、2 簇（(0,2),(1,2)）
  assert.equal(clusterOf.get("0,0"), clusterOf.get("1,0"));
  assert.equal(clusterOf.get("0,0"), clusterOf.get("0,1"));
  assert.notEqual(clusterOf.get("0,0"), clusterOf.get("2,0"));
  assert.equal(clusterOf.get("2,0"), clusterOf.get("2,2"));
  assert.equal(clusterOf.get("0,2"), clusterOf.get("1,2"));
  assert.notEqual(clusterOf.get("0,2"), clusterOf.get("1,0"));
  // 竖柱：baseChar 记录最低层字符
  assert.equal(baseChar.get("0,0"), "0");
  // 簇 id 稳定
  const again = computeTownClusters(g);
  assert.equal(again.clusterOf.get("2,1"), clusterOf.get("2,1"));
});

ok("朝向：邻门=route、簇核=back、边缘=normal", () => {
  const g = gridOf([
    [
      "000",
      "0G0",
      "000",
    ],
  ]);
  const { baseChar } = computeTownClusters(g);
  assert.equal(townCellFacing(baseChar, 0, 1), "route"); // 紧邻 G
  assert.equal(townCellFacing(baseChar, 0, 0), "normal"); // 角上：有同字符邻但不邻 G、四邻不全同
  // 簇核：3×3 全同字符的中心
  const g2 = gridOf([
    [
      "000",
      "000",
      "000",
    ],
  ]);
  const b2 = computeTownClusters(g2).baseChar;
  assert.equal(townCellFacing(b2, 1, 1), "back");
});

console.log(`\n全部通过：${passed} 项`);
