// =====================================================================
// C6 · 放开 C5 约束后的 100 seed 体检（TODOS C6「[Grok→Claude]」项）
//
// 产出三组数字，供 Claude 判断「WFC 路径与哈希路径的差异是不是变好」：
//   1) 可解性：矛盾（contradiction）次数、回溯次数、unresolved 格数
//   2) 成本：单次求解 ms 的 P50/P90/max
//   3) 差异：与哈希路径逐格对比——哈希路径没有"体块角色"这个域，
//      所以不能逐格比 key，只能比**结构性事实**（塔/锥顶/花园/晒台的分布、
//      顶格是否成屋顶、锥顶下是否必是塔身）。这几条正是 S19/S20 的画面事实。
//
// 运行：node tools/report_wfc_100seed.mjs
// 落盘：tools/out/wfc_100seed.json
// 非零退出 = 出现无解 seed 或结构性事实被破坏。
// =====================================================================
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const town = await import(new URL("world/citadelTown.js", SRC).href);
const { solveTownSelection } = await import(new URL("world/citadel/wfcTownSelection.js", SRC).href);

const SEEDS = 100;

function gridOf(spec, floors) {
  const layout = town.normalizeCitadelTerraceLayout(spec, floors);
  const levels = layout.levels ?? layout.terraces?.[0]?.levels ?? layout;
  return town.levelsToGrid(levels);
}

const CASES = [
  { name: "highland", grid: gridOf(town.HIGHLAND_TOWNSCAPER_TOWN_SPEC, 12) },
  { name: "canal-junction", grid: gridOf(town.CANAL_JUNCTION_TOWN_SPEC, 12) },
];

/** 这一格的上方是否还有实心格（= 不是顶格） */
const hasAbove = (grid, id) => {
  const [x, y, z] = id.split(",").map(Number);
  return grid.has(`${x},${y + 1},${z}`);
};
const below = (id) => {
  const [x, y, z] = id.split(",").map(Number);
  return `${x},${y - 1},${z}`;
};

const percentile = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))];

const report = { generatedAt: new Date().toISOString(), seeds: SEEDS, cases: {} };
let hardFail = 0;

for (const { name, grid } of CASES) {
  const cellIds = [...grid.keys()];
  const times = [];
  let fails = 0;
  let backtracks = 0;
  let observations = 0;
  let bans = 0;
  const unresolved = [];
  const familyTotals = new Map();
  // 结构性事实（每 seed 一组，最后取跨 seed 的 min/max，看它稳不稳）
  const facts = { topIsRoof: [], coneOverTower: [], gardenCount: [], towerCount: [], terraceCount: [], coneCount: [] };
  const hashFamilyTotals = new Map();

  for (let seed = 1; seed <= SEEDS; seed++) {
    const t0 = performance.now();
    const r = solveTownSelection({ grid, seed });
    times.push(performance.now() - t0);
    if (!r.ok) {
      fails++;
      for (const u of r.unresolved) unresolved.push({ seed, cell: u, reason: r.failure?.reason ?? null });
      continue;
    }
    backtracks += r.stats?.backtracks ?? 0;
    observations += r.stats?.observations ?? 0;
    bans += r.stats?.bans ?? 0;

    let topCells = 0;
    let topRoof = 0;
    let cones = 0;
    let coneOnTower = 0;
    let gardens = 0;
    let towers = 0;
    let terraces = 0;
    for (const id of cellIds) {
      const c = r.byCell[id];
      if (!c) continue;
      // 家族是「域的粗分类」（body/roof/top…），builderKey 才是画面上看得见的
      // 体块角色（tower / cone / gable / terrace…）。统计用后者，否则塔会被算成 body。
      familyTotals.set(c.variant, (familyTotals.get(c.variant) ?? 0) + 1);
      const isTop = !hasAbove(grid, id);
      if (isTop) {
        topCells++;
        if (c.variant === "gable" || c.variant === "hip" || c.variant === "cone") topRoof++;
      }
      if (c.variant === "cone") {
        cones++;
        const b = r.byCell[below(id)];
        if (b?.variant === "tower") coneOnTower++;
      }
      if (c.variant === "garden") gardens++;
      if (c.variant === "tower") towers++;
      if (c.variant === "terrace") terraces++;
    }
    facts.topIsRoof.push(topCells ? topRoof / topCells : 1);
    facts.coneOverTower.push(cones ? coneOnTower / cones : 1);
    facts.gardenCount.push(gardens);
    facts.towerCount.push(towers);
    facts.terraceCount.push(terraces);
    facts.coneCount.push(cones);
  }

  // 哈希路径的家族分布（同一批格；哈希路径的"家族"是装饰家族，取 8 项里
  // 与体块最接近的 foundation/floor 两项做对照——这里只用来说明「两边的域
  // 根本不同构」，不是逐格比对）
  for (const id of cellIds) {
    const [ix, iy, iz] = id.split(",").map(Number);
    const sel = town.townscaperModuleSelection(ix, iy, iz, grid.get(id), 0, 0);
    const k = `foundation#${sel.foundation}`;
    hashFamilyTotals.set(k, (hashFamilyTotals.get(k) ?? 0) + 1);
  }

  const okSeeds = SEEDS - fails;
  const entry = {
    cells: grid.size,
    fails,
    unresolvedCells: unresolved.length,
    unresolvedSample: unresolved.slice(0, 10),
    backtracksPerSeed: okSeeds ? +(backtracks / okSeeds).toFixed(3) : null,
    observationsPerSeed: okSeeds ? Math.round(observations / okSeeds) : null,
    bansPerSeed: okSeeds ? Math.round(bans / okSeeds) : null,
    msP50: +percentile(times, 0.5).toFixed(1),
    msP90: +percentile(times, 0.9).toFixed(1),
    msMax: +Math.max(...times).toFixed(1),
    familyShare: Object.fromEntries(
      [...familyTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([f, n]) => [f, +(n / (okSeeds * grid.size)).toFixed(4)])
    ),
    facts: {
      topIsRoofMin: +Math.min(...facts.topIsRoof).toFixed(4),
      coneOverTowerMin: +Math.min(...facts.coneOverTower).toFixed(4),
      gardenCount: [Math.min(...facts.gardenCount), Math.max(...facts.gardenCount)],
      towerCount: [Math.min(...facts.towerCount), Math.max(...facts.towerCount)],
      terraceCount: [Math.min(...facts.terraceCount), Math.max(...facts.terraceCount)],
      coneCount: [Math.min(...facts.coneCount), Math.max(...facts.coneCount)],
    },
    hashPathFamilies: hashFamilyTotals.size,
  };
  report.cases[name] = entry;

  console.log(
    `[${name}] cells=${grid.size} fails=${fails}/${SEEDS} unresolved=${unresolved.length} ` +
    `backtrack/seed=${entry.backtracksPerSeed} P50=${entry.msP50}ms P90=${entry.msP90}ms max=${entry.msMax}ms`
  );
  console.log(
    `[${name}] 顶格成屋顶 ≥${(entry.facts.topIsRoofMin * 100).toFixed(1)}% · 锥顶下是塔身 ≥${(entry.facts.coneOverTowerMin * 100).toFixed(1)}% · ` +
    `花园 ${entry.facts.gardenCount.join("–")} · 塔身 ${entry.facts.towerCount.join("–")} · 锥顶 ${entry.facts.coneCount.join("–")} · 晒台 ${entry.facts.terraceCount.join("–")}`
  );
  console.log(`[${name}] 家族占比 ${JSON.stringify(entry.familyShare)}`);

  if (fails) hardFail++;
  if (entry.facts.coneOverTowerMin < 1) hardFail++;
}

mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
writeFileSync(new URL("./out/wfc_100seed.json", import.meta.url), JSON.stringify(report, null, 2));

assert.equal(hardFail, 0, "有 seed 无解，或「锥顶下必是塔身」被破坏（见上方逐行输出）");
console.log("✅ report_wfc_100seed → tools/out/wfc_100seed.json");
