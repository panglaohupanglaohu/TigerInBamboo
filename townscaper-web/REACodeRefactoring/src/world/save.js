/**
 * save.js — 分享字符串（Placemaker.TextSaveSystem：位数组 → 64 字符表）。
 * 1198957499027795969："the save data … packed about as tight as I can … easily shareable"
 *
 * v5：[3b 版本][2b 场景][6b 网格半径]，然后是游程记录：
 *   [1b 非空] [12b 实心掩码][12b 岩石掩码][5b 颜色+1][1b 河道]  [5b 游程-1][1b 继续]…
 * 可选尾段（navgraph 1795831296952041691）：World.riverFlow 有效时追加 [1b=1]，然后按格序
 *   每个河格 [3b 下游邻边槽，7=无]。旧码的补零尾巴首位是 0 → 读作「无流向」，旧存档照读。
 * 可选尾段 2（r55，splice 1584623053061099520）：World.splicedHouses 非空时追加
 *   [流向段之后 1b=1；若没有流向段则先写 1b=0 再写 1b=1]，然后 [W 位 个数]，每栋按格序
 *   [W 位 格号][6b inset×100][2b 层数-1][6b sink×100]，W = ceil(log2(格数+1))。
 *   旧存档的补零尾巴不会出现「0 后跟 1」或「流向段后 1」，所以旧码照读、读出来没有嵌入房子。
 * 可选尾段 3（meta：调色板 + 玩法/天气状态，encodeWorld 第三参触发）：整条尾段是同一条
 *   「缺席段写 0、在位段写 1」标志链——[流向标志][流向记录][嵌入标志][嵌入记录][meta 标志][meta]，
 *   缺席段的 0 位与补零尾巴不可区分，旧串照读不误判；meta 段 = [3b metaVer=0]
 *   [1b 调色板段→[2b mode]（0=自定义→[5b 色数][每色 24b RGB]；1..3=PALETTE_IDS 预设序号）]
 *   [1b 状态段→[2b 光照时段][3b 北境主题 0=无/1..7][5b 世界开关
 *     flatRoofs/churchDoors/canalBridges/steelFrame/yardWalls][1b 天气段→
 *     [1b 雪][1b 雾][5b 雾浓度×20][5b 雾流速×10][9b 风向°]]]。
 *   解码把调色板/世界开关直接回写 world（原子段：全部校验通过才 restore），视图侧字段
 *   （时段/主题/天气）放 world.saveMeta 交调用方应用；encodeWorld 的 meta 缺省回落
 *   world.saveMeta，所以「解码 → 原样再编码」逐位一致（house-project 依赖这个 canonical）。
 *   旧解码器见到 meta 尾巴里的 1 → 「存档有多余数据」拒收，岛保住。
 * 可选尾段 4（UI 态：工具/色槽/镜头/选中态/撤销栈，meta.ui 触发）：同一条标志链末节
 *   [meta 记录][1b UI 标志]——缺席段的 0 位与补零尾巴不可区分，旧串照读；旧解码器见到
 *   UI 尾巴里的 1 → 「多余数据」拒收保岛。UI 段 = [3b 工具][5b 色槽序号]
 *   [1b 镜头段→[14b tx][14b ty][14b tz]（有符 ×0.05）[11b yaw/2π][8b pitch/1.6][10b 距离×10]]
 *   [1b 选中态段→[W 位 个数][每格 W 位 升序格号]]
 *   [1b 撤销栈段→[4b 撤销数≤8][1b 截断][条目…][4b 重做数≤8][1b 截断][条目…]]，
 *   条目 = 体素游程块（与主段同格式）+ [1b 嵌入房段→同尾段 2 记录] + [1b 选中态段→同前]。
 *   撤销栈条目是整份快照、分享串体量约束下只带最近 ≤8 条/栈（HISTORY_MAX），截断位如实记；
 *   多格实例登记（houseInstances）不进分享串，与主段 restore 行为一致（键缺席 → 不动登记）。
 *   全部视图侧字段经 world.saveMeta.ui 出站交调用方应用，再编码回落逐位一致。
 */

import { MAX_LEVEL } from '../core/world.js';
import { PALETTES } from '../core/palette.js';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));
const VERSION = 5;
const SCENE_IDS = ['town', 'terrain', 'fusion', 'badnorth'];
const PALETTE_IDS = ['town', 'pastel', 'dusk'];            // core/palette.js PALETTES 键序（存档写序号）
const TIME_IDS = ['day', 'dusk', 'night', 'bn'];           // app.js TIMES + 北境主题光照（view.timeOfDay）
const BN_THEME_IDS = ['summer', 'dawn', 'rain', 'dusk', 'night', 'winter', 'autumn'];   // badnorth/theme.js BN_PAL 键序
const WORLD_FLAGS = ['flatRoofs', 'churchDoors', 'canalBridges', 'steelFrame', 'yardWalls'];   // app.js ?flag= 世界开关
const TOOL_IDS = ['build', 'erase', 'paint', 'select', 'splice'];   // index.html data-tool + ?tool=splice
const HISTORY_MAX = 8;                    // 分享串最多带最近 8 条撤销 + 8 条重做（整快照入档的体量取舍）
const TAU = Math.PI * 2;
const HEX6 = /^#[0-9a-f]{6}$/i;

/** meta 缺省回落 world.saveMeta（decode 写的「上次导入状态」）；传 null 强制旧格式、不写尾段。 */
export function encodeWorld(world, scene, meta = world.saveMeta) {
  if (!SCENE_IDS.includes(scene)) throw new Error('未知场景');
  if (!Number.isInteger(world.grid.radius) || world.grid.radius < 1 || world.grid.radius > 63) throw new Error('网格半径越界');
  const bits = [];
  const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  push(VERSION, 3);
  push(Math.max(0, SCENE_IDS.indexOf(scene)), 2);
  push(world.grid.radius, 6);
  const n = world.solid.length;
  const palLen = world.palette?.colors.length ?? 15;
  pushVoxelRuns(push, world, n, palLen);
  const flow = world.riverFlow?.version === world.version ? world.riverFlow.flowTo : null;
  const spliced = world.splicedHouses?.size ? [...world.splicedHouses].sort((a, b) => a[0] - b[0]) : null;
  const metaBlk = metaPayload(world, meta);
  const uiBlk = uiPayload(world, meta?.ui, n);
  const pushHistEntry = (e) => {
    pushVoxelRuns(push, e.snapshot, n, palLen);
    push(e.snapshot.spliced ? 1 : 0, 1);
    if (e.snapshot.spliced) pushSpliced(push, e.snapshot.spliced, n);
    push(e.selection ? 1 : 0, 1);
    if (e.selection) pushIdList(push, e.selection, n);
  };
  if (flow || spliced || metaBlk || uiBlk) {
    push(flow ? 1 : 0, 1);
    if (flow) {
      for (let i = 0; i < n; i++) {
        if (!world.river[i]) continue;
        const slot = flow[i] < 0 ? -1 : world.cells[i].edgeNeighbors.indexOf(flow[i]);
        if (flow[i] >= 0 && (slot < 0 || slot > 6)) throw new Error('河流流向不是相邻格');
        push(slot < 0 ? 7 : slot, 3);
      }
    }
    if (spliced || metaBlk || uiBlk) {
      push(spliced ? 1 : 0, 1);
      if (spliced) pushSpliced(push, spliced, n);
      if (metaBlk || uiBlk) {
        push(metaBlk ? 1 : 0, 1);
        if (metaBlk) {
          push(0, 3);                                   // metaVer = 0，未来扩展换代
          if (metaBlk.palette) {
            push(1, 1);
            if (metaBlk.palette.preset) push(metaBlk.palette.preset, 2);
            else {
              push(0, 2); push(metaBlk.palette.colors.length, 5);
              for (const c of metaBlk.palette.colors) push(parseInt(c.slice(1), 16), 24);
            }
          } else push(0, 1);
          if (metaBlk.state) {
            push(1, 1);
            push(metaBlk.state.tod, 2); push(metaBlk.state.theme, 3); push(metaBlk.state.flags, 5);
            if (metaBlk.state.weather) {
              const w = metaBlk.state.weather;
              push(1, 1); push(w.snow ? 1 : 0, 1); push(w.fog ? 1 : 0, 1); push(w.op, 5); push(w.sp, 5); push(w.deg, 9);
            } else push(0, 1);
          } else push(0, 1);
        }
        if (uiBlk) {
          push(1, 1);
          push(uiBlk.tool, 3); push(uiBlk.colorIndex, 5);
          if (uiBlk.camera) {
            push(1, 1);
            for (const q of uiBlk.camera.target) push(q, 14);
            push(uiBlk.camera.yaw, 11); push(uiBlk.camera.pitch, 8); push(uiBlk.camera.distance, 10);
          } else push(0, 1);
          if (uiBlk.selection) { push(1, 1); pushIdList(push, uiBlk.selection, n); }
          else push(0, 1);
          if (uiBlk.history) {
            push(1, 1);
            push(uiBlk.history.undo.length, 4); push(uiBlk.history.undoTruncated ? 1 : 0, 1);
            for (const e of uiBlk.history.undo) pushHistEntry(e);
            push(uiBlk.history.redo.length, 4); push(uiBlk.history.redoTruncated ? 1 : 0, 1);
            for (const e of uiBlk.history.redo) pushHistEntry(e);
          } else push(0, 1);
        }
      }
    }
  }
  let out = '';
  for (let i = 0; i < bits.length; i += 6) {
    let v = 0;
    for (let b = 0; b < 6; b++) v = (v << 1) | (bits[i + b] ?? 0);
    out += ALPHABET[v];
  }
  return out;
}

/** 只读存档头里的网格半径（不解码整个存档）：用来判断这个链接是哪种网格做的。 */
export function peekGridRadius(str) {
  if (typeof str !== 'string' || str.trim().length < 2) throw new Error('存档头被截断');
  let v = 0;
  for (const ch of str.trim().slice(0, 2)) {
    const digit = INDEX.get(ch);
    if (digit === undefined) throw new Error('存档头有未知字符');
    v = (v << 6) | digit;
  }
  if ((v >> 9) !== VERSION) throw new Error('存档版本不对（需要 v5）');
  return (v >> 1) & 63;
}

/** Parse and validate in scratch arrays; corrupt input must never erase the live island. */
export function decodeWorld(str, world) {
  if (typeof str !== 'string') throw new Error('存档必须是字符串');
  str = str.trim();
  const n = world.solid.length;
  // 上限 = 头 + 体素段 + 嵌入房段 + meta 尾段最坏 790 位 + UI 尾段最坏
  // （镜头/工具/色槽 ~80b + 选中态 (n+1)W + 撤销/重做各 HISTORY_MAX 条 × 单条最坏）。
  const Wcap = idWidth(n);
  const histWorst = 2 * HISTORY_MAX * (n * 49 + (n + 1) * (2 * Wcap + 14) + 4) + 10;
  if (str.length > Math.ceil((14 + n * 43 + (n + 1) * (Wcap + 14) + 790 + 80 + (n + 1) * Wcap + histWorst) / 6)) throw new Error('存档过长');
  const bits = [];
  for (const ch of str) {
    const v = INDEX.get(ch);
    if (v === undefined) throw new Error(`未知字符 "${ch}"`);
    for (let i = 5; i >= 0; i--) bits.push((v >> i) & 1);
  }
  let p = 0;
  const read = (n) => {
    if (p + n > bits.length) throw new Error('存档被截断');
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | bits[p++];
    return v;
  };
  if (read(3) !== VERSION) throw new Error('存档版本不对（需要 v5）');
  const scene = SCENE_IDS[read(2)];
  if (read(6) !== world.grid.radius) throw new Error('网格半径不一致');
  const { next, maxColor } = readVoxelRuns(read, n);   // 色槽上限延到 meta 段解完后按生效调色板验
  // ---- 可选尾段标志链：[1b 流向][1b 嵌入][1b meta] ----
  // padFrom = 补零尾巴起点：最后一个**在位**段的记录末尾；全部缺席时 = 第一个标志位。
  // 缺席标志的 0 位本来就算在 ≤5 位补零额度里（与旧解码器同一判据，legacy+'0' 依然拒收）。
  let padFrom = p;
  let flowTo = null;
  if (bits[p++] === 1) {
    flowTo = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (!next.river[i]) continue;
      const slot = read(3);
      if (slot === 7) continue;
      const to = world.cells[i].edgeNeighbors[slot];
      if (to === undefined || to < 0) throw new Error('河流流向槽位无效');
      flowTo[i] = to;
    }
    padFrom = p;
  }
  let spliced = null;
  if (bits[p++] === 1) {
    spliced = readSpliced(read, n, next);
    padFrom = p;
  }
  let palette = null, st = null;
  if (bits[p++] === 1) {
    if (read(3) !== 0) throw new Error('存档扩展段版本不对');
    if (read(1)) {
      const mode = read(2);
      if (mode === 0) {
        const count = read(5);
        if (count < 1) throw new Error('调色板色数无效');
        const colors = [];
        for (let k = 0; k < count; k++) colors.push('#' + read(24).toString(16).padStart(6, '0'));
        palette = { name: '自定义（存档）', colors };
      } else palette = PALETTES[PALETTE_IDS[mode - 1]];
    }
    if (read(1)) {
      const timeOfDay = TIME_IDS[read(2)], themeV = read(3), flags = read(5);
      let weather = null;
      if (read(1)) {
        const snow = !!read(1), fog = !!read(1), op = read(5), sp = read(5), deg = read(9);
        if (op > 20 || sp > 20 || deg > 359) throw new Error('天气参数越界');
        weather = { snow, fog, fogOpacity: op / 20, fogSpeed: sp / 10, windDeg: deg };
      }
      st = { timeOfDay, bnTheme: themeV ? BN_THEME_IDS[themeV - 1] : null, flags, weather };
    }
    if (!palette && !st) throw new Error('存档扩展段为空');   // 编码器不产空 meta 段，非规范输入拒收
    padFrom = p;
  }
  // 色槽上限按「解完后生效的调色板」验：meta 段带来新调色板时槽位跟着换，没带就用当前 palette。
  const palCap = (palette ?? world.palette)?.colors.length ?? 15;
  if (maxColor >= palCap) throw new Error('无效的体素或墙色色槽');
  // ---- 可选尾段标志链末节：[1b UI 标志][3b 工具][5b 色槽][1b 镜头][1b 选中态][1b 撤销栈] ----
  let ui = null;
  if (bits[p++] === 1) {
    const toolV = read(3);
    if (toolV >= TOOL_IDS.length) throw new Error('存档扩展段工具无效');
    ui = { tool: TOOL_IDS[toolV], colorIndex: read(5) };
    if (ui.colorIndex >= palCap) throw new Error('色槽序号越界');
    if (read(1)) {
      ui.camera = {
        target: [read(14) - 8192, read(14) - 8192, read(14) - 8192].map((q) => q / 20),
        yaw: read(11) * TAU / 2048,
        pitch: read(8) * 1.6 / 255,
        distance: read(10) / 10,
      };
    }
    if (read(1)) ui.selection = readIdList(read, n);
    if (read(1)) {
      const stack = () => {
        const count = read(4);
        if (count > HISTORY_MAX) throw new Error('撤销栈条目数越界');
        const truncated = !!read(1), list = [];
        for (let k = 0; k < count; k++) {
          const { next: e, maxColor: mc } = readVoxelRuns(read, n);
          if (mc >= palCap) throw new Error('无效的体素或墙色色槽');
          const entry = { snapshot: { ...e, spliced: null }, selection: null };
          if (read(1)) entry.snapshot.spliced = readSpliced(read, n, e);
          if (read(1)) entry.selection = readIdList(read, n);
          list.push(entry);
        }
        return { list, truncated };
      };
      const u = stack(), r = stack();
      ui.history = { undo: u.list, undoTruncated: u.truncated, redo: r.list, redoTruncated: r.truncated };
    }
    padFrom = p;
  }
  // Encoder adds at most five zero padding bits after the last present section; reject appended payloads.
  if (bits.length - padFrom > 5 || bits.slice(padFrom).some(Boolean)) throw new Error('存档有多余数据');
  world.restore({ ...next, spliced });
  if (palette) world.palette = palette;
  if (st) WORLD_FLAGS.forEach((k, i) => { world[k] = !!(st.flags & (1 << i)); });
  // 视图侧状态出站：调用方应用后可保留（再编码走 saveMeta 回落、逐位一致），也可自行清掉。
  world.saveMeta = palette || st || ui
    ? { palette: !!palette, state: st ? { timeOfDay: st.timeOfDay, bnTheme: st.bnTheme, weather: st.weather } : null, ui }
    : null;
  if (flowTo) world.riverFlow = { ...riverFlowChains(world, flowTo), flowTo, version: world.version, restored: true };
  return scene;
}

/** meta 段编码输入 → 归一化的 {palette,state}；meta 为空或两段都不要 → null（不写尾段）。 */
function metaPayload(world, meta) {
  if (!meta || (!meta.palette && !meta.state)) return null;
  const out = {};
  if (meta.palette) {
    const colors = world.palette?.colors;
    if (!Array.isArray(colors) || !colors.length || colors.length > 31) throw new Error('调色板色数越界');
    if (colors.some((c) => typeof c !== 'string' || !HEX6.test(c))) throw new Error('无效的调色板颜色');
    const preset = PALETTE_IDS.findIndex((id) => PALETTES[id].colors.length === colors.length
      && PALETTES[id].colors.every((c, i) => c.toLowerCase() === colors[i].toLowerCase()));
    out.palette = preset >= 0 ? { preset: preset + 1 } : { colors: colors.map((c) => c.toLowerCase()) };
  }
  if (meta.state) {
    const s = meta.state;
    const tod = TIME_IDS.indexOf(s.timeOfDay ?? 'day');
    if (tod < 0) throw new Error('未知光照时段');
    const theme = s.bnTheme == null ? 0 : BN_THEME_IDS.indexOf(s.bnTheme) + 1;
    if (theme === 0 && s.bnTheme != null) throw new Error('未知北境主题');
    let flags = 0;
    WORLD_FLAGS.forEach((k, i) => { if (world[k]) flags |= 1 << i; });
    let weather = null;
    if (s.weather) {
      const w = s.weather;
      if (!Number.isFinite(w.fogOpacity) || w.fogOpacity < 0 || w.fogOpacity > 1) throw new Error('雾浓度越界');
      if (!Number.isFinite(w.fogSpeed) || w.fogSpeed < 0 || w.fogSpeed > 2) throw new Error('雾流速越界');
      if (!Number.isFinite(w.windDeg) || w.windDeg < 0 || w.windDeg > 360) throw new Error('风向角度越界');
      weather = { snow: !!w.snow, fog: !!w.fog, op: Math.round(w.fogOpacity * 20), sp: Math.round(w.fogSpeed * 10), deg: Math.round(w.windDeg) % 360 };
    }
    out.state = { tod, theme, flags, weather };
  }
  return out;
}

/** UI 段编码输入 → 归一化的 {tool,colorIndex,camera?,selection?,history?}；meta.ui 全空 → null（不写尾段）。 */
function uiPayload(world, ui, n) {
  if (!ui) return null;
  if (ui.tool == null && ui.colorIndex == null && ui.camera == null && ui.selection == null && ui.history == null) return null;
  const tool = ui.tool == null ? 0 : TOOL_IDS.indexOf(ui.tool);
  if (tool < 0) throw new Error('未知工具');
  const palLen = world.palette?.colors.length ?? 15;
  const colorIndex = ui.colorIndex ?? 0;
  if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= palLen) throw new Error('色槽序号越界');
  const out = { tool, colorIndex };
  if (ui.camera != null) {
    const c = ui.camera, t = c.target;
    const q = (v) => { if (!Number.isFinite(v) || Math.abs(v) > 409.55) throw new Error('镜头目标越界'); return Math.round(v * 20) + 8192; };
    if (!Array.isArray(t) || t.length !== 3) throw new Error('镜头目标无效');
    if (!Number.isFinite(c.yaw)) throw new Error('镜头朝向无效');
    if (!Number.isFinite(c.pitch) || c.pitch < 0 || c.pitch > 1.6) throw new Error('镜头俯仰越界');
    if (!Number.isFinite(c.distance) || c.distance < 0 || c.distance > 102.3) throw new Error('镜头距离越界');
    out.camera = { target: t.map(q), yaw: ((Math.round(c.yaw * 2048 / TAU) % 2048) + 2048) % 2048, pitch: Math.round(c.pitch * 255 / 1.6), distance: Math.round(c.distance * 10) };
  }
  if (ui.selection != null) out.selection = checkedIdList(ui.selection, n, '选中态');
  if (ui.history != null) {
    const h = ui.history, history = {};
    for (const key of ['undo', 'redo']) {
      const list = h[key] ?? [];
      if (!Array.isArray(list) || list.length > HISTORY_MAX) throw new Error('撤销栈条目数越界');
      history[key] = list.map((e) => {
        const s = e?.snapshot;
        if (!s || s.solid?.length !== n || s.rock?.length !== n || s.color?.length !== n || s.river?.length !== n) throw new Error('撤销栈快照无效');
        const sp = s.spliced?.length ? [...s.spliced].sort((a, b) => a[0] - b[0]) : null;
        if (sp) for (let k = 1; k < sp.length; k++) if (!(sp[k][0] > sp[k - 1][0])) throw new Error('撤销栈嵌入房子无效');
        return { snapshot: { solid: s.solid, rock: s.rock, color: s.color, river: s.river, spliced: sp }, selection: e.selection?.length ? checkedIdList(e.selection, n, '撤销栈选中态') : null };
      });
      history[key + 'Truncated'] = !!h[key + 'Truncated'];
    }
    out.history = history;
  }
  return out;
}

/** 格号表编码侧归一化：去重 + 升序（解码只收严格升序 → 往返逐位一致）。空表 → null（不写子段）。 */
function checkedIdList(ids, n, what) {
  if (!Array.isArray(ids) || !ids.length) return null;
  const seen = new Set();
  for (const id of ids) {
    if (!Number.isInteger(id) || id < 0 || id >= n || seen.has(id)) throw new Error(`${what}格号无效`);
    seen.add(id);
  }
  return [...seen].sort((a, b) => a - b);
}

/** W 位格号表写出：[W 个数][每格 W 位 id]（调用方保证非空升序）。 */
function pushIdList(push, ids, n) {
  const W = idWidth(n);
  push(ids.length, W);
  for (const id of ids) push(id, W);
}

/** W 位格号表读入：非空、严格升序（编码侧只产升序 → 0/降序/重复是非规范输入）。 */
function readIdList(read, n) {
  const W = idWidth(n), count = read(W);
  if (count < 1 || count > n) throw new Error('选中态格数无效');
  const ids = [];
  for (let k = 0, prev = -1; k < count; k++) {
    const id = read(W);
    if (id <= prev) throw new Error('选中态格号无效');
    ids.push(id); prev = id;
  }
  return ids;
}

/** 体素游程写块（主段与撤销栈条目共用同一格式）：arrays = {solid,rock,color,river}，palLen = 生效调色板色数。 */
function pushVoxelRuns(push, arrays, n, palLen) {
  const key = (i) => `${arrays.solid[i]},${arrays.rock[i]},${arrays.color[i]},${arrays.river[i]}`;
  for (let i = 0; i < n;) {
    let run = 1;
    while (i + run < n && key(i + run) === key(i)) run++;
    const s = arrays.solid[i], r = arrays.rock[i], c = arrays.color[i], river = arrays.river[i];
    if ((s & ~((1 << MAX_LEVEL) - 1)) || (r & ~s) || c < -1 || c > 30 || c >= palLen || river > 1) throw new Error('无效的体素或墙色色槽');
    if (s === 0 && r === 0 && c === -1 && river === 0) push(0, 1);
    else {
      push(1, 1);
      push(s, MAX_LEVEL); push(r, MAX_LEVEL); push(c + 1, 5); push(river, 1);
    }
    for (let left = run; left > 0;) {
      const chunk = Math.min(32, left);
      push(chunk - 1, 5);
      left -= chunk;
      push(left > 0 ? 1 : 0, 1);
    }
    i += run;
  }
}

/** 体素游程读块：返回 {next:{solid,rock,color,river}, maxColor}；掩码/游程界就地校验。 */
function readVoxelRuns(read, n) {
  const next = { solid: new Uint16Array(n), rock: new Uint16Array(n), color: new Int8Array(n).fill(-1), river: new Uint8Array(n) };
  let maxColor = -1;
  for (let i = 0; i < n;) {
    let s = 0, r = 0, c = -1, rv = 0;
    if (read(1)) { s = read(MAX_LEVEL); r = read(MAX_LEVEL); c = read(5) - 1; rv = read(1); }
    if ((r & ~s) !== 0) throw new Error('无效的体素');
    if (c > maxColor) maxColor = c;
    let run = 0;
    for (let more = 1; more;) {
      run += read(5) + 1;
      if (run > n - i) throw new Error('游程超出网格');
      more = read(1);
    }
    for (let k = 0; k < run; k++, i++) { next.solid[i] = s; next.rock[i] = r; next.color[i] = c; next.river[i] = rv; }
  }
  return { next, maxColor };
}

/** 嵌入房记录写块（尾段 2 与撤销栈条目共用）：spliced = [[id,{inset,stories,sink}]…] 升序。 */
function pushSpliced(push, spliced, n) {
  const W = idWidth(n);
  push(spliced.length, W);
  for (const [id, h] of spliced) {
    const inset = Math.round(h.inset * 100), sink = Math.round(h.sink * 100);
    if (!(id >= 0 && id < n) || inset < 1 || inset > 49 || sink < 0 || sink > 49 || !(h.stories >= 1 && h.stories <= 4)) throw new Error('嵌入房子参数越界');
    push(id, W); push(inset, 6); push(h.stories - 1, 2); push(sink, 6);
  }
}

/** 嵌入房记录读块：next = 该条目的体素组（裸露岩顶校验按条目自身体素）。 */
function readSpliced(read, n, next) {
  const W = idWidth(n), count = read(W);
  if (count < 1 || count > n) throw new Error('嵌入房子个数无效');
  const spliced = [];
  for (let k = 0, prev = -1; k < count; k++) {
    const id = read(W), inset = read(6), stories = read(2) + 1, sink = read(6);
    if (id <= prev || id >= n || inset < 1 || inset > 49 || sink > 49) throw new Error('嵌入房子记录无效');
    const g = 32 - Math.clz32(next.rock[id]);
    if (!next.rock[id] || next.river[id] || (next.solid[id] >> g) & 1) throw new Error('嵌入房子不在裸露岩顶上');
    spliced.push([id, { inset: inset / 100, stories, sink: sink / 100 }]);
    prev = id;
  }
  return spliced;
}

function idWidth(n) { return Math.max(1, Math.ceil(Math.log2(n + 1))); }

/** 读档后从 flowTo 重建链（头 = 无上游的河格），河口取链尾相邻的海格；汇流重叠段只出现在先开凿的链里。 */
function riverFlowChains(world, flowTo) {
  const n = flowTo.length, indeg = new Uint8Array(n), paths = [], mouths = [];
  for (let i = 0; i < n; i++) if (flowTo[i] >= 0) indeg[flowTo[i]] = 1;
  for (let i = 0; i < n; i++) {
    if (indeg[i] || flowTo[i] < 0) continue;
    const path = [i], seen = new Set(path);
    for (let c = flowTo[i]; c >= 0 && !seen.has(c); c = flowTo[c]) { path.push(c); seen.add(c); }
    paths.push(path);
    const end = world.cells[path[path.length - 1]];
    const mouth = end.edgeNeighbors.find((id) => id >= 0 && world.ground(world.cells[id]) === 0);
    if (mouth !== undefined && !mouths.includes(mouth)) mouths.push(mouth);
  }
  return { paths, mouths };
}
