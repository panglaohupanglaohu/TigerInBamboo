/**
 * save.js — 分享字符串（Placemaker.TextSaveSystem：位数组 → 64 字符表）。
 * 1198957499027795969："the save data … packed about as tight as I can … easily shareable"
 *
 * v5：[3b 版本][2b 场景][6b 网格半径]，然后是游程记录：
 *   [1b 非空] [12b 实心掩码][12b 岩石掩码][5b 颜色+1][1b 河道]  [5b 游程-1][1b 继续]…
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
  if (str.length > Math.ceil((11 + n * 37) / 6)) throw new Error('存档过长');
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
  // Encoder adds at most five zero padding bits; reject appended payloads.
  if (bits.length - p > 5 || bits.slice(p).some(Boolean)) throw new Error('存档有多余数据');
  world.restore(next);
  return scene;
}
