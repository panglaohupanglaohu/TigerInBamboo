/**
 * 第 56 批 C01：Bad North 特效 A 的 Battle 扩展（全部默认关）。
 * 打开：URL `?c01=all` 或 `?c01=squadHud,nodeNet,...`；运行时 `battle.c01.set(name, on)`。
 *
 *   squadHud     839067977781768193  旗顶血量槽（绿/黄/红按存活比缩短，受击左端闪红 0.16s，squad-hud.js bannerBar）
 *   plank        839067977781768193  长船卸人时从船头搭到岸上的木跳板（只做视觉，卸人仍是 battle 的逐个上岸）
 *   nodeNet      883447205176238083  动态节点图可视化：同队、同层、半径内且视线通的队友连线（=凹形占位线网）+ 节点小方块 +
 *                                    旗顶白菱形 + 飞行中箭矢的细白线（InfoGraph 同一套建边规则）
 *   orderPillar  837027901853810688  下令后 0.6s 立在该队旗顶的亮黄竖条 + 细引线
 *   skyBeam      837027901853810688 / 912691357440978945  旗顶 **捅破画面上缘** 的整根天光柱（第 87 轮按帧量测：
 *                                    837 0358–0364 共 7 帧 29px 宽 / 从 y=0 落到旗顶 / #F0FA90；912 0278–0288 与
 *                                    0672–0681 各 10–13 帧 16px 宽 / 落到 **单位本人头顶上方** / 淡奶油色）。与 orderPillar
 *                                    的区别：那根只有 0.9 单位高，片子里的光柱是「从天而降、上端被画面上缘裁掉」。
 *                                    第 88 轮起分两套口径：旗顶版 SKY_BEAM（onMove 触发）+ 单位版 SKY_BEAM_UNIT
 *                                    （柱底悬在单位上方 baseLift，颜色 #E6E4C5）。第 90 轮把单位版的触发改掉了：
 *                                    912 全片只有 23 帧有柱，反例 frame-0695 同一根火柱 + 同一张单位卡 + 「+6/+8」
 *                                    都在却**没有**柱 → 「挨打就起柱」被证伪，受击自动挂钩默认关（setBeamOnHit）。
 *   bloodAge     837027901853810688  地面血迹：新鲜鲜红 → **0.335s** 退成暗红（第 92 轮按帧重标，原 3s 是估的）→
 *                                    25s 后逐渐变淡（这一段片子里没有证据，属本仓扩展参数）
 *   bloodStack   984813819280191488  同一处反复流血 → 旧斑堆厚变暗（半径 0.09 内每叠一层暗 12%，最多 4 层）
 *   fireGlow     837027901853810688  烧毁小屋的橙色火光：闪烁点光源（真的照亮地形 / 单位）+ 贴地光晕
 *   groundTint   837027901853810688  整岛地面染色：打完一场，雪地由冷灰转灰玫瑰（格子顶面乘性贴面，
 *                                    不碰 worldMesh 材质）。实测只染陆地不染海、R 不动 G/B 压 6.6%/5.3%、
 *                                    进度折线见 ground-stain.js（起爆当帧 25%，10.9s 到满）
 *   column       816743289500106752  成列行军：下令时按到目标的树距离排序，后一个等前一个拉开 spacing 才走（单列长蛇，
 *                                    跨台阶自然变竖列）；到达后按 4 列 N 排方块落位（朝向 = 行军方向）
 *   routePreview 995043346778415104  #drawPath 换成 route-preview.js（落崖弧 + 圆角 + 等距点），并在小队走完前常驻、
 *                                    走过的部分逐段消掉（不再是 2.5s 淡出的一次性点串）
 *   shoreFoam    946660607008403456  沿岸白泡沫带（岛缘外一圈呼吸的白带 + 碎白点）—— 第 185 轮起**只管泡沫**，默认关（该片水面干净）
 *   shoreFlowers 946660607008403456  草地上的米白 / 浅粉小花簇（4–7 朵一簇、只长在四邻同高的台面格），默认开
 *   waterBlood   946660607008403456  落在水面的血 → 粉红血雾，6s 内铺开、随流漂、14s 淡出
 *   windTraces   926903893866541057  风矢量之外的红色风粒子轨迹：岛周一圈 + 台地上方播种，用 atmosphere.trace（共享风场 + World 体素滑移）积分画出
 *   raidBoxes    974325184525201409  维京登陆规划的 3D 盒子：每条船的泊位盒 + 整条进场走廊盒（按船着色的线框），
 *                                    下一波的候选（同一套 berthBox/approachBox/SAT/礁石判定）里被拒的画成暗红，可用的画白
 *   portraits    1010979395719319552 / 958371606350454784  每支守军一张游戏内头像卡（切角框 + 盔 / 护鼻 / 锁甲 / 兜帽 + 背景队友，
 *                                    ui/game-portrait-c01.js：同一 sampleSlots 走表器换表），卡下是该队血量条，全灭变灰
 *   smokeShape   1015142746372366336 / 837027901853810688  烧屋黑烟：大瓣 + 顶端断开的独立烟团 + 弥散薄雾
 *                                    （第 71 轮起走 life/smoke.js 的 native 实现；life/smoke-c01.js 的外挂层只留作回归对照）
 * battle.js 只有一行级挂钩（构造 / start / stop / afterDraw / onMove / 行军 steer），其余都在这里。
 */
import * as THREE from 'three';
import { bannerBar } from './squad-hud.js';
import { buildRoutePreview } from '../core/route-preview.js';
import { berthBox, approachBox, seawayBlocked, LANE_ANGLES } from './landing-plan.js';
import { obbOverlap } from '../core/obb.js';
import { drawGamePortrait, squadPortraitIdentity } from '../ui/game-portrait-c01.js';
import { stainProgress, stainHex } from './ground-stain.js';
import { charHouseVerts, restoreChar } from './house-char.js';

export const C01_FLAGS = ['squadHud', 'plank', 'nodeNet', 'orderPillar', 'skyBeam', 'bloodAge', 'bloodStack', 'fireGlow', 'column', 'routePreview', 'shoreFoam', 'shoreFlowers', 'waterBlood', 'smokeShape', 'windTraces', 'raidBoxes', 'portraits', 'groundTint', 'houseChar'];
/**
 * 第 97 轮 · **默认开**的层（其余仍全关，保持「实验层不改旧行为」）。
 * houseChar 破例的唯一理由：837027901853810688 里「屋体失守后转炭黑」是**原片默认观感**（f0082→f0083 一帧跳完、
 * 之后 13s 不扩大、中位色 [46,29,51] 冷紫黑），不是可选特效；本仓渲出 [45,30,52] 与原片差 ≤1。
 * 关法：URL `?c01=-houseChar` 或 `c01.set('houseChar', false)`。
 * **第 185 轮破例之二 `shoreFlowers`**（946660607008403456）：原文点名 "adding pretty little flowers"，原片 0150 的 10× 裁切里
 * 草地上是一片米白小花（不是个别点），属于原片默认观感的岸上陈设；而它原先和「沿岸白泡沫带」挤在同一个 `shoreFoam` 开关里
 * （该片水面全程干净、那条白是栈桥白边），所以两者必须拆开：花默认开、泡沫带仍旧默认关。
 * 开默认的同轮必须同步三条回归：tests/battle-c01.mjs（默认全关断言）、tests/ground-stain-browser.cjs、
 * tests/smoke-solid-base-browser.cjs（炭黑会改像素差集）。
 */
export const C01_DEFAULT_ON = ['houseChar', 'shoreFlowers'];
const MAXB = 600;
/**
 * 816743289500106752 · 拐角减速三参数：转角阈值（rad）、拐点邻近半径（世界单位）、最大降速比例。
 * turn=0.35(20°) 以下的直线段不降；near=0.45 之外不降；drop=0.60 时 90° 且贴拐点 ≈0.40 倍速。
 */
export const CORNER_SLOW = { turn: 0.35, near: 0.45, drop: 0.6 };
/**
 * 血斑配色与老化节奏。
 *   第 92 轮按 837027901853810688 重标了 aging：全片红掩膜（r>110 & r−g>55 & r−b>45）逐帧中位
 *   f0083 (189,105,117) → f0093 (174,87,107) → **f0094 (163,80,99) 之后 13 秒一格不动**；
 *   83→94 只有 11 帧 = **0.335s**。原来的 3s 是拍脑袋的（片子是「溅射亮层 0.33s 内退掉、底下暗斑留着」）。
 *   25s→45s 的淡出**片子里没有证据**（全片 15.6s 内血斑不消失），保留为本仓扩展参数，别再当原片口径引用。
 */
const BLOOD = { fresh: new THREE.Color('#c8262e'), base: new THREE.Color('#8e1f24'), aging: 0.335, fadeAfter: 25, fadeSpan: 20 };
const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;

/**
 * 第 87 轮 · 天光柱（skyBeam）口径 —— 全部来自帧量测，不是拍脑袋：
 *   837027901853810688 frame-0358..0364（7 帧 ≈0.21s / 32.9fps）：宽 29px（画幅 460）、x 268–298 恒定不变，
 *     y 从 0（被画面上缘裁掉）一直到 141–144（= 旗顶），色中位 (245,253,144)=#F5FD90，端点有一小块更亮的帽。
 *   912691357440978945 frame-0278..0288（11 帧 / 32.6fps）与 0672..0681（10 帧）：宽 16px（画幅 400）、
 *     色中位 (215–226,210–226,187–207)=淡奶油，落到地面单位身上；两窗之间 x 从 305 移到 276 → 跟着目标走。
 * 两片的宽度/画幅比不同（6.3% vs 4.0%），说明不是屏幕像素恒宽，而是**世界宽度**随镜头缩放 → 这里用世界单位。
 * 高度不按帧给（帧里恒被上缘裁掉，量不出来），取「远大于任何镜头可见高度」的 24 单位。
 * 第 95 轮补量柱底「帽」（r94 说 capHeight 0.10 是估的）：0358–0364 逐行统计，柱身 y=0→137 **恒 28px 宽**（全程不变宽），
 * 唯一变化在 y≈130–137 这 6–8px：B 145→165、R 244→236 → 帽是**偏白的去黄**，不是更亮/更宽的喇叭；
 * 96.7px/世界单位（29px=0.30）→ 0.06–0.08 单位，取 0.07；帽宽 = 柱宽（1.0×，旧值 1.35× 无帧依据）。
 */
export const SKY_BEAM = { width: 0.30, height: 24, life: 0.22, color: '#f0fa90', cap: '#e8f6a4', opacity: 0.95, capHeight: 0.07, capWidth: 1.0, baseLift: 0.6 };

/**
 * 第 88 轮 · 天光柱的**第二种口径**（912691357440978945，落到单位身上的那根）—— 与旗顶那根是两套数：
 *   第 91 轮用统一的奶油色掩膜（r>195 & g>190 & b<200 & r−b>18 & g−b>12）重扫全 759 帧，
 *   得到「只有两窗、各 15 帧」——**第 97 轮证明这个 15 帧是阈值切出来的**：硬阈值在 α<0.5 时整片失效，
 *   把淡入首帧和淡出末几帧都吃掉。逐帧净计数重扫后是 20 帧（0275–0294）与 18 帧（0669–0686）：
 *   0.614s / 0.553s，取 **life 0.60**。而且形状是**拱形包络**，见下面 SKY_BEAM_UNIT_STEPS。
 *   ① 0275–0294：柱心 x 315→266 单调左移（跟着走动中的目标），宽恒 16–17px（3.6–4.3% 画幅），
 *      线芯中位 (230,228,197)=#E6E4C5（淡奶油，**不是**旗顶那根的黄绿 #F5FD90）。
 *   ② 0669–0686：x 恒 297–312（不动），宽 17→18px（**不是**「越淡越窄」，那是阈值假象）。
 *   两根的底边都**不接触地面也不停在旗顶**：底点悬在单位头顶上方约 55–60px（≈1 世界单位）→ baseLift 1.0。
 *   宽度 3.6% vs 旗顶那根 6.3%（837）→ 世界宽按比例 0.30×0.57≈0.17，取 0.18。
 *   触发：受击已证伪（0695 同火同卡同「+6」无柱）、晋升已证伪、hover 也站不住（卡在柱窗前后一直在，
 *   且两窗同长）→ 语义**不再标定**，接口保留显式入口（unitBeam / setBeamOnHit），默认不自动起柱。
 */
export const SKY_BEAM_UNIT = { width: 0.18, height: 24, life: 0.60, color: '#e6e4c5', cap: '#f6f3e6', opacity: 0.92, capHeight: 0.07, capWidth: 1.0, baseLift: 1.0 };

/**
 * 第 97 轮 · 单位柱（912）的**逐帧 α 实测表**。
 *
 * 之前（r88–r96）一直说「两窗各 15 帧、0.46s、没有逐帧 α」，那是**阈值计数把尾巴切掉了**：
 * 掩膜 (R>190 & G>190 & B>160 & 8<R−B<58) 在 α 掉到 0.5 以下时就整片失效，
 * 于是「第一帧 0.54 的淡入」和「末几帧 0.4 的淡出」都不算进窗口。本轮逐帧重扫（工具 `tools/beam-alpha-measure.py`）：
 *
 *   窗1 0275–0294（20 帧 / 32.56fps = 0.614s）净计数（减同机位无柱基线 285px）：
 *     1003 1054 1578 2037 2086 2093 2079 2108 2081 2045 1971 1921 1611 1398 1115 1039 901 322 204
 *     → 归一化 0.48 0.50 0.75 0.97 1.00 1.00 0.99 1.00 0.99 0.97 0.94 0.92 0.77 0.67 0.53 0.50 0.43 0.15 0.10
 *   窗2 0669–0686（18 帧 = 0.553s）净计数（基线 7px）：
 *     443 819 1345 1746 1790 1790 1744 1763 1749 1729 1683 1539 1432 1215 1113 982 964 451
 *     → 归一化 0.25 0.46 0.75 0.98 1.00 1.00 0.97 0.98 0.98 0.97 0.94 0.86 0.80 0.68 0.62 0.55 0.54 0.25
 *
 * **两窗形状一致**：3–4 帧淡入（从 ≈0.4 起，不是 0 起）→ 6–8 帧满亮 → 7–9 帧淡出 → 一帧归零。
 * 所以它不是「恒定 0.92 + 末段 3 帧线性砍掉」，而是**拱形包络**；寿命也不是 0.46s 而是 0.55–0.61s（取 0.60）。
 *
 * ⚠️ 计数法在低 α 会低估（阈值硬切）：拿 837 已知阶梯标定，计数比 0.924 ↔ 真值 0.93（准），
 *    计数比 0.30 ↔ 真值 0.42（低 0.12）。所以表尾 0.20 的真实值大概在 0.3 左右，表头同理；
 *    本轮**不做上修**，先按实测值落地，尾巴要改等有更好的 α 估计器再说。
 */
export const SKY_BEAM_UNIT_STEPS = [[0, 0.38], [0.030, 0.48], [0.060, 0.75], [0.090, 0.98], [0.120, 1.00], [0.270, 0.97], [0.360, 0.86], [0.420, 0.64], [0.480, 0.52], [0.540, 0.20], [0.600, 0]];

/** 纯函数：单位柱在 age 秒的不透明度系数 —— 线性插值查 SKY_BEAM_UNIT_STEPS（拱形包络），表尾外为 0。 */
export function beamFadeUnit(age, table = SKY_BEAM_UNIT_STEPS) {
  const a = Math.max(0, age);
  if (a <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [t1, v1] = table[i], [t0, v0] = table[i - 1];
    if (a <= t1) return v1 + ((v1 - v0) * (a - t1)) / (t1 - t0);
  }
  return 0;
}
/** 纯函数：光柱在 age 秒时的不透明度 —— 前 80% 满亮，最后 20% 线性能淡出（片子是 1 帧内消失，不是长淡出）。 */
export function beamFade(age, life = SKY_BEAM.life) {
  const a = Math.max(0, Math.min(life, age));
  return a <= life * 0.8 ? 1 : Math.max(0, (life - a) / (life * 0.2));
}

/**
 * 第 94 轮 · 旗顶那根光柱（837）的**实测阶梯**：它不是线性淡出，而是**一帧一跳**地掉。
 * 逐帧量（掩膜 r>200 & g>210 & b<210 & r−b>45，只数 x∈[240,320] 且 y<152 的柱身，柱上端恒被画面上缘裁）：
 *   f0358 3966px / f0359 3939 / f0360 3925 / f0361 3920 = 100%
 *   f0362 3701 = 93%  · f0363 1662 = 42% · f0364 117 = 3% · f0365 归零（117 已是旗布杂像素）
 *   帧长 1/32.885 = 0.0304s → α 表（按帧边界给，不是按「最后 20%」）：4 帧满亮 → 1 帧 0.93 → 1 帧 0.42 → 1 帧 0.03 → 0，
 *   合计 7 帧 = 0.2129s ≈ life 0.22（r87 的 7 帧天数没错，错的是末端形状）。
 * 旧实现「前 80% 满亮 + 最后 20% 线性」在末端会连着三帧 0.75 / 0.5 / 0.25（≈0.09s 的连续半透明），
 * 原片只有**一帧 0.42** —— 所以旗顶这根改成查表步进，单位那根（912 两窗各 15 帧）没有逐帧 α 数据，仍走线性。
 */
export const SKY_BEAM_STEPS = [[0, 1], [0.1216, 0.93], [0.1520, 0.42], [0.1824, 0.03], [0.2128, 0]];

/** 纯函数：按 (tStart, α) 表步进，取「最后一个 tStart ≤ age」对应的 α；超出表尾 = 0。负龄夹到 0（=满亮）。 */
export function beamFadeStepped(age, table = SKY_BEAM_STEPS) {
  const a0 = Math.max(0, age);
  let a = 0;
  for (const [t, v] of table) { if (a0 + 1e-9 >= t) a = v; else break; }
  return a;
}

/** 纯函数：血斑在 age 秒、叠了 stack 层时的颜色系数与透明度系数（测试直接用）。 */
export function bloodLook(age, stack = 0, { aging = true, stacking = true } = {}) {
  const c = new THREE.Color().copy(BLOOD.base);
  let a = 1;
  if (aging) {
    c.copy(BLOOD.fresh).lerp(BLOOD.base, Math.min(1, Math.max(0, age) / BLOOD.aging));
    a = age < BLOOD.fadeAfter ? 1 : Math.max(0.45, 1 - (age - BLOOD.fadeAfter) / BLOOD.fadeSpan * 0.55);
  }
  if (stacking && stack > 0) { const k = Math.min(4, stack); c.multiplyScalar(1 - 0.12 * k); a = Math.min(1.28, a * (1 + 0.08 * k)); }
  return { color: c, alpha: a };
}

/** 纯函数：方块落位。n 人、第 r 个（0 起），朝向 (fx,fz)，间距 sp → 相对目标中心的偏移。4 列，3–4 排起步。 */
export function blockSlot(r, n, fx, fz, sp = 0.13) {
  const cols = Math.max(4, Math.ceil(n / 4)), rows = Math.ceil(n / cols);
  const c = r % cols, row = Math.floor(r / cols);
  const l = Math.hypot(fx, fz) || 1, ux = fx / l, uz = fz / l, rx = -uz, rz = ux;
  const across = (c - (cols - 1) / 2) * sp, back = ((rows - 1) / 2 - row) * sp;
  return { x: rx * across + ux * back, z: rz * across + uz * back, cols, rows };
}

/** 纯函数：同队节点图的边（与 InfoGraph 同口径：半径内、高差容差内、视线通）。 */
export function graphEdges(units, { radius = 0.55, heightTolerance = 0.3, canSee = () => true } = {}) {
  const e = [], r2 = radius * radius;
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j], dx = a.x - b.x, dz = a.z - b.z;
    if (dx * dx + dz * dz > r2 || Math.abs((a.y ?? 0) - (b.y ?? 0)) > heightTolerance || !canSee(a, b)) continue;
    e.push([i, j]);
  }
  return e;
}

/** 岛的海岸边：top≥1 的格，邻格缺失或 top=0 的那条边（带向外法线）。 */
export function coastEdges(world) {
  const out = [];
  for (const c of world.cells) {
    if (world.top(c) < 1) continue;
    for (let i = 0; i < c.n; i++) {
      const nb = c.edgeNeighbors[i];
      if (nb >= 0 && world.top(world.cells[nb]) > 0) continue;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n];
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      let nx = -(b.z - a.z), nz = b.x - a.x; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      if (nx * (mx - c.cx) + nz * (mz - c.cz) < 0) { nx = -nx; nz = -nz; }
      out.push({ a, b, nx, nz, cell: c });
    }
  }
  return out;
}

export class BattleC01 {
  constructor(battle) {
    this.b = battle;
    this.on = Object.fromEntries(C01_FLAGS.map((k) => [k, false]));
    for (const k of C01_DEFAULT_ON) this.on[k] = true;
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    const list = (q.get('c01') || '').split(',').filter(Boolean);
    for (const k of C01_FLAGS) {
      if (list.includes('all') || list.includes(k)) this.on[k] = true;
      if (list.includes('-' + k)) this.on[k] = false;   // 显式关：?c01=-houseChar
    }
    this.group = new THREE.Group(); battle.group.add(this.group);
    this.stats = this.#zero();
    // 节点图线网 + 节点小方块 + 箭矢细线
    const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false });
    this.net = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, toneMapped: false }));
    this.net.renderOrder = 28; this.net.frustumCulled = false; this.group.add(this.net);
    this.ticks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#e8fbff', size: 4, sizeAttenuation: false, depthTest: false, transparent: true, toneMapped: false }));
    this.ticks.renderOrder = 28; this.ticks.frustumCulled = false; this.group.add(this.ticks);
    this.arrowLines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat('#ffffff', 0.95));
    this.arrowLines.renderOrder = 28; this.arrowLines.frustumCulled = false; this.group.add(this.arrowLines);
    this.diamondGeo = new THREE.OctahedronGeometry(1, 0).scale(0.03, 0.045, 0.03);
    this.diamondMat = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, toneMapped: false });
    // 旗顶血量槽 / 下令竖条 / 跳板 / 火光 / 泡沫 / 花 / 水中血雾
    this.huds = new Map(); this.diamonds = new Map(); this.pillars = []; this.planks = new Map(); this.glows = new Map();
    this.pillarGeo = new THREE.BoxGeometry(0.045, 1, 0.012).translate(0, 0.5, 0);
    this.pillarMat = new THREE.MeshBasicMaterial({ color: '#f2ec5c', transparent: true, depthTest: false, toneMapped: false });
    this.leadMat = lineMat('#f2ec5c', 0.9);
    // 第 87 轮 · 天光柱：一个 1×1 的面片，原点在底边（translate 0,0.5,0 → y 0…1），实例只改 scale/位置。
    this.beamGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: SKY_BEAM.color, transparent: true, opacity: SKY_BEAM.opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.capGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.capMat = new THREE.MeshBasicMaterial({ color: SKY_BEAM.cap, transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.beams = [];
    this.beamOnHit = false;   // 第 90 轮：受击自动落单位柱默认关（912 frame-0695 是反例，见 onHit 注释）
    this.plankGeo = new THREE.BoxGeometry(0.075, 0.014, 1).translate(0, 0, 0.5);
    this.plankMat = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9, flatShading: true });
    const haze = new THREE.CircleGeometry(1, 16); haze.rotateX(-Math.PI / 2);
    this.hazeA = new THREE.InstancedBufferAttribute(new Float32Array(48), 1); haze.setAttribute('aHazeA', this.hazeA);
    const hazeMat = new THREE.MeshBasicMaterial({ color: '#c9566a', transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
    hazeMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aHazeA;\nvarying float vHazeA;\nvarying vec2 vHz;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHazeA = aHazeA; vHz = position.xz;');
      // 血雾：中心浓、外缘软（不是硬边圆片）
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHazeA;\nvarying vec2 vHz;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vHazeA * (1.0 - smoothstep(0.35, 1.0, length(vHz)));');
    };
    hazeMat.customProgramCacheKey = () => 'c01haze';
    this.hazeMesh = new THREE.InstancedMesh(haze, hazeMat, 48);
    this.hazeMesh.count = 0; this.hazeMesh.frustumCulled = false; this.hazeMesh.renderOrder = 3; this.group.add(this.hazeMesh);
    this.hazes = [];
    this.foam = null; this.flowers = null; this.foamDots = null;
    this.blood = null;   // 逐实例血迹状态（bloodAge / bloodStack 打开时建）
    // 第 92 轮 · 地面染色层（groundTint）：格子顶面的乘性贴面，不碰 worldMesh 材质
    this.stain = null;        // { mesh, cells }
    this.stainT0 = null;      // 第一次伤害的时刻（b.t），染色从这里起步
    this.stainForce = null;   // 手动锁进度（测试/截图用）
  }
  #zero() { return { hudRedraws: 0, hitFlashes: 0, edges: 0, nodes: 0, arrowLines: 0, diamonds: 0, pillars: 0, beams: 0, beamWidth: 0, beamHeight: 0, beamTopY: 0, beamBaseY: 0, beamUnits: 0, beamUnitWidth: 0, beamUnitBaseY: 0, beamUnitColor: '', planks: 0, glows: 0, bloodTracked: 0, stacked: 0, maxStack: 0, waits: 0, slotted: 0, cornerTurns: 0, cornerSlows: 0, minSpeedK: 1, routeSamples: 0, routeArcs: 0, routeCorners: 0, routeTrimmed: 0, coast: 0, foamDots: 0, flowers: 0, flowerClusters: 0, hazes: 0, stainCells: 0, stainProgress: 0, stainAge: 0, stainColor: '', housesCharred: 0, charredVerts: 0 }; }

  set(name, value) {
    if (!C01_FLAGS.includes(name)) throw new RangeError('unknown C01 flag ' + name);
    this.on[name] = !!value; this.#apply(); return this.on[name];
  }
  start() { this.stats = this.#zero(); this.blood = null; this.hazes = []; this.hazeMesh.count = 0; this.beams = []; this._charDone = null; this._charGeo = null; this._charSaved = null; this.#apply(); }
  stop() {
    this.#charRestore();
    for (const m of [...this.huds.values(), ...this.diamonds.values(), ...this.planks.values()]) this.group.remove(m);
    for (const g of this.glows.values()) { this.group.remove(g.light, g.disc); }
    for (const p of this.pillars) this.group.remove(p.mesh);
    for (const p of this.beams) { this.group.remove(p.mesh); p.bar.material.dispose(); p.cap.material.dispose(); }
    this.beams = [];
    for (const s of this.stain ? [this.stain.mesh] : []) { this.group.remove(s); s.geometry.dispose(); s.material.dispose(); }
    this.stain = null; this.stainT0 = null; this.stainForce = null;
    this.huds.clear(); this.diamonds.clear(); this.planks.clear(); this.glows.clear(); this.pillars = [];
    for (const o of [this.foam, this.flowers, this.foamDots, this.traces, this.raid]) if (o) { this.group.remove(o); o.geometry.dispose(); }
    this.foam = this.flowers = this.foamDots = this.traces = this.raid = null; this.flowerCells = null;
    this.net.visible = this.ticks.visible = this.arrowLines.visible = false; this.hazeMesh.count = 0; this.hazes = [];
    if (this.cards) { this.cards.el.remove?.(); this.cards = null; }
    this.#bloodMaterial(false);
  }
  #apply() {
    const b = this.b;
    this.net.visible = this.ticks.visible = this.arrowLines.visible = this.on.nodeNet;
    if (!this.on.nodeNet) for (const d of this.diamonds.values()) d.visible = false;
    if (!this.on.squadHud) for (const h of this.huds.values()) h.visible = false;
    if (!this.on.plank) for (const p of this.planks.values()) p.visible = false;
    if (!this.on.fireGlow) for (const g of this.glows.values()) { g.light.visible = g.disc.visible = false; }
    if (!this.on.waterBlood) { this.hazeMesh.count = 0; this.hazes = []; }
    this.#bloodMaterial(this.on.bloodAge || this.on.bloodStack || this.on.waterBlood);
    // 第 71 轮（缺口 ①）：从 smoke-c01 的外挂近似切到 src/life/smoke.js 的 native 实现。
    // 外挂层是把原生 update 包一层、事后改实例缩放（每 3 片丢 1 片再放大 1.32）并自己铺 240 张雾卡；
    // native 则是「发射间隔 + 噪声尺度」（setLobeStyle('big')）、「分组吐片 + 组间静默」（setTopBreak）、
    // 「断口后复起那一组更大更暗」（setCrown）、「独立扁软卡薄雾层」（setHaze）——同一批口径，但走烟本体，
    // 不会和 wind/gravity 的实例矩阵打架，也不会多一份雾卡。三个开关都只让 #apply 在 set()/start() 里跑一次，
    // 不会每帧重建发射点。
    const sm = b.view.smoke;
    if (sm?.group && typeof sm.update === 'function') {
      sm.setLobeStyle(this.on.smokeShape ? 'big' : 'fine');
      sm.setTopBreak(this.on.smokeShape);
      sm.setCrown(this.on.smokeShape);
      sm.setHaze(this.on.smokeShape);
    }
    if (b.running && b.world) {
      if (this.on.shoreFoam && !this.foam) this.#buildShore();
      for (const o of [this.foam, this.foamDots]) if (o) o.visible = this.on.shoreFoam;
      // 花与泡沫带解耦（第 185 轮）：946660607008403456 的水面干净、只有岸上有花
      if (this.on.shoreFlowers && !this.flowers) this.#buildFlowers();
      if (this.flowers) this.flowers.visible = this.on.shoreFlowers;
      if (this.on.groundTint && !this.stain) this.#buildStain();
      if (this.stain) this.stain.mesh.visible = this.on.groundTint;
    }
  }

  /* ------------------------------------------------------------ 每帧（battle.#draw 之后） */
  afterDraw(dt) {
    const b = this.b; if (!b.running) return;
    this.t = b.t;
    if (this.on.squadHud) this.#squadHud(dt);
    if (this.on.nodeNet) this.#nodeNet(dt);
    if (this.on.orderPillar || this.pillars.length) this.#pillars(dt);
    if (this.on.skyBeam || this.beams.length) this.#beams(dt);
    if (this.on.plank) this.#planks();
    if (this.blood) this.#bloodStep();
    if (this.stain) this.#stainStep();
    if (this.on.houseChar) this.#charStep();
    if (this.on.fireGlow) this.#fireGlow();
    if (this.on.routePreview && this.route) this.#routeStep();
    if (this.on.shoreFoam && this.foam) this.foam.material.userData.uT.value = b.t;
    if (this.on.waterBlood || this.hazes.length) this.#hazeStep(dt);
    if (this.on.windTraces) { this.traceT = (this.traceT ?? 0) - dt; if (this.traceT <= 0 || !this.traces) { this.traceT = 2; this.#windTraces(); } }
    if (this.traces) this.traces.visible = this.on.windTraces;
    if (this.on.raidBoxes) { this.raidT = (this.raidT ?? 0) - dt; if (this.raidT <= 0 || !this.raid) { this.raidT = 0.5; this.#raidBoxes(); } }
    if (this.raid) this.raid.visible = this.on.raidBoxes;
    if (this.on.portraits) this.#portraits(); else if (this.cards) { this.cards.el.remove?.(); this.cards = null; }
  }

  /* ---------------------------------------------- 1010979395719319552：游戏内头像卡 */
  #portraits() {
    const b = this.b;
    if (!this.cards) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:6;display:flex;gap:10px;pointer-events:none';
      document.body.appendChild(el);
      this.cards = { el, items: [] };
      for (const sq of b.squads) {
        const card = document.createElement('div'); card.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;transition:opacity .3s';
        const cv = document.createElement('canvas'); cv.width = cv.height = 88; cv.style.cssText = 'width:88px;height:88px';
        const bar = document.createElement('div'); bar.style.cssText = 'width:70px;height:6px;background:#16202a;border-radius:2px;overflow:hidden';
        const fill = document.createElement('div'); fill.style.cssText = 'height:100%;width:100%;background:#68ce7c'; bar.appendChild(fill);
        card.appendChild(cv); card.appendChild(bar); el.appendChild(card);
        // 角色接口：卡面装备/底色按小队真数据钉槽（矛兵→锁甲、弓手→兜帽、队序→底色），种子仍按 sq.id 稳定
        const r = drawGamePortrait(cv.getContext('2d'), 101 + sq.id * 37, { x: 0, y: 0, w: 88, h: 88 }, { identity: squadPortraitIdentity(sq) });
        this.cards.items.push({ sq, card, fill, spec: r.spec }); this.stats.portraits = (this.stats.portraits ?? 0) + 1;
      }
    }
    for (const it of this.cards.items) {
      const alive = it.sq.members.filter((u) => !u.dead).length, ratio = alive / Math.max(1, it.sq.members.length);
      it.fill.style.width = Math.round(ratio * 100) + '%'; it.fill.style.background = ratio > 0.7 ? '#68ce7c' : ratio > 0.34 ? '#e8ba56' : '#e4605c';
      it.card.style.opacity = it.sq.alive ? '1' : '0.35'; it.ratio = ratio;
    }
  }

  /* ---------------------------------------------- 974325184525201409：登陆规划盒子 */
  #raidBoxes() {
    const b = this.b, w = b.world, pos = [], col = [];
    const PAL = [[1, .86, .25], [.3, .85, 1], [.35, .45, 1], [1, .45, .9], [1, .6, .2], [1, .25, .25]];
    const box = (B, c, lift = 0) => {
      const k = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) k.push([0, 1, 2].map((i) => B.c[i] + sx * B.e[0] * B.u[0][i] + sy * B.e[1] * B.u[1][i] + sz * B.e[2] * B.u[2][i] + (i === 1 ? lift : 0)));
      for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) { pos.push(...k[i], ...k[j]); col.push(...c, ...c); }
    };
    let ok = 0, rejected = 0;
    b.boats.forEach((boat, i) => { const c = PAL[i % PAL.length]; box(berthBox(boat.stop, boat.dir), c, 0.2); box(approachBox(boat.stop, boat.dir), c.map((x) => x * 0.75), 0.2); });
    // 下一波候选：与 planLanding 同一套判定（泊位盒 SAT、走廊盒 SAT、航道压礁），只画不发船
    const reserved = b.boats.map((x) => berthBox(x.stop, x.dir)), lanes = b.boats.map((x) => approachBox(x.stop, x.dir));
    const landings = w.cells.filter((c) => { const t = w.top(c); return t >= 1 && t <= 2 && t === w.ground(c) && c.edgeNeighbors.some((id) => id >= 0 && w.top(w.cells[id]) === 0); });
    for (const land of landings.slice(0, 40)) for (const id of land.edgeNeighbors) {
      if (id < 0 || w.top(w.cells[id]) !== 0) continue;
      const sea = w.cells[id], dx = sea.cx - land.cx, dz = sea.cz - land.cz, len = Math.hypot(dx, dz); if (len < 1e-9) continue;
      for (const da of LANE_ANGLES) {
        const cs = Math.cos(da), sn = Math.sin(da), dir = [(dx * cs - dz * sn) / len, (dx * sn + dz * cs) / len], stop = [sea.cx + dir[0] * .25, sea.cz + dir[1] * .25], bb = berthBox(stop, dir);
        const bad = reserved.some((o) => obbOverlap(bb, o)) || lanes.some((o) => obbOverlap(approachBox(stop, dir), o)) || seawayBlocked(w, stop, dir, { except: [land] });
        if (bad) rejected++; else ok++;
        box(bb, bad ? [.55, .12, .14] : [.92, .92, .92], 0.2);
      }
    }
    if (!this.raid) { this.raid = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false })); this.raid.renderOrder = 27; this.raid.frustumCulled = false; this.group.add(this.raid); }
    this.raid.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.raid.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.stats.raidBoats = b.boats.length; this.stats.raidOk = ok; this.stats.raidRejected = rejected;
  }

  /* ---------------------------------------------- 926903893866541057：风粒子轨迹（红线） */
  #windTraces() {
    const b = this.b, atm = b.view.atmosphere, w = b.world;
    if (!atm?.trace || !atm.probes) return;
    const pos = []; let n = 0, blocked = 0;
    let cx = 0, cz = 0, r = 0; for (const c of w.cells) { cx += c.cx; cz += c.cz; } cx /= w.cells.length; cz /= w.cells.length;
    for (const c of w.cells) if (w.top(c) > 0) r = Math.max(r, Math.hypot(c.cx - cx, c.cz - cz));
    const seeds = [];
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; seeds.push([cx + Math.cos(a) * (r + 1.2), b.L * 0.6, cz + Math.sin(a) * (r + 1.2)]); }
    // 贴着岸 / 崖脚再播一圈：原片里红轨迹在崖边绕行、折转，远海是直的
    const coast = coastEdges(w); for (let k = 0; k < coast.length; k += 4) { const e = coast[k]; seeds.push([(e.a.x + e.b.x) / 2 + e.nx * 0.3, b.L * 0.6, (e.a.z + e.b.z) / 2 + e.nz * 0.3]); }
    const tops = w.cells.filter((c) => w.top(c) >= 2); for (let k = 0; k < tops.length; k += Math.max(1, Math.floor(tops.length / 24))) { const c = tops[k]; seeds.push([c.cx, (w.top(c) + 0.6) * b.L, c.cz]); }
    for (const s0 of seeds) {
      let t; try { t = atm.trace(s0, { steps: 40, dt: 0.09 }); } catch { continue; }
      blocked += t.blocked; n++;
      for (let i = 1; i < t.points.length; i++) pos.push(...t.points[i - 1], ...t.points[i]);
    }
    if (!this.traces) { this.traces = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#d8343f', transparent: true, opacity: 0.9, depthTest: false, toneMapped: false })); this.traces.renderOrder = 27; this.traces.frustumCulled = false; this.group.add(this.traces); }
    this.traces.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.stats.traces = n; this.stats.traceBlocked = blocked;
  }

  /* ---------------------------------------------- 837027901853810688 / 912691357440978945：天光柱 */
  /**
   * 起一根天光柱。target 给世界坐标；opts.follow 传小队则每帧跟着它的旗顶走（片子里光柱跟着目标移动：
   * 912 的 x 从 309 移到 276）。opts.followUnit 传单个单位则跟着**单位本人**走，柱底悬在它上方 baseLift
   * （912 那根的口径，见 SKY_BEAM_UNIT）。preset='unit' 时用 SKY_BEAM_UNIT 那套宽度/颜色/寿命。
   * 返回这条记录，测试可直接读 baseY/topY/width。
   */
  beamAt(target, opts = {}) {
    const P = opts.preset === 'unit' ? SKY_BEAM_UNIT : SKY_BEAM;
    const width = opts.width ?? P.width, height = opts.height ?? P.height;
    const mat = this.beamMat.clone(), capMat = this.capMat.clone();
    mat.color.set(P.color); capMat.color.set(P.cap); mat.opacity = P.opacity;
    const mesh = new THREE.Mesh(this.beamGeo, mat);
    const cap = new THREE.Mesh(this.capGeo, capMat); cap.scale.set(width * (P.capWidth ?? 1), P.capHeight, 1);
    mesh.renderOrder = cap.renderOrder = 31; mesh.frustumCulled = cap.frustumCulled = false;
    mesh.scale.set(width, height, 1);
    const g = new THREE.Group(); g.add(mesh, cap); this.group.add(g);
    const rec = {
      mesh: g, bar: mesh, cap, follow: opts.follow || null, followUnit: opts.followUnit || null,
      baseLift: opts.baseLift ?? P.baseLift, kind: opts.preset === 'unit' ? 'unit' : 'flag',
      age: 0, life: opts.life ?? P.life, width, height,
    };
    if (rec.followUnit) { const u = rec.followUnit; g.position.set(u.x, u.y + rec.baseLift, u.z); }
    else if (rec.follow) { const f = rec.follow.flag?.position; g.position.set(f.x, f.y + rec.baseLift, f.z); }
    else g.position.set(target.x, target.y, target.z);
    this.beams.push(rec); this.stats.beams++;
    if (rec.kind === 'unit') { this.stats.beamUnits++; this.lastBeamUnit = rec.followUnit; }
    return rec;
  }
  /** 912 那根：柱挂在**单位本人**身上（选中单位优先，否则用最近受击的那个）。 */
  unitBeam(u, opts = {}) {
    if (!u) return null;
    return this.beamAt(null, { ...opts, followUnit: u, preset: 'unit' });
  }
  /**
   * 命中钩子（battle.#hit 每次挨打都调）。**第 90 轮改成默认不自动起柱**：
   * 912 全片找反例 —— frame-0695 同一根火柱、同一张单位卡、同一批「+6/+8」伤害数字都在，
   * 天空里**没有**光柱（只有白色菱形标记）；而 0277–0289 / 0672–0681 有柱的帧里，
   * 柱底接的是**单位卡（名字 + 军衔 + 血条 + 兵种图标）顶端的白色标记**，不是单位身体。
   * 所以「挨打 → 起柱」既不是充分也不是必要条件，第 88 轮的自动挂钩没有原片支撑。
   * 现在：`on.skyBeam` 只让旗顶版（onMove）生效；单位版必须显式 `unitBeam(u)` 或打开
   * `setBeamOnHit(true)` 才会由命中触发（留给实验页做对照，不作为默认行为）。
   */
  onHit(v) {
    if (!this.on.skyBeam || !this.beamOnHit || !v || v.dead || v.onBoat) return null;
    return this.unitBeam(v);
  }
  /** 受击自动落单位柱（第 90 轮新增，默认 false —— 原片证伪，见 onHit 注释）。 */
  setBeamOnHit(on = true) { this.beamOnHit = !!on; return this.beamOnHit; }
  #beams(dt) {
    const b = this.b, cam = b.view.camera;
    const step = dt > 0 ? dt : 1 / 60;   // 暂停/慢动作里光柱仍按真实时间消失（片子里它跟玩法时钟无关）
    for (const p of this.beams) {
      p.age += step;
      if (p.followUnit) {
        const u = p.followUnit;
        if (u) { p.mesh.position.set(u.x, u.y + p.baseLift, u.z); if (u.dead) p.age = p.life; }
      } else if (p.follow) { const f = p.follow.flag?.position; if (f) p.mesh.position.set(f.x, f.y + p.baseLift, f.z); }
      if (cam) p.mesh.rotation.y = Math.atan2(cam.position.x - p.mesh.position.x, cam.position.z - p.mesh.position.z);
      // 第 94 轮：旗顶那根走实测阶梯（837 逐帧 α）；第 97 轮：单位那根也换成实测拱形包络（912 逐帧 α，表按 life 缩放）
      const k = p.kind === 'unit'
        ? beamFadeUnit(p.age * (SKY_BEAM_UNIT.life / p.life), SKY_BEAM_UNIT_STEPS)
        : beamFadeStepped(p.age, SKY_BEAM_STEPS);
      p.bar.material.opacity = (p.kind === 'unit' ? SKY_BEAM_UNIT.opacity : SKY_BEAM.opacity) * k; p.cap.material.opacity = k;
      // 跟着目标的小队全灭就不该再指它（片子里没有对着空地下柱）
      if (!p.followUnit && p.follow && p.follow.alive === false) p.age = p.life;
    }
    const live = this.beams.filter((p) => p.age < p.life);
    for (const p of this.beams.filter((p) => p.age >= p.life)) {
      this.group.remove(p.mesh); p.bar.material.dispose(); p.cap.material.dispose();
    }
    this.beams = live;
    const f = this.beams[0];
    this.stats.beamBaseY = f ? +f.mesh.position.y.toFixed(3) : 0;
    this.stats.beamTopY = f ? +(f.mesh.position.y + f.height).toFixed(3) : 0;
    this.stats.beamWidth = f ? f.width : 0;
    this.stats.beamHeight = f ? f.height : 0;
    const u = this.beams.find((p) => p.kind === 'unit');
    this.stats.beamUnitWidth = u ? u.width : 0;
    this.stats.beamUnitBaseY = u ? +u.mesh.position.y.toFixed(3) : 0;
    this.stats.beamUnitColor = u ? '#' + u.bar.material.color.getHexString() : '';
  }

  /* ------------------------------------------------------------ 下令（battle.onPointer 之后） */
  onMove(sq, picked) {
    const b = this.b; if (!sq) return;
    if (this.on.orderPillar) { const mesh = this.#pillarMesh(); this.group.add(mesh); this.pillars.push({ sq, mesh, age: 0, life: 0.6 }); this.stats.pillars++; }
    if (this.on.skyBeam) this.beamAt(null, { follow: sq });
    if (this.on.column) this.#orderColumn(sq, picked);
    if (this.on.routePreview) this.#route(sq, picked);
  }

  /* ---------------------------------------------- 839067977781768193：旗顶血量槽 */
  #squadHud(dt) {
    const b = this.b;
    for (const sq of b.squads) {
      let h = this.huds.get(sq);
      if (!sq.alive) { if (h) h.visible = false; continue; }
      if (!h) {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 8;
        const tex = new THREE.CanvasTexture(canvas); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
        h = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false }));
        h.renderOrder = 31; h.scale.set(0.2, 0.025, 1); h.userData = { canvas, tex, key: '', hp: null, hitAge: Infinity };
        this.huds.set(sq, h); this.group.add(h);
      }
      const ud = h.userData, alive = sq.members.filter((u) => !u.dead).length, hpSum = sq.members.reduce((s, u) => s + Math.max(0, u.dead ? 0 : u.hp), 0);
      if (ud.hp !== null && hpSum < ud.hp) { ud.hitAge = 0; this.stats.hitFlashes++; } else ud.hitAge += dt;
      ud.hp = hpSum;
      const bar = bannerBar({ hp: alive, max: sq.members.length, width: 64, hitAge: ud.hitAge });
      const key = bar.fill.w + '|' + bar.fill.color + '|' + !!bar.flash;
      if (key !== ud.key) {
        ud.key = key; this.stats.hudRedraws++;
        const g = ud.canvas.getContext('2d');
        g.fillStyle = rgb(bar.slot.color); g.fillRect(0, 0, 64, 8);
        g.fillStyle = rgb(bar.fill.color); g.fillRect(0, 1, bar.fill.w, 6);
        if (bar.flash) { g.fillStyle = rgb(bar.flash.color); g.fillRect(0, 1, bar.flash.w, 6); }
        ud.tex.needsUpdate = true;
        ud.bar = bar;
      }
      // 旗面上沿中点：Bezier 旗面上排顶点的中间那个（旗子随风摆，槽跟着旗面走）
      const cloth = sq.flag.userData.cloth, pos = cloth?.geometry?.attributes?.position, seg = sq.flag.userData.SEG ?? 10;
      if (pos && pos.count > seg) { const i = seg; h.position.set(pos.getX(i), pos.getY(i) + 0.035, pos.getZ(i)); }
      else h.position.set(sq.flag.position.x, sq.flag.position.y + 0.64, sq.flag.position.z);
      h.visible = true;
    }
  }

  /* ---------------------------------------------- 839067977781768193：登陆木跳板 */
  #planks() {
    const b = this.b;
    for (const boat of b.boats) {
      let p = this.planks.get(boat);
      const show = boat.state === 'unload' && boat.wait < 3.5 + (boat.crew?.length ?? 0) * 0.25;
      if (!show) { if (p) p.visible = false; continue; }
      if (!p) { p = new THREE.Mesh(this.plankGeo, this.plankMat); p.castShadow = true; this.planks.set(boat, p); this.group.add(p); this.stats.planks++; }
      // 船头 = 朝岸那一端（dir 指向外海）；跳板搭到登陆格的岸沿上
      const ux = -boat.dir[0], uz = -boat.dir[1];
      const bx = boat.mesh.position.x + ux * 0.5, bz = boat.mesh.position.z + uz * 0.5, by = boat.mesh.position.y + 0.12;
      // 沿船头朝岸方向找搭脚点：坡度不超过 ~40°（rise ≤ 0.85 × run）的第一处地面；找不到就搭到登陆格上
      let to = null;
      for (let run = 0.3; run <= 1.2 && !to; run += 0.05) {
        const x = bx + ux * run, z = bz + uz * run, c = b.view.index.cellAt(x, z);
        if (!c || b.world.top(c) < 1) continue;
        const gy = b.world.top(c) * b.L + (b.view.visualOffset ? b.view.visualOffset(x, z) : 0);
        if (gy - by <= run * 0.85) to = new THREE.Vector3(x, gy + 0.01, z);
      }
      if (!to) { const land = boat.land; to = new THREE.Vector3(land.cx, b.world.top(land) * b.L + 0.01, land.cz); }
      const from = new THREE.Vector3(bx, by, bz);
      const len = Math.min(1.4, from.distanceTo(to));
      p.position.copy(from); p.lookAt(to); p.scale.set(1, 1, len); p.visible = true;
    }
    for (const [boat, p] of this.planks) if (!b.boats.includes(boat)) { this.group.remove(p); this.planks.delete(boat); }
  }

  /* ---------------------------------------------- 883447205176238083：动态节点图线网 */
  #nodeNet(dt) {
    const b = this.b;
    this.netT = (this.netT ?? 0) - dt;
    if (this.netT <= 0) {
      this.netT = 0.1;
      const pos = [], col = [], tick = [];
      const nav = b.navigation, canSee = (u, v) => !nav?.clearSegment || nav.clearSegment({ x: u.x, y: u.y + 0.1, z: u.z }, { x: v.x, y: v.y + 0.1, z: v.z });
      const vo = (x, z) => (b.view.visualOffset ? b.view.visualOffset(x, z) : 0);
      let edges = 0, nodes = 0;
      for (const team of [0, 1]) {
        const us = b.units.filter((u) => u.team === team && !u.dead && !u.onBoat && !u.fall);
        const E = graphEdges(us, { radius: team === 0 ? 0.42 : 0.55, canSee });
        const c = team === 0 ? [0.78, 0.96, 1] : [1, 1, 1];
        for (const [i, j] of E) { const u = us[i], v = us[j]; pos.push(u.x, u.y + vo(u.x, u.z) + 0.012, u.z, v.x, v.y + vo(v.x, v.z) + 0.012, v.z); col.push(...c, ...c); }
        for (const u of us) tick.push(u.x, u.y + vo(u.x, u.z) + 0.012, u.z);
        edges += E.length; nodes += us.length;
      }
      this.net.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.net.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      this.ticks.geometry.setAttribute('position', new THREE.Float32BufferAttribute(tick, 3));
      this.stats.edges = edges; this.stats.nodes = nodes;
    }
    // 箭：飞行中的每支画一条细白线（箭尾 0.22 → 箭头）
    const ap = []; const fwd = new THREE.Vector3();
    for (const a of b.arrows) { if (a.stuck || !a.mesh.visible) continue; fwd.set(0, 0, 1).applyQuaternion(a.mesh.quaternion); const p = a.mesh.position; ap.push(p.x - fwd.x * 0.22, p.y - fwd.y * 0.22, p.z - fwd.z * 0.22, p.x + fwd.x * 0.08, p.y + fwd.y * 0.08, p.z + fwd.z * 0.08); }
    this.arrowLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
    this.stats.arrowLines = ap.length / 6;
    // 旗顶白菱形（每支在场守军一个，慢转）
    let nd = 0;
    for (const sq of b.squads) {
      let d = this.diamonds.get(sq);
      if (!d) { d = new THREE.Mesh(this.diamondGeo, this.diamondMat); d.renderOrder = 31; this.diamonds.set(sq, d); this.group.add(d); }
      d.visible = sq.alive; if (!sq.alive) continue;
      d.position.set(sq.flag.position.x, sq.flag.position.y + 0.78, sq.flag.position.z); d.rotation.y = b.t * 1.5; nd++;
    }
    this.stats.diamonds = nd;
  }

  /* ---------------------------------------------- 837027901853810688：下令黄竖条 */
  #pillarMesh() {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(this.pillarGeo, this.pillarMat.clone()); bar.scale.y = 0.9; bar.position.y = 0.66; bar.renderOrder = 31; g.add(bar);
    const lead = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0, 0.66, 0)]), this.leadMat); lead.renderOrder = 31; g.add(lead);
    g.userData.bar = bar; return g;
  }
  #pillars(dt) {
    const cam = this.b.view.camera;
    for (const p of this.pillars) {
      p.age += dt > 0 ? dt : 1 / 60;   // 下令时 battle 处于慢动作 / 暂停也要按真实时间消失
      const f = p.sq.flag.position; p.mesh.position.set(f.x, f.y, f.z);
      if (cam) p.mesh.rotation.y = Math.atan2(cam.position.x - f.x, cam.position.z - f.z);
      p.mesh.userData.bar.material.opacity = p.age < p.life - 0.15 ? 1 : Math.max(0, (p.life - p.age) / 0.15);
      p.mesh.visible = p.sq.alive;
    }
    for (const p of this.pillars.filter((p) => p.age >= p.life)) { this.group.remove(p.mesh); p.mesh.userData.bar.material.dispose(); }
    this.pillars = this.pillars.filter((p) => p.age < p.life);
  }

  /* ---------------------------------------------- 837027901853810688 / 984813819280191488：血迹变暗 / 变淡 / 堆厚 */
  #bloodMaterial(on) {
    const mesh = this.b.blood, mat = mesh.material;
    if (on && !this.blood) {
      if (!mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXB * 3), 3);
      if (!mesh.geometry.getAttribute('aBloodA')) mesh.geometry.setAttribute('aBloodA', new THREE.InstancedBufferAttribute(new Float32Array(MAXB).fill(1), 1));
      for (let i = 0; i < MAXB; i++) mesh.instanceColor.setXYZ(i, BLOOD.base.r, BLOOD.base.g, BLOOD.base.b);
      mat.userData.c01Color = mat.color.getHex(); mat.color.set('#ffffff');
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aBloodA;\nvarying float vBloodA;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBloodA = aBloodA;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBloodA;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a = min(1.0, diffuseColor.a * vBloodA);');
      };
      mat.customProgramCacheKey = () => 'c01blood'; mat.needsUpdate = true;
      this.blood = { seen: 0, born: new Float32Array(MAXB), stack: new Uint8Array(MAXB), ground: new Uint8Array(MAXB), x: new Float32Array(MAXB), z: new Float32Array(MAXB) };
    } else if (!on && this.blood) {
      mat.onBeforeCompile = () => {}; mat.customProgramCacheKey = () => ''; if (mat.userData.c01Color != null) mat.color.setHex(mat.userData.c01Color);
      mesh.instanceColor = null; mat.needsUpdate = true; this.blood = null;
    }
  }
  #bloodStep() {
    const b = this.b, mesh = b.blood, st = this.blood, m = new THREE.Matrix4(), e = m.elements;
    if (mesh.count < st.seen) st.seen = 0;   // 重开局
    for (let i = st.seen; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      st.born[i] = b.t; st.stack[i] = 0; st.x[i] = e[12]; st.z[i] = e[14];
      const ground = e[5] > 0.9; st.ground[i] = ground ? 1 : 0;
      if (ground && this.on.bloodStack) for (let j = 0; j < i; j++) {
        if (!st.ground[j] || Math.hypot(st.x[j] - e[12], st.z[j] - e[14]) > 0.09) continue;
        st.stack[j] = Math.min(4, st.stack[j] + 1); this.stats.stacked++; this.stats.maxStack = Math.max(this.stats.maxStack, st.stack[j]);
      }
      if (this.on.waterBlood && ground && e[13] < 0.06) { const c = b.view.index.cellAt(e[12], e[14]); if (!c || b.world.top(c) === 0) this.#addHaze(e[12], e[14]); }
    }
    st.seen = mesh.count; this.stats.bloodTracked = mesh.count;
    const A = mesh.geometry.getAttribute('aBloodA');
    for (let i = 0; i < mesh.count; i++) {
      const look = bloodLook(b.t - st.born[i], st.stack[i], { aging: this.on.bloodAge, stacking: this.on.bloodStack });
      mesh.instanceColor.setXYZ(i, look.color.r, look.color.g, look.color.b); A.setX(i, look.alpha);
    }
    mesh.instanceColor.needsUpdate = true; A.needsUpdate = true;
  }

  /* ---------------------------------------------- 837027901853810688：整岛地面染色（groundTint） */
  /**
   * 为什么走「独立贴面」而不是改地形材质：solid-base / shrub-* 那一串回归都在断言地面与灌木的
   * 颜色与接缝，直接改 `worldMesh` 的材质色等于把那些断言一起改掉（等于把回归作废）。
   * 贴面是纯叠加层：关掉 flag 时完全不存在（`#buildStain` 只在 flag 打开时建），
   * 且用 MultiplyBlending —— 片子里是 R 不动、G/B 各掉 6.6%/5.3% 的**压色**，不是叠一层粉。
   */
  #buildStain() {
    const b = this.b, w = b.world, L = b.L;
    const pos = [], idx = [];
    let cells = 0;
    for (const c of w.cells) {
      const y = w.top(c) * L;
      if (y <= 0) continue;                       // 只染陆地顶面：海面 514 帧恒 [165,176,178]（r−g 恒 −11）
      if (!c.pts || c.pts.length < 3) continue;   // 三角剖分用扇形，3 边格也一样
      const base = pos.length / 3;
      for (const p of c.pts) pos.push(p.x, y + 0.004, p.z);
      for (let i = 1; i < c.pts.length - 1; i++) idx.push(base, base + i, base + i + 1);
      cells++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, blending: THREE.MultiplyBlending,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2; mesh.frustumCulled = false;
    this.group.add(mesh);
    this.stain = { mesh, cells };
    this.stats.stainCells = cells;
  }

  /** 手动锁进度（0–1），传 null 恢复按时间自动走；测试和定格截图都用它。 */
  setStainProgress(p) {
    this.stainForce = p === null || p === undefined ? null : Math.max(0, Math.min(1, Number(p)));
    return this.stainForce;
  }

  #stainStep() {
    const b = this.b;
    // 起点 = 第一次伤害（屋子被打着 / 已经见血）。片子里染色是在火球炸开的那一帧起步的（f0082→0083）
    if (this.stainT0 == null) {
      const hurt = (b.blood && b.blood.count > 0) || b.houses.some((h) => h.lost || h.burn > 0);
      if (hurt) this.stainT0 = b.t;
    }
    const age = this.stainT0 == null ? 0 : Math.max(0, b.t - this.stainT0);
    const p = this.stainForce == null ? stainProgress(age) : this.stainForce;
    const hex = stainHex(p);
    this.stain.mesh.material.color.setStyle(hex);
    this.stats.stainProgress = +p.toFixed(3);
    this.stats.stainAge = +age.toFixed(2);
    this.stats.stainColor = hex;
  }

  /* ---------------------------------------------- 837027901853810688：烧屋火光 */
  /* ---------------------------------------------- 837027901853810688：失守小屋屋体炭黑 */
  /**
   * 原片 f0082→f0083 一帧之内，小屋**自己**从米白变成近黑多边形，之后 13 s 一直黑（近黑像素 1076→5681，
   * 稳定在 5.5–6.6 k 不再扩大）。所以是屋体顶点色压黑，不是地面贴花 —— 逐帧对照图证同一栋屋的屋脊/附属体。
   */
  #charStep() {
    const b = this.b, mesh = b.view.mesh;
    const col = mesh?.geometry?.attributes?.color, pos = mesh?.geometry?.attributes?.position;
    if (!col || !pos) return;
    // 几何重建后顶点色被重写，旧快照不能再拿去还原
    if (this._charGeo !== mesh.geometry) { this._charGeo = mesh.geometry; this._charSaved = { geometry: mesh.geometry, idx: [], rgb: [] }; this._charDone = new Set(); }
    mesh.updateMatrixWorld();
    for (const h of b.houses) {
      if (!h.lost || this._charDone.has(h)) continue;
      const r = charHouseVerts({ owner:this,color: col, position: pos, matrix: mesh.matrixWorld.elements, cell: h.cell, baseY: b.world.ground(h.cell) * b.L });
      if (!r.count) continue;   // 网格还没建好，下一帧再试
      this._charDone.add(h);
      this._charSaved.idx.push(...r.idx); this._charSaved.rgb.push(...r.rgb);
      this.stats.housesCharred++; this.stats.charredVerts += r.count;
      col.needsUpdate = true;
    }
  }
  #charRestore() {
    const s = this._charSaved; this._charSaved = null; this._charDone = null; this._charGeo = null;
    if (!s || this.b.view.mesh?.geometry !== s.geometry) return;
    const col = s.geometry.attributes.color; if (!col) return;
    restoreChar(col, s,this); col.needsUpdate = true;
  }

  #fireGlow() {
    const b = this.b;
    for (const h of b.houses) {
      if (!h.lost || this.glows.has(h)) continue;
      const c = h.cell, y = b.world.top(c) * b.L;
      const light = new THREE.PointLight('#ff8a2a', 3, 3.2, 1.6); light.position.set(c.cx, y + 0.45, c.cz);
      const dm = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      // 贴地光晕：径向软衰减（中心最亮，边缘归零），不是一张硬边圆片
      dm.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vG;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvG = position.xz;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vG;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat gr = length(vG) / 0.7; diffuseColor.a *= (1.0 - gr) * (1.0 - gr);'); };
      dm.customProgramCacheKey = () => 'c01glow';
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24).rotateX(-Math.PI / 2), dm);
      disc.position.set(c.cx, y + 0.02, c.cz); disc.renderOrder = 4;
      this.group.add(light, disc); this.glows.set(h, { light, disc, seed: c.id * 1.7 }); this.stats.glows++;
    }
    for (const g of this.glows.values()) {
      const f = 0.75 + 0.15 * Math.sin(b.t * 13 + g.seed) + 0.1 * Math.sin(b.t * 31 + g.seed * 2);
      g.light.intensity = 3 * f; g.disc.material.opacity = 0.36 * f; g.light.visible = g.disc.visible = true;
    }
    // 第 102 轮：把火光状态暴露成探针，供 tests/stain-joint-curve-browser.cjs 判「火先起 / 地面后跟」。
    // 不新增渲染行为，只读已有 glows（r101 的缺口：badnorth 拿不到 view.smoke.fireAt）。
    let li = 0, lo = 0;
    for (const g of this.glows.values()) { if (g.light.visible) { li = Math.max(li, g.light.intensity); lo = Math.max(lo, g.disc.material.opacity); } }
    this.fireStats = { t: +b.t.toFixed(3), houses: this.glows.size, lit: li > 0 ? this.glows.size : 0, intensity: +li.toFixed(4), discOpacity: +lo.toFixed(4) };
  }

  /* ---------------------------------------------- 816743289500106752：成列行军 + 方块集结 */
  /**
   * 拐角减速（第 173 轮补）：片子里长蛇在台地拐角处**收拢**——队伍不散开、内圈更慢。
   * 判据两轴：① 转向角（当前朝向 vs 期望方向）② 到下一个导航节点（= 这一段的拐点）的平面距离。
   * 距离拐点越近 = 越在内圈 → 降得越多；直线段（转角 < 0.35）与离拐点远的段完全不降。
   * 返回速度倍率（1 = 原速），同时把逐人读数写进 u.c01SpeedK 供探针取用。
   */
  #cornerSpeed(u, plan, tx, tz) {
    const dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz);
    if (d <= 1e-4) return 1;
    const hx = Math.sin(u.face ?? 0), hz = Math.cos(u.face ?? 0);
    const turn = Math.acos(Math.max(-1, Math.min(1, (hx * dx + hz * dz) / d)));
    const node = plan?.next, to = node ? Math.hypot(node.x - u.x, node.z - u.z) : Infinity;
    u.c01Turn = turn; u.c01Pivot = to;
    if (turn < CORNER_SLOW.turn || to > CORNER_SLOW.near) { u.c01SpeedK = 1; return 1; }
    const sharp = Math.min(1, turn / (Math.PI / 2));
    const prox = 1 - Math.min(1, to / CORNER_SLOW.near);
    const k = 1 - CORNER_SLOW.drop * sharp * (0.35 + 0.65 * prox);
    u.c01SpeedK = k;
    this.stats.cornerTurns++;
    if (k < 0.995) { this.stats.cornerSlows++; this.stats.minSpeedK = Math.min(this.stats.minSpeedK, k); }
    return k;
  }
  /** 只读探针：逐人列队读数（rank / 等待 / 速度倍率 / 转角 / 离拐点 / 落位格）。 */
  columnStats() {
    const b = this.b, sq = b.squads.find((s) => s.c01) || null;
    if (!sq) return null;
    const c = sq.c01, alive = c.order.filter((v) => !v.dead && !v.onBoat && !v.fall);
    return {
      squad: sq.id, n: alive.length, spacing: c.spacing, goal: sq.goal ? [sq.goal.cx, sq.goal.cz] : null,
      // 第 174 轮：缩步重试记账（battle.#step 的只读计数）—— crawls = 靠缩步才走动的帧数，stuck = 缩到 1/16 仍被拒的帧数
      crawls: b.crawlSteps ?? 0, stuck: b.stuckSteps ?? 0, slides: b.slideSteps ?? 0,
      men: alive.map((u, r) => {
        const s = blockSlot(r, alive.length, c.fx, c.fz);
        return {
          r, x: u.x, z: u.z, y: u.y, floor: u.navFloor, face: u.face ?? 0,
          waiting: c.waiting?.get(u) ?? false, speedK: u.c01SpeedK ?? 1,
          turn: u.c01Turn ?? 0, pivot: u.c01Pivot ?? null,
          slot: [sq.goal.cx + s.x, sq.goal.cz + s.z], cols: s.cols, rows: s.rows,
        };
      }),
    };
  }
  #orderColumn(sq, picked) {
    const b = this.b, men = sq.members.filter((u) => !u.dead && !u.onBoat && !u.fall);
    if (!men.length) return;
    const lead = men[0], plan = b.navigation.plan(lead, picked.cell, picked.floor);
    const dist = (u) => { const n = b.navigation.unitNode(u); const d = n && plan ? plan.tree.distance[n.id] : Infinity; return (Number.isFinite(d) ? d : 1e6) + Math.hypot(u.x - picked.cell.cx, u.z - picked.cell.cz) * 0.01; };
    const order = men.slice().sort((p, q) => dist(p) - dist(q));
    const [cx, cz] = [men.reduce((s, u) => s + u.x, 0) / men.length, men.reduce((s, u) => s + u.z, 0) / men.length];
    let fx = picked.cell.cx - cx, fz = picked.cell.cz - cz; if (Math.hypot(fx, fz) < 1e-3) { fx = 0; fz = 1; }
    sq.c01 = { order, fx, fz, spacing: 0.15, last: new Map(order.map((u) => [u, [u.x, u.z]])), moved: new Map() };
  }
  /** battle 的行军循环里调用：返回（可能修改过的）目标点 + 速度倍率（拐角减速）。 */
  steer(u, plan, tx, tz, near) {
    if (!this.on.column || u.team !== 0 || !u.squad) return { tx, tz, speed: 1 };
    const sq = u.squad, c = sq.c01 ?? (sq.c01 = { order: sq.members.slice(), fx: 0, fz: 1, spacing: 0.15, last: new Map(), moved: new Map() });
    const alive = c.order.filter((v) => !v.dead && !v.onBoat && !v.fall), r = alive.indexOf(u);
    if (r < 0) return { tx, tz, speed: 1 };
    // 记录每人这一帧走了没有（等人的判据：前一个在动、且离我不到 spacing）
    const prev = c.last.get(u); c.moved.set(u, prev ? Math.hypot(u.x - prev[0], u.z - prev[1]) : 0); c.last.set(u, [u.x, u.z]);
    if (near) {
      const goal = plan.from.cell, s = blockSlot(r, alive.length, c.fx, c.fz);
      this.stats.slotted++;
      return { tx: goal.cx + s.x, tz: goal.cz + s.z, speed: 1 };
    }
    // 路线距离 = 下一节点到目标的树距离 + 自己到下一节点的直线（同一棵树，前后两人可比）
    const routeDist = (v, pl) => pl ? pl.tree.distance[pl.next.id] + Math.hypot(v.x - pl.next.x, v.z - pl.next.z) : Infinity;
    const mine = routeDist(u, plan); c.dist ??= new Map(); c.dist.set(u, mine);
    c.waiting ??= new Map(); c.waiting.set(u, false);
    if (r > 0) {
      const ahead = alive[r - 1], ad = c.dist.get(ahead) ?? routeDist(ahead, this.b.navigation.plan(ahead, sq.goal, sq.goalFloor ?? this.b.world.top(sq.goal)));
      const busy = (c.moved.get(ahead) ?? 0) > 1e-4 || c.waiting.get(ahead);   // 前一个在走或在排队；卡住 / 打起来了就不等
      if (busy && mine - ad < c.spacing) { this.stats.waits++; c.waiting.set(u, true); return { tx: u.x, tz: u.z, speed: 0 }; }
    }
    return { tx, tz, speed: this.#cornerSpeed(u, plan, tx, tz) };
  }

  /* ---------------------------------------------- 995043346778415104：常驻路线预览 */
  #route(sq, picked) {
    const b = this.b, lead = sq.members.find((u) => !u.dead && !u.onBoat);
    const plan = lead ? b.navigation.plan(lead, picked.cell, picked.floor) : null;
    if (!plan) return;
    const graph = b.navigation.graph, pts = [[lead.x, lead.y + 0.05, lead.z]];
    for (let id = plan.from.id, k = 0; id >= 0 && k < graph.nodes.length; k++) { const a = graph.nodes[id]; pts.push([a.x, a.floor * b.L + 0.05, a.z]); const nx = plan.tree.next[id]; if (nx < 0) break; id = nx; }
    const r = buildRoutePreview(pts, { spacing: 0.12, radius: 0.3, minStep: b.L * 0.9 });
    this.route = { sq, lead, points: r.points, start: 0 };
    this.stats.routeSamples = r.points.length; this.stats.routeArcs = r.arcs; this.stats.routeCorners = r.corners;
    b.commandPathSamples = r;
    b.path.geometry.setAttribute('position', new THREE.Float32BufferAttribute(r.points.flat(), 3));
    b.pathT = 2.5;
  }
  #routeStep() {
    const b = this.b, R = this.route, u = R.lead;
    if (u.dead || !R.sq.alive) { this.route = null; return; }
    // 小队走过的点逐段消掉：领头人附近（0.18 内）往前滑动起点
    let s = R.start;
    for (let i = s; i < Math.min(R.points.length, s + 12); i++) { const p = R.points[i]; if (Math.hypot(p[0] - u.x, p[2] - u.z) < 0.18) s = i + 1; }
    if (s !== R.start) { R.start = s; this.stats.routeTrimmed = s; b.path.geometry.setAttribute('position', new THREE.Float32BufferAttribute(R.points.slice(s).flat(), 3)); }
    const done = R.start >= R.points.length - 2;
    if (!done) b.pathT = Math.max(b.pathT, 1.2);   // 走完前常驻（不淡出）
    else this.route = null;                          // 走完后交回 battle 的淡出
  }

  /* ---------------------------------------------- 946660607008403456：沿岸泡沫带 + 小花 + 水面血雾 */
  #buildShore() {
    const b = this.b, w = b.world, edges = coastEdges(w), y0 = 0.03;
    const pos = [], out = [], idx = [];
    // 顶点法线 = 相邻海岸边外法线的平均（转角处斜接），带子连续、不在角上交叉成 X
    const vn = new Map(), key = (p) => p.id ?? (p.x.toFixed(4) + ',' + p.z.toFixed(4));
    for (const e of edges) for (const p of [e.a, e.b]) { const k = key(p), v = vn.get(k) ?? { x: 0, z: 0, n: 0 }; v.x += e.nx; v.z += e.nz; v.n++; vn.set(k, v); }
    const nrm = (p) => { const v = vn.get(key(p)), l = Math.hypot(v.x, v.z) || 1, d = v.n > 1 ? Math.max(0.6, l / v.n) : 1; return [v.x / l / d, v.z / l / d]; };
    for (const e of edges) {
      const k = pos.length / 3, off = 0.05, wid = 0.045;
      for (const [p, s] of [[e.a, 0], [e.b, 0], [e.b, 1], [e.a, 1]]) { const [nx, nz] = nrm(p); pos.push(p.x + nx * (off + wid * s), y0, p.z + nz * (off + wid * s)); out.push(nx, nz); }
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aOut', new THREE.Float32BufferAttribute(out, 2)); g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const uT = { value: 0 }; mat.userData.uT = uT;
    mat.onBeforeCompile = (sh) => { sh.uniforms.uT = uT; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aOut;\nuniform float uT;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat br = 0.035 * sin(uT * 1.3 + position.x * 1.7 + position.z * 1.3);\ntransformed.xz += aOut * br;'); };
    mat.customProgramCacheKey = () => 'c01foam';
    this.foam = new THREE.Mesh(g, mat); this.foam.renderOrder = 2; this.foam.frustumCulled = false; this.group.add(this.foam);
    // 碎白点：沿岸带外侧再撒一圈（片子里成串的白泡沫点）
    const rnd = mulberry(w.cells.length * 13 + 7), dots = [];
    for (const e of edges) for (let k = 0; k < 3; k++) { const t = rnd(), d = 0.12 + rnd() * 0.22; dots.push(e.a.x + (e.b.x - e.a.x) * t + e.nx * d, y0, e.a.z + (e.b.z - e.a.z) * t + e.nz * d); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    this.foamDots = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    this.foamDots.frustumCulled = false; this.group.add(this.foamDots);
    this.stats.coast = edges.length; this.stats.foamDots = dots.length / 3;
    this.#buildFlowers();
  }
  /** 岸上小花簇（第 185 轮从 `#buildShore` 里拆出来，独立 `shoreFlowers` 开关）：
   *  平地格（四邻同高、不是小屋）里按种子挑一部分，每簇 4–7 朵**米白 / 浅粉**（原片 0150 的 10× 裁切是成片米白，不是个别点）。
   *  与泡沫带解耦的原因见 C01_DEFAULT_ON 注释：946660607008403456 的水面干净、只有岸上有花。 */
  #buildFlowers() {
    const b = this.b, w = b.world;
    if (this.flowers) { this.group.remove(this.flowers); this.flowers.geometry.dispose(); this.flowers = null; }
    const houses = new Set((w.bnHouses || []).map((c) => c.id)), fp = [], fc = [], cells = [];
    const rnd = mulberry(w.cells.length * 29 + 11);
    const cream = new THREE.Color('#f6efdd'), pink = new THREE.Color('#f2c4cf');
    for (const c of w.cells) {
      const t = w.top(c); if (t < 1 || houses.has(c.id)) continue;   // 北境的台地本身是岩体（isRock），花长在台面上
      if (!c.edgeNeighbors.every((id) => id >= 0 && w.top(w.cells[id]) === t)) continue;
      if (rnd() > 0.22) continue;
      const n = 4 + Math.floor(rnd() * 4), ox = (rnd() - 0.5) * 0.5, oz = (rnd() - 0.5) * 0.5, col = rnd() < 0.7 ? cream : pink;
      const start = fp.length / 3;
      for (let k = 0; k < n; k++) { const x = c.cx + ox + (rnd() - 0.5) * 0.16, z = c.cz + oz + (rnd() - 0.5) * 0.10; fp.push(x, t * b.L + (b.view.visualOffset ? b.view.visualOffset(x, z) : 0) + 0.012, z); fc.push(col.r, col.g, col.b); }
      cells.push({ cell: c.id, top: t, size: n, at: start });
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
    this.flowers = new THREE.Points(fg, new THREE.PointsMaterial({ vertexColors: true, size: 0.05, sizeAttenuation: true, toneMapped: false }));
    this.flowers.frustumCulled = false; this.group.add(this.flowers);
    this.stats.flowers = fp.length / 3; this.stats.flowerClusters = cells.length;
    this.flowerCells = cells;
  }
  /** 只读探针（第 185 轮运行验收用，零渲染改动）：
   *   clusters = 每簇格 + 朵数（应为 4–7）+ 台面高度；land = 全部落点是否都在陆地台面上；
   *   y 偏差 = 落点 y 与「格顶 + 视觉偏移」的差（应为 +0.012）。 */
  flowerProbe() {
    const b = this.b, w = b.world, pos = this.flowers?.geometry.attributes.position.array ?? [];
    const idx = b.view?.index ?? b.index ?? null;
    const cells = (this.flowerCells || []).map((c) => ({ ...c }));
    const sizes = cells.map((c) => c.size);
    let offLand = 0, yOff = 0;
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3], z = pos[i * 3 + 2];
      const cell = idx?.cellAt ? idx.cellAt(x, z) : null;
      if (!cell || w.top(cell) < 1) offLand++;
      const t = cell ? w.top(cell) : 0;
      yOff += Math.abs(pos[i * 3 + 1] - (t * b.L + (b.view.visualOffset ? b.view.visualOffset(x, z) : 0) + 0.012));
    }
    return {
      on: !!this.on.shoreFlowers, visible: !!this.flowers?.visible, points: pos.length / 3, clusters: cells.length,
      sizes: { min: sizes.length ? Math.min(...sizes) : 0, max: sizes.length ? Math.max(...sizes) : 0 },
      cells, offLand, maxYOff: pos.length ? yOff / (pos.length / 3) : 0,
      foamOn: !!this.on.shoreFoam, foamBuilt: !!this.foam,
      colorMix: this.#flowerColorMix(),
    };
  }
  #flowerColorMix() {
    const c = this.flowers?.geometry.attributes.color?.array; if (!c) return null;
    let cream = 0, pink = 0;
    for (let i = 0; i < c.length / 3; i++) { const g = c[i * 3 + 1]; if (g > 0.86) cream++; else pink++; }   // 米白 #f6efdd g=.937 / 浅粉 #f2c4cf g=.769
    const n = c.length / 3 || 1;
    return { cream: cream / n, pink: pink / n };
  }
  #addHaze(x, z) {
    if (this.hazes.length >= 48) this.hazes.shift();
    const near = this.hazes.find((h) => Math.hypot(h.x - x, h.z - z) < 0.25 && h.age < 4);
    if (near) { near.r0 = Math.min(0.9, near.r0 + 0.05); return; }   // 同一片水里接着流血 → 那团血雾更大，不另起
    this.hazes.push({ x, z, age: 0, r0: 0.12, seed: Math.random() * 6 }); this.stats.hazes++;
  }
  #hazeStep(dt) {
    const b = this.b, m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const wind = b.view.atmosphere?.sample ? b.view.atmosphere.sample(0, 0, 0) : { x: 1, z: 0 };
    let n = 0;
    for (const h of this.hazes) {
      h.age += dt; h.x += (wind.x ?? 0) * dt * 0.02; h.z += (wind.z ?? 0) * dt * 0.02;
      const grow = Math.min(1, h.age / 6), r = h.r0 + 0.45 * (1 - (1 - grow) * (1 - grow));
      const a = h.age < 6 ? 1 : Math.max(0, 1 - (h.age - 6) / 8);
      m.compose(p.set(h.x, 0.012, h.z), q.setFromAxisAngle(s.set(0, 1, 0), h.seed), s.set(r, 1, r * 0.75));
      this.hazeMesh.setMatrixAt(n, m); this.hazeA.setX(n, a); n++;
    }
    this.hazes = this.hazes.filter((h) => h.age < 14);
    this.hazeMesh.count = n; this.hazeMesh.instanceMatrix.needsUpdate = true; this.hazeA.needsUpdate = true;
  }
}

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
