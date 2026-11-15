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
 */

import { MAX_LEVEL } from '../core/world.js';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));
const VERSION = 5;
const SCENE_IDS = ['town', 'terrain', 'fusion', 'badnorth'];

export function encodeWorld(world, scene) {
  if (!SCENE_IDS.includes(scene)) throw new Error('未知场景');
  if (!Number.isInteger(world.grid.radius) || world.grid.radius < 1 || world.grid.radius > 63) throw new Error('网格半径越界');
  const bits = [];
  const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  push(VERSION, 3);
  push(Math.max(0, SCENE_IDS.indexOf(scene)), 2);
  push(world.grid.radius, 6);
  const n = world.solid.length;
  const key = (i) => `${world.solid[i]},${world.rock[i]},${world.color[i]},${world.river[i]}`;
  for (let i = 0; i < n;) {
    let run = 1;
    while (i + run < n && key(i + run) === key(i)) run++;
    const s = world.solid[i], r = world.rock[i], c = world.color[i], river = world.river[i];
    if ((s & ~((1 << MAX_LEVEL) - 1)) || (r & ~s) || c < -1 || c > 30 || c >= (world.palette?.colors.length ?? 15) || river > 1) throw new Error('无效的体素或墙色色槽');
    if (s === 0 && r === 0 && c === -1 && river === 0) push(0, 1);
    else {
      push(1, 1);
      push(world.solid[i], MAX_LEVEL);
      push(world.rock[i], MAX_LEVEL);
      push(world.color[i] + 1, 5);
      push(world.river[i], 1);
    }
    for (let left = run; left > 0;) {
      const chunk = Math.min(32, left);
      push(chunk - 1, 5);
      left -= chunk;
      push(left > 0 ? 1 : 0, 1);
    }
    i += run;
  }
  const flow = world.riverFlow?.version === world.version ? world.riverFlow.flowTo : null;
  const spliced = world.splicedHouses?.size ? [...world.splicedHouses].sort((a, b) => a[0] - b[0]) : null;
  if (flow) {
    push(1, 1);
    for (let i = 0; i < n; i++) {
      if (!world.river[i]) continue;
      const slot = flow[i] < 0 ? -1 : world.cells[i].edgeNeighbors.indexOf(flow[i]);
      if (flow[i] >= 0 && (slot < 0 || slot > 6)) throw new Error('河流流向不是相邻格');
      push(slot < 0 ? 7 : slot, 3);
    }
  }
  if (spliced) {
    if (!flow) push(0, 1);
    push(1, 1);
    const W = idWidth(n);
    push(spliced.length, W);
    for (const [id, h] of spliced) {
      const inset = Math.round(h.inset * 100), sink = Math.round(h.sink * 100);
      if (!(id >= 0 && id < n) || inset < 1 || inset > 49 || sink < 0 || sink > 49 || !(h.stories >= 1 && h.stories <= 4)) throw new Error('嵌入房子参数越界');
      push(id, W); push(inset, 6); push(h.stories - 1, 2); push(sink, 6);
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
  if (str.length > Math.ceil((14 + n * 43 + (n + 1) * (idWidth(n) + 14)) / 6)) throw new Error('存档过长');
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
  const next = {solid:new Uint16Array(n),rock:new Uint16Array(n),color:new Int8Array(n).fill(-1),river:new Uint8Array(n)};
  for (let i = 0; i < n;) {
    let s = 0, r = 0, c = -1, rv = 0;
    if (read(1)) { s = read(MAX_LEVEL); r = read(MAX_LEVEL); c = read(5) - 1; rv = read(1); }
    if ((r & ~s) !== 0 || c >= (world.palette?.colors.length ?? 15)) throw new Error('无效的体素或墙色色槽');
    let run = 0;
    for (let more = 1; more;) {
      run += read(5) + 1;
      if (run > n - i) throw new Error('游程超出网格');
      more = read(1);
    }
    for (let k = 0; k < run; k++, i++) { next.solid[i] = s; next.rock[i] = r; next.color[i] = c; next.river[i] = rv; }
  }
  let flowTo = null;
  if (p < bits.length && bits[p] === 1) {
    p++;
    flowTo = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (!next.river[i]) continue;
      const slot = read(3);
      if (slot === 7) continue;
      const to = world.cells[i].edgeNeighbors[slot];
      if (to === undefined || to < 0) throw new Error('河流流向槽位无效');
      flowTo[i] = to;
    }
  }
  let spliced = null;
  if (flowTo ? bits[p] === 1 : bits[p] === 0 && bits[p + 1] === 1) {
    p += flowTo ? 1 : 2;
    const W = idWidth(n), count = read(W);
    if (count < 1 || count > n) throw new Error('嵌入房子个数无效');
    spliced = [];
    for (let k = 0, prev = -1; k < count; k++) {
      const id = read(W), inset = read(6), stories = read(2) + 1, sink = read(6);
      if (id <= prev || id >= n || inset < 1 || inset > 49 || sink > 49) throw new Error('嵌入房子记录无效');
      const g = 32 - Math.clz32(next.rock[id]);
      if (!next.rock[id] || next.river[id] || (next.solid[id] >> g) & 1) throw new Error('嵌入房子不在裸露岩顶上');
      spliced.push([id, { inset: inset / 100, stories, sink: sink / 100 }]);
      prev = id;
    }
  }
  // Encoder adds at most five zero padding bits; reject appended payloads.
  if (bits.length - p > 5 || bits.slice(p).some(Boolean)) throw new Error('存档有多余数据');
  world.restore({ ...next, spliced });
  if (flowTo) world.riverFlow = { ...riverFlowChains(world, flowTo), flowTo, version: world.version, restored: true };
  return scene;
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
