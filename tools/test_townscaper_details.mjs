// 建筑构件细节（Townscaper 立面层次）单元测试：
//   檐口线 / 墙裙 / 窗台窗楣 / 转角壁柱 / 阳台 / 连拱柱廊 / 屋脊瓦 / 挑檐 / 山墙圆窗 / 风向标
// 运行：node tools/test_townscaper_details.mjs
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
const { buildCitadelTownAssembly } = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);

let pass = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };

const makeFloor = (cells) => {
  const rows = [];
  for (let iz = 0; iz < 25; iz++) {
    let line = "";
    for (let ix = 0; ix < 25; ix++) {
      line += cells.get(`${ix},${iz}`) ?? ".";
    }
    rows.push(line);
  }
  return rows;
};
const C = (x, z, ch = "0") => new Map([[`${x},${z}`, ch]]);

// ---------- 1. 立面层次：独立柱（四面开敞）→ 檐口/墙裙/壁柱 ----------
{
  const spec = {
    cellSize: 2.0, cellHeight: 2.0, gridSize: 25,
    levels: [
      makeFloor(new Map([["12,12", "0"], ["12,13", "0"], ["13,12", "0"], ["13,13", "0"]])),
      makeFloor(new Map([["12,12", "0"], ["13,12", "0"]])),
      makeFloor(new Map()),
      makeFloor(new Map()),
      makeFloor(new Map()),
    ],
  };
  const a = buildCitadelTownAssembly(spec, { baseY: 0 });
  const s = a.stats;
  assert(s.corniceCount >= 4, `檐口线应出（实际 ${s.corniceCount}）`);
  assert(s.plinthCount >= 4, `墙裙应出（实际 ${s.plinthCount}）`);
  assert(s.pilasterCount >= 4, `转角壁柱应出（实际 ${s.pilasterCount}）`);
  ok(`檐口线 ${s.corniceCount} · 墙裙 ${s.plinthCount} · 转角壁柱 ${s.pilasterCount}`);
}

// ---------- 2. 阳台：外露面户种子生成 ----------
{
  const spec = {
    cellSize: 2.0, cellHeight: 2.0, gridSize: 25,
    levels: [
      makeFloor(C(12, 12, "3")),
      makeFloor(C(12, 12, "3")),
      makeFloor(new Map()),
      makeFloor(new Map()),
      makeFloor(new Map()),
    ],
  };
  const a = buildCitadelTownAssembly(spec, { baseY: 0 });
  const s = a.stats;
  assert(s.balconyCount >= 0, "阳台不报错");
  // 2 层单柱四面开敞：每层外露 4 面 × 户种子 30% → 期望约 1-4 个
  assert(s.balconyCount >= 1 && s.balconyCount <= 8, `单柱阳台应 1-8（实际 ${s.balconyCount}）`);
  ok(`阳台 ${s.balconyCount} 个（户种子 30% 分布）`);
}

// ---------- 3. 连拱柱廊：连续悬空段 ----------
{
  // 二层条带 4 格（11-14, 12），一层只两端有支撑（10,12 与 15,12）→ 中间 11-14 悬空
  const spec = {
    cellSize: 2.0, cellHeight: 2.0, gridSize: 25,
    levels: [
      makeFloor(new Map([["10,12", "0"], ["15,12", "0"]])),
      makeFloor(new Map([
        ["10,12", "0"], ["11,12", "0"], ["12,12", "0"], ["13,12", "0"], ["14,12", "0"], ["15,12", "0"],
      ])),
      makeFloor(new Map()),
      makeFloor(new Map()),
      makeFloor(new Map()),
    ],
  };
  const a = buildCitadelTownAssembly(spec, { baseY: 0 });
  const s = a.stats;
  assert(s.arcadeColumnCount >= 1, `连拱柱廊细柱应出（实际 ${s.arcadeColumnCount}）`);
  assert(s.archCount >= 3, `连拱拱数 ≥3（实际 ${s.archCount}）`);
  ok(`连拱柱廊：${s.archCount} 拱 + ${s.arcadeColumnCount} 细柱`);
}

// ---------- 4. 屋顶完善：条带 → 屋脊瓦 + 挑檐 + 山墙圆窗 ----------
{
  const spec = {
    cellSize: 2.0, cellHeight: 2.0, gridSize: 25,
    levels: [
      makeFloor(new Map([["11,12", "1"], ["12,12", "1"], ["13,12", "1"]])),
      makeFloor(new Map()),
      makeFloor(new Map()),
      makeFloor(new Map()),
      makeFloor(new Map()),
    ],
  };
  const a = buildCitadelTownAssembly(spec, { baseY: 0 });
  const s = a.stats;
  assert(s.ridgeCount >= 3, `屋脊瓦 ≥3（实际 ${s.ridgeCount}）`);
  assert(s.eaveCount >= 2, `挑檐 ≥2（实际 ${s.eaveCount}）`);
  assert(s.oculusCount >= 2, `山墙圆窗 ≥2（实际 ${s.oculusCount}）`);
  ok(`条带屋顶：屋脊瓦 ${s.ridgeCount} · 挑檐 ${s.eaveCount} · 山墙圆窗 ${s.oculusCount}`);
}

// ---------- 5. L 形教堂 → 风向标 ----------
{
  const L = new Map([["11,12", "2"], ["12,12", "2"], ["12,11", "2"]]);
  const spec = {
    cellSize: 2.0, cellHeight: 2.0, gridSize: 25,
    levels: [makeFloor(L), makeFloor(new Map()), makeFloor(new Map()), makeFloor(new Map()), makeFloor(new Map())],
  };
  const a = buildCitadelTownAssembly(spec, { baseY: 0 });
  const s = a.stats;
  assert(s.steepleCount >= 1, "教堂尖塔");
  const vaneCount = a.group.traverse ? (() => {
    let n = 0;
    a.group.traverse((o) => { if (o.name === "town-steeple-vane") n++; });
    return n;
  })() : 0;
  assert(vaneCount >= 1, "尖塔风向标");
  assert(s.ridgeCount >= 1, "L 形臂屋脊瓦");
  ok(`L 形教堂：尖塔 + 风向标 + 臂屋脊瓦`);
}

// ---------- 6. 默认 SPEC 全规则回归（构件不破坏既有） ----------
{
  const a = buildCitadelTownAssembly(CITADEL_TOWN_SPEC, { baseY: 0 });
  const s = a.stats;
  assert(s.cellCount >= 150, "默认体块");
  assert(s.doorCount > 0 && s.windowCount > 0, "门+窗");
  assert(s.corniceCount > 0 && s.plinthCount > 0, "檐口+墙裙");
  ok("默认 SPEC：体块/门/窗/檐口/墙裙共存（构件不破坏既有）");
}

console.log(`\n结果：${pass}/6 通过`);
process.exit(0);
