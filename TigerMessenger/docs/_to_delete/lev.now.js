// =====================================================================
//  太古巨型浮岛白鲸（The Grand Leviathan Island）
//
//  世界观重构：西芳寺苔庭不再贴地球面，而是整座扎根、承托在
//  一尾在天空中缓缓漂移的太古白鲸脊背上。本模块只产出「鲸体资产」：
//   - 非等比极致拉伸的山岳级流线型躯干（压扁拉长的低面数球体，
//     分段压到 6~11，flatShading 下呈手工积木式大刻面）
//   - 头段两侧各一枚深色太古鲸眼（半嵌贴面，远景读得出「活物」）
//   - 背部横向切平的墨绿苔原地壳层（西芳寺的地基容器）
//   - 后方斜向上 35° 微翘扬起的巨型 Y 字分叉尾鳍，升空后极缓摆尾
//   - 20 枚极扁太古藤壶贴片 + 环绕地壳的「防空灌木围墙」
//   - 平缓呼吸缓动：leviathanGroup 随极低频正弦起伏 + 缓慢漂移
//
//  调用方（scenes/saihojiGarden.js）负责把苔庭组装配到鲸背：
//  见 buildEcoLeviathanIsland 的 opts（basePos/up/forward 锁定栖息位）。
//
//  性能：全部低面数网格 + 描边壳，SwiftShader 无头环境开销可忽略。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { registerLocalLight } from "../render/lighting/localLightRegistry.js";

/**
 * 鲸体配色（主人 2026-09-05 参考座头鲸照片重定）。
 *
 * 上一版按「水彩画」调成了普鲁士蓝 + 青蓝，整头读成一艘蓝色飞艇。
 * 参考照片里的座头鲸其实几乎不含蓝：背面是**近黑的冷炭灰**，腹面是
 * **暖白**，两者之间是一条从下颌后掠的硬边，而不是渐层。所以这里
 * 把彩度整体压掉，只在近黑里留一点点蓝紫倾向（照片的反光色）。
 */
const SKIN_DEEP = 0x23262b; // 背部近黑炭灰（照片主色）
const SKIN_MID = 0x3a4048; // 体侧石板灰
const SKIN_CREST = 0x4e5762; // 背脊极弱提亮（照片几乎无花斑，不要抢戏）
const SKIN_PALE = 0xe8e5dd; // 腹部暖白（不是冷银白）
const SKIN_PLEAT = 0xb0aca3; // 喉腹褶槽阴影（暖灰）
const FIN_PALE = 0xf2efe8; // 鳍肢腹面白
const FIN_DARK = 0x2a2e34; // 鳍肢背面近黑
const FLUKE_DEEP = 0x1d2025; // 尾叶背面近黑（照片里尾叶比体色更深）
/** 眼珠高光与眼灯色：暖琥珀，不是冷白——冷白在近黑的头上会读成一颗塑料珠 */
const EYE_GLOW = 0xffcf8a;
/** 藤壶浅壳色（暖白骨色，不是冰蓝） */
const BARNACLE = 0xd8d3c8;
/** 地壳深苔绿（西芳寺苔庭地基） */
const CRUST = 0x2e7d32;
/** 灌木围墙翠绿 */
const SHRUB = 0x3e8e52;
/** 全场景水墨粗描边厚度（用户锁死） */
const OUTLINE_W = 0.055;
/** 地壳板局部高度：鲸背在此「横向切平」 */
export const LEVIATHAN_PLATE_Y = 6.08;
/** 苔庭压缩比：六景跨度 ~40×23 → ~22×12.6，收进 25×14 地壳板 */
export const LEVIATHAN_GARDEN_SCALE = 0.55;
/** 整鲸（连同背上苔庭）线性缩放：体积观感缩到一半 */
export const LEVIATHAN_SIZE = 0.5;

const _up = new THREE.Vector3(0, 1, 0);

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * 鲸皮顶点色（参考座头鲸照片，确定性无随机）：
 *  - 背面近黑：只留一层极弱的低频起伏读出体积，**不做水彩大斑**——
 *    上一版的三组正弦花斑是这头鲸「像塑料玩具」的主因；
 *  - 背腹分界是一条**硬边**，且越靠头越高（照片里白喉一直包到下颌上方），
 *    不是从背到腹的均匀渐层；
 *  - 喉腹褶（opts.pleats）：下颌到胸鳍之间平行 z 的深槽，是这个物种
 *    最好认的特征，比花斑重要得多。
 * 材质须配 toonMat(0xffffff, { vertexColors: true, flatShading: true })。
 */
function paintWhaleSkin(geometry, { pleats = false, toWorld = null } = {}) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const deep = new THREE.Color(SKIN_DEEP);
  const mid = new THREE.Color(SKIN_MID);
  const pale = new THREE.Color(SKIN_PALE);
  const crest = new THREE.Color(SKIN_CREST);
  const pleat = new THREE.Color(SKIN_PLEAT);
  const c = new THREE.Color();
  // 背腹位置必须按**该处横截面**归一化，不能拿绝对 Y 当尺子：体轴本身是有
  // 起伏的（吻端低、背鳍处高），拿绝对 Y 分层会让白腹的边界在体侧上下乱窜，
  // 渲出来是一块一块的斑，而不是照片里那条顺着体线走的硬边。
  const radiusY = Math.max(
    1e-3,
    Math.max(Math.abs(geometry.boundingBox?.min.y ?? -8), geometry.boundingBox?.max.y ?? 8)
  );
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let tTop;
    let wx = x;
    if (toWorld) {
      wx = toWorld.x(x);
      const sec = whaleSectionAt(wx);
      const scy = (sec.top + sec.bot) * 0.5;
      const shy = Math.max(1e-3, (sec.top - sec.bot) * 0.5);
      tTop = THREE.MathUtils.clamp((toWorld.y(y) - scy) / shy, -1, 1);
    } else {
      tTop = THREE.MathUtils.clamp(y / radiusY, -1, 1); // -1 腹 → 1 背
    }
    // 极弱低频起伏：只够让大刻面之间有明暗差，不形成可辨认的斑块
    const grain = 0.5 + 0.5 * Math.sin(x * 0.31 + z * 0.19 + 1.3);
    c.copy(deep).lerp(mid, grain * 0.42);
    c.lerp(crest, THREE.MathUtils.clamp(tTop, 0, 1) * 0.16); // 背脊只提一点点
    // 背腹硬边：越靠头分界线越高（照片里白喉一直包到下颌上方）
    const seam = 0.24 - 0.0105 * wx;
    const bellyMix = THREE.MathUtils.smoothstep(-tTop, seam, seam + 0.14);
    c.lerp(pale, bellyMix);
    // 喉腹褶：下颌 → 胸鳍之间的平行深槽
    if (bellyMix > 0.18 && wx > 0) {
      const groove = Math.sin(z * 2.35 + x * 0.42);
      const fade = pleats ? THREE.MathUtils.clamp(wx / 8, 0, 1) : 0;
      if (groove > -0.1) {
        c.lerp(pleat, THREE.MathUtils.clamp((groove + 0.1) * 0.62, 0, 1) * bellyMix * fade);
      }
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

/**
 * 低面数「鳍叶」放样器。
 *
 * 上一版的胸鳍与尾鳍都是 `ConeGeometry`——锥体只有一个尖，做出来是两支
 * 飞镖尾翼，不是鳍。真正的鳍是一张**扁叶**：有前缘、有后缘、中间厚两边
 * 薄、并且整片向后掠。这里给一张展向控制表 `[span, xLead, xTrail]`，
 * 沿展向放样出上下两个面：
 *   - span 沿 ±Z（展向，side 决定左右镜像）
 *   - 弦沿 X（+X 前缘 / −X 后缘）
 *   - 厚度沿 Y，按 sin(πu) 分布 → 前后缘自然收成刃口，不必额外封边
 * 背面深、腹面白直接写进顶点色（座头鲸的鳍腹面与尾叶腹面都是白的）。
 */
function makeFinBlade(table, {
  side = 1,
  thickRoot = 0.6,
  thickTip = 0.12,
  chordSteps = 5,
  topColor = FIN_DARK,
  bottomColor = FIN_PALE,
  edgeWhite = 0,
} = {}) {
  const NS = table.length;
  const NC = Math.max(3, chordSteps);
  const positions = [];
  const colors = [];
  const indices = [];
  const top = new THREE.Color(topColor);
  const bot = new THREE.Color(bottomColor);
  const white = new THREE.Color(FIN_PALE);
  const c = new THREE.Color();
  const vid = (surface, i, j) => surface * NS * NC + i * NC + j;
  for (let surface = 0; surface < 2; surface++) {
    const sign = surface === 0 ? 1 : -1;
    for (let i = 0; i < NS; i++) {
      const [sp, xl, xt] = table[i];
      const t = NS > 1 ? i / (NS - 1) : 0;
      const th = THREE.MathUtils.lerp(thickRoot, thickTip, t * (0.4 + 0.6 * t));
      for (let j = 0; j < NC; j++) {
        const u = j / (NC - 1);
        // 前后缘保留 22% 厚度当刃口：收到 0 会让上下两面重合，
        // 再叠上 addOutline 的背面壳，整片鳍就渲成一团抖动墨点。
        positions.push(
          THREE.MathUtils.lerp(xl, xt, u),
          sign * th * (0.22 + 0.78 * Math.pow(Math.sin(Math.PI * u), 0.65)),
          sp * side
        );
        c.copy(sign > 0 ? top : bot);
        if (edgeWhite > 0 && sign > 0) {
          c.lerp(white, Math.max(0, 1 - u / edgeWhite) * 0.8);
        }
        colors.push(c.r, c.g, c.b);
      }
    }
  }
  for (let surface = 0; surface < 2; surface++) {
    for (let i = 0; i < NS - 1; i++) {
      for (let j = 0; j < NC - 1; j++) {
        const a = vid(surface, i, j);
        const b = vid(surface, i + 1, j);
        const d = vid(surface, i, j + 1);
        const e = vid(surface, i + 1, j + 1);
        // 上下两面缠绕相反，法线才都朝外；side 镜像会再翻一次手性。
        // 手推过：展向 di=(0,0,Δsp·side)、弦向 dj=(Δx,0,0) 且 Δx<0，
        // 所以 di×dj 的 Y 分量 = Δsp·side·Δx —— side>0 时为负，上表面
        // 必须用 (a,d,b) 才朝上。缠反了 toonMat 的 FrontSide 会被整片剔掉，
        // 只剩 addOutline 的 BackSide 墨壳，鳍就渲成一团抖动黑斑。
        if ((surface === 0) !== (side > 0)) indices.push(a, b, d, d, b, e);
        else indices.push(a, d, b, b, d, e);
      }
    }
  }
  // 展向末排上下缝合，鳍尖不留破口
  for (let j = 0; j < NC - 1; j++) {
    const a = vid(0, NS - 1, j);
    const b = vid(0, NS - 1, j + 1);
    const d = vid(1, NS - 1, j);
    const e = vid(1, NS - 1, j + 1);
    if (side > 0) indices.push(a, b, d, d, b, e);
    else indices.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** 尾叶单片轮廓：根部窄（让中央缺刻读出来）→ 中段最宽 → 尖端后掠 */
const FLUKE_LOBE = Object.freeze([
  [0.25, 2.30, -0.55], // 根部贴中线且弦宽 → 两片连成一张月牙，缺刻只是浅 V
  [2.40, 2.40, -3.30],
  [5.00, 1.95, -4.65],
  [7.40, 1.05, -4.90],
  [9.60, -0.20, -4.25],
  [11.50, -2.10, -3.05], // 尖端后掠
]);

/** 胸鳍轮廓：座头鲸的鳍肢接近体长 1/3，细长、前缘略鼓、尖端后掠 */
const PEC_BLADE = Object.freeze([
  [0.0, 2.55, -2.45],
  [3.6, 2.85, -2.10],
  [7.4, 2.50, -1.80],
  [11.0, 1.90, -1.65],
  [14.0, 1.05, -1.65],
  [16.6, -0.40, -1.30],
]);

/** 背鳍轮廓：小而后钩 */
const DORSAL_BLADE = Object.freeze([
  [0.0, 1.5, -1.5],
  [0.9, 1.2, -1.95],
  [1.8, 0.5, -2.1],
  [2.6, -0.6, -1.9],
  [3.2, -1.7, -1.4],
]);


/**
 * 鲸体横截面站位表 —— 主人 2026-09-05 给的正交线稿（顶视 + 侧视）逐站量出来的。
 *
 * 为什么必须有这张表：上一版鲸体是「躯干球 + 头球 + 吻球 + 臀球 + 三节圆柱尾柄」
 * 六件拼的，每件各有各的轮廓函数，接缝处必然出台阶——主人先后两次点名
 * 「腰部突然变窄」「头到腰到尾应该是很平顺的」，根子都在这。拼件是修不好的，
 * 补一件、挪一件只会把台阶挪个地方，所以整条体线改成**一张放样壳**：
 * 一组横截面沿体轴放样，中间不存在接缝。
 *
 * 每行 = `[世界 X, 背线 Y, 腹线 Y, 半宽 Z]`，X 从吻端 +43 一路到尾鳍缺刻 −51。
 *  - 横向严格按线稿比例：最大半宽 / 体长 = 17.6 / 94 ≈ 0.19（也正是
 *    `saihojiPhalanx.js` 的 `ROPE_HALF` 锁死的 36 / 17.6，两边对得上）。
 *  - 纵向做了 1.24× 夸张：线稿的体高换算到世界只有 ±8.4，而这头鲸背上要托
 *    一块 Y=6.08 的地壳板（`LEVIATHAN_PLATE_Y`），压不下去。
 */
const WHALE_SECTIONS = Object.freeze([
  //  世界X    背线Y    腹线Y    半宽Z
  [43.0, -6.50, -8.30, 1.60], // 吻端
  [37.6, -3.45, -12.02, 7.80],
  [31.6, -1.37, -14.47, 12.10],
  [24.7, 0.47, -15.69, 15.50], // 眼 / 胸鳍前
  [16.8, 2.67, -16.30, 17.20],
  [8.9, 4.26, -16.30, 17.60], // 最厚处
  [1.9, 5.12, -15.69, 17.00],
  [-8.0, 5.73, -14.72, 15.30],
  [-17.8, 6.10, -13.00, 12.30], // 背鳍
  [-27.8, 3.90, -10.80, 8.80],
  [-35.7, 0.22, -9.33, 5.20],
  [-42.6, -3.45, -8.60, 3.00], // 尾柄：侧扁，横向收得比纵向快
  [-47.5, -5.29, -8.34, 1.90],
  [-51.0, -6.50, -8.09, 1.30], // 尾鳍缺刻
]);

/** Catmull-Rom（端点夹持）：站位之间要 C1 连续，用线性会在每一站留折角 */
function _cr(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * 取体轴 X 处的横截面 `{ top, bot, hz }`（世界坐标）。
 * 背部在地壳板下方会被「横向切平」抬到板面高度——这是设定里那块苔庭台地，
 * 不是几何凑数；过渡带 |X| 10.5→19 用 smoothstep，不留硬边。
 */
function whaleSectionAt(x) {
  const S = WHALE_SECTIONS;
  const n = S.length;
  let out;
  if (x >= S[0][0]) out = { top: S[0][1], bot: S[0][2], hz: S[0][3] };
  else if (x <= S[n - 1][0]) out = { top: S[n - 1][1], bot: S[n - 1][2], hz: S[n - 1][3] };
  else {
    let i = 0;
    while (i < n - 2 && x < S[i + 1][0]) i++;
    const a = S[Math.max(0, i - 1)];
    const b = S[i];
    const c = S[i + 1];
    const d = S[Math.min(n - 1, i + 2)];
    const t = (b[0] - x) / (b[0] - c[0]);
    out = {
      top: _cr(a[1], b[1], c[1], d[1], t),
      bot: _cr(a[2], b[2], c[2], d[2], t),
      hz: Math.max(0.05, _cr(a[3], b[3], c[3], d[3], t)),
    };
  }
  const flat = 1 - THREE.MathUtils.smoothstep(Math.abs(x), 10.5, 19.0);
  if (flat > 0) out.top = THREE.MathUtils.lerp(out.top, Math.max(out.top, LEVIATHAN_PLATE_Y + 0.07), flat);
  if (out.bot > out.top - 0.1) out.bot = out.top - 0.1;
  return out;
}

/**
 * 沿站位表放样一段壳体。返回的是**局部坐标**：世界 = 局部 × scale + origin。
 * 缠绕方向不靠手推——建完取一张面的法线与它的外向径向量点乘，为负就整体翻转。
 * （上一轮鳍叶就是缠反了，`FrontSide` 被整片剔掉、只剩描边墨壳，渲成一团黑斑。）
 */
function buildWhaleHull({
  fromX, toX, rings = 26, radial = 12, scale, originX = 0, originY = 0,
  /** 可选：按体轴 X 缩放该处截面半径。用来让尾柄段的前几环「缩进」躯干里 */
  radiusMul = null,
}) {
  const pos = [];
  const idx = [];
  const sx = scale?.x ?? 1;
  const sy = scale?.y ?? 1;
  const sz = scale?.z ?? 1;
  const put = (x, wy, wz) => pos.push((x - originX) / sx, (wy - originY) / sy, wz / sz);
  for (let i = 0; i <= rings; i++) {
    const x = THREE.MathUtils.lerp(fromX, toX, i / rings);
    const sec = whaleSectionAt(x);
    const cy = (sec.top + sec.bot) * 0.5;
    const k = radiusMul ? radiusMul(x) : 1;
    const hy = Math.max(0.05, (sec.top - sec.bot) * 0.5) * k;
    const hz = sec.hz * k;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      put(x, cy + hy * Math.sin(a), hz * Math.cos(a));
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      const a = i * radial + j;
      const b = i * radial + j2;
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + j2;
      idx.push(a, c, b, b, c, d);
    }
  }
  // 两端封口：尾根一端会被下一段壳盖住，但不封口的话尾巴一摆就露出内壁
  const capAt = (x, ringBase) => {
    const sec = whaleSectionAt(x);
    const cy = (sec.top + sec.bot) * 0.5;
    const center = pos.length / 3;
    put(x, cy, 0);
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      idx.push(center, ringBase + j, ringBase + j2);
    }
  };
  capAt(fromX, 0);
  capAt(toX, rings * radial);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // 自动定向：拿第一张面判一次
  {
    const p = g.attributes.position;
    const i0 = idx[0];
    const i1 = idx[1];
    const i2 = idx[2];
    const v = (k) => new THREE.Vector3(p.getX(k), p.getY(k), p.getZ(k));
    const A = v(i0);
    const nrm = new THREE.Vector3().subVectors(v(i1), A).cross(new THREE.Vector3().subVectors(v(i2), A));
    // 该面所在环的截面中心（局部）
    const midX = A.x;
    const sec = whaleSectionAt(midX * sx + originX);
    const cyLocal = ((sec.top + sec.bot) * 0.5 - originY) / sy;
    const radialDir = new THREE.Vector3(0, A.y - cyLocal, A.z);
    if (nrm.dot(radialDir) < 0) {
      for (let k = 0; k < idx.length; k += 3) {
        const t = idx[k + 1];
        idx[k + 1] = idx[k + 2];
        idx[k + 2] = t;
      }
      g.setIndex(idx);
    }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * 鲸体纵剖轮廓（旧）：现在只剩「升空落雨」那段用它把水滴出生点随体形内收，
 * 体形本身已改由 `WHALE_SECTIONS` + `buildWhaleHull` 决定。
 * X 为世界体轴坐标（吻端约 +36 / 尾端约 -36）；返回该处 y/z 半径缩放。
 * 躯干/头/吻/臀段几何与藤壶、落雨出生点共用，保证贴件不脱体。
 */
function whaleProfile(X) {
  const rear = THREE.MathUtils.smoothstep(-X, 6, 30);
  const fore = THREE.MathUtils.smoothstep(X, 16, 34);
  // 2026-09-05：后段收细幅度加大（0.40/0.30 → 0.55/0.52）。原值让躯干
  // 一路粗到尾柄，侧面读成飞艇；真鲸从背鳍往后是明显的锥收。
  return { sy: 1 - 0.55 * rear, sz: 1 - 0.52 * rear - 0.16 * fore };
}


// 西芳寺苔庭周边不是一块矩形草皮：用 Oskar Stålberg 式的低面数、
// 模块化轮廓表达「苔台 → 湿润斜坡 → 深色地脚」三层地貌。每一层仍
// 保持确定性，截图、寻路和战斗回放都能得到同一块地形。
const MOSS_TERRAIN_TOP = Object.freeze([0x477f58, 0x548c60, 0x3e704f, 0x5c9767]);
const MOSS_TERRAIN_SLOPE = Object.freeze([0x345b43, 0x3e704f, 0x2f5d41, 0x477f58]);
const MOSS_TERRAIN_BASE = Object.freeze([0x20392f, 0x2b4838, 0x344e3e, 0x263f34]);

function makeMossContour(rnd, rx, rz, count, phase, jitter) {
  const contour = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    // 椭圆是轮廓骨架，二次低频扰动让边缘像手工拼出的自然苔台，
    // 而不是带有明显 CSS/PlaneGeometry 直角的人工平台。
    const profile =
      1 +
      Math.sin(a * 3 + phase * 1.7) * 0.045 +
      Math.cos(a * 5 - phase * 0.8) * 0.028 +
      (rnd() - 0.5) * jitter;
    contour.push({
      x: Math.cos(a) * rx * profile,
      y: 0,
      z: Math.sin(a) * rz * profile,
    });
  }
  return contour;
}

function pushTerrainTriangle(positions, colors, a, b, c, color) {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const tint = new THREE.Color(color);
  for (let i = 0; i < 3; i++) colors.push(tint.r, tint.g, tint.b);
}

function buildMossTerrainTopography(rnd) {
  const count = 18;
  const layers = [
    { rx: 14.25, rz: 7.65, y: -1.75, jitter: 0.12, palette: MOSS_TERRAIN_BASE },
    { rx: 14.0, rz: 7.55, y: -1.28, jitter: 0.1, palette: MOSS_TERRAIN_BASE },
    { rx: 13.35, rz: 7.18, y: -0.78, jitter: 0.085, palette: MOSS_TERRAIN_SLOPE },
    { rx: 12.55, rz: 6.82, y: -0.28, jitter: 0.07, palette: MOSS_TERRAIN_SLOPE },
    { rx: 11.75, rz: 6.38, y: 0.02, jitter: 0.055, palette: MOSS_TERRAIN_TOP },
  ];
  const phase = rnd() * Math.PI * 2;
  const contours = layers.map((layer, i) => {
    const ring = makeMossContour(rnd, layer.rx, layer.rz, count, phase, layer.jitter);
    for (const point of ring) point.y = layer.y + (i === layers.length - 1 ? rnd() * 0.035 : 0);
    return ring;
  });

  const positions = [];
  const colors = [];
  const center = { x: 0, y: 0.055, z: 0 };
  const top = contours.length - 1;
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    pushTerrainTriangle(
      positions,
      colors,
      center,
      contours[top][next],
      contours[top][i],
      layers[top].palette[(i + Math.floor(rnd() * 2)) % layers[top].palette.length]
    );
  }
  for (let layer = 0; layer < contours.length - 1; layer++) {
    const lower = contours[layer];
    const upper = contours[layer + 1];
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const palette = layers[layer].palette;
      const c0 = palette[(i + layer) % palette.length];
      const c1 = palette[(i + layer + 1) % palette.length];
      pushTerrainTriangle(positions, colors, lower[i], upper[i], upper[next], c0);
      pushTerrainTriangle(positions, colors, lower[i], upper[next], lower[next], c1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geometry,
    toonMat(0xffffff, {
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
    })
  );
  terrain.name = "leviathan-terrain-topography";
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  addOutline(terrain, OUTLINE_W * 0.9, 0x1b2b24, 0.035);
  terrain.userData.surfaceTopY = 0.055;
  terrain.userData.layerCount = layers.length;
  terrain.userData.contour = contours[top].map(({ x, y, z }) => ({ x, y, z }));
  // 保留旧地壳板的尺寸元数据，调试器/存档工具仍可识别原来的
  // 25×14 设计包络；实际可见轮廓由上面的五层等高线提供。
  geometry.parameters = { width: 25.0, height: 14.0 };
  return { terrain, topContour: contours[top] };
}

function addMossBed(parent, rnd, x, z, rx, rz, y, color, index) {
  const count = 9;
  const contour = makeMossContour(rnd, rx, rz, count, rnd() * Math.PI * 2, 0.18);
  const positions = [x, y, z];
  const indices = [];
  for (const point of contour) positions.push(x + point.x, y + point.y, z + point.z);
  for (let i = 0; i < count; i++) indices.push(0, i + 1, ((i + 1) % count) + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const bed = new THREE.Mesh(
    geometry,
    toonMat(color, { flatShading: true, side: THREE.DoubleSide })
  );
  bed.name = `leviathan-moss-bed-${index}`;
  bed.receiveShadow = true;
  parent.add(bed);
  return bed;
}

/**
 * 构建太古巨型浮岛白鲸资产（含呼吸缓动 + 藏地/升空两态）。
 *
 * 藏地态（minR）：整头鲸沉入星球地下，只有背部苔原地壳与苔庭露出
 * 地表——「平时只见苔庭」；升空态（maxR）：扫描灯艇掠过时整鲸升空。
 * 两态之间由 setAnchorRadius() 平滑过渡；尾柄/尾鳍随升空微延迟地
 * 从「贴地收起」到「斜向上 35° 扬起」。
 *
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.basePos] 栖息锚点（世界位）。缺省原点。
 * @param {THREE.Vector3} [opts.up] 鲸体上方（径向朝外）。缺省 +Y。
 * @param {THREE.Vector3} [opts.forward] 鲸头朝向（局部 +X）。缺省 +X。
 * @param {number} [opts.minR] 藏地锚点半径（鲸身全沉地下；默认 = basePos 长度）
 * @param {number} [opts.maxR] 升空锚点半径（默认 = basePos 长度）
 * @param {number} [opts.plateWorldLift] 藏地时苔庭岛留驻的地表径向高度
 *   （默认 = basePos 长度 + 地壳板高）——鲸沉入地下时岛面不随之下陷
 * @param {number} [opts.groundRadius] 星球地表半径（默认 = minR）——
 *   升空落雨的水滴坠到地表高度即隐
 * @param {number} [opts.seed]
 * @returns {{ group: THREE.Group, island: THREE.Group,
 *             update: (dt:number, t:number) => void,
 *             setAnchorRadius: (r:number) => void }}
 */
export function buildEcoLeviathanIsland(opts = {}) {
  const rnd = lcg(opts.seed ?? 9901);
  const upN = (opts.up || new THREE.Vector3(0, 1, 0)).clone().normalize();
  const fwdN = (opts.forward || new THREE.Vector3(1, 0, 0)).clone();
  fwdN.addScaledVector(upN, -fwdN.dot(upN));
  if (fwdN.lengthSq() < 1e-8) {
    fwdN.set(0, 0, 1).addScaledVector(upN, -upN.z);
    if (fwdN.lengthSq() < 1e-8) fwdN.set(1, 0, 0).addScaledVector(upN, -upN.x);
  }
  fwdN.normalize();
  const rightN = new THREE.Vector3().crossVectors(fwdN, upN).normalize();
  fwdN.crossVectors(upN, rightN).normalize();
  const basePos = opts.basePos ? opts.basePos.clone() : new THREE.Vector3();
  const minR = Number.isFinite(opts.minR) ? opts.minR : basePos.length();
  const maxR = Number.isFinite(opts.maxR) ? opts.maxR : basePos.length();
  let anchorR = THREE.MathUtils.clamp(basePos.length(), minR, maxR);

  const group = new THREE.Group();
  group.name = "leviathanGroup";

  // 组姿态：局部 +X=鲸头 / +Y=背脊上方 / +Z=右舷。
  const _basis = new THREE.Matrix4().makeBasis(fwdN, upN, rightN);
  group.quaternion.setFromRotationMatrix(_basis);
  const poseQ = group.quaternion.clone();

  // ---------- 1. 主躯干：非等比极致拉伸的山岳巨鲸 ----------
  // SphereGeometry(8,11,8) × (4.5, 1.3, 2.2)：总长 72（玩家 35~40 倍），
  // 前粗后尖的流线由「球体拉伸 + 尾柄收细 + 尾鳍」三段共同完成；
  // 躯干整体下沉，使背部最高点恰好在 Y=6——地壳板在此横向切平封顶。
  // 分段数刻意压低（参考低多边形样例的 6~11 分段）：flatShading 下
  // 大块刻面让巨鲸读出「手工积木」感，而不是一颗光滑的光蛋。
  {
    // 一张放样壳从吻端一路走到尾柄枢纽（世界 X +43 → −31.2），
    // 中间没有任何接缝。躯干整体下沉，使背部最高点落在地壳板高度。
    const BODY_SCALE = new THREE.Vector3(4.5, 1.3, 2.2); // 锁死（test_leviathan 断言）
    const BODY_Y0 = 6 - 8 * 1.3; // = −4.4，背顶 +6.0
    const bodyGeo = buildWhaleHull({
      fromX: 43.0,
      // 比尾柄枢纽（−31.2）再往后多伸 2.8：接口要**互相埋进去**，不能对接。
      // 对接的话尾巴一抬（tailRoot.rotation.z）就把两段壳掰开一道楔形缝，
      // 加上两端封口盖与各自的描边壳，看上去就是尾巴断了——主人 2026-09-05
      // 「鲸鱼尾还真有断裂口」。
      toX: -34.0,
      rings: 30,
      radial: 12,
      scale: BODY_SCALE,
      originY: BODY_Y0,
    });
    paintWhaleSkin(bodyGeo, {
      pleats: true,
      toWorld: { x: (lx) => lx * BODY_SCALE.x, y: (ly) => ly * BODY_SCALE.y + BODY_Y0 },
    });
    const body = new THREE.Mesh(
      bodyGeo,
      toonMat(0xffffff, { vertexColors: true, flatShading: true })
    );
    body.name = "leviathan-body";
    body.scale.copy(BODY_SCALE);
    body.position.y = BODY_Y0;
    body.castShadow = true;
    body.receiveShadow = true;
    addOutline(body, OUTLINE_W);
    group.add(body);

    // 头 / 吻 / 臀：几何已并进壳体，这三个名字保留为**定位空节点**——
    // 贴件（结节、眼、藤壶）与 test_leviathan 的「尾柄枢纽必须插在臀段内部」
    // 都按它们取参考系。留空节点比留三颗看不见的球干净。
    const anchor = (name, x, y, sx) => {
      const a = new THREE.Object3D();
      a.name = name;
      a.position.set(x, y, 0);
      a.scale.setScalar(sx);
      group.add(a);
      return a;
    };
    anchor("leviathan-head", 24.5, -2.15, 1.55);
    anchor("leviathan-snout", 33.2, -4.85, 1.28);
    anchor("leviathan-rump", -24.2, -4.15, 1.62);

    // 吻背结节（座头鲸 tubercle）：沿吻背两排小丘贴在壳面上
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = 28.0 + i * 3.1;
        const sec = whaleSectionAt(x);
        const cy = (sec.top + sec.bot) * 0.5;
        const hy = (sec.top - sec.bot) * 0.5;
        const phi = Math.PI / 2 - (0.34 + 0.07 * i); // 从背脊往体侧铺开一点
        const zz = sec.hz * Math.cos(phi) * side;
        const yy = cy + hy * Math.sin(phi);
        const tub = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 5, 4),
          toonMat(SKIN_MID, { flatShading: true })
        );
        tub.name = `leviathan-tubercle-${side < 0 ? "L" : "R"}-${i}`;
        tub.position.set(x, yy, zz);
        tub.scale.set(1, 0.72, 1);
        addOutline(tub, OUTLINE_W * 0.6);
        group.add(tub);
      }
    }

    // 背鳍（座头鲸的小钩状背鳍）：脊线上、地壳板后方
    {
      const dorsal = new THREE.Mesh(
        makeFinBlade(DORSAL_BLADE, {
          side: 1, thickRoot: 0.95, thickTip: 0.26,
          topColor: SKIN_DEEP, bottomColor: SKIN_MID,
        }),
        toonMat(0xffffff, { vertexColors: true, flatShading: true })
      );
      dorsal.name = "leviathan-dorsal";
      dorsal.scale.set(1.25, 1, 1.25);
      dorsal.position.set(-16.5, whaleSectionAt(-16.5).top - 0.25, 0);
      dorsal.rotation.x = -Math.PI / 2; // 展向 +Z → +Y（立起来），厚度落在 ±Z
      dorsal.castShadow = true;
      addOutline(dorsal, OUTLINE_W * 0.34);
      group.add(dorsal);
    }

    // 太古鲸眼（主人 2026-09-05 加需求）：**会睁会闭**，眼珠里有光。
    //
    // 结构（每侧一组，挂在 eyeRoot 下，动画只动这一组）：
    //   眼球（近黑压扁球） → 眼珠高光（暖琥珀小球，MeshBasicMaterial 不吃光）
    //   → 上下眼睑（肤色压扁球，沿 Y 相向合拢，合上时把眼球整个盖住）
    //   → 眼灯（PointLight，走 localLightRegistry 参与 K4 预算，不是野生灯）
    //
    // 眼睑用「两片相向合拢」而不是「一片缩放」：巨物的眼要有上下皮的厚度感，
    // 单片缩放会读成一张贴纸在闪。
    const eyes = [];
    for (const side of [-1, 1]) {
      const sec = whaleSectionAt(27.5);
      const cy = (sec.top + sec.bot) * 0.5;
      const hy = (sec.top - sec.bot) * 0.5;
      const phi = -0.18;
      const ex = 27.5;
      const ey = cy + hy * Math.sin(phi);
      const ez = side * sec.hz * Math.cos(phi) * 0.97;
      const tag = side < 0 ? "L" : "R";

      const eyeRoot = new THREE.Group();
      eyeRoot.name = `leviathan-eye-root-${tag}`;
      eyeRoot.position.set(ex, ey, ez);
      group.add(eyeRoot);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 6, 5),
        toonMat(0x101215, { flatShading: true })
      );
      eye.name = `leviathan-eye-${tag}`; // 名字不变：test_leviathan / 外部按名取
      eye.scale.set(1, 1, 0.55); // 压扁贴面
      addOutline(eye, OUTLINE_W);
      eyeRoot.add(eye);

      // 眼珠高光：不吃光的小亮点，偏上外侧——这是「活物」的关键一笔
      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 5, 4),
        new THREE.MeshBasicMaterial({ color: EYE_GLOW })
      );
      shine.name = `leviathan-eye-shine-${tag}`;
      shine.position.set(0.16, 0.24, side * 0.42);
      shine.scale.set(1, 1, 0.6);
      shine.userData.transientFx = true; // 不进静态合并块
      eyeRoot.add(shine);

      // 上下眼睑：肤色，比眼球略大，闭合时相向合拢到中线
      const lidGeo = new THREE.SphereGeometry(0.95, 6, 4);
      const lidMat = toonMat(SKIN_DEEP, { flatShading: true });
      const mkLid = (dir) => {
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.name = `leviathan-eyelid-${tag}-${dir > 0 ? "top" : "bot"}`;
        lid.scale.set(1, 0.62, 0.62);
        lid.userData.lidDir = dir;
        addOutline(lid, OUTLINE_W * 0.5);
        eyeRoot.add(lid);
        return lid;
      };
      const lidTop = mkLid(1);
      const lidBot = mkLid(-1);

      // 眼灯：K4 局部光预算内的注册灯，id 由 owner 派生（leviathan-eye#0/#1）
      const glow = new THREE.PointLight(EYE_GLOW, 0.0, 26, 2);
      glow.name = `leviathan-eye-light-${tag}`;
      glow.position.set(0.2, 0.2, side * 0.7);
      eyeRoot.add(glow);
      registerLocalLight(glow, {
        owner: "leviathan-eye",
        kind: "point",
        color: EYE_GLOW,
        intensity: 1.15,
        radius: 26,
        priority: 4,
      });

      eyes.push({ eyeRoot, eye, shine, lidTop, lidBot, glow, side });
    }
    group.userData.leviathanEyes = eyes;



    // 胸鳍：座头鲸标志性的长鳍肢——淡青白，贴在躯干中段两侧
    // 胸鳍：座头鲸标志性的超长鳍肢。上一版是 ConeGeometry 且埋在体侧
    // 轮廓里，正侧视几乎看不见；改成放样鳍叶，根部插进体侧、叶身伸出
    // 体外并向后下方掠，前缘留白边（照片特征）。
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(
        makeFinBlade(PEC_BLADE, {
          side, thickRoot: 1.15, thickTip: 0.32, edgeWhite: 0.34,
        }),
        toonMat(0xffffff, { vertexColors: true, flatShading: true })
      );
      pec.name = `leviathan-pectoral-${side < 0 ? "L" : "R"}`;
      // 姿态取「侧视能看全、俯视也露得出」的折中：后掠 30°、下垂 22°，
      // 再绕体轴外翻一点，让鳍面不与体侧平行（平行时侧视会缩成一条线）。
      // 附着点按线稿取在体长 ~30% 处的下体侧，长度也照线稿放大到近体长 1/3
      {
        const sec = whaleSectionAt(16.0);
        const cy = (sec.top + sec.bot) * 0.5;
        const hy = (sec.top - sec.bot) * 0.5;
        const phi = -0.62;
        pec.position.set(16.0, cy + hy * Math.sin(phi), side * sec.hz * Math.cos(phi) * 0.86);
      }
      pec.scale.setScalar(1.55);
      pec.rotation.order = "ZYX";
      pec.rotation.z = -0.26; // 鳍面外翻，侧视看得到叶面而不是刃口
      pec.rotation.y = -side * 0.50;
      pec.rotation.x = side * 0.34;
      pec.castShadow = true;
      addOutline(pec, OUTLINE_W * 0.34); // 薄件描边必须减细
      group.add(pec);

      // 前缘结节：座头鲸鳍肢前缘的一排肉瘤，低多边形下用小扁球点出来
      for (let k = 0; k < 5; k++) {
        const t = 0.12 + k * 0.19;
        const idx = Math.min(PEC_BLADE.length - 1, Math.round(t * (PEC_BLADE.length - 1)));
        const [sp, xl] = PEC_BLADE[idx];
        const knob = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 5, 4),
          toonMat(FIN_PALE, { flatShading: true })
        );
        knob.name = `leviathan-pectoral-knob-${side < 0 ? "L" : "R"}-${k}`;
        knob.position.set(xl * 0.94, 0, sp * side);
        knob.scale.set(0.9, 0.5, 0.9);
        pec.add(knob);
      }
    }

    // 20 枚极扁太古藤壶：贴壳面撒，避开地壳板投影区与腹底正中
    let placed = 0;
    let guard = 0;
    while (placed < 20 && guard < 400) {
      guard++;
      const x = THREE.MathUtils.lerp(40, -29, rnd());
      const a = rnd() * Math.PI * 2;
      const sec = whaleSectionAt(x);
      const cy = (sec.top + sec.bot) * 0.5;
      const hy = (sec.top - sec.bot) * 0.5;
      const y = cy + hy * Math.sin(a);
      const z = sec.hz * Math.cos(a);
      if (Math.abs(x) < 13.2 && Math.abs(z) < 7.6 && y > 3.4) continue; // 地壳板投影下
      if (Math.sin(a) < -0.86) continue; // 腹底正中留白
      const barn = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 0),
        toonMat(BARNACLE, { flatShading: true })
      );
      barn.name = "leviathan-barnacle";
      const sc = 0.32 + rnd() * 0.3;
      barn.scale.set(sc * (0.85 + rnd() * 0.5), sc * (0.16 + rnd() * 0.12), sc * (0.85 + rnd() * 0.5));
      barn.position.set(x, y, z);
      // 椭圆截面外法线（体轴方向的斜度对贴片朝向影响可忽略）
      const n = new THREE.Vector3(0, Math.sin(a) / hy, Math.cos(a) / sec.hz).normalize();
      barn.quaternion.setFromUnitVectors(_up, n);
      barn.rotateY(rnd() * Math.PI);
      addOutline(barn, OUTLINE_W);
      group.add(barn);
      placed++;
    }
  }

  // ---------- 2. 背部苔原地壳层：西芳寺的地基容器 ----------
  // islandGroup 的局部原点 = 地壳板面（升空时随鲸、藏地时脱离鲸体
  // 留在球面地表——「平时只见苔庭」，鲸身整头沉入地下）。
  const size = LEVIATHAN_SIZE;
  group.scale.setScalar(size);
  const plateWorldLift = Number.isFinite(opts.plateWorldLift)
    ? opts.plateWorldLift
    : basePos.length() + LEVIATHAN_PLATE_Y * size;
  const island = new THREE.Group();
  island.name = "leviathan-island";
  island.position.y = LEVIATHAN_PLATE_Y;
  group.add(island);
  {
    // 地形由五条不规则等高线组成：顶面是苔庭连续的浅台，下面逐级
    // 收成湿润深色坡脚。这样远景读到的是一座小型苔丘，而不是漂浮
    // 在天空中的矩形地板；顶面仍保留足够平缓的可行走区域。
    const { terrain, topContour } = buildMossTerrainTopography(rnd);
    terrain.name = "leviathan-crust-plate";
    island.add(terrain);

    // 顶面再铺少量不规则苔床，作为苔庭六景之间的自然过渡；每块都
    // 使用低面数扇形，不引入贴图噪声，也不遮住主石与古松的构图。
    const MOSS_BEDS = [0x477f58, 0x5c9767, 0x3e704f, 0x668b60, 0x355a40];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rnd() * 0.22;
      const r = 0.42 + rnd() * 0.36;
      const x = Math.cos(a) * (5.8 + rnd() * 5.1) * r;
      const z = Math.sin(a) * (2.35 + rnd() * 2.9) * r;
      addMossBed(
        island,
        rnd,
        x,
        z,
        0.65 + rnd() * 1.2,
        0.36 + rnd() * 0.72,
        0.06 + rnd() * 0.03,
        MOSS_BEDS[i % MOSS_BEDS.length],
        i
      );
    }

    // 防空灌木不再沿矩形四边排队，而是跟随自然轮廓稀疏落位；
    // 中间留出缺口，形成苔庭入口与可读的坡面边缘。
    const count = 26;
    for (let i = 0; i < count; i++) {
      const u = (i / count) * topContour.length;
      const i0 = Math.floor(u) % topContour.length;
      const i1 = (i0 + 1) % topContour.length;
      const mix = u - Math.floor(u);
      const contour = {
        x: THREE.MathUtils.lerp(topContour[i0].x, topContour[i1].x, mix),
        z: THREE.MathUtils.lerp(topContour[i0].z, topContour[i1].z, mix),
      };
      const sparse = i % 5 === 2;
      const shrub = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 0),
        toonMat(i % 3 === 0 ? 0x467d4f : SHRUB, { flatShading: true })
      );
      shrub.name = "leviathan-shrub-ring";
      // 入口位置保留同样的 26 个地貌标记以兼容旧调试器，但缩成
      // 低矮苔丛，不再形成一圈等高的“防空围墙”。
      const scl = sparse ? 0.22 + rnd() * 0.16 : 0.42 + rnd() * 0.4;
      shrub.scale.set(scl, scl * 0.62, scl);
      // 略外探半身，包住坡缘的层次接缝
      shrub.position.set(
        contour.x * (sparse ? 0.94 : 0.985) + (rnd() - 0.5) * 0.42,
        (sparse ? 0.07 : 0.1) + rnd() * (sparse ? 0.16 : 0.42),
        contour.z * (sparse ? 0.94 : 0.985) + (rnd() - 0.5) * 0.42
      );
      shrub.rotateY(rnd() * Math.PI);
      addOutline(shrub, OUTLINE_W);
      island.add(shrub);
    }

    island.userData.terrain = terrain;
    island.userData.topContour = topContour;
    island.userData.terrainStyle = "osksta-moss-terraces-v1";
    island.userData.terrainLayerCount = 5;
  }

  // ---------- 3. 尾柄 + 巨型 Y 字分叉尾鳍 ----------
  // 枢纽钉在臀段内部，只绕 Z 俯仰，禁止整段平移——平移会把尾巴从身上撕开。
  // 藏地：尾柄下折收起；升空：尾柄回水平并微抬，尾鳍再扬 35°。
  const TAIL_Z_BURIED = 0.78;
  const TAIL_Z_RISEN = -0.2;
  const tailRoot = new THREE.Group();
  tailRoot.name = "leviathan-tail-root";
  tailRoot.position.set(-31.2, -3.55, 0);
  tailRoot.rotation.z = TAIL_Z_RISEN;
  group.add(tailRoot);
  {
    // 尾柄是**同一张站位表的续接段**：起点截面与躯干壳在 X=−31.2 处逐字相同，
    // 所以尾巴摆动时接口只是弯，不会露台阶。原来的「袖口球 + 三节圆柱」正是
    // 主人看到的那圈突然鼓出来的方块。
    {
      const sec0 = whaleSectionAt(-31.2);
      const pivotY = (sec0.top + sec0.bot) * 0.5;
      tailRoot.position.y = pivotY;
      const stalkGeo = buildWhaleHull({
        // 从枢纽**之前** 3.2 起步，整段前端埋进躯干里；埋进去的那截半径缩到
        // 0.84 再渐回 1.0，避免与躯干壳同半径重合而 z-fighting。
        // 这样尾巴绕枢纽俯仰时，掰动发生在躯干内部，外面看不到接缝。
        fromX: -28.0,
        toX: -51.0,
        rings: 16,
        radial: 12,
        scale: new THREE.Vector3(1, 1, 1),
        originX: -31.2,
        originY: pivotY,
        radiusMul: (x) => (x >= -34.0
          ? THREE.MathUtils.lerp(0.84, 1.0, THREE.MathUtils.clamp((-28.0 - x) / 6.0, 0, 1))
          : 1),
      });
      paintWhaleSkin(stalkGeo, {
        toWorld: { x: (lx) => lx - 31.2, y: (ly) => ly + pivotY },
      });
      const stalk = new THREE.Mesh(
        stalkGeo,
        toonMat(0xffffff, { vertexColors: true, flatShading: true })
      );
      stalk.name = "leviathan-tail-stalk";
      stalk.castShadow = true;
      addOutline(stalk, OUTLINE_W);
      tailRoot.add(stalk);
    }

    const flukes = new THREE.Group();
    flukes.name = "leviathan-flukes";
    {
      const secT = whaleSectionAt(-51.0);
      flukes.position.set(-19.8, (secT.top + secT.bot) * 0.5 - whaleSectionAt(-31.2).top * 0 -
        ((whaleSectionAt(-31.2).top + whaleSectionAt(-31.2).bot) * 0.5), 0);
    }
    flukes.rotation.x = 0.6;
    // 尾叶：上一版是两只 4 面锥体，读成飞镖尾翼——主人 2026-09-05 点名
    // 「尤其是尾巴」不对。改成放样鳍叶：中央有缺刻、两片向后掠、后缘凹、
    // 尖端细；背面近黑、腹面白（照片特征，也是鲸豚辨识用的那一面）。
    // 翻滚补偿：升空动画驱动的是 flukes.rotation.x（测试锁死 0.6）。
    // 尾叶展向沿 ±Z，所以那 0.6 会把整片尾叶**翻滚**成一高一低，而不是
    // 「扬起」。这里套一层反向 −0.6 的平面：升空到位时净翻滚归零，
    // 再由 rotation.z 给一点抬头、由每片的上反角撑出 Y 字。
    const flukePlane = new THREE.Group();
    flukePlane.name = "leviathan-fluke-plane";
    flukePlane.rotation.x = -0.6;
    flukePlane.rotation.z = 0.26; // 前缘抬头
    flukes.add(flukePlane);
    const wing = (side) => {
      const tri = new THREE.Mesh(
        makeFinBlade(FLUKE_LOBE, {
          side, thickRoot: 1.05, thickTip: 0.30,
          topColor: FLUKE_DEEP, bottomColor: FIN_PALE,
        }),
        toonMat(0xffffff, { vertexColors: true, flatShading: true })
      );
      tri.name = `leviathan-fluke-${side < 0 ? "L" : "R"}`;
      tri.position.set(0, 0, 0);
      tri.rotation.x = -side * 0.26; // 上反角：两片尖端都抬起，读出 Y 字
      tri.rotation.y = -side * 0.16; // 各自再微微后掠
      tri.castShadow = true;
      addOutline(tri, OUTLINE_W * 0.34); // 薄件描边必须减细
      flukePlane.add(tri);
    };
    wing(-1);
    wing(1);
    tailRoot.add(flukes);
  }

  // ---------- 3b. 升空落雨：苔庭的水沿鲸身滑落、如雨坠向地面 ----------
  // 只在上浮时触发（上升速度驱动发射率；下沉不落雨）。水滴两个来源：
  // 苔庭地壳板缘（水从板缘滴落）+ 鲸身上半球（水沿体表下滑、过赤道
  // 后脱离坠落）；坠到地面高度即隐。水滴挂鲸体局部系，随鲸呼吸漂移。
  const groundRadius = Number.isFinite(opts.groundRadius)
    ? opts.groundRadius
    : minR;
  const RAIN_POOL = 110;
  const rainGroup = new THREE.Group();
  rainGroup.name = "leviathan-rain";
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0.3, 0, 0.1, -0.26, 0.06, -0.1, -0.26, 0.06, 0, 0.06, -0.17],
      3
    )
  );
  rainGeo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2]);
  rainGeo.computeVertexNormals();
  const rainMats = [0xbfe8f2, 0xd6f2fb, 0x9fd4e8].map(
    (c) =>
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      })
  );
  const rainDrops = [];
  for (let i = 0; i < RAIN_POOL; i++) {
    const drop = new THREE.Mesh(rainGeo, rainMats[i % rainMats.length]);
    drop.visible = false;
    drop.userData = {
      dir: new THREE.Vector3(0, 1, 0),
      phase: 0,
      vel: new THREE.Vector3(),
      life: 0,
      dur: 2.4,
      s0: 0.6 + rnd() * 0.5,
    };
    rainGroup.add(drop);
    rainDrops.push(drop);
  }
  group.add(rainGroup);
  const _rn = new THREE.Vector3();
  const _rt = new THREE.Vector3();
  const _redge = { x: 0, z: 0 };
  const BODY_Y = 6 - 8 * 1.3; // 躯干局部 Y（与主躯干同值）
  const rainEdgePoint = () => {
    const s = rnd() * 78; // 板缘周长 2·(25+14)
    if (s < 25) {
      _redge.x = -12.5 + s;
      _redge.z = -7;
    } else if (s < 39) {
      _redge.x = 12.5;
      _redge.z = -7 + (s - 25);
    } else if (s < 64) {
      _redge.x = 12.5 - (s - 39);
      _redge.z = 7;
    } else {
      _redge.x = -12.5;
      _redge.z = 7 - (s - 64);
    }
  };
  const spawnRain = () => {
    const drop = rainDrops[rainCursor];
    rainCursor = (rainCursor + 1) % rainDrops.length;
    if (!drop) return;
    const u = drop.userData;
    u.life = 0;
    u.dur = 2.2 + rnd() * 0.9;
    u.s0 = 0.5 + rnd() * 0.55;
    if (rnd() < 0.5) {
      // 苔庭地壳板缘滴落
      rainEdgePoint();
      u.phase = 1;
      u.vel.set((rnd() - 0.5) * 2.4, -1.2 - rnd() * 1.6, (rnd() - 0.5) * 2.4);
      drop.position.set(
        _redge.x + (rnd() - 0.5) * 0.6,
        island.position.y + 0.08,
        _redge.z + (rnd() - 0.5) * 0.6
      );
    } else {
      // 鲸身上半球：沿体表下滑
      let d = null;
      for (let guard = 0; guard < 12 && !d; guard++) {
        const lat = rnd() * 1.25;
        const lon = rnd() * Math.PI * 2;
        const dx = Math.cos(lat) * Math.cos(lon);
        const dy = Math.sin(lat);
        const dz = Math.cos(lat) * Math.sin(lon);
        const x = dx * 36;
        const z = dz * 17.6;
        if (Math.abs(x) < 13.2 && Math.abs(z) < 7.6) continue; // 板下
        d = new THREE.Vector3(dx, dy, dz);
      }
      if (!d) return;
      u.dir.copy(d);
      u.phase = 0;
      u.vel.set(0, 0, 0);
      const pr0 = whaleProfile(u.dir.x * 36);
      drop.position.set(u.dir.x * 36, u.dir.y * 10.4 * pr0.sy + BODY_Y, u.dir.z * 17.6 * pr0.sz);
    }
    drop.visible = true;
  };
  const updateRain = (dt) => {
    const groundLocalY = groundRadius - anchorR + 0.6;
    for (const drop of rainDrops) {
      if (!drop.visible) continue;
      const u = drop.userData;
      u.life += dt;
      const e = Math.min(1, u.life / u.dur);
      if (e >= 1) {
        drop.visible = false;
        continue;
      }
      if (u.phase === 0) {
        // 沿椭球面下滑：法向 (dx/sx², dy/sy², dz/sz²)，滑向 = -Y 切向
        _rn.set(u.dir.x / 20.25, u.dir.y / 1.69, u.dir.z / 4.84).normalize();
        _rt.set(0, -1, 0).addScaledVector(_rn, -_rn.y);
        if (_rt.lengthSq() < 1e-8) _rt.set(1, 0, 0).addScaledVector(_rn, -_rn.x);
        _rt.normalize();
        u.dir.addScaledVector(_rt, dt * (1.6 + rnd() * 1.4)).normalize();
        const pr1 = whaleProfile(u.dir.x * 36);
        drop.position.set(u.dir.x * 36, u.dir.y * 10.4 * pr1.sy + BODY_Y, u.dir.z * 17.6 * pr1.sz);
        if (u.dir.y < -0.12) {
          // 滑过赤道：脱离体表，沿切向初速坠落
          u.phase = 1;
          u.vel.set(
            _rt.x * 3.4 + (rnd() - 0.5) * 0.8,
            _rt.y * 3.4,
            _rt.z * 3.4 + (rnd() - 0.5) * 0.8
          );
        }
      } else {
        u.vel.y -= 13 * dt; // 重力（鲸体上方 = +Y）
        u.vel.x *= 0.985;
        u.vel.z *= 0.985;
        drop.position.addScaledVector(u.vel, dt);
        if (drop.position.y < groundLocalY) {
          drop.visible = false;
          continue;
        }
      }
      drop.scale.setScalar(u.s0 * (1 - e) + 0.04);
    }
  };

  // ---------- 4. 平缓呼吸 + 缓慢漂移 + 藏地/升空尾姿 ----------
  // 用户锁死：position.y = sin(t·0.6)·0.25。鲸体上方在世界系近似 +Y
  // （栖息于 lat56），此处沿「鲸体上方」做同频径向起伏，语义一致且
  // 不破坏球面定位；另叠极低频的切向漂移（±1.1），呼应「缓缓漂移」。
  const _anchor = new THREE.Vector3();
  const _base = new THREE.Vector3();
  let _prevAnchorR = anchorR;
  let rainSpeed = 0;
  let rainAcc = 0;
  let rainCursor = 0;
  const setAnchorRadius = (r) => {
    anchorR = THREE.MathUtils.clamp(Number(r) || minR, minR, maxR);
  };
  const update = (_dt, t) => {
    const time = Number(t) || 0;
    const step = Math.min(1, Number(_dt) || 0.016);
    group.quaternion.copy(poseQ);
    _anchor.copy(upN).multiplyScalar(anchorR);
    const bob = Math.sin(time * 0.6) * 0.25 * size;
    const driftF = Math.sin(time * 0.05 + 1.3) * 1.1 * size;
    const driftR = Math.sin(time * 0.07) * 1.1 * size;
    group.position
      .copy(_anchor)
      .addScaledVector(upN, bob)
      .addScaledVector(fwdN, driftF)
      .addScaledVector(rightN, driftR);
    // ---- 眨眼（主人 2026-09-05）：确定性节律，不用 Math.random ----
    // 节律参考真实巨鲸：多数时候半睁着缓慢呼吸，偶尔一次快速眨，
    // 更偶尔一次长闭（像在打盹）。三条正弦错相拼出来，同一时刻永远同一结果。
    {
      const eyes = group.userData.leviathanEyes || [];
      if (eyes.length) {
        const cyc = time / 5.7;
        const frac = cyc - Math.floor(cyc);            // 每 5.7s 一轮
        // 快眨：一轮里前 7% 的时间，0→1→0 走一个正弦包
        const quick = frac < 0.07 ? Math.sin((frac / 0.07) * Math.PI) : 0;
        // 长闭：每 6 轮来一次，闭得更久也更深
        const longIdx = Math.floor(cyc) % 6 === 0;
        const long = longIdx && frac < 0.30 ? Math.sin((frac / 0.30) * Math.PI) ** 0.6 : 0;
        // 常态半睁：极缓的呼吸感，眼睑始终有一点点动
        const idle = 0.12 + 0.05 * Math.sin(time * 0.31);
        const close = THREE.MathUtils.clamp(Math.max(quick, long * 0.95, idle), 0, 1);
        for (const e of eyes) {
          // 上下眼睑相向合拢：全开时退到眼球外，全闭时压到中线
          const open = 1 - close;
          const gap = 0.78 * open + 0.02;
          e.lidTop.position.y = gap;
          e.lidBot.position.y = -gap;
          // 闭合时眼珠高光与眼灯一起熄，睁开才亮——不然会隔着眼皮发光
          const lit = Math.max(0, open - 0.25) / 0.75;
          e.shine.visible = lit > 0.02;
          e.shine.scale.setScalar(0.6 + 0.4 * lit);
          e.glow.intensity = 1.15 * lit * lit;
        }
      }
    }

    // 尾姿随升空进度：尾鳍比躯干微延迟 12% 扬起
    const span = Math.max(1e-6, maxR - minR);
    const t01 = THREE.MathUtils.clamp((anchorR - minR) / span, 0, 1);
    const k = t01 <= 0.12 ? 0 : (t01 - 0.12) / 0.88;
    const tailT = k * k * (3 - 2 * k); // smoothstep
    tailRoot.rotation.z = THREE.MathUtils.lerp(TAIL_Z_BURIED, TAIL_Z_RISEN, tailT);
    // 升空后极缓摆尾（巨物慢节奏，参考低多边形样例的尾部游动）：
    // 只绕 Y 轻摆，藏地/升空断言锁死的 z 俯仰与尾鳍 x 仰角不受影响。
    tailRoot.rotation.y = Math.sin(time * 0.8) * 0.07 * tailT;
    const flukes = tailRoot.getObjectByName("leviathan-flukes");
    if (flukes) {
      flukes.rotation.x = 0.6 * tailT;
      // 尾鳍比尾柄滞后半拍，像大动物甩尾的跟随动作
      flukes.rotation.y = Math.sin(time * 0.8 - 0.55) * 0.09 * tailT;
    }
    // 苔庭岛随鲸/留地：升空时骑在鲸背（Y=PLATE_Y），藏地时脱离鲸体、
    // 留在地表（plateWorldLift）——鲸身沉入地下，只见苔庭
    {
      const rideY = LEVIATHAN_PLATE_Y;
      const detachWorld = plateWorldLift - anchorR;
      island.position.y =
        detachWorld > rideY * size ? detachWorld / size : rideY;
    }

    // ---- 升空落雨：上升速度驱动发射，峰值在中段；下沉不落雨 ----
    const vRise = step > 1e-4 ? (anchorR - _prevAnchorR) / step : 0;
    _prevAnchorR = anchorR;
    rainSpeed += (Math.max(0, vRise) - rainSpeed) * Math.min(1, step * 1.6);
    const wRain = Math.sin(Math.PI * THREE.MathUtils.clamp(t01, 0, 1));
    rainAcc += step * rainSpeed * 34 * wRain;
    while (rainAcc >= 1) {
      spawnRain();
      rainAcc -= 1;
    }
    updateRain(step);
  };
  update(0, 0);

  return { group, update, setAnchorRadius, island };
}
