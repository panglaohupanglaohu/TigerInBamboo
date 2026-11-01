import {loadRobotWeaponSamples,robotSample,robotSampleState} from './robotWeaponSamples.js';
// =====================================================================
//  世界音效库（战斗 / 武器 / 载具 / 能力 / 天气）
//
//  全部 WebAudio 程序合成，不引入新音频文件，不触碰 BGM：
//  - 独立 SFX 总线（压限器 → destination），复用 sfx.js 的 AudioContext 与 M 键静音。
//  - 一次性音效：事件驱动，带冷却、同类实例上限、前景/总量预算与低优先级让位。
//  - 空间化：以玩家身体为听点决定远近，镜头右向决定左右声像；远处加空气吸收低通。
//  - 循环：引擎（最多 2 路，取最响的两艘）、舰队吸取（1 路）、天气底声（1 路）。
//  预算与混音口径见 docs/AUDIO_DIRECTION_AND_MIX_PLAN.md。
//  声音只观察事件，不改变任何战斗状态；随机数用本模块私有 PRNG，不碰模拟 RNG。
// =====================================================================
import { ensureAudio, isMuted } from "./sfx.js";

// ---------------------------------------------------------------- 预算 --
const FOREGROUND_CAP = 6; // 武器 / 命中 / 能力
const ONESHOT_CAP = 8; // 一次性总量（循环另计：引擎 2 + 吸取 1 + 天气 1 → 非音乐 ≤ 12）
const ENGINE_SLOTS = 2;
const MASTER_GAIN = 0.9;
const FOREGROUND_CATS = new Set(["weapon", "impact", "ability"]);

// 空间：参考距离内满音量，之后按距离衰减，maxDist 前 25% 渐隐到 0
const DEFAULT_REF = 7;

// ----------------------------------------------------------- 内部状态 --
let bus = null; // {ctx, master, comp, cats:{...}}
let white = null;
let brown = null;
const voices = []; // {id, cat, prio, end, out}
const lastPlayed = new Map(); // id -> ctx time
const listener = { has: false, x: 0, y: 0, z: 0, rx: 1, ry: 0, rz: 0 };

let seed = 0x2f6e2b1;
function rnd() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const jitter = (v, amt) => v * (1 + (rnd() * 2 - 1) * amt);

function getCtx() {
  if (isMuted()) return null;
  const ctx = ensureAudio();
  if (!ctx || ctx.state !== "running") return null;
  if (!bus || bus.ctx !== ctx) buildBus(ctx);
  return ctx;
}

function buildBus(ctx) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(comp);
  comp.connect(ctx.destination);
  const cat = (g) => {
    const n = ctx.createGain();
    n.gain.value = g;
    n.connect(master);
    return n;
  };
  bus = {
    ctx,
    master,
    comp,
    cats: {
      weapon: cat(0.85),
      impact: cat(0.8),
      ability: cat(0.9),
      event: cat(0.75),
      vehicle: cat(0.55),
      weather: cat(0.6),
    },
  };
  loadRobotWeaponSamples(ctx);
  white = makeNoise(ctx, false);
  brown = makeNoise(ctx, true);
}

function makeNoise(ctx, isBrown) {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
    if (isBrown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

// ------------------------------------------------------------ 听点 --
/**
 * 每帧设置听点：位置 = 玩家身体；右向取自镜头（左右声像）。
 * @param {{x:number,y:number,z:number}} pos
 * @param {import('three').Camera} [camera]
 */
export function setSfxListener(pos, camera) {
  if (!pos || !Number.isFinite(pos.x)) return;
  listener.has = true;
  listener.x = pos.x;
  listener.y = pos.y;
  listener.z = pos.z;
  const e = camera?.matrixWorld?.elements;
  if (e) {
    const l = Math.hypot(e[0], e[1], e[2]) || 1;
    listener.rx = e[0] / l;
    listener.ry = e[1] / l;
    listener.rz = e[2] / l;
  }
}

/** 距离 → {gain, pan, dist}；超出范围返回 null（不建节点）。 */
function spatial(pos, maxDist, ref = DEFAULT_REF) {
  if (!pos || !listener.has) return { gain: 1, pan: 0, dist: 0 };
  const dx = pos.x - listener.x;
  const dy = pos.y - listener.y;
  const dz = pos.z - listener.z;
  const dist = Math.hypot(dx, dy, dz);
  if (!(dist < maxDist)) return null;
  let gain = dist <= ref ? 1 : Math.pow(ref / dist, 0.85);
  const edge = maxDist * 0.75;
  if (dist > edge) gain *= 1 - (dist - edge) / (maxDist - edge);
  const pan = dist > 0.5 ? ((dx * listener.rx + dy * listener.ry + dz * listener.rz) / dist) * 0.75 : 0;
  return { gain, pan, dist };
}

// ---------------------------------------------------------- 声部管理 --
function reap(now) {
  for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= now) voices.splice(i, 1);
}

function stealFor(prio, filter, allowEqual = false) {
  let worst = -1;
  let worstP = Infinity;
  for (let i = 0; i < voices.length; i++) {
    const v = voices[i];
    if (!filter(v)) continue;
    if (v.prio < worstP) {
      worstP = v.prio;
      worst = i;
    }
  }
  if (worst < 0 || (allowEqual ? worstP > prio : worstP >= prio)) return false;
  const v = voices[worst];
  try {
    v.out.gain.cancelScheduledValues(bus.ctx.currentTime);
    v.out.gain.setTargetAtTime(0, bus.ctx.currentTime, 0.015);
  } catch {
    /* 已回收 */
  }
  voices.splice(worst, 1);
  return true;
}

/**
 * 申请一个一次性声部。返回 {ctx, t0, input} 或 null（被限流/太远/静音）。
 * spec: {id, cat, prio, maxInst, cd, maxDist, ref, gain, dur, air}
 */
function voice(spec, pos) {
  const ctx = getCtx();
  if (!ctx) return null;
  const now = ctx.currentTime;
  const last = lastPlayed.get(spec.id);
  if (last !== undefined && now - last < (spec.cd ?? 0.08)) return null;
  const sp = spatial(pos, spec.maxDist ?? 60, spec.ref ?? DEFAULT_REF);
  if (!sp || sp.gain < 0.02) return null;
  reap(now);
  const prio = (spec.prio ?? 50) * (0.5 + 0.5 * sp.gain); // 近处同类更优先
  const same = voices.reduce((n, v) => n + (v.id === spec.id), 0);
  if (same >= (spec.maxInst ?? 2) && !stealFor(prio, (v) => v.id === spec.id, spec.replaceOldest)) return null;
  const fg = FOREGROUND_CATS.has(spec.cat);
  if (fg && voices.filter((v) => FOREGROUND_CATS.has(v.cat)).length >= FOREGROUND_CAP) {
    if (!stealFor(prio, (v) => FOREGROUND_CATS.has(v.cat), spec.replaceOldest)) return null;
  }
  if (voices.length >= ONESHOT_CAP && !stealFor(prio, () => true, spec.replaceOldest)) return null;
  lastPlayed.set(spec.id, now);

  const t0 = now + 0.005;
  const dur = spec.dur ?? 0.5;
  const input = ctx.createGain();
  let node = input,panNode=null;
  // 空气吸收：越远越闷
  const airT = sp.dist / (spec.maxDist ?? 60);
  if (spec.air !== false && airT > 0.15) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 16000 * Math.pow(0.12, airT);
    node.connect(lp);
    node = lp;
  }
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();panNode=p;
    p.pan.value = Math.max(-1, Math.min(1, sp.pan));
    node.connect(p);
    node = p;
  }
  const out = ctx.createGain();
  out.gain.value = (spec.gain ?? 1) * sp.gain;
  node.connect(out);
  out.connect(bus.cats[spec.cat] || bus.master);
  voices.push({ id: spec.id, cat: spec.cat, prio, end: t0 + dur, out, panNode, position:pos?{x:pos.x,y:pos.y,z:pos.z}:null, baseGain:spec.gain??1, maxDist:spec.maxDist??60, ref:spec.ref??DEFAULT_REF });
  setTimeout(() => {
    try {
      out.disconnect();
    } catch {
      /* ignore */
    }
  }, (dur + 0.4) * 1000);
  return { ctx, t0, input, dur };
}

// ----------------------------------------------------------- 合成积木 --
function osc(v, type, f0, f1, start, dur, glide = "exp") {
  const o = v.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, start);
  if (f1 && f1 !== f0) {
    if (glide === "exp") o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    else o.frequency.linearRampToValueAtTime(f1, start + dur);
  }
  o.start(start);
  o.stop(start + dur + 0.05);
  return o;
}

function noise(v, kind, start, dur) {
  const s = v.ctx.createBufferSource();
  s.buffer = kind === "brown" ? brown : white;
  s.loop = true;
  s.start(start, rnd() * 1.5);
  s.stop(start + dur + 0.05);
  return s;
}

function filt(v, type, freq, q = 0.7, f1, start, dur) {
  const f = v.ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, start ?? v.t0);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, (start ?? v.t0) + (dur ?? v.dur));
  return f;
}

/** 打击包络：attack 线性上冲，指数衰减 */
function env(v, peak, start, attack, decay) {
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return g;
}

/** 连一条链：src → ...nodes → v.input */
function chain(v, ...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  nodes[nodes.length - 1].connect(v.input);
}

/** 金属泛音组（非谐和），用于兵刃、护甲、船体 */
function metalPartials(v, base, start, decay, peak, ratios = [1, 1.47, 2.09, 2.56, 3.39]) {
  ratios.forEach((r, i) => {
    const o = osc(v, "sine", jitter(base * r, 0.02), 0, start, decay);
    chain(v, o, env(v, peak / (1 + i * 0.6), start, 0.002, decay * (1 - i * 0.12)));
  });
}

// ====================================================================
//  武器
// ====================================================================

/** 长弓放箭：弦的一声短促“嘣”+羽箭破风。齐射只保留近处代表声。 */
export function sfxBowRelease(pos) {
  const v = voice({ id: "bow", cat: "weapon", prio: 62, maxInst: 2, cd: 0.09, maxDist: 55, gain: 0.8, dur: 0.4 }, pos);
  if (!v) return;
  const { t0 } = v;
  const f = jitter(165, 0.08);
  chain(v, osc(v, "triangle", f * 1.6, f, t0, 0.14), env(v, 0.5, t0, 0.002, 0.14));
  chain(v, osc(v, "sine", f * 3.1, f * 2.2, t0, 0.08), env(v, 0.18, t0, 0.001, 0.08));
  chain(v, noise(v, "white", t0, 0.05), filt(v, "highpass", 2400), env(v, 0.35, t0, 0.001, 0.04));
  chain(v, noise(v, "white", t0 + 0.02, 0.3), filt(v, "bandpass", 2600, 1.4, 900, t0 + 0.02, 0.3), env(v, 0.22, t0 + 0.02, 0.03, 0.27));
}

/** 长矛/标枪出手：木杆破风的低沉“呼”，不做金属长鸣。 */
export function sfxSpearThrow(pos) {
  const v = voice({ id: "spear", cat: "weapon", prio: 60, maxInst: 2, cd: 0.14, maxDist: 55, gain: 0.85, dur: 0.5 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, noise(v, "white", t0, 0.45), filt(v, "bandpass", 380, 1.8, 1300, t0, 0.18), env(v, 0.55, t0, 0.06, 0.38));
  chain(v, osc(v, "triangle", 120, 70, t0, 0.09), env(v, 0.25, t0, 0.003, 0.08));
}

/** 近战兵刃交击：短剑/矛与盾、护甲相碰（金属泛音 + 冲击噪声）。 */
export function sfxSwordClash(pos) {
  const v = voice({ id: "clash", cat: "impact", prio: 72, maxInst: 2, cd: 0.11, maxDist: 45, gain: 0.7, dur: 0.45 }, pos);
  if (!v) return;
  const { t0 } = v;
  metalPartials(v, jitter(820, 0.12), t0, 0.32, 0.28);
  chain(v, noise(v, "white", t0, 0.06), filt(v, "bandpass", 3200, 1.2), env(v, 0.6, t0, 0.001, 0.05));
  chain(v, osc(v, "sine", 180, 120, t0, 0.07), env(v, 0.3, t0, 0.002, 0.07));
}

/** 重甲兵激光刀：带电的“嗡—唰”，一刀一声。 */
export function sfxLaserSwing(pos) {
  const v = voice({ id: "laser", cat: "weapon", prio: 68, maxInst: 2, cd: 0.12, maxDist: 50, gain: 0.65, dur: 0.4 }, pos);
  if (!v) return;
  const { t0 } = v;
  const base = jitter(95, 0.06);
  const saw = osc(v, "sawtooth", base, base * 1.9, t0, 0.3, "lin");
  chain(v, saw, filt(v, "bandpass", 500, 3, 2400, t0, 0.22), env(v, 0.5, t0, 0.03, 0.28));
  chain(v, osc(v, "sine", base * 2, base * 2.4, t0, 0.3), env(v, 0.25, t0, 0.02, 0.3));
  chain(v, noise(v, "white", t0 + 0.05, 0.2), filt(v, "highpass", 3000), env(v, 0.2, t0 + 0.05, 0.03, 0.16));
}

/** 闪电枪充能：细长上扬的电啸，只给最近的一支。 */
export function sfxBoltCharge(pos) {
  const v = voice({ id: "boltCharge", cat: "weapon", prio: 40, maxInst: 1, cd: 0.8, maxDist: 40, gain: 0.35, dur: 1.6 }, pos);
  if (!v) return;
  const { t0 } = v;
  const o = osc(v, "sine", 420, 1900, t0, 1.5);
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 1.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.55);
  const trem = osc(v, "sine", 18, 34, t0, 1.5);
  const tg = v.ctx.createGain();
  tg.gain.value = 0.08;
  trem.connect(tg);
  tg.connect(g.gain);
  chain(v, o, g);
}

/** 闪电枪放电：短电击“滋啪”+下扫啸音，不带爆炸长尾。 */
export function sfxBoltFire(pos) {
  const v = voice({ id: "boltFire", cat: "weapon", prio: 74, maxInst: 2, cd: 0.1, maxDist: 90, gain: 0.7, dur: 0.45 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "square", 2600, 240, t0, 0.22), filt(v, "lowpass", 5000), env(v, 0.22, t0, 0.002, 0.22));
  chain(v, osc(v, "sawtooth", 140, 60, t0, 0.18), env(v, 0.3, t0, 0.003, 0.18));
  // 噼啪：几次极短噪声爆点
  for (let i = 0; i < 5; i++) {
    const s = t0 + rnd() * 0.16;
    chain(v, noise(v, "white", s, 0.02), filt(v, "highpass", 1800 + rnd() * 3000), env(v, 0.35 * (1 - i * 0.12), s, 0.001, 0.015));
  }
}

/** 光圈弹命中：电流炸开 + 闷击。miss=true 时只留一丝散电。 */
export function sfxBoltHit(pos, miss = false) {
  const v = voice({ id: "boltHit", cat: "impact", prio: miss ? 35 : 76, maxInst: 2, cd: 0.1, maxDist: 70, gain: miss ? 0.35 : 0.75, dur: 0.5 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, noise(v, "white", t0, 0.3), filt(v, "bandpass", 3500, 0.9, 900, t0, 0.3), env(v, 0.4, t0, 0.001, 0.28));
  if (!miss) chain(v, osc(v, "sine", 150, 45, t0, 0.25), env(v, 0.55, t0, 0.002, 0.25));
  for (let i = 0; i < 4; i++) {
    const s = t0 + 0.02 + rnd() * 0.2;
    chain(v, noise(v, "white", s, 0.015), filt(v, "highpass", 2500), env(v, 0.25, s, 0.001, 0.012));
  }
}

/** 侦察机机炮：发射一声清楚短促的重音。同时只一个强发射声。 */
export function sfxAircraftCannon(pos) {
  const v = voice({ id: "cannon", cat: "weapon", prio: 78, maxInst: 1, cd: 0.12, maxDist: 150, ref: 12, gain: 0.8, dur: 0.6 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 120, 38, t0, 0.3), env(v, 0.8, t0, 0.002, 0.3));
  chain(v, noise(v, "white", t0, 0.25), filt(v, "lowpass", 3200, 0.7, 500, t0, 0.25), env(v, 0.6, t0, 0.001, 0.22));
  chain(v, noise(v, "brown", t0 + 0.03, 0.5), filt(v, "lowpass", 400), env(v, 0.5, t0 + 0.03, 0.02, 0.45));
}

/** 小型空爆（机炮命中）：短促闷爆，不做长尾。 */
export function sfxSmallExplosion(pos) {
  const v = voice({ id: "blast", cat: "impact", prio: 70, maxInst: 2, cd: 0.1, maxDist: 160, ref: 14, gain: 0.7, dur: 0.9 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 90, 32, t0, 0.5), env(v, 0.8, t0, 0.003, 0.5));
  chain(v, noise(v, "brown", t0, 0.8), filt(v, "lowpass", 1400, 0.7, 180, t0, 0.8), env(v, 0.9, t0, 0.005, 0.75));
  chain(v, noise(v, "white", t0, 0.12), filt(v, "highpass", 1500), env(v, 0.3, t0, 0.001, 0.1));
}

/** 气泡艇麻醉炮：圆润的“啵—噗”，上扬气泡 + 气压噗声。 */
export function sfxBubbleCannon(pos) {
  const v = voice({ id: "bubbleGun", cat: "weapon", prio: 80, maxInst: 2, cd: 0.08, maxDist: 60, gain: 0.8, dur: 0.45 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 260, 880, t0, 0.12), env(v, 0.55, t0, 0.004, 0.14));
  chain(v, noise(v, "white", t0, 0.2), filt(v, "lowpass", 1600, 0.8, 400, t0, 0.2), env(v, 0.45, t0, 0.003, 0.18));
  chain(v, osc(v, "sine", 90, 55, t0, 0.15), env(v, 0.4, t0, 0.002, 0.15));
  for (let i = 0; i < 3; i++) {
    const s = t0 + 0.08 + i * 0.05 + rnd() * 0.03;
    const f = 900 + rnd() * 900;
    chain(v, osc(v, "sine", f, f * 1.6, s, 0.04), env(v, 0.12, s, 0.002, 0.04));
  }
}

/** GatePod 麻醉弹：轻气动“噗嗤”。 */
export function sfxTranqShot(pos) {
  const v = voice({ id: "tranqShot", cat: "weapon", prio: 55, maxInst: 1, cd: 0.25, maxDist: 70, gain: 0.55, dur: 0.3 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, noise(v, "white", t0, 0.14), filt(v, "bandpass", 2400, 1.2, 1000, t0, 0.14), env(v, 0.4, t0, 0.002, 0.13));
  chain(v, osc(v, "sine", 620, 360, t0, 0.08), env(v, 0.25, t0, 0.002, 0.08));
}

/** 麻醉弹/气泡命中：水泡破裂的“啪嗒”。 */
export function sfxBubblePop(pos) {
  const v = voice({ id: "pop", cat: "impact", prio: 58, maxInst: 2, cd: 0.08, maxDist: 60, gain: 0.6, dur: 0.3 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 1400, 380, t0, 0.05), env(v, 0.45, t0, 0.001, 0.05));
  chain(v, noise(v, "white", t0 + 0.01, 0.18), filt(v, "lowpass", 2200, 0.8, 500, t0 + 0.01, 0.18), env(v, 0.3, t0 + 0.01, 0.004, 0.16));
}

// ====================================================================
//  命中（按材质）
// ====================================================================

/**
 * 按材质播放命中声。
 * @param {"shield"|"flesh"|"armor"|"hull"|"ground"|"stone"} kind
 */
export function sfxImpact(kind, pos) {
  const P = {
    shield: { prio: 80, gain: 0.75, maxDist: 50 },
    flesh: { prio: 70, gain: 0.7, maxDist: 42 },
    armor: { prio: 78, gain: 0.6, maxDist: 55 },
    hull: { prio: 66, gain: 0.6, maxDist: 70 },
    stone: { prio: 45, gain: 0.5, maxDist: 40 },
    ground: { prio: 25, gain: 0.35, maxDist: 30 },
  }[kind] || { prio: 40, gain: 0.5, maxDist: 40 };
  const v = voice({ id: "hit-" + kind, cat: "impact", maxInst: kind === "shield" ? 3 : 2, cd: 0.07, dur: 0.45, ...P }, pos);
  if (!v) return;
  const { t0 } = v;
  switch (kind) {
    case "shield": // 木盾“咚”+铁箍一点点颤
      chain(v, osc(v, "sine", jitter(210, 0.08), 110, t0, 0.13), env(v, 0.7, t0, 0.002, 0.13));
      chain(v, noise(v, "white", t0, 0.07), filt(v, "bandpass", 900, 1.1), env(v, 0.6, t0, 0.001, 0.06));
      metalPartials(v, 1900, t0, 0.12, 0.05);
      break;
    case "flesh": // 箭扎入：闷“噗”
      chain(v, noise(v, "white", t0, 0.1), filt(v, "lowpass", 900), env(v, 0.6, t0, 0.002, 0.08));
      chain(v, osc(v, "sine", 110, 60, t0, 0.1), env(v, 0.5, t0, 0.002, 0.1));
      break;
    case "armor": // 重甲偏转：钝金属“铛”+火星
      metalPartials(v, jitter(1150, 0.1), t0, 0.22, 0.2, [1, 1.53, 2.31, 3.07]);
      chain(v, noise(v, "white", t0, 0.04), filt(v, "highpass", 3500), env(v, 0.45, t0, 0.001, 0.035));
      chain(v, osc(v, "sine", 240, 160, t0, 0.06), env(v, 0.25, t0, 0.002, 0.06));
      break;
    case "hull": // 扎在机身：空腔金属“嗵”
      metalPartials(v, jitter(340, 0.08), t0, 0.35, 0.16, [1, 1.9, 2.7, 4.1]);
      chain(v, noise(v, "white", t0, 0.05), filt(v, "bandpass", 1800, 1.2), env(v, 0.35, t0, 0.001, 0.04));
      break;
    case "stone": // 城墙石面：干脆“嗒”
      chain(v, noise(v, "white", t0, 0.05), filt(v, "bandpass", 2600, 1.5), env(v, 0.5, t0, 0.001, 0.04));
      chain(v, osc(v, "triangle", 520, 300, t0, 0.04), env(v, 0.2, t0, 0.001, 0.04));
      break;
    default: // ground：落进泥土
      chain(v, noise(v, "brown", t0, 0.12), filt(v, "lowpass", 600), env(v, 0.7, t0, 0.003, 0.1));
  }
}

/** 木盾被激光刀切开：断裂噼啪 + 闷响。 */
export function sfxShieldBreak(pos) {
  const v = voice({ id: "shieldBreak", cat: "impact", prio: 82, maxInst: 1, cd: 0.2, maxDist: 55, gain: 0.8, dur: 0.6 }, pos);
  if (!v) return;
  const { t0 } = v;
  for (let i = 0; i < 6; i++) {
    const s = t0 + i * 0.025 + rnd() * 0.02;
    chain(v, noise(v, "white", s, 0.04), filt(v, "bandpass", 1200 + rnd() * 1600, 2), env(v, 0.55 - i * 0.06, s, 0.001, 0.035));
  }
  chain(v, osc(v, "sine", 160, 80, t0, 0.18), env(v, 0.5, t0, 0.002, 0.18));
}

/** 士兵倒地：身体落地闷响 + 甲片碎响。无人声。 */
export function sfxBodyFall(pos) {
  const v = voice({ id: "fall", cat: "impact", prio: 50, maxInst: 2, cd: 0.15, maxDist: 38, gain: 0.6, dur: 0.6 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, noise(v, "brown", t0, 0.25), filt(v, "lowpass", 500), env(v, 0.8, t0, 0.005, 0.22));
  chain(v, osc(v, "sine", 85, 50, t0, 0.15), env(v, 0.4, t0, 0.003, 0.15));
  for (let i = 0; i < 3; i++) {
    const s = t0 + 0.04 + i * 0.05 + rnd() * 0.03;
    metalPartials(v, 2200 + rnd() * 900, s, 0.05, 0.03, [1, 1.6]);
  }
}

/** 登陆艇/运兵艇撞上岸滩：船体刮擦 + 木构闷响。 */
export function sfxHullLanding(pos) {
  const v = voice({ id: "landing", cat: "event", prio: 55, maxInst: 1, cd: 0.8, maxDist: 110, ref: 14, gain: 0.7, dur: 1.2 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 70, 42, t0, 0.35), env(v, 0.6, t0, 0.01, 0.35));
  chain(v, noise(v, "brown", t0, 1.0), filt(v, "lowpass", 900, 0.7, 250, t0, 1.0), env(v, 0.6, t0, 0.03, 0.95));
  chain(v, noise(v, "white", t0 + 0.05, 0.6), filt(v, "bandpass", 700, 2), env(v, 0.2, t0 + 0.05, 0.08, 0.5));
}

/** 撞击掀翻（气垫艇离场撞人）：重物猛撞。 */
export function sfxHeavyRam(pos) {
  const v = voice({ id: "ram", cat: "impact", prio: 75, maxInst: 1, cd: 0.25, maxDist: 80, ref: 10, gain: 0.8, dur: 0.6 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 110, 40, t0, 0.3), env(v, 0.8, t0, 0.002, 0.3));
  chain(v, noise(v, "brown", t0, 0.4), filt(v, "lowpass", 1100), env(v, 0.7, t0, 0.003, 0.35));
  metalPartials(v, 420, t0, 0.3, 0.1, [1, 1.7, 2.9]);
}

// ====================================================================
//  能力 / 载具事件
// ====================================================================

/** 索降放绳：尼龙绳高速滑过的“嘶—”。 */
export function sfxRopeZip(pos) {
  const v = voice({ id: "zip", cat: "event", prio: 40, maxInst: 1, cd: 0.6, maxDist: 60, gain: 0.45, dur: 0.9 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, noise(v, "white", t0, 0.8), filt(v, "bandpass", 1600, 3, 4200, t0, 0.8), env(v, 0.4, t0, 0.05, 0.75));
}

/** 运兵艇尾门：液压嘶声 + 落地“哐”。 */
export function sfxRampOpen(pos) {
  const v = voice({ id: "ramp", cat: "event", prio: 50, maxInst: 1, cd: 1.0, maxDist: 80, ref: 10, gain: 0.6, dur: 1.4 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, noise(v, "white", t0, 0.9), filt(v, "highpass", 2500), env(v, 0.25, t0, 0.08, 0.8));
  chain(v, osc(v, "sawtooth", 70, 55, t0, 0.9, "lin"), filt(v, "lowpass", 300), env(v, 0.2, t0, 0.1, 0.8));
  const s = t0 + 0.95;
  chain(v, osc(v, "sine", 90, 45, s, 0.25), env(v, 0.7, s, 0.002, 0.25));
  metalPartials(v, 280, s, 0.35, 0.12, [1, 2.1, 3.3]);
}

/** 莫比斯扫描光束锁定：1.4s 上扬电啸（烧灰前的预警）。 */
export function sfxScanLock(pos) {
  const v = voice({ id: "scanLock", cat: "ability", prio: 64, maxInst: 1, cd: 1.0, maxDist: 90, ref: 10, gain: 0.45, dur: 1.5 }, pos);
  if (!v) return;
  const { t0 } = v;
  const o = osc(v, "triangle", 300, 1500, t0, 1.4);
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.3, t0 + 1.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.45);
  chain(v, o, filt(v, "lowpass", 2600), g);
  const lfo = osc(v, "sine", 7, 22, t0, 1.4);
  const lg = v.ctx.createGain();
  lg.gain.value = 40;
  lfo.connect(lg);
  lg.connect(o.frequency);
}

/** 扫描烧灰：灼烧“呼—”+灰烬噼啪。 */
export function sfxScanBurn(pos) {
  const v = voice({ id: "scanBurn", cat: "ability", prio: 70, maxInst: 1, cd: 0.5, maxDist: 90, ref: 10, gain: 0.7, dur: 1.0 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, noise(v, "white", t0, 0.8), filt(v, "bandpass", 700, 0.8, 2400, t0, 0.3), env(v, 0.55, t0, 0.02, 0.75));
  chain(v, osc(v, "sine", 180, 60, t0, 0.3), env(v, 0.4, t0, 0.004, 0.3));
  for (let i = 0; i < 6; i++) {
    const s = t0 + 0.15 + rnd() * 0.6;
    chain(v, noise(v, "white", s, 0.01), filt(v, "highpass", 3000), env(v, 0.2, s, 0.001, 0.01));
  }
}

/** 机队吸取启动（每轮一次）：下沉的气流啸 + 低频共鸣。 */
export function sfxSuctionOnset(pos) {
  const v = voice({ id: "suckOn", cat: "ability", prio: 85, maxInst: 1, cd: 3, maxDist: 200, ref: 18, gain: 0.8, dur: 1.8 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, noise(v, "white", t0, 1.6), filt(v, "bandpass", 2400, 2.5, 300, t0, 1.5), env(v, 0.5, t0, 0.2, 1.4));
  chain(v, osc(v, "sine", 110, 55, t0, 1.6), env(v, 0.5, t0, 0.3, 1.3));
  chain(v, osc(v, "sine", 880, 440, t0, 1.2), env(v, 0.08, t0, 0.2, 1.0));
}

/** 机队反击脉冲：光束一次闪爆，冲击波推倒士兵。 */
export function sfxEnergyPulse(pos) {
  const v = voice({ id: "pulse", cat: "ability", prio: 84, maxInst: 1, cd: 1.0, maxDist: 160, ref: 16, gain: 0.85, dur: 1.4 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 75, 28, t0, 0.8), env(v, 0.9, t0, 0.01, 0.8));
  chain(v, noise(v, "brown", t0, 1.2), filt(v, "lowpass", 900, 0.8, 120, t0, 1.2), env(v, 0.7, t0, 0.02, 1.1));
  chain(v, osc(v, "sine", 1800, 600, t0, 0.5), env(v, 0.12, t0, 0.005, 0.5));
  chain(v, osc(v, "sine", 2700, 900, t0, 0.5), env(v, 0.07, t0, 0.005, 0.5));
}

// ------------------------------------------------------- 鲲 / 鲸吞 --

/** 鲲张口 / 被拽住挣扎时的低吟（鲸歌式滑音）。 */
export function sfxWhaleGroan(pos, intensity = 1) {
  const v = voice({ id: "groan", cat: "ability", prio: 70, maxInst: 1, cd: 4, maxDist: 220, ref: 24, gain: 0.75 * intensity, dur: 2.4 }, pos);
  if (!v) return;
  const { t0 } = v;
  const f = jitter(62, 0.08);
  const o = v.ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(f, t0);
  o.frequency.linearRampToValueAtTime(f * 1.45, t0 + 0.8);
  o.frequency.linearRampToValueAtTime(f * 0.9, t0 + 2.1);
  o.start(t0);
  o.stop(t0 + 2.3);
  const vib = osc(v, "sine", 4.5, 3, t0, 2.2);
  const vg = v.ctx.createGain();
  vg.gain.value = f * 0.03;
  vib.connect(vg);
  vg.connect(o.frequency);
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.5, t0 + 0.5);
  g.gain.linearRampToValueAtTime(0.35, t0 + 1.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.25);
  // 两个共振峰 → 有“喉音”
  const f1 = filt(v, "bandpass", 320, 4);
  const f2 = filt(v, "bandpass", 780, 6);
  o.connect(f1);
  o.connect(f2);
  f1.connect(g);
  f2.connect(g);
  g.connect(v.input);
}

/** 鲸吞吸气：明确起止的有机气流，随吸入逐渐上扬。 */
export function sfxWhaleInhale(pos, seconds = 1.2) {
  const d = Math.max(0.5, Math.min(3, seconds));
  const v = voice({ id: "inhale", cat: "ability", prio: 90, maxInst: 1, cd: 1, maxDist: 220, ref: 24, gain: 0.9, dur: d + 0.3 }, pos);
  if (!v) return;
  const { t0 } = v;
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.7, t0 + d * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  chain(v, noise(v, "white", t0, d), filt(v, "bandpass", 220, 1.2, 1500, t0, d), g);
  chain(v, noise(v, "brown", t0, d), filt(v, "lowpass", 300), env(v, 0.6, t0, d * 0.6, d * 0.4));
}

/** 吞下：一声闷而圆的“咕咚”。 */
export function sfxWhaleGulp(pos) {
  const v = voice({ id: "gulp", cat: "ability", prio: 88, maxInst: 1, cd: 1, maxDist: 220, ref: 24, gain: 0.9, dur: 0.9 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 160, 48, t0, 0.35), env(v, 0.9, t0, 0.01, 0.35));
  chain(v, osc(v, "sine", 90, 38, t0 + 0.22, 0.4), env(v, 0.7, t0 + 0.22, 0.01, 0.4));
  chain(v, noise(v, "brown", t0, 0.4), filt(v, "lowpass", 400), env(v, 0.4, t0, 0.02, 0.35));
}

/** 从尾根排出：低沉、带颤的“噗噜噜”。 */
export function sfxWhaleExpel(pos) {
  const v = voice({ id: "expel", cat: "ability", prio: 72, maxInst: 1, cd: 1, maxDist: 200, ref: 20, gain: 0.8, dur: 1.0 }, pos);
  if (!v) return;
  const { t0 } = v;
  const o = osc(v, "sawtooth", 72, 48, t0, 0.8);
  const g = env(v, 0.6, t0, 0.02, 0.75);
  const flutter = osc(v, "square", 24, 16, t0, 0.8);
  const fg = v.ctx.createGain();
  fg.gain.value = 0.35;
  flutter.connect(fg);
  fg.connect(g.gain);
  chain(v, o, filt(v, "lowpass", 420, 2), g);
  chain(v, noise(v, "brown", t0, 0.7), filt(v, "lowpass", 600), env(v, 0.5, t0, 0.02, 0.65));
}

// ====================================================================
//  循环：引擎（最多 2 路）/ 舰队吸取（1 路）/ 天气（1 路）
// ====================================================================

const engineHints = [];
const engineSlots = [];
const LOOP_TAU = 0.25;

/**
 * 每帧登记一个可能发声的引擎。管理器挑选最响的两个播放。
 * @param {string} key 稳定编号（同一艘船每帧相同）
 * @param {"light"|"heavy"|"jet"} kind light=悬浮泡机/灯艇，heavy=运兵气垫艇/航空艇，jet=侦察机
 * @param {{x,y,z}} pos
 * @param {number} [throttle] 0..1
 * @param {boolean} [own] 玩家所乘：不衰减、居中
 */
export function hintEngine(key, kind, pos, throttle = 0.5, own = false) {
  if (!pos || engineHints.length > 32) return;
  engineHints.push({ key, kind, x: pos.x, y: pos.y, z: pos.z, throttle, own });
}

function makeEngineSlot(ctx) {
  const out = ctx.createGain();
  out.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) {
    pan.connect(out);
  }
  out.connect(bus.cats.vehicle);
  const sum = ctx.createGain();
  sum.connect(pan || out);
  // heavy 层：锯齿低频 + 棕噪隆隆
  const hSaw = ctx.createOscillator();
  hSaw.type = "sawtooth";
  hSaw.frequency.value = 48;
  const hLp = ctx.createBiquadFilter();
  hLp.type = "lowpass";
  hLp.frequency.value = 240;
  const hG = ctx.createGain();
  hG.gain.value = 0;
  hSaw.connect(hLp).connect(hG).connect(sum);
  const hN = ctx.createBufferSource();
  hN.buffer = brown;
  hN.loop = true;
  const hNLp = ctx.createBiquadFilter();
  hNLp.type = "lowpass";
  hNLp.frequency.value = 220;
  const hNG = ctx.createGain();
  hNG.gain.value = 0;
  hN.connect(hNLp).connect(hNG).connect(sum);
  // light 层：两路正弦悬浮音 + 带通风嘶
  const l1 = ctx.createOscillator();
  l1.type = "sine";
  l1.frequency.value = 150;
  const l2 = ctx.createOscillator();
  l2.type = "triangle";
  l2.frequency.value = 301;
  const lG = ctx.createGain();
  lG.gain.value = 0;
  l1.connect(lG);
  const l2g = ctx.createGain();
  l2g.gain.value = 0.35;
  l2.connect(l2g).connect(lG);
  lG.connect(sum);
  const wob = ctx.createOscillator();
  wob.frequency.value = 3.1;
  const wobG = ctx.createGain();
  wobG.gain.value = 3;
  wob.connect(wobG);
  wobG.connect(l1.frequency);
  wobG.connect(l2.frequency);
  const lN = ctx.createBufferSource();
  lN.buffer = white;
  lN.loop = true;
  const lBp = ctx.createBiquadFilter();
  lBp.type = "bandpass";
  lBp.frequency.value = 900;
  lBp.Q.value = 1.6;
  const lNG = ctx.createGain();
  lNG.gain.value = 0;
  lN.connect(lBp).connect(lNG).connect(sum);
  const t = ctx.currentTime;
  for (const s of [hSaw, hN, l1, l2, wob, lN]) s.start(t, s.buffer ? rnd() * 1.5 : 0);
  return { key: null, out, pan, hSaw, hLp, hG, hNG, l1, l2, lG, lBp, lNG, level: 0 };
}

function updateEngines(ctx, muted) {
  // 选最响的两个
  const scored = [];
  for (const h of engineHints) {
    const sp = h.own ? { gain: 1, pan: 0 } : spatial(h, h.kind === "heavy" ? 120 : 90, 12);
    if (!sp || sp.gain < 0.03) continue;
    scored.push({ h, sp, score: sp.gain * (h.own ? 4 : 1) });
  }
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored.slice(0, ENGINE_SLOTS);
  engineHints.length = 0;
  if (!ctx) return;
  while (engineSlots.length < ENGINE_SLOTS && chosen.length > engineSlots.length) engineSlots.push(makeEngineSlot(ctx));
  const t = ctx.currentTime;
  // 保持已分配的 key 在原槽位，避免换槽爆音
  const free = [];
  const assign = new Map();
  for (const slot of engineSlots) {
    const c = chosen.find((c) => c.h.key === slot.key);
    if (c) assign.set(slot, c);
    else free.push(slot);
  }
  for (const c of chosen) {
    if ([...assign.values()].includes(c)) continue;
    const slot = free.shift();
    if (slot) assign.set(slot, c);
  }
  for (const slot of engineSlots) {
    const c = muted ? null : assign.get(slot);
    if (!c) {
      slot.out.gain.setTargetAtTime(0, t, LOOP_TAU);
      if (slot.level < 0.01) slot.key = null;
      slot.level *= 0.9;
      continue;
    }
    const { h, sp } = c;
    const switched = slot.key !== h.key;
    slot.key = h.key;
    const th = Math.max(0, Math.min(1, h.throttle));
    const heavy = h.kind === "heavy";
    const jet = h.kind === "jet";
    slot.hSaw.frequency.setTargetAtTime(44 + th * 22, t, 0.3);
    slot.hLp.frequency.setTargetAtTime(180 + th * 160, t, 0.3);
    // User requested removal of the aircraft low-frequency drone.
    slot.hG.gain.setTargetAtTime(0, t, LOOP_TAU);
    slot.hNG.gain.setTargetAtTime(0, t, LOOP_TAU);
    const lf = jet ? 210 + th * 120 : 140 + th * 50;
    slot.l1.frequency.setTargetAtTime(lf, t, 0.3);
    slot.l2.frequency.setTargetAtTime(lf * 2.01, t, 0.3);
    slot.lG.gain.setTargetAtTime(0, t, LOOP_TAU);
    slot.lBp.frequency.setTargetAtTime(jet ? 1800 + th * 1500 : 800 + th * 500, t, 0.3);
    slot.lNG.gain.setTargetAtTime(jet ? 0.22 : heavy ? 0.08 : 0.12, t, LOOP_TAU);
    if (slot.pan) slot.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, sp.pan)), t, 0.08);
    const level = sp.gain * (h.own ? 0.55 : 0.8);
    slot.out.gain.setTargetAtTime(level, t, switched ? 0.4 : 0.12);
    slot.level = level;
  }
}

// -------------------------------------------------------- 舰队吸取 --
let suction = null;
let suctionWant = { level: 0, pos: null };
let suctionWasOn = false;

/**
 * 每帧告知舰队吸取强度（0 = 不吸）。仅一路循环，不按每架飞机叠加。
 * 从 0 升起时自动播一次启动提示。
 */
export function setFleetSuction(level, pos) {
  suctionWant.level = Math.max(0, Math.min(1, Number(level) || 0));
  suctionWant.pos = pos ? { x: pos.x, y: pos.y, z: pos.z } : null;
}

function makeSuction(ctx) {
  const out = ctx.createGain();
  out.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) pan.connect(out);
  out.connect(bus.cats.ability);
  const sum = ctx.createGain();
  sum.connect(pan || out);
  const n = ctx.createBufferSource();
  n.buffer = brown;
  n.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 500;
  bp.Q.value = 1.4;
  const nG = ctx.createGain();
  nG.gain.value = 0.9;
  n.connect(bp).connect(nG).connect(sum);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.35;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 260;
  lfo.connect(lfoG).connect(bp.frequency);
  // The persistent 55/82.6 Hz suction hum was removed at user request.
  const whistle = ctx.createOscillator();
  whistle.frequency.value = 1320;
  const wG = ctx.createGain();
  wG.gain.value = 0.012;
  whistle.connect(wG).connect(sum);
  const t = ctx.currentTime;
  for (const s of [n, lfo, whistle]) s.start(t);
  return { out, pan, bp, whistle };
}

function updateSuction(ctx, muted) {
  const { level, pos } = suctionWant;
  const on = level > 0.02 && !muted;
  if (on && !suctionWasOn) sfxSuctionOnset(pos);
  suctionWasOn = on;
  if (!ctx) return;
  if (!suction && !on) return;
  if (!suction) suction = makeSuction(ctx);
  const t = ctx.currentTime;
  const sp = on ? spatial(pos, 220, 20) : null;
  const g = sp ? sp.gain * (0.25 + 0.45 * level) : 0;
  suction.out.gain.setTargetAtTime(g, t, on ? 0.5 : 0.35);
  if (sp && suction.pan) suction.pan.pan.setTargetAtTime(sp.pan, t, 0.1);
  suction.whistle.frequency.setTargetAtTime(900 + 700 * level, t, 0.4);
}

// ------------------------------------------------------------ 天气 --
let weatherBed = null;
const weatherWant = { rain: 0, snow: 0, wind: 0.8 };
let dropTimer = 0;
let gustPhase = 0;

/**
 * 每帧由天气系统调用。
 * @param {{rain:number, snow:number, wind:number}} s rain/snow 0..1，wind = 风速
 */
export function setWeatherAmbience(s) {
  weatherWant.rain = Math.max(0, Math.min(1, Number(s?.rain) || 0));
  weatherWant.snow = Math.max(0, Math.min(1, Number(s?.snow) || 0));
  weatherWant.wind = Math.max(0, Number(s?.wind) || 0);
}

function makeWeather(ctx) {
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(bus.cats.weather);
  // 雨幕：白噪 → 高通 → 低通
  const r = ctx.createBufferSource();
  r.buffer = white;
  r.loop = true;
  const rHp = ctx.createBiquadFilter();
  rHp.type = "highpass";
  rHp.frequency.value = 450;
  const rLp = ctx.createBiquadFilter();
  rLp.type = "lowpass";
  rLp.frequency.value = 5200;
  const rG = ctx.createGain();
  rG.gain.value = 0;
  r.connect(rHp).connect(rLp).connect(rG).connect(out);
  // 雨的低层（远处雨打地面的沙沙闷声）
  const r2 = ctx.createBufferSource();
  r2.buffer = brown;
  r2.loop = true;
  const r2Lp = ctx.createBiquadFilter();
  r2Lp.type = "lowpass";
  r2Lp.frequency.value = 700;
  const r2G = ctx.createGain();
  r2G.gain.value = 0;
  r2.connect(r2Lp).connect(r2G).connect(out);
  // 风：棕噪 → 带通（中心频率随阵风游走）
  const w = ctx.createBufferSource();
  w.buffer = brown;
  w.loop = true;
  const wBp = ctx.createBiquadFilter();
  wBp.type = "bandpass";
  wBp.frequency.value = 420;
  wBp.Q.value = 0.9;
  const wG = ctx.createGain();
  wG.gain.value = 0;
  w.connect(wBp).connect(wG).connect(out);
  const t = ctx.currentTime;
  r.start(t, rnd());
  r2.start(t, rnd());
  w.start(t, rnd());
  return { out, rG, r2G, rLp, wBp, wG };
}

function rainDrop(ctx, level) {
  // 近处雨滴打在叶面/石面的零星“嗒”
  const t = ctx.currentTime + rnd() * 0.05;
  const s = ctx.createBufferSource();
  s.buffer = white;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2500 + rnd() * 3500;
  bp.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.1 * level * (0.4 + rnd() * 0.6), t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  let node = g;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = rnd() * 1.6 - 0.8;
    g.connect(p);
    node = p;
  }
  s.connect(bp).connect(g);
  node.connect(bus.cats.weather);
  s.start(t, rnd() * 1.5);
  s.stop(t + 0.05);
  s.onended = () => {
    try {
      node.disconnect();
    } catch {
      /* ignore */
    }
  };
}

function updateWeather(ctx, dt, muted) {
  if (!ctx) return;
  const { rain, snow, wind } = weatherWant;
  const active = !muted && (rain > 0 || snow > 0 || wind > 0.05);
  if (!weatherBed && !active) return;
  if (!weatherBed) weatherBed = makeWeather(ctx);
  const t = ctx.currentTime;
  const m = muted ? 0 : 1;
  weatherBed.rG.gain.setTargetAtTime(0.075 * rain * m, t, 1.2);
  weatherBed.r2G.gain.setTargetAtTime(0.22 * rain * m, t, 1.2);
  // 阵风：缓慢游走的包络
  gustPhase += dt * (0.12 + wind * 0.05);
  const gust = 0.55 + 0.3 * Math.sin(gustPhase * 1.7) + 0.15 * Math.sin(gustPhase * 4.3 + 1.1);
  const windBase = Math.min(1, 0.25 + wind * 0.35);
  const windLvl = (0.035 + 0.05 * snow + 0.02 * rain) * windBase * gust * m;
  weatherBed.wG.gain.setTargetAtTime(windLvl, t, 0.6);
  const snowDamp = snow > 0 ? 0.7 : 1;
  weatherBed.wBp.frequency.setTargetAtTime((280 + 380 * gust + wind * 60) * snowDamp, t, 0.6);
  if (rain > 0.05 && !muted) {
    dropTimer -= dt;
    while (dropTimer <= 0) {
      rainDrop(ctx, rain);
      dropTimer += 0.06 + rnd() * 0.22;
    }
  }
}

// ----------------------------------------------------------- 每帧 --
/**
 * 每帧调用一次（main.js 渲染循环），推进循环音与限流状态。
 * @param {number} dt
 */
export function updateWorldSfx(dt) {
  const muted = isMuted();
  const ctx = getCtx();
  const d = Math.max(0, Math.min(0.1, Number(dt) || 0));
  if(bus){reap(bus.ctx.currentTime);for(const v of voices){const s=spatial(v.position,v.maxDist,v.ref);v.out.gain.setTargetAtTime(muted?0:v.baseGain*(s?.gain||0),bus.ctx.currentTime,.035);if(v.panNode&&s)v.panNode.pan.setTargetAtTime(s.pan,bus.ctx.currentTime,.035);}}
  updateEngines(ctx, muted);
  updateSuction(ctx, muted);
  updateWeather(ctx, d, muted);
  if (!ctx) suctionWant.level = 0;
}

/** 调试 / 测试用快照：当前声部占用与循环状态。 */
export function getWorldSfxSnapshot() {
  const now = bus?.ctx?.currentTime ?? 0;
  if (bus) reap(now);
  return {
    ready: !!bus,listener:{...listener},robotSamples:bus?robotSampleState(bus.ctx):null,
    oneShots: voices.map((v) => ({ id: v.id, cat: v.cat, gain:v.out.gain.value, maxDistance:v.maxDist })),
    foreground: voices.filter((v) => FOREGROUND_CATS.has(v.cat)).length,
    engines: engineSlots.map((s) => ({ key: s.key, level: +s.level.toFixed(3) })),
    suction: suctionWasOn,
    weather: { ...weatherWant },
    caps: { FOREGROUND_CAP, ONESHOT_CAP, ENGINE_SLOTS },
  };
}

// Original robot weapon synthesis: mechanical signature, blast, propagation,
// near-pass crack, and geometry-sampled reflections. No licensed recordings.
const robotAudioStats = {shots:0, cracks:0, impacts:0, confirmed:0, reflected:0, rejected:0,sampled:0,fallback:0};
export const getRobotAudioSnapshot = () => ({...robotAudioStats});
export function sfxRobotShot(kind, from, to, {enclosure=0, reflectionDistance=12}={}) {
  if (!listener.has||!['locust','ant','beetle','sentry'].includes(kind)) return;
  const heavy=kind==='ant', rapid=kind==='beetle';
  const sp=spatial(from,heavy?140:100);if(!sp)return;
  const wet=Math.max(0,Math.min(1,enclosure));
  const delay=Math.min(.35,sp.dist/343), echo=Math.min(.20,Math.max(.025,reflectionDistance*2/343));
  const tail=heavy?2.45:rapid?.30:1.50;
  const v=voice({id:'robot-'+kind,replaceOldest:true,cat:'weapon',prio:heavy?79:74,maxInst:rapid?5:3,cd:.025,maxDist:heavy?140:100,gain:heavy?.65:rapid?.40:.55,dur:delay+tail+echo*2+.12},from);
  if(!v){robotAudioStats.rejected++;return false;}robotAudioStats.shots++;
  const t=v.t0+delay, base=jitter(heavy?84:rapid?210:135,.065);
  const sample=robotSample(v.ctx,kind,Math.floor(rnd()*1000)),rate=jitter(heavy?.72:rapid?1.03:.96,.018);
  function recorded(start,gain,offset=0,duration=null,lowpass=14000){
    const src=v.ctx.createBufferSource();src.buffer=sample;src.playbackRate.value=rate;
    const end=Math.min(sample.duration-offset,duration??sample.duration),length=end/rate;
    const gainNode=v.ctx.createGain();gainNode.gain.setValueAtTime(gain,start);gainNode.gain.setValueAtTime(gain,start+Math.max(.001,length-.08));gainNode.gain.linearRampToValueAtTime(0,start+length);
    chain(v,src,filt(v,'lowpass',lowpass),gainNode);src.start(start,offset,end);src.stop(start+length+.01);
  }
  if(sample){robotAudioStats.sampled++;recorded(t,heavy?1.12:rapid?.85:1.0,0,rapid?.25:null);
    // Distant natural field returns, separated from the direct report.
    if(wet>.05){robotAudioStats.reflected++;for(let i=1;i<=2;i++)recorded(t+echo*i,wet*.24/i,.09,rapid?.14:heavy?.65:.50,3400/i);}
    // Subtle pressure weight under the recorded report, not a pitched laser chirp.
    if(heavy){chain(v,osc(v,'sine',58,33,t,.24),env(v,.20,t,.003,.23));chain(v,noise(v,'white',t+.12,.50),filt(v,'lowpass',900),env(v,.09,t+.12,.025,.46));}
  }else{robotAudioStats.fallback++;
    chain(v,noise(v,'white',t,.09),filt(v,'bandpass',heavy?650:2300,.5),env(v,.75,t,.001,.085));
    chain(v,noise(v,'brown',t,.19),filt(v,'lowpass',350),env(v,.5,t,.001,.18));
  }
  // Supersonic crack occurs at the listener's nearest point on the segment,
  // never as a global click on every gunshot. Ant pressure shells are subsonic.
  if(!heavy&&to&&listener.has){
    const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,len2=dx*dx+dy*dy+dz*dz;
    const a=len2?((listener.x-from.x)*dx+(listener.y-from.y)*dy+(listener.z-from.z)*dz)/len2:0;
    if(a>.06&&a<.98){const near={x:from.x+dx*a,y:from.y+dy*a,z:from.z+dz*a};
      const d=Math.hypot(near.x-listener.x,near.y-listener.y,near.z-listener.z);
      if(d<5){const c=voice({id:'robot-crack',cat:'weapon',prio:90,maxInst:2,cd:.07,maxDist:6,gain:.38*(1-d/6),dur:.18+Math.sqrt(len2)*a/650},near);
        if(c){robotAudioStats.cracks++;const ct=c.t0+Math.sqrt(len2)*a/650;
          for(const off of[0,.009])chain(c,noise(c,'white',ct+off,.018),filt(c,'highpass',2800),env(c,.65,ct+off,.0008,.014));
        }
      }
    }
  }
  return true;
}
export function sfxRobotImpact(kind,pos) {
  if(!listener.has)return;
  const v=voice({id:'robot-impact',cat:'impact',prio:66,maxInst:2,cd:.07,maxDist:65,gain:.32,dur:.22},pos);if(!v)return;
  robotAudioStats.impacts++;metalPartials(v,kind==='ant'?180:1250,v.t0,.13,.13,[1,1.43,2.37]);
  chain(v,noise(v,'white',v.t0,.04),filt(v,'bandpass',kind==='ant'?600:2700),env(v,.5,v.t0,.001,.035));
}
// Only actual damage/disabled events call this, never a decorative tracer.
export function sfxRobotConfirmed(pos,disabled=false) {
  if(!listener.has)return;
  const v=voice({id:disabled?'robot-confirm-disabled':'robot-confirm-hit',cat:'impact',prio:disabled?95:78,maxInst:2,cd:disabled?.18:.10,maxDist:75,gain:disabled?.48:.24,dur:.19},pos);if(!v)return;
  robotAudioStats.confirmed++;
  for(const offset of disabled?[0,.052]:[0]){
    chain(v,noise(v,'white',v.t0+offset,.021),filt(v,'bandpass',1800,1.2),env(v,.8,v.t0+offset,.001,.019));
    chain(v,osc(v,'triangle',disabled?780:1150,disabled?380:700,v.t0+offset,.035),env(v,.15,v.t0+offset,.001,.03));
  }
}


window.addEventListener('keydown',e=>{if(e.code==='KeyM'&&bus)bus.master.gain.setTargetAtTime(isMuted()?0:MASTER_GAIN,bus.ctx.currentTime,.012);});

// ------------------------------------------------------- 航空艇烟雾弹 --
/** 投弹：挂钩脱开的“咔嗒”+下坠破风。 */
export function sfxBombRelease(pos) {
  const v = voice({ id: "bombDrop", cat: "weapon", prio: 60, maxInst: 1, cd: 0.2, maxDist: 60, gain: 0.55, dur: 0.6 }, pos);
  if (!v) return;
  const { t0 } = v;
  metalPartials(v, 1600, t0, 0.05, 0.12, [1, 1.7]);
  chain(v, noise(v, "white", t0 + 0.03, 0.5), filt(v, "bandpass", 1800, 1.6, 500, t0 + 0.03, 0.5), env(v, 0.3, t0 + 0.03, 0.15, 0.35));
}

/** 烟雾弹触地：闷声“噗嗵”后一口气喷出烟团（非爆炸）。 */
export function sfxSmokeBurst(pos) {
  const v = voice({ id: "smokeBurst", cat: "impact", prio: 62, maxInst: 2, cd: 0.15, maxDist: 110, ref: 12, gain: 0.7, dur: 1.4 }, pos);
  if (!v) return;
  const { t0 } = v;
  chain(v, osc(v, "sine", 110, 45, t0, 0.25), env(v, 0.6, t0, 0.003, 0.25));
  chain(v, noise(v, "white", t0 + 0.02, 1.2), filt(v, "lowpass", 2600, 0.7, 350, t0 + 0.02, 1.2), env(v, 0.5, t0 + 0.02, 0.06, 1.1));
}
