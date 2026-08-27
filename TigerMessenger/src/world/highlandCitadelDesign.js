// ============================================================================
//  Highland Citadel — mountain-valley presentation layer
//
//  This layer replaces the old five terraces and waterfalls with one continuous
//  mountain-valley city. Local convention: +Y = sky, +Z = waterfront/player.
// ============================================================================
import * as THREE from "three";
import { TOWNSCAPER_HIGHLAND_PALETTE } from "./citadelTown.js?v=20260825-highland-obelisk-stone-v3";
import { mergeStaticGroup } from "./geometryMerge.js";

export const HIGHLAND_CITADEL_DESIGN_VERSION = "2026.08.27-reference-obelisk-stone-v12-vegetation-bands";

/** 高山 Townscaper 城区的统一建造/行走基面；山体在边缘连续抬升。 */
export const HIGHLAND_TOWNSCAPER_BASE_Y = 4.95;

/**
 * 高山圣城的统一厚地台。顶面保持水平，底部深入球面山体；球面高差只会
 * 改变侧壁露出的高度，不得再逐格扭曲 Townscaper 建筑。
 */
export const HIGHLAND_TOWNSCAPER_PLATFORM = Object.freeze({
  topY: HIGHLAND_TOWNSCAPER_BASE_Y,
  halfWidth: 23,
  halfDepth: 22.5,
  cornerCut: 3.0,
  thickness: 1.0,
  surfaceProvider: "highland-town-platform-v1",
});

// 视觉比例以“战船船长”为一个可测量的基准，而不是凭镜头感觉缩放。
// 战船≈4.5u，城堡最高建筑≈36u（8×），山体连续网格横向跨度≈180u（5×城堡高度）。
export const HIGHLAND_REFERENCE_PROPORTIONS = Object.freeze({
  battleShipLength: 4.5,
  castleArchitecturalHeight: 36,
  mountainRangeSpan: 180,
  castleToBattleShip: 8,
  mountainToCastle: 5,
});

export const HIGHLAND_CITADEL_DESIGN_PALETTE = Object.freeze({
  // 山体岩石配色按主人验收恢复为 2026-08-25 基线（冷蓝灰系）。
  mountainDeep: 0x14243d,
  mountainMid: 0x294766,
  mountainMist: 0x4f7897,
  mountainFace: 0x3b5f69,
  mountainHigh: 0x8095a0,
  mountainSnow: 0xd7e0df,
  // 山地植被只使用截图 2 的去饱和灰绿低模色，不使用彩色树冠。
  foliageDeep: 0x46524a,
  foliageMid: 0x64705f,
  foliageLight: 0x7e8870,
  bark: 0x665b4b,
  wallShadow: 0x7898b5,
  wallMid: 0xa9bdcf,
  wallLight: 0xd8e1e8,
  band: 0x6685a0,
  roof: 0x5d7790,
  windowDark: 0x13243a,
  windowWarm: 0xffb066,
  windowCore: 0xff6c35,
  water: 0x163c59,
  quay: 0xc5d1d8,
  boat: 0x24283a,
  mist: 0x76c9e8,
  lakeGlow: 0xff8b4e,
});

/**
 * 山地树的权威放置表。点位在山肩/山脊带上，而不是城址内部；
 * 运行时 Y 仍由 highlandTerrainSurfaceHeight(x,z) 采样，避免树根悬空。
 */
export const HIGHLAND_MOUNTAIN_TREE_PLACEMENTS = Object.freeze([
  Object.freeze({ x: -62, z: 22, scale: 1.04, band: "west-shoulder" }),
  Object.freeze({ x: -55, z: 10, scale: 0.94, band: "west-shoulder" }),
  Object.freeze({ x: -48, z: -2, scale: 0.98, band: "west-shoulder" }),
  Object.freeze({ x: -43, z: -15, scale: 1.02, band: "west-shoulder" }),
  Object.freeze({ x: 62, z: 22, scale: 1.04, band: "east-shoulder" }),
  Object.freeze({ x: 55, z: 9, scale: 0.94, band: "east-shoulder" }),
  Object.freeze({ x: 48, z: -3, scale: 0.98, band: "east-shoulder" }),
  Object.freeze({ x: 43, z: -16, scale: 1.02, band: "east-shoulder" }),
  Object.freeze({ x: -34, z: -44, scale: 1.00, band: "north-forest-belt" }),
  Object.freeze({ x: -12, z: -50, scale: 0.92, band: "north-forest-belt" }),
  Object.freeze({ x: 15, z: -50, scale: 0.96, band: "north-forest-belt" }),
  Object.freeze({ x: 37, z: -43, scale: 1.05, band: "north-forest-belt" }),
]);

/** Single continuous mountain-city ground.  It replaces all five ring shelves. */
export function highlandCityGroundHeight(x, z) {
  const climb = THREE.MathUtils.clamp((29 - z) / 58, 0, 1);
  const valleyWidth = 7.5 + (1 - climb) * 10.5;
  const side = Math.max(0, Math.abs(x) - valleyWidth);
  const sideRise = Math.pow(side / 18, 1.45) * (5.5 + climb * 10.5);
  const axialUndulation = Math.sin(x * 0.22 + z * 0.085) * 0.42
    + Math.cos(z * 0.18 - x * 0.07) * 0.28;
  const slopeGround = 2.15 + climb * 17.4 + sideRise + axialUndulation;
  // 运河古堡式逐格建筑要求单元共享同一承重基面。只在方尖碑周围做一块
  // 连续山肩，不生成旧式圆形台地；边缘用 smoothstep 与山谷坡面相接。
  // 参考图中的城市从湖岸一直铺到山腰，新的 25×25 Townscaper 种子比
  // v8 运河样例更宽。共享承重面必须覆盖完整城域，否则外圈格会被山体
  // 穿过；只在 22u 城址内压平，外圈仍平滑回到连续山坡。
  const townFootprint = Math.max(Math.abs(x) / 25.0, Math.abs(z) / 25.0);
  // 2026-08-27 地势重做（飞艇鸟瞰验收）：城址边缘从 0.80–1.08 宽过渡
  // 改为 0.90–1.04 的台地崖壁——鸟瞰时台地边界是一条清晰崖线，
  // 不再与山坡糊成一片；湖岸（z=24，footprint≈0.81）不受影响。
  const townBlend = 1 - smoothMask(0.90, 1.04, townFootprint);
  const raw = THREE.MathUtils.lerp(slopeGround, HIGHLAND_TOWNSCAPER_BASE_Y - 0.04, townBlend);
  // S13 层级台地（画面归纳）：城址外的山腰是岩石台阶，不是平滑坡面——
  // 高度量化成 ~1.35u 一级的岩层，出城 1.30 后完全台阶化，1.02–1.30 平滑过渡。
  // 城址内保持水平（建筑/编辑器/寻路承重面），湖岸线（waterfront）不受影响。
  const outCity = smoothMask(1.02, 1.30, townFootprint);
  if (outCity > 0.01) {
    const stepped = Math.floor(slopeGround / 1.35) * 1.35 + 0.9;
    return THREE.MathUtils.lerp(raw, stepped, outCity);
  }
  return raw;
}

function smoothMask(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Oskar 风格的山体高度场：主网格 + 对偶点偏移 + 交替三角剖分。
 * 边界只生成顺着山坡落到地面的侧裙，不生成一张暴露的水平底板。
 */
export function highlandMountainGridHeight(x, z) {
  const ridge = (cx, cz, width, height) => {
    const dx = (x - cx) / width;
    const dz = (z - cz) / (width * 0.78);
    return Math.exp(-(dx * dx + dz * dz) * 1.65) * height;
  };
  const shoulder = Math.max(0, 1 - Math.abs(x) / 90) * 7.5;
  const basin = Math.max(0, 1 - Math.abs(z - 18) / 54) * 3.2;
  const terraces = Math.sin(x * 0.095 + z * 0.061) * 1.4
    + Math.cos(x * 0.17 - z * 0.08) * 0.85;
  const naturalMountain = Math.max(
    0.9,
    3.2 + shoulder + basin + terraces
      + ridge(0, -34, 34, 50)
      + ridge(-48, -13, 28, 32)
      + ridge(49, -18, 30, 36)
      + ridge(-70, 26, 24, 22)
      + ridge(72, 28, 26, 24)
  );
  // 城市有自己的地表标高。先挖出一个连续的山谷城市 footprint，再让
  // 山体从城墙外缘抬升；否则山体网格会穿过建筑底座，把城堡“埋”进山里。
  const cityFootprint = Math.max(
    Math.abs(x) / 28.5,
    Math.abs(z + 1.5) / 31.5
  );
  const cityCarve = 1 - smoothMask(0.82, 1.08, cityFootprint);
  // The city floor is the authoritative walking surface. Keep the carve only
  // a few centimetres above it; a larger lift makes the mountain read as a
  // dark slab cutting through the castle podium and the soldiers' feet.
  // highlandMountainGridHeight 是球面径向高度；外层还会叠加
  // localSphericalSurfaceOffset。这里预先抵消球面下沉，让城址周围的
  // 天然土层盖到水平地台顶面，厚地台只在地下承重而不形成高墙。
  const groundedCityFloor = highlandCityGroundHeight(x, z)
    + 0.04
    - localSphericalSurfaceOffset(x, z);
  const mountainBase = THREE.MathUtils.lerp(naturalMountain, groundedCityFloor, cityCarve);
  // S13/S14 层级岩山（2026-08-27 飞艇鸟瞰重做）：出城后的山体量化成
  // ~2.6u 一级的岩石台阶（原 1.6u 太细，鸟瞰不可见），还原视频里岩石
  // 台地山的层理；城址内保持水平承重面，1.02–1.30 平滑过渡。
  const outCity = smoothMask(1.02, 1.30, cityFootprint);
  if (outCity > 0.01) {
    const stepped = Math.floor(naturalMountain / 2.6) * 2.6 + 1.3;
    return THREE.MathUtils.lerp(mountainBase, stepped, outCity);
  }
  return mountainBase;
}

/** Tangent-chart → planet surface offset. The chart is never a flat plane. */
export function localSphericalSurfaceOffset(x, z, radius = 160) {
  const rhoSq = x * x + z * z;
  return -(radius - Math.sqrt(Math.max(0, radius * radius - rhoSq)));
}

/** Townscaper 建筑、编辑器和城内寻路共用的水平地台顶面。 */
export function highlandTownscaperSurfaceHeight() {
  return HIGHLAND_TOWNSCAPER_PLATFORM.topY;
}

const HIGHLAND_TERRAIN_TILES = Object.freeze([
  { id: "meadow", edges: ["soft", "soft", "soft", "soft"], weight: 7, bias: 0 },
  { id: "slope", edges: ["ridge", "soft", "soft", "ridge"], weight: 5, bias: 1.2 },
  { id: "scree", edges: ["ridge", "ridge", "soft", "soft"], weight: 3, bias: 2.5 },
  { id: "ridge", edges: ["ridge", "ridge", "ridge", "ridge"], weight: 1, bias: 4.4 },
]);

function highlandTileCompatible(a, b, direction) {
  const opposite = (direction + 2) % 4;
  const left = HIGHLAND_TERRAIN_TILES[a].edges[direction];
  const right = HIGHLAND_TERRAIN_TILES[b].edges[opposite];
  return left === "soft" || right === "soft" || left === right;
}

function highlandSeededRandom(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** A bounded WFC collapse for the authored mountain chart. */
export function solveHighlandTerrainTiles({ cols = 18, rows = 16, seed = 20260824 } = {}) {
  const random = highlandSeededRandom(seed);
  const count = cols * rows;
  const domains = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const northness = 1 - row / Math.max(1, rows - 1);
    const ridgeBias = Math.abs(col - (cols - 1) / 2) < cols * 0.24 && northness > 0.46;
    return new Set(ridgeBias ? [1, 2, 3] : [0, 1, 2]);
  });
  const neighbors = (index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return [
      row > 0 ? [index - cols, 0] : null,
      col < cols - 1 ? [index + 1, 1] : null,
      row < rows - 1 ? [index + cols, 2] : null,
      col > 0 ? [index - 1, 3] : null,
    ].filter(Boolean);
  };
  let backtracks = 0;
  const propagate = (start) => {
    const queue = [start];
    while (queue.length) {
      const current = queue.shift();
      for (const [neighbor, direction] of neighbors(current)) {
        const target = domains[neighbor];
        const allowed = new Set();
        for (const candidate of target) {
          if ([...domains[current]].some((source) => highlandTileCompatible(source, candidate, direction))) {
            allowed.add(candidate);
          }
        }
        if (!allowed.size) return false;
        if (allowed.size !== target.size) {
          domains[neighbor] = allowed;
          queue.push(neighbor);
        }
      }
    }
    return true;
  };
  while (domains.some((domain) => domain.size > 1)) {
    const candidates = domains
      .map((domain, index) => ({ index, entropy: domain.size }))
      .filter((entry) => entry.entropy > 1)
      .sort((a, b) => a.entropy - b.entropy || a.index - b.index);
    const selected = candidates[Math.floor(random() * Math.min(candidates.length, 4))];
    if (!selected) break;
    const domain = [...domains[selected.index]];
    domain.sort((a, b) => HIGHLAND_TERRAIN_TILES[b].weight - HIGHLAND_TERRAIN_TILES[a].weight);
    const choice = domain[Math.floor(random() * domain.length)];
    const previous = domains.map((entry) => new Set(entry));
    domains[selected.index] = new Set([choice]);
    if (!propagate(selected.index)) {
      backtracks++;
      for (let index = 0; index < domains.length; index++) domains[index] = previous[index];
      domains[selected.index] = new Set([domain[(domain.indexOf(choice) + 1) % domain.length]]);
      if (!propagate(selected.index)) {
        domains[selected.index] = new Set([0]);
        propagate(selected.index);
      }
    }
  }
  const tiles = domains.map((domain) => {
    const ids = [...domain];
    return ids.length ? ids[0] : 0;
  });
  return Object.freeze({
    cols,
    rows,
    tiles: Object.freeze(tiles),
    tileIds: Object.freeze(tiles.map((index) => HIGHLAND_TERRAIN_TILES[index].id)),
    backtracks,
    algorithm: "wfc-collapse+edge-propagation",
  });
}

// 水体使用独立瓦片集，不复用山体 meadow/slope 瓦片冒充湖面结构。
// edge: 0=N, 1=E, 2=S, 3=W；any 是可与水面/岸线连接的过渡边。
const HIGHLAND_WATER_TILES = Object.freeze([
  { id: "open-water", edges: ["water", "water", "water", "water"], weight: 14, bias: 0 },
  { id: "shore-north", edges: ["shore", "any", "water", "any"], weight: 3, bias: 0.12 },
  { id: "shore-east", edges: ["any", "shore", "any", "water"], weight: 3, bias: 0.10 },
  { id: "shore-south", edges: ["water", "any", "shore", "any"], weight: 3, bias: 0.08 },
  { id: "shore-west", edges: ["any", "water", "any", "shore"], weight: 3, bias: 0.10 },
  { id: "eddy-pocket", edges: ["water", "any", "water", "any"], weight: 2, bias: 0.24 },
]);

// The waterfront is a carved opening in the same terrain chart.  Keeping this
// footprint in one place prevents the mountain mesh, the water cap, and the
// editor/debug overlays from disagreeing about what is land.
export const HIGHLAND_LAKE_CHART = Object.freeze({
  // Townscaper 最前排格心在 z=20，体块前缘到 z≈21。湖面从 z=24
  // 才开始切开山体，留下连续天然湖岸承重带；旧值 18 会把正门脚下
  // 的 terrain cell 一并删掉，即使 Y 曲率正确也会看成悬空桥。
  zStart: 24,
  depth: 34,
  width: 64,
  centerAmplitude: 1.35,
  // A water cell owns a generous clearance corridor. Terrain cells touching
  // it are removed as a whole, so no dark triangular mountain sliver remains
  // over the canal from the waterfront camera.
  shoreHalfWidth: 10.0,
  basinHalfWidth: 22.0,
});

export function highlandWaterCenterX(z) {
  return Math.sin((z - HIGHLAND_LAKE_CHART.zStart) * 0.16) * HIGHLAND_LAKE_CHART.centerAmplitude;
}

export function highlandWaterHalfWidth(z) {
  const u = THREE.MathUtils.clamp(
    (z - HIGHLAND_LAKE_CHART.zStart) / HIGHLAND_LAKE_CHART.depth,
    0,
    1
  );
  const cap = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.72);
  return HIGHLAND_LAKE_CHART.shoreHalfWidth + cap * HIGHLAND_LAKE_CHART.basinHalfWidth;
}

export function isHighlandWaterfrontCutout(x, z) {
  if (z < HIGHLAND_LAKE_CHART.zStart - 1 || z > HIGHLAND_LAKE_CHART.zStart + HIGHLAND_LAKE_CHART.depth + 7) return false;
  const center = highlandWaterCenterX(z);
  // A narrow downstream continuation keeps the front of the terrain open
  // without turning the entire mountain chart into a lake.
  const continuation = z > HIGHLAND_LAKE_CHART.zStart + HIGHLAND_LAKE_CHART.depth
    ? Math.max(5.6, HIGHLAND_LAKE_CHART.shoreHalfWidth - (z - (HIGHLAND_LAKE_CHART.zStart + HIGHLAND_LAKE_CHART.depth)) * 0.2)
    : highlandWaterHalfWidth(z);
  return Math.abs(x - center) <= continuation + 1.8;
}

function highlandWaterTileCompatible(a, b, direction) {
  const opposite = (direction + 2) % 4;
  const left = HIGHLAND_WATER_TILES[a].edges[direction];
  const right = HIGHLAND_WATER_TILES[b].edges[opposite];
  return left === "any"
    || right === "any"
    || left === right
    || (left === "shore" && right === "water")
    || (left === "water" && right === "shore");
}

/** 专用于海/湖的 bounded WFC：先解邻接结构，再交给曲面编译器生成水网格。 */
export function solveHighlandWaterTiles({ cols = 16, rows = 14, seed = 20260825 } = {}) {
  const random = highlandSeededRandom(seed);
  const count = cols * rows;
  const domains = Array.from({ length: count }, () =>
    new Set(HIGHLAND_WATER_TILES.map((_, index) => index))
  );
  const neighbors = (index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return [
      row > 0 ? [index - cols, 0] : null,
      col < cols - 1 ? [index + 1, 1] : null,
      row < rows - 1 ? [index + cols, 2] : null,
      col > 0 ? [index - 1, 3] : null,
    ].filter(Boolean);
  };
  let backtracks = 0;
  const propagate = (start) => {
    const queue = [start];
    while (queue.length) {
      const current = queue.shift();
      for (const [neighbor, direction] of neighbors(current)) {
        const target = domains[neighbor];
        const allowed = new Set();
        for (const candidate of target) {
          if ([...domains[current]].some((source) =>
            highlandWaterTileCompatible(source, candidate, direction)
          )) allowed.add(candidate);
        }
        if (!allowed.size) return false;
        if (allowed.size !== target.size) {
          domains[neighbor] = allowed;
          queue.push(neighbor);
        }
      }
    }
    return true;
  };
  while (domains.some((domain) => domain.size > 1)) {
    const candidates = domains
      .map((domain, index) => ({ index, entropy: domain.size }))
      .filter((entry) => entry.entropy > 1)
      .sort((a, b) => a.entropy - b.entropy || a.index - b.index);
    const selected = candidates[Math.floor(random() * Math.min(candidates.length, 5))];
    if (!selected) break;
    const choices = [...domains[selected.index]].sort(
      (a, b) => HIGHLAND_WATER_TILES[b].weight - HIGHLAND_WATER_TILES[a].weight
    );
    const choice = choices[Math.floor(random() * choices.length)];
    const previous = domains.map((entry) => new Set(entry));
    domains[selected.index] = new Set([choice]);
    if (!propagate(selected.index)) {
      backtracks++;
      for (let index = 0; index < domains.length; index++) domains[index] = previous[index];
      domains[selected.index] = new Set([choices[(choices.indexOf(choice) + 1) % choices.length]]);
      if (!propagate(selected.index)) {
        domains[selected.index] = new Set([0]);
        propagate(selected.index);
      }
    }
  }
  const tiles = domains.map((domain) => [...domain][0] ?? 0);
  return Object.freeze({
    cols,
    rows,
    tiles: Object.freeze(tiles),
    tileIds: Object.freeze(tiles.map((index) => HIGHLAND_WATER_TILES[index].id)),
    backtracks,
    algorithm: "wfc-collapse+edge-propagation",
    tileSet: "highland-water-v1",
  });
}

function buildIrregularMountainGrid() {
  const width = HIGHLAND_REFERENCE_PROPORTIONS.mountainRangeSpan;
  const depth = 118;
  const cols = 18;
  const rows = 16;
  const dx = width / cols;
  const dz = depth / rows;
  const positions = [];
  const colors = [];
  const heights = [];
  const points = [];
  const tileValues = [];
  const tileField = solveHighlandTerrainTiles({ cols, rows });
  const low = new THREE.Color(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainDeep);
  const mid = new THREE.Color(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainFace);
  const high = new THREE.Color(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainHigh);
  const snow = new THREE.Color(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainSnow);
  const pointIndex = (row, col) => row * (cols + 1) + col;
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const edge = row === 0 || row === rows || col === 0 || col === cols;
      const jitterX = edge ? 0 : Math.sin(row * 2.17 + col * 1.31) * dx * 0.16;
      const jitterZ = edge ? 0 : Math.cos(row * 1.73 - col * 1.19) * dz * 0.14;
      const x = -width / 2 + col * dx + jitterX;
      const z = -depth / 2 + row * dz + jitterZ;
      const tileIndex = tileField.tiles[Math.min(rows - 1, row) * cols + Math.min(cols - 1, col)];
      const rawTileBias = HIGHLAND_TERRAIN_TILES[tileIndex]?.bias ?? 0;
      // WFC 山体瓦片可以抬高外侧坡面，但不能在城址下重新长出 1~4u
      // 的凸块；否则建筑按权威承重面落地后仍会被地形穿透。城域内把
      // tile bias 平滑衰减到 0，出城后再恢复完整山体变化。
      const cityFootprint = Math.max(Math.abs(x) / 28.5, Math.abs(z + 1.5) / 31.5);
      const tileBias = rawTileBias * smoothMask(0.80, 1.10, cityFootprint);
      const y = edge
        ? mountainGridSurfaceHeight(x, z)
        : localSphericalSurfaceOffset(x, z) + highlandMountainGridHeight(x, z) + tileBias;
      points.push({ x, y, z });
      tileValues.push(tileIndex);
      heights.push(y);
      const t = THREE.MathUtils.clamp((y - 1) / 62, 0, 1);
      const color = low.clone().lerp(mid, Math.min(1, t * 1.55));
      if (t > 0.55) color.lerp(high, (t - 0.55) / 0.45 * 0.82);
      if (t > 0.83) color.lerp(snow, (t - 0.83) / 0.17 * 0.55);
      colors.push(color.r, color.g, color.b);
    }
  }
  const indices = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = pointIndex(row, col);
      const b = pointIndex(row, col + 1);
      const c = pointIndex(row + 1, col + 1);
      const d = pointIndex(row + 1, col);
      // The lake is a real opening in the WFC chart. Testing only the cell
      // centre leaves a large dark-blue triangular sliver across the canal;
      // remove every cell whose corner touches the water corridor instead.
      const cellTouchesWater = [a, b, c, d].some((point) =>
        isHighlandWaterfrontCutout(points[point].x, points[point].z)
      );
      if (cellTouchesWater) continue;
      // 交替对角线，避免规则方格在远景产生连续斜纹。
      if ((row + col) % 2 === 0) indices.push(a, b, d, b, c, d);
      else indices.push(a, b, c, a, c, d);
    }
  }
  // Side skirt: every boundary edge drops to its own local ground height.
  // There is intentionally no bottom cap, so no rectangular underside is exposed.
  const boundary = [];
  for (let col = 0; col <= cols; col++) boundary.push(pointIndex(0, col));
  for (let row = 1; row <= rows; row++) boundary.push(pointIndex(row, cols));
  for (let col = cols - 1; col >= 0; col--) boundary.push(pointIndex(rows, col));
  for (let row = rows - 1; row >= 1; row--) boundary.push(pointIndex(row, 0));
  const skirtStart = points.length;
  for (const vertex of boundary.map((index) => points[index])) {
    const skirtY = Math.min(
      vertex.y - 0.18,
      localSphericalSurfaceOffset(vertex.x, vertex.z)
        + highlandCityGroundHeight(vertex.x * 0.22, vertex.z * 0.24)
        - 0.2
    );
    points.push({ x: vertex.x, y: skirtY, z: vertex.z });
    tileValues.push(0);
    const color = low.clone().multiplyScalar(0.7);
    colors.push(color.r, color.g, color.b);
  }
  for (let i = 0; i < boundary.length; i++) {
    const topA = boundary[i];
    const topB = boundary[(i + 1) % boundary.length];
    const boundaryA = points[topA];
    const boundaryB = points[topB];
    const boundaryMidX = (boundaryA.x + boundaryB.x) * 0.5;
    const boundaryMidZ = (boundaryA.z + boundaryB.z) * 0.5;
    if (
      isHighlandWaterfrontCutout(boundaryA.x, boundaryA.z)
      || isHighlandWaterfrontCutout(boundaryB.x, boundaryB.z)
      || isHighlandWaterfrontCutout(boundaryMidX, boundaryMidZ)
    ) continue;
    const skirtA = skirtStart + i;
    const skirtB = skirtStart + ((i + 1) % boundary.length);
    indices.push(topA, topB, skirtA, topB, skirtB, skirtA);
  }
  for (const point of points) positions.push(point.x, point.y, point.z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("terrainTile", new THREE.Float32BufferAttribute(tileValues, 1));
  geometry.setAttribute("mountainHeight", new THREE.Float32BufferAttribute(heights.concat(boundary.map((index) => points[skirtStart + boundary.indexOf(index)]?.y ?? 0)), 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    gridMethod: "primary-grid+dual-grid+alternating-triangles",
    gridSize: { cols, rows },
    dualGridOffset: true,
    flatBase: false,
    sideSkirt: true,
    waterfrontCutout: "wfc-curved-lake-corridor",
    canalRockObstructionRemoved: true,
    frontObstaclePolicy: "remove-whole-touching-cells-and-skirt-edges",
    waterfrontCutoutBounds: HIGHLAND_LAKE_CHART,
    boundaryVertexCount: boundary.length,
    wfc: tileField,
  };
  return geometry;
}

export function highlandTerrainSurfaceHeight(x, z, radius = 160) {
  const edge = Math.abs(x) >= 83 || z <= -50 || z >= 50;
  const height = edge
    ? Math.max(0.9, highlandMountainGridHeight(x, z) * 0.58)
    : highlandMountainGridHeight(x, z);
  return localSphericalSurfaceOffset(x, z, radius) + height;
}

/** 山体采样坡度；树、灌木、草都读取同一高度场，不能各自猜 Y。 */
export function highlandMountainSlope(x, z, delta = 0.75) {
  const dx = (highlandTerrainSurfaceHeight(x + delta, z) - highlandTerrainSurfaceHeight(x - delta, z)) / (2 * delta);
  const dz = (highlandTerrainSurfaceHeight(x, z + delta) - highlandTerrainSurfaceHeight(x, z - delta)) / (2 * delta);
  return Math.hypot(dx, dz);
}

function mountainGridSurfaceHeight(x, z) {
  return highlandTerrainSurfaceHeight(x, z);
}

export function buildHighlandCitadelContinuousTerrain() {
  const geometry = buildIrregularMountainGrid();
  const material = standardMaterial(0xffffff, {
    vertexColors: true,
    flatShading: true,
    roughness: 0.98,
    side: THREE.DoubleSide,
    semanticToken: "oskar-irregular-mountain-grid",
  });
  const mesh = presentationMesh(
    geometry,
    material,
    "citadel-oskar-grid-mountain-surface",
    "continuous-mountain-grid"
  );
  mesh.userData.presentationOnly = false;
  mesh.userData.isCitadelTerrain = true;
  mesh.userData.skipInkOutline = true;
  mesh.userData.gridMethod = geometry.userData.gridMethod;
  mesh.userData.flatBase = false;
  mesh.userData.wfc = geometry.userData.wfc;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.name = "citadel-continuous-mountain-terrain-system";
  group.userData.terrainLayerCount = 1;
  group.userData.terraceLayerCount = 0;
  group.userData.waterfallCount = 0;
  group.userData.continuousGround = true;
  group.userData.heightFunction = "highlandMountainGridHeight";
  group.userData.gridMethod = geometry.userData.gridMethod;
  group.userData.flatBase = false;
  group.userData.canalRockObstructionRemoved = true;
  group.userData.frontObstaclePolicy = "curved-lake-corridor-owns-waterfront-sightline";
  group.userData.wfc = geometry.userData.wfc;
  group.userData.surfaceRadius = 160;
  group.userData.groundSurfaceHeight = highlandTerrainSurfaceHeight;
  group.userData.mountainRangeSpan = HIGHLAND_REFERENCE_PROPORTIONS.mountainRangeSpan;
  group.add(mesh);
  return group;
}

function standardMaterial(color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.9,
    metalness: options.metalness ?? 0,
    flatShading: options.flatShading === true,
    vertexColors: options.vertexColors === true,
    transparent: options.transparent === true,
    opacity: options.opacity ?? 1,
    depthWrite: options.depthWrite ?? true,
    side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
  material.userData.highlandLatestDesign = true;
  material.userData.semanticToken = options.semanticToken ?? "presentation";
  return material;
}

function presentationMesh(geometry, material, name, semantic) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.castShadow = false;
  object.receiveShadow = false;
  object.userData.nonNavigable = true;
  object.userData.presentationOnly = true;
  object.userData.semantic = semantic;
  return object;
}

function makeArchedPanelGeometry(width, height) {
  const radius = width * 0.5;
  const shoulderY = height - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, shoulderY);
  shape.absarc(0, shoulderY, radius, 0, Math.PI, false);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 8);
}

function addFacadeWindow(group, material, {
  x = 0,
  y,
  z,
  yaw = 0,
  width = 0.58,
  height = 1.45,
  name,
  floorIndex = 0,
  unitId = null,
}) {
  const window = presentationMesh(
    makeArchedPanelGeometry(width, height),
    material,
    name,
    "warm-window"
  );
  window.position.set(x, y, z);
  window.rotation.y = yaw;
  window.userData.citadelDesignWindow = true;
  window.userData.castleFloor = floorIndex;
  window.userData.unitId = unitId;
  window.userData.skipInkOutline = true;
  group.add(window);
  return window;
}

function buildInteriorRotatingStaircase(materials) {
  const group = new THREE.Group();
  group.name = "highland-central-interior-rotating-staircase";
  group.userData.nonNavigable = false;
  group.userData.presentationOnly = true;
  group.userData.walkSurface = true;
  group.userData.routeKind = "interior-rotating-stairs";
  const floorHeights = [2.25, 8.9, 15.55, 22.15, 28.75];
  const floorRoutes = [];
  for (let floor = 0; floor < floorHeights.length; floor++) {
    const start = floorHeights[floor];
    const end = floor < floorHeights.length - 1 ? floorHeights[floor + 1] : 30.05;
    const points = [];
    const stepCount = floor < floorHeights.length - 1 ? 8 : 4;
    for (let step = 0; step <= stepCount; step++) {
      const u = step / Math.max(1, stepCount);
      const angle = -Math.PI * 0.25 + u * Math.PI * 1.72 + floor * Math.PI * 0.42;
      points.push(Object.freeze([
        Math.cos(angle) * 0.86,
        THREE.MathUtils.lerp(start, end, u),
        Math.sin(angle) * 0.86,
      ]));
      if (step === stepCount) continue;
      const stair = presentationMesh(
        new THREE.BoxGeometry(0.72, 0.12, 0.62),
        materials.band,
        `highland-central-interior-stair-${floor}-${step}`,
        "interior-rotating-stair"
      );
      stair.position.set(points[points.length - 1][0], points[points.length - 1][1], points[points.length - 1][2]);
      stair.rotation.y = angle + Math.PI * 0.5;
      stair.userData.walkSurface = true;
      stair.userData.castleFloor = floor;
      group.add(stair);
    }
    floorRoutes.push(Object.freeze({
      floor,
      points: Object.freeze(points),
      surface: "interior-rotating-stairs",
    }));
  }
  group.userData.floorCount = floorRoutes.length;
  group.userData.floorRoutes = Object.freeze(floorRoutes);
  return group;
}

function addTowerBands(group, material, width, depth, levels, prefix) {
  for (let i = 0; i < levels.length; i++) {
    const band = presentationMesh(
      new THREE.BoxGeometry(width + 0.34, 0.22, depth + 0.34),
      material,
      `${prefix}-band-${i}`,
      "tower-cornice"
    );
    band.position.y = levels[i];
    group.add(band);
  }
}

function buildCentralSacredTower(materials) {
  const tower = new THREE.Group();
  tower.name = "highland-central-sacred-tower";
  tower.userData.nonNavigable = true;
  tower.userData.presentationOnly = true;
  tower.userData.role = "highest-architectural-anchor";
  tower.userData.architecture = "obelisk-citadel-tower";
  tower.userData.townscaperConstraint = "hard-monument-cavity-v1";
  // The podium bottom is the same local surface used by the district meshes
  // and assault anchors. Do not sink the tower into the mountain grid.
  tower.position.y = highlandCityGroundHeight(0, 0) + 0.04;
  tower.scale.set(1, 1, 1);
  tower.userData.baseY = tower.position.y;
  tower.userData.topY = tower.position.y + HIGHLAND_REFERENCE_PROPORTIONS.castleArchitecturalHeight + 0.2;
  tower.userData.captureDeckY = tower.position.y + 30.28;
  const interiorStaircase = buildInteriorRotatingStaircase(materials);
  tower.add(interiorStaircase);
  tower.userData.interiorFloorRoutes = interiorStaircase.userData.floorRoutes;
  tower.userData.interiorFloorCount = interiorStaircase.userData.floorCount;

  const podium = presentationMesh(
    new THREE.BoxGeometry(8.8, 2.0, 7.4),
    materials.wallMid,
    "highland-central-tower-podium",
    "sacred-tower"
  );
  podium.position.y = 1.0;
  tower.add(podium);

  const foundation = presentationMesh(
    new THREE.BoxGeometry(6.7, 5.4, 6.0),
    materials.wallLight,
    "highland-central-tower-foundation",
    "sacred-tower-foundation"
  );
  foundation.position.y = 4.7;
  tower.add(foundation);

  const lower = presentationMesh(
    new THREE.BoxGeometry(5.7, 7.0, 5.25),
    materials.wallLight,
    "highland-central-tower-lower",
    "sacred-tower"
  );
  lower.position.y = 10.9;
  tower.add(lower);

  const middle = presentationMesh(
    new THREE.BoxGeometry(4.35, 8.4, 4.15),
    materials.wallMid,
    "highland-central-tower-middle",
    "sacred-tower"
  );
  middle.position.y = 18.4;
  tower.add(middle);

  const upper = presentationMesh(
    new THREE.BoxGeometry(3.35, 8.0, 3.2),
    materials.wallLight,
    "highland-central-tower-upper",
    "sacred-tower"
  );
  upper.position.y = 26.6;
  tower.add(upper);

  const chamber = presentationMesh(
    new THREE.BoxGeometry(2.7, 4.8, 2.62),
    materials.wallMid,
    "highland-central-obelisk-chamber",
    "obelisk-chamber"
  );
  chamber.position.y = 30.0;
  tower.add(chamber);

  addTowerBands(tower, materials.band, 5.7, 5.25, [7.55, 14.55], "highland-central-lower");
  addTowerBands(tower, materials.band, 4.35, 4.15, [22.65], "highland-central-middle");
  addTowerBands(tower, materials.band, 3.35, 3.2, [29.05], "highland-central-upper");

  const buttressGeometry = new THREE.BoxGeometry(0.62, 7.4, 0.72);
  for (const [x, z] of [[-2.72, 2.42], [2.72, 2.42], [-2.72, -2.42], [2.72, -2.42]]) {
    const buttress = presentationMesh(
      buttressGeometry,
      materials.wallMid,
      `highland-central-buttress-${x > 0 ? "e" : "w"}-${z > 0 ? "s" : "n"}`,
      "tower-buttress"
    );
    buttress.position.set(x, 10.8, z);
    tower.add(buttress);
  }

  const obeliskShoulder = presentationMesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.28, 4),
    materials.wallLight,
    "highland-central-obelisk-shoulder",
    "obelisk-shoulder"
  );
  obeliskShoulder.position.y = 32.52;
  obeliskShoulder.rotation.y = Math.PI / 4;
  tower.add(obeliskShoulder);

  const captureDeck = presentationMesh(
    new THREE.BoxGeometry(3.25, 0.24, 2.95),
    materials.band,
    "highland-castle-top-capture-deck",
    "castle-top-capture-deck"
  );
  captureDeck.position.set(0, 30.28, 0.08);
  captureDeck.userData.captureGoal = "castle-top";
  captureDeck.userData.obeliskCompatible = true;
  captureDeck.userData.maxOverhang = 0.28;
  tower.add(captureDeck);
  const parapetLong = new THREE.BoxGeometry(3.25, 0.42, 0.22);
  const parapetShort = new THREE.BoxGeometry(0.22, 0.42, 2.95);
  for (const [name, geo, x, z] of [
    ["south", parapetLong, 0, 1.47],
    ["north", parapetLong, 0, -1.34],
    ["west", parapetShort, -1.52, 0.08],
    ["east", parapetShort, 1.52, 0.08],
  ]) {
    const parapet = presentationMesh(
      geo,
      materials.wallLight,
      `highland-castle-top-parapet-${name}`,
      "castle-top-parapet"
    );
    parapet.position.set(x, 30.66, z);
    tower.add(parapet);
  }

  // The former wide roof was the wrong silhouette.  Keep the compatibility
  // name for existing tooling, but make it a narrow four-sided obelisk cap.
  const roof = presentationMesh(
    new THREE.ConeGeometry(1.55, 3.2, 4),
    materials.roof,
    "highland-central-tower-roof",
    "obelisk-cap"
  );
  roof.position.y = 34.10;
  roof.rotation.y = Math.PI / 4;
  tower.add(roof);

  const finial = presentationMesh(
    new THREE.ConeGeometry(0.3, 0.6, 4),
    materials.windowCore,
    "highland-central-tower-finial",
    "obelisk-finial"
  );
  finial.position.y = 35.90;
  tower.add(finial);

  const portal = addFacadeWindow(tower, materials.windowDark, {
    y: 4.95,
    z: 3.02,
    width: 1.75,
    height: 2.8,
    name: "highland-central-sacred-portal",
  });
  portal.userData.citadelDesignWindow = false;
  portal.userData.semantic = "sacred-portal";

  const frontWindowYs = [8.0, 11.0, 15.4, 19.0, 23.8, 27.6, 30.0];
  for (let i = 0; i < frontWindowYs.length; i++) {
    const y = frontWindowYs[i];
    const frontDepth = y < 15 ? 2.66 : y < 24 ? 2.09 : 1.64;
    addFacadeWindow(tower, materials.windowWarm, {
      x: i % 2 ? 1.18 : -1.18,
      y,
      z: frontDepth + 0.012,
      width: i < 2 ? 0.62 : 0.5,
      height: i < 2 ? 1.52 : 1.3,
      floorIndex: Math.min(4, Math.floor(y / 6.5)),
      name: `highland-central-warm-window-front-${i}`,
    });
  }
  for (let i = 0; i < 6; i++) {
    const y = 8.6 + i * 3.55;
    const sideDepth = y < 15 ? 2.63 : y < 24 ? 2.08 : 1.64;
    addFacadeWindow(tower, materials.windowWarm, {
      x: -sideDepth,
      y,
      z: i % 2 ? 0.9 : -0.8,
      yaw: -Math.PI / 2,
      width: 0.48,
      height: 1.35,
      floorIndex: Math.min(4, Math.floor(y / 6.5)),
      name: `highland-central-warm-window-west-${i}`,
    });
    addFacadeWindow(tower, materials.windowWarm, {
      x: sideDepth,
      y,
      z: i % 2 ? -0.9 : 0.8,
      yaw: Math.PI / 2,
      width: 0.48,
      height: 1.35,
      floorIndex: Math.min(4, Math.floor(y / 6.5)),
      name: `highland-central-warm-window-east-${i}`,
    });
  }

  return tower;
}

const HIGHLAND_UNIT_COLOR_BY_CHAR = new Map(
  TOWNSCAPER_HIGHLAND_PALETTE.map((entry) => [entry.char, entry])
);

// 性能（2026-08-24）：15 色墙体材质共享缓存。改色编辑（editHighlandCastleUnit）
// 对共享材质 clone-on-write，避免同色建筑被一次编辑整体染色。
const HIGHLAND_WALL_MATERIAL_CACHE = new Map();
function highlandTownscaperWallMaterial(colorChar) {
  const entry = HIGHLAND_UNIT_COLOR_BY_CHAR.get(colorChar) || TOWNSCAPER_HIGHLAND_PALETTE[0];
  let material = HIGHLAND_WALL_MATERIAL_CACHE.get(entry.char);
  if (!material) {
    material = standardMaterial(entry.color, {
      roughness: 0.93,
      semanticToken: `highland-townscaper-wall-${entry.char}`,
    });
    material.userData.townscaperColorChar = entry.char;
    material.userData.townscaperColorName = entry.name;
    material.userData.townscaperShared = true;
    HIGHLAND_WALL_MATERIAL_CACHE.set(entry.char, material);
  }
  return material;
}

export const HIGHLAND_CASTLE_UNIT_CATALOG = Object.freeze([
  { family: "foundation", variants: ["stone", "arched", "buttressed"] },
  { family: "floor", variants: ["wall", "windowed", "balcony"] },
  { family: "tower", variants: ["narrow", "corner", "lantern"] },
  { family: "balcony", variants: ["stone", "flower-tile", "covered"] },
  { family: "support", variants: ["post", "brace", "arch"] },
  { family: "stair", variants: ["straight", "rotating", "bridge"] },
  { family: "roof", variants: ["gable", "dome", "flat"] },
  { family: "decor", variants: ["lantern", "tree-pot", "flag"] },
]);

export const HIGHLAND_CITY_BANDS = Object.freeze([
  { z: 23, halfWidth: 22, columns: 12, baseH: 4.0 },
  { z: 18, halfWidth: 21, columns: 12, baseH: 4.5 },
  { z: 13, halfWidth: 19, columns: 11, baseH: 5.0 },
  { z: 8, halfWidth: 17, columns: 10, baseH: 5.4 },
  { z: 3, halfWidth: 15, columns: 9, baseH: 5.9 },
  { z: -2, halfWidth: 13, columns: 8, baseH: 6.4 },
  { z: -7, halfWidth: 11.5, columns: 7, baseH: 6.9 },
  { z: -12, halfWidth: 9.5, columns: 6, baseH: 7.3 },
  { z: -17, halfWidth: 7.4, columns: 5, baseH: 7.7 },
  { z: -22, halfWidth: 6.2, columns: 4, baseH: 8.4 },
  { z: -27, halfWidth: 5.0, columns: 3, baseH: 9.0 },
].map((band) => Object.freeze(band)));

function highlandValleySlotSpec(bandIndex, column) {
  const band = HIGHLAND_CITY_BANDS[bandIndex];
  if (!band) return null;
  const u = band.columns === 1 ? 0.5 : column / (band.columns - 1);
  const x = THREE.MathUtils.lerp(-band.halfWidth, band.halfWidth, u)
    + Math.sin((column + 1) * 2.17 + bandIndex) * 0.72;
  const z = band.z + Math.sin(column * 1.71 + bandIndex * 0.8) * 1.35;
  const width = 3.0 + (Math.abs(column + bandIndex) % 3) * 0.58;
  const depth = 3.0 + (Math.abs(column * 2 + bandIndex) % 3) * 0.52;
  const height = band.baseH + (Math.abs(column * 5 + bandIndex * 3) % 5) * 0.82;
  return { band, bandIndex, column, x, z, width, depth, height, ground: highlandCityGroundHeight(x, z) };
}

/** A small Townscaper-style socket pass: authored cells collapse to compatible
 * families before geometry is compiled.  It is deliberately deterministic so
 * an edited seed can be replayed by the editor and by the test harness. */
export function solveHighlandCastleUnitGrid({ rows = 11, columns = 12, seed = 20260824 } = {}) {
  const random = highlandSeededRandom(seed);
  const units = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const top = row === rows - 1;
      const edge = column === 0 || column === columns - 1;
      const candidates = top
        ? ["roof", "tower"]
        : row === 0
          ? ["foundation", "support", "floor"]
          : edge
            ? ["tower", "balcony", "floor", "support"]
            : ["floor", "balcony", "decor", "stair"];
      const family = candidates[Math.floor(random() * candidates.length)];
      const entry = HIGHLAND_CASTLE_UNIT_CATALOG.find((item) => item.family === family);
      const variant = entry.variants[Math.floor(random() * entry.variants.length)];
      units.push({
        id: `highland-unit-${row}-${column}`,
        grid: [column, row],
        family,
        variant,
        rotation: (Math.floor(random() * 4) * Math.PI) / 2,
        scale: 1,
        sockets: {
          north: top ? "roof" : "wall",
          east: edge ? "corner" : "wall",
          south: row === 0 ? "foundation" : "wall",
          west: column === 0 ? "corner" : "wall",
        },
        algorithm: "townscaper-wfc-v1",
      });
    }
  }
  return Object.freeze(units.map((unit) => Object.freeze(unit)));
}

function editHighlandCastleUnit(root, unitId, patch = {}) {
  const units = root.userData.units || root.userData.castleUnits || [];
  const unit = units.find((candidate) => candidate.id === unitId);
  if (!unit) return { ok: false, error: "unknown-unit", unitId };
  const building = root.getObjectByName(unit.buildingId);
  if (!building) return { ok: false, error: "unit-building-missing", unitId };
  if (Number.isFinite(patch.rotation)) {
    unit.rotation = Number(patch.rotation);
    building.rotation.y = unit.rotation;
  }
  if (Number.isFinite(patch.scale)) {
    unit.scale = THREE.MathUtils.clamp(Number(patch.scale), 0.72, 1.35);
  }
  if (typeof patch.family === "string") unit.family = patch.family;
  if (typeof patch.variant === "string") unit.variant = patch.variant;
  if (typeof patch.colorChar === "string") {
    const colorEntry = HIGHLAND_UNIT_COLOR_BY_CHAR.get(patch.colorChar);
    if (!colorEntry) return { ok: false, error: "unknown-color", colorChar: patch.colorChar };
    unit.colorChar = colorEntry.char;
    const body = building.userData.bodyMesh;
    if (body?.material?.color) {
      // 共享缓存材质 clone-on-write：一次改色只影响本栋建筑
      if (body.material.userData.townscaperShared === true) {
        body.material = body.material.clone();
        body.material.userData.townscaperShared = false;
      }
      body.material.color.setHex(colorEntry.color);
      body.material.needsUpdate = true;
      body.material.userData.townscaperColorChar = colorEntry.char;
      body.material.userData.townscaperColorName = colorEntry.name;
    }
  }
  if (typeof patch.hidden === "boolean") {
    unit.hidden = patch.hidden;
  }
  if (typeof patch.occupied === "boolean") unit.occupied = patch.occupied;
  if (Number.isFinite(patch.storeys)) {
    unit.storeys = THREE.MathUtils.clamp(Math.round(Number(patch.storeys)), 1, unit.maxStoreys || 4);
  }
  const storeys = Math.max(1, Number(unit.storeys) || 1);
  const heightFactor = 1 + (storeys - 1) * 0.38;
  building.scale.set(unit.scale, unit.scale * heightFactor, unit.scale);
  building.visible = unit.occupied !== false && unit.hidden !== true;
  const roofVariants = building.userData.roofVariants;
  if (roofVariants) {
    for (const [variant, object] of Object.entries(roofVariants)) object.visible = variant === unit.variant;
  }
  building.userData.townscaperUnit = unit;
  root.userData.occupiedUnitCount = units.filter((candidate) => candidate.occupied !== false).length;
  return { ok: true, algorithm: "townscaper-wfc-v1", unit: { ...unit } };
}

function buildValleyCityDistricts(materials) {
  const root = new THREE.Group();
  root.name = "highland-continuous-valley-city";
  root.userData.nonNavigable = true;
  root.userData.presentationOnly = true;
  root.userData.groundSurfaceHeight = highlandTerrainSurfaceHeight;
  root.userData.cityGroundHeight = highlandTownscaperSurfaceHeight;
  root.userData.unitEditor = "townscaper-wfc-v1";
  root.userData.units = [];
  const bands = HIGHLAND_CITY_BANDS;
  let buildingCount = 0;
  let windowCount = 0;
  for (let bandIndex = 0; bandIndex < bands.length; bandIndex++) {
    const band = bands[bandIndex];
    for (let column = 0; column < band.columns; column++) {
      const u = band.columns === 1 ? 0.5 : column / (band.columns - 1);
      const x = THREE.MathUtils.lerp(-band.halfWidth, band.halfWidth, u)
        + Math.sin((column + 1) * 2.17 + bandIndex) * 0.72;
      // 只在最下方两排留出水岸通往城心的窄街；山腰必须密集连续。
      if (Math.abs(x) < 1.65 && bandIndex < 2) continue;
      const z = band.z + Math.sin(column * 1.71 + bandIndex * 0.8) * 1.35;
      const width = 3.0 + ((column + bandIndex) % 3) * 0.58;
      const depth = 3.0 + ((column * 2 + bandIndex) % 3) * 0.52;
      const height = band.baseH + ((column * 5 + bandIndex * 3) % 5) * 0.82;
      const ground = highlandCityGroundHeight(x, z);
      const building = new THREE.Group();
      building.name = `highland-valley-building-${buildingCount}`;
      building.position.set(x, ground, z);
      building.rotation.y = Math.sin(column * 1.3 + bandIndex) * 0.075;
      building.userData.nonNavigable = true;
      building.userData.presentationOnly = true;
      building.userData.districtBand = bandIndex;
      const unit = {
        id: `highland-unit-${buildingCount}`,
        buildingId: building.name,
        grid: [column, bandIndex],
        family: bandIndex === 0 ? "foundation" : column % 5 === 0 ? "tower" : "floor",
        variant: ["gable", "dome", "flat"][ (column + bandIndex) % 3 ],
        colorChar: TOWNSCAPER_HIGHLAND_PALETTE[(column * 2 + bandIndex * 3) % TOWNSCAPER_HIGHLAND_PALETTE.length].char,
        hidden: false,
        occupied: true,
        storeys: 1,
        maxStoreys: 4,
        baseHeight: height,
        expandable: true,
        rotation: building.rotation.y,
        scale: 1,
        sockets: {
          north: bandIndex === bands.length - 1 ? "roof" : "wall",
          east: column === band.columns - 1 ? "corner" : "wall",
          south: bandIndex === 0 ? "foundation" : "wall",
          west: column === 0 ? "corner" : "wall",
        },
        algorithm: "townscaper-wfc-v1",
        editable: true,
      };
      building.userData.townscaperUnit = unit;
      root.userData.units.push(unit);

      const body = presentationMesh(
        new THREE.BoxGeometry(width, height, depth),
        highlandTownscaperWallMaterial(unit.colorChar),
        `highland-valley-building-${buildingCount}-body`,
        "slope-city-building"
      );
      body.position.y = height * 0.5;
      building.add(body);
      building.userData.bodyMesh = body;

      if ((column + bandIndex) % 2 === 0) {
        const belt = presentationMesh(
          new THREE.BoxGeometry(width + 0.18, 0.18, depth + 0.18),
          materials.band,
          `highland-valley-building-${buildingCount}-mid-belt`,
          "slope-city-cornice"
        );
        belt.position.y = height * (0.48 + ((column + bandIndex) % 3) * 0.08);
        building.add(belt);
      }

      const roof = presentationMesh(
        new THREE.ConeGeometry(Math.max(width, depth) * 0.62, 1.5, 8),
        materials.roof,
        `highland-valley-building-${buildingCount}-roof`,
        "slope-city-roof"
      );
      roof.position.y = height + 0.75;
      roof.rotation.y = Math.PI / 8;
      building.add(roof);
      const dome = presentationMesh(
        new THREE.SphereGeometry(Math.max(width, depth) * 0.52, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        materials.roof,
        `highland-valley-building-${buildingCount}-dome`,
        "slope-city-dome"
      );
      dome.position.y = height;
      dome.scale.y = 0.62;
      building.add(dome);
      const rim = presentationMesh(
        new THREE.BoxGeometry(width + 0.28, 0.34, depth + 0.28),
        materials.band,
        `highland-valley-building-${buildingCount}-roof-rim`,
        "slope-city-flat-roof"
      );
      rim.position.y = height + 0.12;
      building.add(rim);
      building.userData.roofVariants = { gable: roof, dome, flat: rim };
      for (const [variant, object] of Object.entries(building.userData.roofVariants)) object.visible = variant === unit.variant;

      const levels = Math.max(1, Math.floor(height / 1.85));
      for (let level = 0; level < levels; level++) {
        if ((level + column + bandIndex) % 3 === 1) continue;
        addFacadeWindow(building, materials.windowWarm, {
          x: ((level + column) % 2 ? 0.58 : -0.58) * Math.min(1, width / 3),
          y: 1.0 + level * 1.72,
          z: depth * 0.5 + 0.012,
          width: 0.38,
          height: 0.88,
          floorIndex: Math.min(4, level),
          unitId: unit.id,
          name: `highland-valley-building-${buildingCount}-window-${level}`,
        });
        windowCount++;
      }

      if ((column * 3 + bandIndex) % 11 === 0) {
        const lantern = presentationMesh(
          new THREE.OctahedronGeometry(0.18, 0),
          materials.windowWarm,
          `highland-valley-building-${buildingCount}-street-lantern`,
          "warm-route-light"
        );
        lantern.position.set(width * 0.42, 0.72, depth * 0.54);
        lantern.userData.skipInkOutline = true;
        building.add(lantern);
      }
      root.add(building);
      buildingCount++;
    }
  }
  // Townscaper 扩建槽：每条建筑带向左右各预留两格，同时把水岸主街
  // 的留白注册成可建空格。空槽没有可见建筑，但保留稳定 WFC 单元 ID，
  // 因而点击扩建、撤销、导入导出和刷新重放都不会改变拓扑身份。
  const occupiedKeys = new Set(root.userData.units.map((unit) => `${unit.grid[1]}:${unit.grid[0]}`));
  const slotPickRoot = new THREE.Group();
  slotPickRoot.name = "highland-townscaper-expansion-picks";
  slotPickRoot.userData.presentationOnly = true;
  slotPickRoot.userData.nonNavigable = true;
  const slotPickGeometry = new THREE.PlaneGeometry(3.3, 3.3);
  const slotPickMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
    side: THREE.DoubleSide,
  });
  function addExpansionSlot(bandIndex, column) {
    const spec = highlandValleySlotSpec(bandIndex, column);
    if (!spec) return;
    const suffix = String(column).replace("-", "m");
    const unitId = `highland-slot-${bandIndex}-${suffix}`;
    const building = new THREE.Group();
    building.name = `highland-valley-expansion-${bandIndex}-${suffix}`;
    building.position.set(spec.x, spec.ground, spec.z);
    building.rotation.y = Math.sin(column * 1.3 + bandIndex) * 0.075;
    building.userData.nonNavigable = true;
    building.userData.presentationOnly = true;
    building.userData.districtBand = bandIndex;
    const unit = {
      id: unitId,
      buildingId: building.name,
      grid: [column, bandIndex],
      family: bandIndex === 0 ? "foundation" : column % 5 === 0 ? "tower" : "floor",
      variant: ["gable", "dome", "flat"][Math.abs(column + bandIndex) % 3],
      colorChar: TOWNSCAPER_HIGHLAND_PALETTE[Math.abs(column * 2 + bandIndex * 3) % TOWNSCAPER_HIGHLAND_PALETTE.length].char,
      hidden: false,
      occupied: false,
      storeys: 1,
      maxStoreys: 4,
      baseHeight: spec.height,
      rotation: building.rotation.y,
      scale: 1,
      sockets: { north: "wall", east: "open", south: bandIndex === 0 ? "foundation" : "wall", west: "open" },
      algorithm: "townscaper-wfc-v1",
      editable: true,
      expandable: true,
    };
    building.userData.townscaperUnit = unit;
    root.userData.units.push(unit);

    const body = presentationMesh(
      new THREE.BoxGeometry(spec.width, spec.height, spec.depth),
      highlandTownscaperWallMaterial(unit.colorChar),
      `${building.name}-body`,
      "slope-city-building"
    );
    body.position.y = spec.height * 0.5;
    building.add(body);
    building.userData.bodyMesh = body;
    const gable = presentationMesh(
      new THREE.ConeGeometry(Math.max(spec.width, spec.depth) * 0.62, 1.5, 8),
      materials.roof,
      `${building.name}-roof`,
      "slope-city-roof"
    );
    gable.position.y = spec.height + 0.75;
    gable.rotation.y = Math.PI / 8;
    building.add(gable);
    const dome = presentationMesh(
      new THREE.SphereGeometry(Math.max(spec.width, spec.depth) * 0.52, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      materials.roof,
      `${building.name}-dome`,
      "slope-city-dome"
    );
    dome.position.y = spec.height;
    dome.scale.y = 0.62;
    building.add(dome);
    const flat = presentationMesh(
      new THREE.BoxGeometry(spec.width + 0.28, 0.34, spec.depth + 0.28),
      materials.band,
      `${building.name}-roof-rim`,
      "slope-city-flat-roof"
    );
    flat.position.y = spec.height + 0.12;
    building.add(flat);
    building.userData.roofVariants = { gable, dome, flat };
    for (const [variant, object] of Object.entries(building.userData.roofVariants)) object.visible = variant === unit.variant;
    building.visible = false;
    root.add(building);

    const pick = new THREE.Mesh(slotPickGeometry, slotPickMaterial);
    pick.name = `highland-expansion-pick-${bandIndex}-${suffix}`;
    pick.rotation.x = -Math.PI / 2;
    pick.position.set(spec.x, spec.ground + 0.035, spec.z);
    pick.userData.highlandSlotUnitId = unitId;
    pick.userData.presentationOnly = true;
    pick.userData.nonNavigable = true;
    pick.userData.skipInkOutline = true;
    slotPickRoot.add(pick);
  }
  for (let bandIndex = 0; bandIndex < bands.length; bandIndex++) {
    const columns = bands[bandIndex].columns;
    for (let column = -2; column <= columns + 1; column++) {
      if (!occupiedKeys.has(`${bandIndex}:${column}`)) addExpansionSlot(bandIndex, column);
    }
  }
  root.add(slotPickRoot);
  root.userData.districtCount = bands.length;
  root.userData.buildingCount = buildingCount;
  root.userData.windowCount = windowCount;
  root.userData.units = root.userData.units;
  root.userData.unitCount = root.userData.units.length;
  root.userData.occupiedUnitCount = buildingCount;
  root.userData.expansionSlotCount = root.userData.units.length - buildingCount;
  root.userData.unitBandCount = bands.length;
  root.userData.unitPalette = TOWNSCAPER_HIGHLAND_PALETTE.map((entry) => ({ ...entry }));
  root.userData.editUnit = (unitId, patch) => editHighlandCastleUnit(root, unitId, patch);
  root.userData.editUnits = (patches = []) => {
    const results = patches.map((patch) => editHighlandCastleUnit(root, patch.id, patch));
    return {
      ok: results.every((result) => result.ok),
      algorithm: "townscaper-wfc-v1",
      results,
    };
  };
  return root;
}

function buildRidgeTower(materials, index, x, y, z, scale = 1) {
  const tower = new THREE.Group();
  tower.name = `highland-ridge-tower-${index}`;
  tower.position.set(x, y, z);
  tower.scale.setScalar(scale);
  tower.userData.nonNavigable = true;
  tower.userData.presentationOnly = true;
  tower.userData.role = "secondary-ridge-anchor";

  const body = presentationMesh(
    new THREE.BoxGeometry(3.6, 6.7, 3.5),
    materials.wallMid,
    `highland-ridge-tower-${index}-body`,
    "ridge-tower"
  );
  body.position.y = 3.35;
  tower.add(body);

  const shoulder = presentationMesh(
    new THREE.BoxGeometry(4.15, 0.42, 4.05),
    materials.band,
    `highland-ridge-tower-${index}-shoulder`,
    "tower-cornice"
  );
  shoulder.position.y = 6.48;
  tower.add(shoulder);

  const roof = presentationMesh(
    new THREE.ConeGeometry(2.55, 2.8, 8),
    materials.roof,
    `highland-ridge-tower-${index}-roof`,
    "ridge-roof"
  );
  roof.position.y = 8.05;
  roof.rotation.y = Math.PI / 8;
  tower.add(roof);

  addFacadeWindow(tower, materials.windowWarm, {
    y: 3.25,
    z: 1.762,
    width: 0.56,
    height: 1.5,
    name: `highland-ridge-tower-${index}-window`,
  });
  return tower;
}

function makeRavineWallGeometry(side) {
  const zValues = [25, 17, 9, 1, -7, -16, -27];
  // Keep the canyon walls on the side wings.  The central waterfront sightline
  // must remain lake → city, never mountain wall → city.
  const innerDistance = [36, 34, 32, 31, 31.5, 33.5, 36.5];
  const outerDistance = [48, 49, 50, 51.5, 52.5, 53.5, 55];
  const innerHeights = [5, 10, 17, 25, 32, 31, 24];
  const outerHeights = [12, 20, 29, 39, 44, 41, 33];
  const sections = zValues.map((z, i) => [
    new THREE.Vector3(side * innerDistance[i], 1.5, z),
    new THREE.Vector3(side * (innerDistance[i] + 3.6), innerHeights[i], z),
    new THREE.Vector3(side * outerDistance[i], outerHeights[i], z),
    new THREE.Vector3(side * (outerDistance[i] + 7.0), 0.2, z),
  ]);
  const positions = [];
  const colors = [];
  const deep = new THREE.Color(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainDeep);
  const mid = new THREE.Color(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainMid);
  const mist = new THREE.Color(HIGHLAND_CITADEL_DESIGN_PALETTE.mountainMist);
  const pushVertex = (v, stripe, sectionIndex) => {
    positions.push(v.x, v.y, v.z);
    const heightT = THREE.MathUtils.clamp(v.y / 46, 0, 1);
    const color = deep.clone().lerp(mid, 0.22 + heightT * 0.62);
    if (stripe === 1) color.lerp(mist, 0.08 + ((sectionIndex + stripe) % 3) * 0.045);
    colors.push(color.r, color.g, color.b);
  };
  const triangle = (a, b, c, stripe, sectionIndex) => {
    pushVertex(a, stripe, sectionIndex);
    pushVertex(b, stripe, sectionIndex);
    pushVertex(c, stripe, sectionIndex);
  };
  for (let i = 0; i < sections.length - 1; i++) {
    for (let stripe = 0; stripe < 3; stripe++) {
      const a = sections[i][stripe];
      const b = sections[i][stripe + 1];
      const c = sections[i + 1][stripe + 1];
      const d = sections[i + 1][stripe];
      // Flip winding on the eastern wall so both walls face the valley.
      if (side < 0) {
        triangle(a, b, c, stripe, i);
        triangle(a, c, d, stripe, i);
      } else {
        triangle(a, c, b, stripe, i);
        triangle(a, d, c, stripe, i);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildRavineWalls(materials) {
  const group = new THREE.Group();
  group.name = "highland-mountain-ravine-walls";
  group.userData.nonNavigable = true;
  group.userData.presentationOnly = true;
  group.userData.frontSightline = "kept-clear-for-curved-lake";
  group.userData.sideWingOffset = 8;
  for (const side of [-1, 1]) {
    const wall = presentationMesh(
      makeRavineWallGeometry(side),
      materials.mountain,
      side < 0 ? "highland-ravine-wall-west" : "highland-ravine-wall-east",
      "mountain-ravine"
    );
    wall.userData.skipInkOutline = true;
    wall.userData.ravineSide = side < 0 ? "west" : "east";
    group.add(wall);
  }
  return group;
}

function buildMountainBackdrop(materials) {
  const group = new THREE.Group();
  group.name = "highland-distant-peak-crown";
  group.userData.nonNavigable = true;
  group.userData.presentationOnly = true;
  // Peaks are part of the same irregular grid below; this group remains as a
  // semantic anchor so no separate cone or flat-bottom mountain can reappear.
  group.userData.gridSource = "citadel-oskar-grid-mountain-surface";
  group.userData.peakCount = 5;
  return group;
}

function buildMountainTree(materials, index, x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.name = `highland-mountain-vegetation-${index}`;
  const surfaceY = mountainGridSurfaceHeight(x, z);
  tree.position.set(x, surfaceY + 0.02, z);
  tree.rotation.y = (index * 1.713) % (Math.PI * 2);
  tree.scale.setScalar(scale);
  tree.userData.nonNavigable = true;
  tree.userData.presentationOnly = true;
  tree.userData.role = "mountain-slope-vegetation";
  tree.userData.surfaceProvider = "highlandTerrainSurfaceHeight";
  tree.userData.surfaceY = surfaceY;

  const trunk = presentationMesh(
    new THREE.CylinderGeometry(0.18, 0.26, 2.3, 5),
    materials.bark,
    `highland-mountain-vegetation-${index}-trunk`,
    "mountain-tree-trunk"
  );
  trunk.position.y = 1.15;
  tree.add(trunk);
  const canopySpecs = [
    [-0.55, 2.4, 0.05, 1.25, materials.foliageDeep],
    [0.45, 2.75, -0.08, 1.12, materials.foliageMid],
    [0.0, 3.35, 0.02, 0.94, materials.foliageLight],
  ];
  for (let canopyIndex = 0; canopyIndex < canopySpecs.length; canopyIndex++) {
    const [cx, cy, cz, radius, material] = canopySpecs[canopyIndex];
    const canopy = presentationMesh(
      new THREE.IcosahedronGeometry(radius, 1),
      material,
      `highland-mountain-vegetation-${index}-canopy-${canopyIndex}`,
      "mountain-tree-canopy"
    );
    canopy.position.set(cx, cy, cz);
    canopy.scale.set(1.0, 0.72, 0.88);
    canopy.userData.skipInkOutline = true;
    tree.add(canopy);
  }
  return tree;
}

function buildMountainVegetation(materials) {
  const group = new THREE.Group();
  group.name = "highland-mountain-slope-vegetation";
  group.userData.nonNavigable = true;
  group.userData.presentationOnly = true;
  // 圣城只使用截图 2 的灰绿圆团低模树；旧港口参天古樟不跨场景复用。
  // 点位沿西/东山肩与北侧森林带排布，城址内部和湖面不再出现孤立树。
  const placements = HIGHLAND_MOUNTAIN_TREE_PLACEMENTS;
  // S17 小阴影：树根部共享 blob（圆形贴地暗斑）
  const blobShared = {
    geometry: new THREE.CircleGeometry(1, 14),
    material: new THREE.MeshBasicMaterial({
      color: 0x141d18,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  };
  placements.forEach(({ x, z, scale, band }, index) => {
    const tree = buildMountainTree(materials, index, x, z, scale);
    tree.userData.mountainBand = band;
    tree.userData.slope = highlandMountainSlope(x, z);
    tree.userData.kind = "highland-low-poly-round-tree";
    tree.userData.assetType = "lowPolyRoundTree";
    tree.userData.style = "three-icosahedron-muted-gray-green-canopy";
    tree.userData.palette = "screenshot-2-gray-green-v1";
    tree.userData.plantOnly = true;
    group.add(tree);
    const blob = buildBlobShadow(THREE, {
      x,
      y: tree.userData.surfaceY,
      z,
      radius: 1.05 * scale,
      shared: blobShared,
    });
    blob.userData.host = tree.name;
    group.add(blob);
  });
  group.userData.treeCount = placements.length;
  group.userData.blobShadowCount = placements.length;
  group.userData.followsMountainGrid = true;
  group.userData.distribution = "authored-mountain-slope-bands";
  group.userData.bandIds = Object.freeze([...new Set(placements.map((entry) => entry.band))]);
  group.userData.assetSource = "buildMountainTree-low-poly-round-canopy";
  return group;
}

function buildWarmPilgrimageAxis(materials) {
  const group = new THREE.Group();
  group.name = "highland-warm-pilgrimage-axis";
  group.userData.nonNavigable = true;
  group.userData.presentationOnly = true;
  const path = [
    [-6.2, 4.45, 21.2],
    [-5.2, 6.45, 17.2],
    [-3.8, 8.45, 13.2],
    [-4.3, 10.45, 8.6],
    [-2.3, 12.45, 5.0],
    [-1.5, 14.6, 2.4],
    [-0.8, 17.1, 1.2],
  ];
  path.forEach(([x, y, z], index) => {
    const lantern = presentationMesh(
      new THREE.OctahedronGeometry(index < 3 ? 0.22 : 0.27, 0),
      materials.windowWarm,
      `highland-pilgrimage-lantern-${index}`,
      "warm-route-light"
    );
    lantern.position.set(x, y, z);
    lantern.userData.skipInkOutline = true;
    group.add(lantern);
  });
  return group;
}

function buildBoat(materials, index, x, z, yaw, scale = 1) {
  const boat = new THREE.Group();
  boat.name = `highland-waterfront-boat-${index}`;
  boat.position.set(x, 2.36, z);
  boat.rotation.y = yaw;
  boat.scale.setScalar(scale);
  boat.userData.nonNavigable = true;
  boat.userData.presentationOnly = true;
  boat.userData.kind = "battle-ship-reference";
  boat.userData.referenceLength = HIGHLAND_REFERENCE_PROPORTIONS.battleShipLength;

  const hull = presentationMesh(
    new THREE.SphereGeometry(1.45, 8, 5, 0, Math.PI * 2, 0.35, Math.PI * 0.52),
    materials.boat,
    `highland-waterfront-boat-${index}-hull`,
    "waterfront-boat"
  );
  hull.scale.set(1.0, 0.34, 0.42);
  hull.rotation.z = Math.PI;
  boat.add(hull);

  const passenger = presentationMesh(
    new THREE.CapsuleGeometry(0.14, 0.46, 3, 6),
    materials.windowWarm,
    `highland-waterfront-boat-${index}-passenger`,
    "boat-passenger"
  );
  passenger.position.set(0.08, 0.52, 0);
  passenger.userData.skipInkOutline = true;
  boat.add(passenger);

  const pole = presentationMesh(
    new THREE.CylinderGeometry(0.025, 0.035, 2.6, 5),
    materials.quay,
    `highland-waterfront-boat-${index}-pole`,
    "boat-pole"
  );
  pole.position.set(-0.12, 0.7, -0.18);
  pole.rotation.z = -0.45;
  boat.add(pole);

  for (const [lanternIndex, lanternX] of [-0.62, 0.62].entries()) {
    const lantern = presentationMesh(
      new THREE.SphereGeometry(0.14, 8, 5),
      materials.lakeGlow,
      `highland-waterfront-boat-${index}-lantern-${lanternIndex}`,
      "boat-lantern"
    );
    lantern.position.set(lanternX, 0.43, 0.02);
    lantern.userData.skipInkOutline = true;
    boat.add(lantern);
    const light = new THREE.PointLight(HIGHLAND_CITADEL_DESIGN_PALETTE.lakeGlow, 0.22, 5.5, 2);
    light.name = `highland-waterfront-boat-${index}-lantern-light-${lanternIndex}`;
    light.position.copy(lantern.position);
    light.userData.presentationOnly = true;
    light.userData.semantic = "boat-lantern-light";
    boat.add(light);
  }
  boat.userData.lanternCount = 2;
  return boat;
}

function buildCurvedLakeSurface(materials) {
  const width = HIGHLAND_LAKE_CHART.width;
  const depth = HIGHLAND_LAKE_CHART.depth;
  const zStart = HIGHLAND_LAKE_CHART.zStart;
  const cols = 16;
  const rows = 14;
  const tileField = solveHighlandWaterTiles({ cols, rows, seed: 20260825 });
  const positions = [];
  const colors = [];
  const indices = [];
  const waterNear = new THREE.Color(0x91cbd0);
  const waterFar = new THREE.Color(0x39788a);
  const cellFilled = [];
  const waterCenterX = highlandWaterCenterX;
  const waterHalfWidth = highlandWaterHalfWidth;
  const isWaterCell = (x, z) => Math.abs(x - waterCenterX(z)) <= waterHalfWidth(z);
  for (let row = 0; row <= rows; row++) {
    const z = zStart + (depth * row) / rows;
    for (let col = 0; col <= cols; col++) {
      const x = -width / 2 + (width * col) / cols;
      const nx = (x - waterCenterX(z)) / Math.max(1, waterHalfWidth(z));
      const nz = (z - (zStart + depth * 0.5)) / (depth * 0.5);
      // Navona-style calm water: the planet curvature supplies the broad
      // concavity; only a few centimetres of authored relief remain.
      const bowl = (nx * nx * 0.08 + nz * nz * 0.12) * 0.055;
      const ripple = Math.sin(x * 0.38 + z * 0.17) * 0.009 + Math.cos(z * 0.26 - x * 0.21) * 0.006;
      const tileIndex = tileField.tiles[Math.min(rows - 1, row) * cols + Math.min(cols - 1, col)];
      const tileBias = HIGHLAND_WATER_TILES[tileIndex]?.bias ?? 0;
      positions.push(x, localSphericalSurfaceOffset(x, z) + 4.8 + bowl + ripple + tileBias * 0.004, z);
      const t = THREE.MathUtils.clamp((z - zStart) / depth, 0, 1);
      const color = waterNear.clone().lerp(waterFar, t * 0.78);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let row = 0; row < rows; row++) {
    const z = zStart + (depth * (row + 0.5)) / rows;
    for (let col = 0; col < cols; col++) {
      const x = -width / 2 + (width * (col + 0.5)) / cols;
      cellFilled.push(isWaterCell(x, z));
    }
  }
  const at = (row, col) => row * (cols + 1) + col;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!cellFilled[row * cols + col]) continue;
      const a = at(row, col);
      const b = at(row, col + 1);
      const c = at(row + 1, col + 1);
      const d = at(row + 1, col);
      if ((row + col) % 2 === 0) indices.push(a, b, d, b, c, d);
      else indices.push(a, b, c, a, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    waterTopology: "curved-lake-cap-v10-navona-gentle",
    gridMethod: "primary-grid+dual-grid+alternating-triangles",
    curved: true,
    flatSurface: false,
    surfaceProfile: "navona-gentle-basin",
    maxAuthoredRelief: 0.12,
    surfaceRadius: 160,
    shoreline: "wfc-tile-mask",
    waterCellFilled: Object.freeze(cellFilled),
    chartBounds: { xMin: -width / 2, xMax: width / 2, zMin: zStart, zMax: zStart + depth },
    gridSize: { cols, rows },
    wfc: tileField,
  };
  return geometry;
}

function buildWaterfront(materials, { waterOnly = false } = {}) {
  const group = new THREE.Group();
  group.name = "highland-waterfront-foreground";
  group.userData.nonNavigable = true;
  group.userData.presentationOnly = true;

  // Reference composition begins on curved lake water, not on a flat backdrop.
  // This local cap follows the same irregular grid principle as the world water
  // compiler and remains presentation-only so it cannot become a combat surface.
  const water = presentationMesh(
    buildCurvedLakeSurface(materials),
    materials.waterfrontWater,
    "highland-waterfront-water",
    "waterfront-water"
  );
  water.userData.waterTopology = "curved-lake-cap-v10-navona-gentle";
  water.userData.flatSurface = false;
  water.userData.curved = true;
  water.userData.gridMethod = "primary-grid+dual-grid+alternating-triangles";
  water.userData.surfaceRadius = 160;
  water.userData.shoreline = "wfc-tile-mask";
  water.userData.surfaceProfile = "navona-gentle-basin";
  water.userData.maxAuthoredRelief = 0.12;
  water.userData.wfc = water.geometry.userData.wfc;
  water.userData.skipInkOutline = true;
  group.add(water);

  if (waterOnly) {
    group.userData.boatCount = 0;
    group.userData.quaySegmentCount = 0;
    group.userData.boatReferenceLength = 0;
    group.userData.lakeSurfaceLightCount = 0;
    group.userData.curvedLake = true;
    group.userData.waterOnly = true;
    return group;
  }

  const quayGeometry = new THREE.BoxGeometry(2.8, 0.38, 1.25);
  const quayXs = [-15.2, -12.1, -9.0, -5.9, 7.2, 10.3, 13.4, 16.5];
  quayXs.forEach((x, index) => {
    const quay = presentationMesh(
      quayGeometry,
      materials.quay,
      `highland-waterfront-quay-${index}`,
      "waterfront-quay"
    );
    quay.position.set(x, 3.0, 24.8 + Math.sin(index * 1.7) * 0.22);
    quay.rotation.y = Math.sin(index * 0.9) * 0.045;
    group.add(quay);
  });

  const boats = [
    buildBoat(materials, 0, -11.5, 30.4, -0.22, 1.55),
    buildBoat(materials, 1, -2.8, 33.3, 0.18, 1.4),
    buildBoat(materials, 2, 8.4, 29.9, -0.08, 1.62),
  ];
  boats.forEach((boat) => group.add(boat));

  const reflectionGeometry = new THREE.PlaneGeometry(0.42, 4.5);
  for (let i = 0; i < 10; i++) {
    const reflection = presentationMesh(
      reflectionGeometry,
      materials.reflection,
      `highland-waterfront-warm-reflection-${i}`,
      "water-reflection"
    );
    reflection.rotation.x = -Math.PI / 2;
    reflection.rotation.z = (i % 3 - 1) * 0.08;
    reflection.position.set(-13 + i * 2.9, 2.18, 29.0 + (i % 2) * 2.1);
    reflection.scale.y = 0.65 + (i % 4) * 0.23;
    reflection.userData.skipInkOutline = true;
    group.add(reflection);
  }

  const lakeLights = [
    [-17, 2.52, 37], [-8.5, 2.48, 42], [1.5, 2.5, 38], [11.5, 2.55, 45],
    [-20, 1.20, 45], [-7, 0.72, 49], [7, 0.94, 46], [20, 0.42, 53],
    [-13, -1.05, 55], [1, -1.42, 58], [15, -1.15, 54],
  ];
  lakeLights.forEach(([x, y, z], index) => {
    const glow = presentationMesh(
      new THREE.CircleGeometry(0.28 + (index % 3) * 0.08, 12),
      materials.lakeGlow,
      `highland-lake-surface-glow-${index}`,
      "lake-surface-light"
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(x, y, z);
    glow.scale.y = 1.8;
    glow.userData.skipInkOutline = true;
    group.add(glow);
    const light = new THREE.PointLight(HIGHLAND_CITADEL_DESIGN_PALETTE.lakeGlow, 0.16, 8.5, 2);
    light.name = `highland-lake-surface-light-${index}`;
    light.position.set(x, y + 0.4, z);
    light.userData.presentationOnly = true;
    light.userData.semantic = "lake-surface-light";
    group.add(light);
  });

  group.userData.boatCount = boats.length;
  group.userData.quaySegmentCount = quayXs.length;
  group.userData.boatReferenceLength = HIGHLAND_REFERENCE_PROPORTIONS.battleShipLength;
  group.userData.lakeSurfaceLightCount = lakeLights.length;
  group.userData.curvedLake = true;
  return group;
}

function buildMistLayers(materials) {
  const group = new THREE.Group();
  group.name = "highland-valley-mist-layers";
  group.userData.nonNavigable = true;
  group.userData.presentationOnly = true;
  const layers = [
    { y: 13.8, z: 11, w: 40, d: 7.5, opacityScale: 1.0 },
    { y: 22.5, z: -2, w: 34, d: 8.5, opacityScale: 0.82 },
    { y: 31.5, z: -14, w: 29, d: 7.0, opacityScale: 0.64 },
  ];
  layers.forEach((spec, index) => {
    const mist = presentationMesh(
      new THREE.PlaneGeometry(spec.w, spec.d),
      materials.mist.clone(),
      `highland-valley-mist-${index}`,
      "valley-mist"
    );
    mist.material.opacity *= spec.opacityScale;
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(0, spec.y, spec.z);
    mist.userData.skipInkOutline = true;
    group.add(mist);
  });
  const veils = [
    { x: -8.5, y: 24.5, z: -20.5, w: 25, h: 30, opacityScale: 0.72 },
    { x: 10.5, y: 28.5, z: -23.0, w: 28, h: 34, opacityScale: 0.58 },
  ];
  veils.forEach((spec, index) => {
    const veil = presentationMesh(
      new THREE.PlaneGeometry(spec.w, spec.h),
      materials.mist.clone(),
      `highland-valley-backlight-veil-${index}`,
      "valley-backlight-mist"
    );
    veil.material.opacity *= spec.opacityScale;
    veil.position.set(spec.x, spec.y, spec.z);
    veil.userData.skipInkOutline = true;
    group.add(veil);
  });
  group.userData.layerCount = layers.length + veils.length;
  return group;
}

function makeMaterials() {
  const P = HIGHLAND_CITADEL_DESIGN_PALETTE;
  return {
    mountain: standardMaterial(0xffffff, {
      vertexColors: true,
      flatShading: true,
      roughness: 0.98,
      side: THREE.DoubleSide,
      semanticToken: "mountain-ravine",
    }),
    mountainFar: standardMaterial(P.mountainDeep, {
      roughness: 1,
      flatShading: true,
      semanticToken: "mountain-far",
    }),
    mountainFarLight: standardMaterial(P.mountainMid, {
      roughness: 1,
      flatShading: true,
      semanticToken: "mountain-far-lit",
    }),
    wallShadow: standardMaterial(P.wallShadow, { semanticToken: "citadel-wall-shadow" }),
    wallMid: standardMaterial(P.wallMid, { semanticToken: "citadel-wall-mid" }),
    wallLight: standardMaterial(P.wallLight, { semanticToken: "citadel-wall-light" }),
    wallWarm: standardMaterial(0xc7a8a6, { semanticToken: "citadel-wall-warm" }),
    wallRose: standardMaterial(0xa77f91, { semanticToken: "citadel-wall-rose" }),
    band: standardMaterial(P.band, { roughness: 0.94, semanticToken: "citadel-band" }),
    roof: standardMaterial(P.roof, { roughness: 0.96, semanticToken: "citadel-roof" }),
    windowDark: standardMaterial(P.windowDark, { roughness: 0.92, semanticToken: "window-dark" }),
    windowWarm: standardMaterial(P.windowWarm, {
      roughness: 0.46,
      emissive: P.windowCore,
      emissiveIntensity: 1.65,
      semanticToken: "window-warm",
    }),
    windowCore: standardMaterial(P.windowCore, {
      roughness: 0.36,
      emissive: P.windowCore,
      emissiveIntensity: 1.95,
      semanticToken: "obelisk-finial-light",
    }),
    foliageDeep: standardMaterial(P.foliageDeep, { roughness: 1, semanticToken: "mountain-foliage-deep" }),
    foliageMid: standardMaterial(P.foliageMid, { roughness: 1, semanticToken: "mountain-foliage-mid" }),
    foliageLight: standardMaterial(P.foliageLight, { roughness: 1, semanticToken: "mountain-foliage-light" }),
    bark: standardMaterial(P.bark, { roughness: 1, semanticToken: "mountain-tree-bark" }),
    lakeGlow: standardMaterial(P.lakeGlow, {
      roughness: 0.3,
      emissive: P.lakeGlow,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
      semanticToken: "lake-surface-light",
    }),
    quay: standardMaterial(P.quay, { roughness: 0.94, semanticToken: "waterfront-stone" }),
    boat: standardMaterial(P.boat, { roughness: 0.9, semanticToken: "waterfront-boat" }),
    waterfrontWater: standardMaterial(0xffffff, {
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      roughness: 0.62,
      metalness: 0.02,
      side: THREE.DoubleSide,
      semanticToken: "waterfront-water",
    }),
    reflection: standardMaterial(P.windowWarm, {
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      emissive: P.windowCore,
      emissiveIntensity: 0.58,
      side: THREE.DoubleSide,
      semanticToken: "warm-water-reflection",
    }),
    mist: standardMaterial(P.mist, {
      transparent: true,
      opacity: 0.105,
      depthWrite: false,
      roughness: 1,
      side: THREE.DoubleSide,
      semanticToken: "valley-mist",
    }),
  };
}

/**
 * Build the latest highland-citadel composition. It exports explicit
 * mountain-foot-to-castle-top assault anchors; decorative meshes stay outside
 * collision/navigation while the continuous mountain ground remains walkable.
 */
export function buildHighlandCitadelLatestDesign(options = {}) {
  const externalTownscaperCity = options.externalTownscaperCity === true;
  const externalTownStats = options.townscaperStats ?? null;
  const materials = makeMaterials();
  const root = new THREE.Group();
  root.name = "citadel-latest-design-v1";
  root.userData.nonNavigable = true;
  root.userData.presentationOnly = true;
  root.userData.groundSurfaceHeight = highlandTerrainSurfaceHeight;
  root.userData.cityGroundHeight = highlandTownscaperSurfaceHeight;
  root.userData.walkSurfaceProvider = HIGHLAND_TOWNSCAPER_PLATFORM.surfaceProvider;

  const ravineWalls = buildRavineWalls(materials);
  const distantPeaks = buildMountainBackdrop(materials);
  const mountainVegetation = buildMountainVegetation(materials);
  // v8 起城体由 odysseyCitadel 的运河 Townscaper 栅格装配器生成；这里的
  // 85 栋整栋参数模型只留作显式旧版回退，不再与新网格重叠渲染。
  const valleyCity = externalTownscaperCity ? null : buildValleyCityDistricts(materials);
  const centralTower = buildCentralSacredTower(materials);
  const ridgeTowers = new THREE.Group();
  ridgeTowers.name = "highland-secondary-ridge-towers";
  ridgeTowers.userData.nonNavigable = true;
  ridgeTowers.userData.presentationOnly = true;
  // 最新版的侧翼高塔已由 12 层 Townscaper 种子中的普通格群生成，必须
  // 随左右键编辑与邻接变化一起重算。旧预制副塔只留给 legacy 回放。
  if (!externalTownscaperCity) {
    ridgeTowers.add(
      buildRidgeTower(materials, 0, -9.6, 24.0, -15.8, 1.02),
      buildRidgeTower(materials, 1, 9.2, 24.8, -17.5, 0.98),
      buildRidgeTower(materials, 2, -15.2, 18.4, -7.4, 0.76),
      buildRidgeTower(materials, 3, 15.0, 18.9, -8.2, 0.74)
    );
  }
  ridgeTowers.userData.towerCount = ridgeTowers.children.length;

  const waterfront = buildWaterfront(materials, { waterOnly: true });

  root.add(distantPeaks, mountainVegetation, ravineWalls);
  if (valleyCity) root.add(valleyCity);
  root.add(centralTower, ridgeTowers, waterfront);

  root.userData.castleUnits = valleyCity?.userData.units ?? [];
  root.userData.castleUnitEditor = externalTownscaperCity
    ? "canal-townscaper-grid-v1"
    : "townscaper-wfc-v1";
  root.userData.castleEditMode = externalTownscaperCity
    ? "left-build-right-hole-v1"
    : "click-expand-storey-v2";
  root.userData.castleOccupiedUnitCount = valleyCity?.userData.occupiedUnitCount
    ?? externalTownStats?.cellCount
    ?? 0;
  root.userData.castleExpansionSlotCount = valleyCity?.userData.expansionSlotCount ?? 0;
  root.userData.castleUnitBandCount = valleyCity?.userData.unitBandCount ?? 0;
  root.userData.castleUnitPalette = valleyCity?.userData.unitPalette
    ?? TOWNSCAPER_HIGHLAND_PALETTE.map((entry) => ({ ...entry }));
  root.userData.editCastleUnit = valleyCity
    ? (unitId, patch) => valleyCity.userData.editUnit(unitId, patch)
    : null;
  root.userData.editCastleUnits = valleyCity
    ? (patches) => valleyCity.userData.editUnits(patches)
    : null;

  root.userData.latestDesign = Object.freeze({
    version: HIGHLAND_CITADEL_DESIGN_VERSION,
    composition: "waterfront-low-city-to-dense-slope-to-obelisk-and-ridge-towers",
    highestArchitecturalY: centralTower.userData.topY,
    captureDeckY: centralTower.userData.captureDeckY,
    mountainPeakY: 62.4,
    ravineWallCount: ravineWalls.children.length,
    ridgeTowerCount: ridgeTowers.children.length,
    townscaperRidgeTowerAnchorCount: externalTownscaperCity ? 6 : 0,
    waterfrontBoatCount: waterfront.userData.boatCount,
    mountainVegetationCount: mountainVegetation.userData.treeCount,
    mountainGridMethod: "primary-grid+dual-grid+alternating-triangles",
    mountainRangeSpan: HIGHLAND_REFERENCE_PROPORTIONS.mountainRangeSpan,
    referenceProportions: HIGHLAND_REFERENCE_PROPORTIONS,
    districtCount: valleyCity?.userData.districtCount ?? 1,
    buildingCount: valleyCity?.userData.buildingCount ?? externalTownStats?.cellCount ?? 0,
    districtWindowCount: valleyCity?.userData.windowCount ?? externalTownStats?.windowCount ?? 0,
    castleUnitCount: valleyCity?.userData.occupiedUnitCount ?? externalTownStats?.cellCount ?? 0,
    castleSlotCount: valleyCity?.userData.unitCount ?? 25 * 25 * 12,
    castleExpansionSlotCount: valleyCity?.userData.expansionSlotCount ?? 0,
    castleUnitEditor: externalTownscaperCity ? "canal-townscaper-grid-v1" : "townscaper-wfc-v1",
    castleEditMode: externalTownscaperCity ? "left-build-right-hole-v1" : "click-expand-storey-v2",
    townscaperConstruction: externalTownscaperCity ? "shared-with-canal-junction" : "legacy-valley-units",
    interiorFloorCount: centralTower.userData.interiorFloorCount,
    mistLayerCount: 0,
    nonBuildingPropCount: 0,
    plantAssetSource: mountainVegetation.userData.assetSource,
    preservesGameplayTerraces: false,
    terraceLayerCount: 0,
    waterfallCount: 0,
    palette: HIGHLAND_CITADEL_DESIGN_PALETTE,
  });
  const captureY = centralTower.userData.captureDeckY;
  const captureFrontZ = 0.08;
  const entryY = centralTower.userData.baseY + 2.25;
  const interiorFloorRoutes = centralTower.userData.interiorFloorRoutes.map((route) => Object.freeze({
    floor: route.floor,
    surface: route.surface,
    points: Object.freeze(route.points.map(([x, y, z]) => Object.freeze([
      x,
      centralTower.userData.baseY + y,
      z,
    ]))),
  }));
  root.userData.assaultAnchors = Object.freeze({
    destination: "castle-top",
    surfaceProvider: HIGHLAND_TOWNSCAPER_PLATFORM.surfaceProvider,
    feetClearance: 0.22,
    keepTop: Object.freeze([0, captureY, captureFrontZ]),
    approach: Object.freeze([0, highlandTownscaperSurfaceHeight(0, 18) + 0.22, 18]),
    stairRoute: Object.freeze([
      Object.freeze([-7.8, highlandTownscaperSurfaceHeight(-7.8, 22) + 0.22, 22]),
      Object.freeze([-9.1, highlandTownscaperSurfaceHeight(-9.1, 15) + 0.22, 15]),
      Object.freeze([-7.0, highlandTownscaperSurfaceHeight(-7.0, 8) + 0.22, 8]),
      Object.freeze([-5.8, highlandTownscaperSurfaceHeight(-5.8, 1) + 0.22, 1]),
      Object.freeze([-4.9, entryY + 1.2, 0.8]),
      Object.freeze([-2.2, entryY, 1.4]),
      Object.freeze([0, entryY, 2.25]),
    ]),
    ladderPolicy: "disabled",
    captureMode: "interior-rotating-stairs",
    interiorFloorRoutes: Object.freeze(interiorFloorRoutes),
    floorCount: interiorFloorRoutes.length,
    ladderLanes: Object.freeze([]),
  });

  // 性能（2026-08-24）：静态装饰组合并。圣塔/山壁/远峰/植被/朝圣轴/水岸硬构件
  // 全是 presentation-only 静态几何，不参与编辑（非 castleUnits）、寻路或夜灯，
  // 按材质合并后 draw calls 从逐构件降到逐组合并网格；描边壳由
  // odysseyCitadel.applyInkOutlines 在合并后统一添加（逐构件描边 → 逐组合并网格）。
  // 保留独立语义的对象：
  //   - walkSurface 楼梯/台阶（寻路表面）
  //   - citadelDesignWindow（夜灯逐窗状态，见 citadelWindowInstances）
  //   - boat / water / mist（船灯光、水体 userData、半透明雾层）
  //   - 三个固定镜头/战斗锚点 mesh（test_odyssey_citadel 与攻城锚按名引用）
  const staticAnchorNames = new Set([
    "highland-central-obelisk-chamber",
    "highland-castle-top-capture-deck",
    "highland-central-tower-roof",
  ]);
  const staticDecorationGroups = [
    // 中央方尖碑保留独立分段 mesh。它同时承担最高建筑、室内旋梯与夺取
    // 状态；把整塔作为装饰合批会移除塔身命名网格，并在部分材质组合下
    // 只剩尖顶/窗洞，视觉上像悬空。
    ravineWalls, distantPeaks, mountainVegetation,
    waterfront, ridgeTowers,
  ];
  for (const group of staticDecorationGroups) {
    if (!group || group.children.length === 0) continue;
    mergeStaticGroup(group, {
      // 独立命名空间：mergeCitadelTownStatic 的幂等清理只移除 town 层组的
      // mergedGeometry===true 网格，绝不误删装饰组的合并网格。
      mergedTag: "highland-decoration",
      skip: (mesh) =>
        mesh.userData?.walkSurface === true ||
        mesh.userData?.citadelDesignWindow === true ||
        mesh.userData?.skipInkOutline === true ||
        staticAnchorNames.has(mesh.name || "") ||
        /(^|-)(boat|water|mist)(-|$)/i.test(mesh.name || ""),
    });
  }
  return root;
}

// =====================================================================
// S13 山坡植被（视频画面归纳）：高山圣城山坡有成片暗绿树丛/灌木
// （色 ≈ 80–112, 96–112, 80），覆盖山体下部多个坡面。
// 新增独立"山坡灌木层"：低模圆冠丛（Icosahedron detail 0，每丛 3 球），
// 确定性散布在城址外山坡环带，避开湖面/城址/12 株低模树；不计入
// mountainVegetationCount 与道具统计（独立 userData.vegetationLayer）。
// =====================================================================

const SHRUB_FOLIAGE = Object.freeze([
  0x5a7058, // 暗绿 (90,112,88) —— 视频植被暗部
  0x6a8060, // 中绿 (106,128,96)
  0x4a5c48, // 最深绿 (74,92,72)
]);

// 截图 3 的植被不是围绕城堡随机撒点，而是沿山肩的等高带成片出现。
// 每条折线都是山体图表中的一条“森林带”；偏移量只沿带的法线抖动，
// 因而既保留自然感，又不会再次退化成圆环随机分布。
const HIGHLAND_MOUNTAIN_SHRUB_BANDS = Object.freeze([
  Object.freeze({
    id: "west-shoulder-forest-belt",
    points: Object.freeze([[-83, 25], [-72, 16], [-59, 3], [-47, -14], [-42, -27]]),
    samples: 24,
    width: 5.4,
  }),
  Object.freeze({
    id: "east-shoulder-forest-belt",
    points: Object.freeze([[83, 25], [72, 16], [59, 3], [47, -14], [42, -27]]),
    samples: 24,
    width: 5.4,
  }),
  Object.freeze({
    id: "north-forest-belt",
    points: Object.freeze([[-56, -42], [-35, -46], [-12, -48], [12, -48], [35, -46], [56, -42]]),
    samples: 28,
    width: 4.8,
  }),
]);

function pointOnPolyline(points, t) {
  const segments = [];
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const [x0, z0] = points[index];
    const [x1, z1] = points[index + 1];
    const length = Math.hypot(x1 - x0, z1 - z0);
    segments.push({ x0, z0, x1, z1, length });
    total += length;
  }
  let distance = THREE.MathUtils.clamp(t, 0, 1) * total;
  for (const segment of segments) {
    if (distance <= segment.length || segment === segments[segments.length - 1]) {
      const u = segment.length > 1e-6 ? distance / segment.length : 0;
      const tx = (segment.x1 - segment.x0) / Math.max(segment.length, 1e-6);
      const tz = (segment.z1 - segment.z0) / Math.max(segment.length, 1e-6);
      return {
        x: THREE.MathUtils.lerp(segment.x0, segment.x1, u),
        z: THREE.MathUtils.lerp(segment.z0, segment.z1, u),
        tx,
        tz,
      };
    }
    distance -= segment.length;
  }
  const [x, z] = points[points.length - 1];
  return { x, z, tx: 1, tz: 0 };
}

function compileHighlandShrubPlacements(count, seed) {
  const random = highlandSeededRandom(seed);
  const candidates = [];
  for (const band of HIGHLAND_MOUNTAIN_SHRUB_BANDS) {
    for (let index = 0; index < band.samples; index++) {
      const t = (index + 0.22 + random() * 0.56) / band.samples;
      const point = pointOnPolyline(band.points, t);
      const offset = (random() - 0.5) * band.width;
      const x = point.x - point.tz * offset + (random() - 0.5) * 0.85;
      const z = point.z + point.tx * offset + (random() - 0.5) * 0.85;
      const footprint = Math.max(Math.abs(x) / 28.5, Math.abs(z + 1.5) / 31.5);
      if (footprint < 1.15 || isHighlandWaterfrontCutout(x, z)) continue;
      const surfaceY = highlandTerrainSurfaceHeight(x, z);
      const slope = highlandMountainSlope(x, z);
      if (surfaceY < 1.0 || surfaceY > 50 || slope > 3.2) continue;
      candidates.push({ x, z, surfaceY, slope, band: band.id, size: random() });
    }
  }

  // First enforce a readable gap. A second pass relaxes only the gap, never
  // the surface/water/city tests, so dense belts remain intentional clusters.
  const placements = [];
  for (const minGap of [3.15, 2.2]) {
    for (const candidate of candidates) {
      if (placements.length >= count) break;
      if (placements.some((placed) => Math.hypot(placed.x - candidate.x, placed.z - candidate.z) < minGap)) continue;
      placements.push(candidate);
    }
    if (placements.length >= count) break;
  }
  return placements.slice(0, count);
}

// S17 植被小阴影（原文 *lil' shadows, they look quite volumetric*）：
// 圆形贴地半透明暗斑，让低模植被「坐」在地面上。共享几何/材质，只改矩阵。
const _blobShadowGeometry = null;
function buildBlobShadow(THREE, { x, y, z, radius = 1.0, opacity = 0.26, shared = null }) {
  const geometry = shared?.geometry || new THREE.CircleGeometry(1, 14);
  const material = shared?.material || new THREE.MeshBasicMaterial({
    color: 0x141d18,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const blob = new THREE.Mesh(geometry, material);
  blob.name = "highland-blob-shadow";
  blob.position.set(x, y + 0.035, z);
  blob.rotation.x = -Math.PI / 2;
  blob.scale.setScalar(radius);
  blob.renderOrder = 1;
  blob.userData.role = "vegetation-blob-shadow";
  blob.userData.skipInkOutline = true;
  return blob;
}

function buildSlopeShrub(materials, index, x, z, size, placement = {}) {
  const shrub = new THREE.Group();
  shrub.name = `highland-slope-shrub-${index}`;
  shrub.position.set(x, placement.surfaceY ?? highlandTerrainSurfaceHeight(x, z) + 0.02, z);
  shrub.rotation.y = (index * 1.913) % (Math.PI * 2);
  shrub.scale.setScalar(0.7 + size * 0.7);
  shrub.userData.nonNavigable = true;
  shrub.userData.presentationOnly = true;
  shrub.userData.role = "slope-shrub";
  shrub.userData.vegetationLayer = "highland-slope-shrubs-v1";
  shrub.userData.surfaceProvider = "highlandTerrainSurfaceHeight";
  shrub.userData.surfaceY = placement.surfaceY ?? highlandTerrainSurfaceHeight(x, z);
  shrub.userData.mountainBand = placement.band ?? "unknown";
  shrub.userData.slope = placement.slope ?? highlandMountainSlope(x, z);
  shrub.userData.palette = "screenshot-2-gray-green-v1";
  // 成丛：中央主冠 + 两侧副冠，堆叠成圆润树丛（视频山坡植被形态）
  const blobs = [
    [0.0, 0.34, 0.0, 0.55, materials.shrubDeep],
    [0.34, 0.22, 0.18, 0.42, materials.shrubMid],
    [-0.3, 0.2, -0.14, 0.4, materials.shrubMid],
    [0.06, 0.6, -0.04, 0.3, materials.shrubLight ?? materials.shrubDeep],
  ];
  for (let blobIndex = 0; blobIndex < blobs.length; blobIndex++) {
    const [bx, by, bz, radius, material] = blobs[blobIndex];
    const blob = presentationMesh(
      new THREE.IcosahedronGeometry(radius, 0),
      material,
      `highland-slope-shrub-${index}-blob-${blobIndex}`,
      "mountain-shrub-blob"
    );
    blob.position.set(bx, by, bz);
    blob.scale.set(1.0, 0.8, 0.92);
    blob.userData.skipInkOutline = true;
    shrub.add(blob);
  }
  return shrub;
}

export function buildHighlandSlopeShrubs(options = {}) {
  const count = options.count ?? 42;
  const seed = options.seed ?? 20260826;
  const foliage = {
    shrubDeep: new THREE.Color(SHRUB_FOLIAGE[0]),
    shrubMid: new THREE.Color(SHRUB_FOLIAGE[1]),
  };
  const materials = {
    shrubDeep: new THREE.MeshStandardMaterial({
      color: foliage.shrubDeep,
      roughness: 1,
      flatShading: true,
    }),
    shrubMid: new THREE.MeshStandardMaterial({
      color: foliage.shrubMid,
      roughness: 1,
      flatShading: true,
    }),
    shrubLight: new THREE.MeshStandardMaterial({
      color: new THREE.Color(SHRUB_FOLIAGE[2]),
      roughness: 1,
      flatShading: true,
    }),
  };
  // S17: 共享 blob shadow 几何/材质（所有灌木/树共用一块圆片）
  const blobShared = {
    geometry: new THREE.CircleGeometry(1, 14),
    material: new THREE.MeshBasicMaterial({
      color: 0x141d18,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    }),
  };
  const group = new THREE.Group();
  group.name = "highland-slope-shrub-vegetation";
  group.userData.nonNavigable = true;
  group.userData.presentationOnly = true;
  group.userData.role = "slope-shrub-vegetation";
  group.userData.vegetationLayer = "highland-slope-shrubs-v1";
  group.userData.shrubCount = 0;
  group.userData.blobShadowShared = blobShared;
  const placements = compileHighlandShrubPlacements(count, seed);
  placements.forEach((placement, index) => {
    const shrub = buildSlopeShrub(
      materials,
      index + 1,
      placement.x,
      placement.z,
      placement.size,
      placement
    );
    group.add(shrub);
    // S17 小阴影：灌木根部圆形暗斑（共享几何，贴地）
    const blob = buildBlobShadow(THREE, {
      x: placement.x,
      y: placement.surfaceY,
      z: placement.z,
      radius: 1.15 + placement.size * 0.5,
      shared: blobShared,
    });
    blob.userData.host = shrub.name;
    group.add(blob);
  });
  group.userData.shrubCount = placements.length;
  group.userData.distribution = "authored-mountain-slope-bands";
  group.userData.bandIds = Object.freeze([...new Set(placements.map((entry) => entry.band))]);
  group.userData.surfaceProvider = "highlandTerrainSurfaceHeight";
  group.userData.assetSource = "buildHighlandSlopeShrubs-low-poly-round-cluster";
  return group;
}

export function mountHighlandSlopeShrubs(THREE, parent, options = {}) {
  if (!THREE || !parent) return null;
  const existing = parent.getObjectByName("highland-slope-shrub-vegetation");
  if (existing) {
    existing.removeFromParent();
    existing.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      }
    });
  }
  const shrubs = buildHighlandSlopeShrubs(options);
  parent.add(shrubs);
  return shrubs;
}
