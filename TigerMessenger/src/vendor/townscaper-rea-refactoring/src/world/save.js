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
const SCENE_IDS = ['town', 'terrain', 'fusion'];

export function encodeWorld(world, scene) {
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
    if (world.solid[i] === 0) push(0, 1);
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
  let v = 0;
  for (const ch of str.trim().slice(0, 2)) v = (v << 6) | (INDEX.get(ch) ?? 0);
  return (v >> 1) & 63;   // 12 位里：[3b 版本][2b 场景][6b 半径][1b …]
}

/** 返回存档里的场景名；格式不对就抛错（不读错数据）。 */
export function decodeWorld(str, world) {
  const bits = [];
  for (const ch of str.trim()) {
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
  const scene = SCENE_IDS[read(2)] ?? 'town';
  if (read(6) !== world.grid.radius) throw new Error('网格半径不一致');
  world.reset();
  const n = world.solid.length;
  for (let i = 0; i < n;) {
    let s = 0, r = 0, c = -1, rv = 0;
    if (read(1)) { s = read(MAX_LEVEL); r = read(MAX_LEVEL); c = read(5) - 1; rv = read(1); }
    let run = 0;
    for (let more = 1; more;) { run += read(5) + 1; more = read(1); }
    for (let k = 0; k < run && i < n; k++, i++) { world.solid[i] = s; world.rock[i] = r; world.color[i] = c; world.river[i] = rv; }
  }
  world.touch();
  return scene;
}
