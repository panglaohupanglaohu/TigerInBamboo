/**
 * propanim.js — 道具出现/消失的动画，以及它为什么"比想象中麻烦"。
 *
 * 1246074663546916873  "The props now animate when they appear and disappear.
 *   This was much trickier than I anticipated."
 *
 * ---- 画面观察（24 帧，512²；一个围合院子，院里有树和灌木） ----
 *   · 出现的道具不是"淡入"，是**长出来**：先扁后高，带一点过冲再回位；
 *   · 一群道具不是同时动：从左到右依次错开（图上大约 0.15–0.25s 的错峰）；
 *   · 消失时更快、幅度更小（消失比出现"紧"，不然会显得拖沓）；
 *   · 房子本身（墙体/屋顶）不动，只有**挂在墙上的**门窗、栏杆、院子里的树在动。
 *
 * "trickier than I anticipated" 技术上的原因是硬的：这些道具在 Townscaper 里是**并进同一份
 * 几何**的（一次 draw call，`src/townmesh.js` 也是这么做的 —— 门窗/钢架/后院全在一个 buffer 里）。
 * 并进去之后，单个道具就没有自己的变换矩阵了，想让它单独动只有两条路：
 *
 *   A. **每帧重建顶点**：把受影响的顶点重新算一遍位置上上传。简单，但要碰几十万个顶点。
 *   B. **顶点着色器里算**：给每个顶点带一个 propId / 一个根部原点，动画参数放一张
 *      每道具一条的记录（400 条 = 一次 1.6KB 的 upload），顶点着色器读它自己缩放。
 *
 * 这个文件把两条路的**代价量出来**，并把 A 的弹簧参数标定到片子里看到的样子（过冲 ≈ 10%，
 * 0.3–0.5s 落定，错峰 0.2s）。B 的那条不做 GLSL，只算 upload 成本 —— 够用来比。
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 半隐式欧拉的弹簧，从 0 起振到 1。
 * 阻尼比 ζ<1 才有过冲；片子里那点"弹一下"大约是 ζ≈0.6。
 */
export function springTrack({ stiffness = 170, zeta = 0.6, dt = 1 / 60, settleEps = 0.01, maxFrames = 240 } = {}) {
  const frames = [];
  let x = 0;
  let v = 0;
  const c = 2 * Math.sqrt(stiffness) * zeta;
  let settle = -1;
  let peak = 0;
  for (let i = 0; i < maxFrames; i++) {
    const a = stiffness * (1 - x) - c * v;
    v += a * dt;
    x += v * dt;
    if (x > peak) peak = x;
    frames.push(x);
    if (settle < 0 && Math.abs(1 - x) < settleEps && Math.abs(v) < settleEps) settle = i;
  }
  return {
    frames,
    settleFrame: settle,
    settleTime: settle < 0 ? Infinity : settle * dt,
    overshoot: peak - 1,
  };
}

/** 错峰：第 i 个道具晚 `spread * i / (n-1)` 秒开始。片子里大约 0.2s 铺满一排。 */
export function staggerAt(i, n, spread = 0.2) {
  return n <= 1 ? 0 : (spread * i) / (n - 1);
}

/** 一个道具的当前缩放：出现用 ζ=0.6 的弹簧；消失更快（stiffness 更高、幅度更小）。 */
export function scaleAt(entry, t, { stiffness = 170, zeta = 0.6, outStiffness = 900, outZeta = 0.8 } = {}) {
  const start = entry.delay;
  const end = entry.hideAt;
  const appear = springValue(Math.max(0, t - start), stiffness, zeta);
  if (end === undefined || t < end) return appear;
  const k = springValue(t - end, outStiffness, outZeta);
  return appear * (1 - k);
}

function springValue(t, stiffness, zeta) {
  const c = 2 * Math.sqrt(stiffness) * zeta;
  // 解析解（欠阻尼）：x(t) = 1 - e^(-c/2 t)(cos(wd t) + (c/2/wd) sin(wd t))
  const alpha = c / 2;
  const w0 = Math.sqrt(stiffness);
  const wd2 = w0 * w0 - alpha * alpha;
  if (wd2 <= 0) return 1 - Math.exp(-alpha * t) * (1 + alpha * t);
  const wd = Math.sqrt(wd2);
  return 1 - Math.exp(-alpha * t) * (Math.cos(wd * t) + (alpha / wd) * Math.sin(wd * t));
}

/**
 * 几何预算：道具并进主 buffer 之后有多大。
 * 门窗按 24 顶点（box 级别）、树按 90 顶点估 —— 这两个数是按现有 `src/townmesh.js`
 * 里门窗 box 与 `src/birds.js` 的树冠量级取的**估计值**，不是实测。
 */
export function bakeProps({ propCount = 400, vertsPerProp = 24, trisPerProp = 12 } = {}) {
  return {
    props: propCount,
    vertices: propCount * vertsPerProp,
    triangles: propCount * trisPerProp,
    bytes: propCount * vertsPerProp * 3 * 4,
  };
}

/**
 * 两条路的代价对比（真跑，不是估算）：
 *   A. 每帧把每个顶点按自己的道具缩放重新算一遍（3 个 float × 顶点数）
 *   B. 每帧只写每道具一条记录（4 个 float），顶点着色器自己去乘
 */
export function costBoth({ propCount = 400, vertsPerProp = 24, frames = 120, dt = 1 / 60 } = {}) {
  const rnd = mulberry32(9);
  const props = [];
  for (let i = 0; i < propCount; i++) props.push({ x: rnd(), y: rnd(), z: rnd(), delay: rnd() * 0.2 });

  const src = new Float32Array(propCount * vertsPerProp * 3);
  for (let i = 0; i < src.length; i++) src[i] = rnd();
  const dst = new Float32Array(src.length);
  const inst = new Float32Array(propCount * 4);

  // A：重建顶点
  const tA = performance.now();
  let sink = 0;
  for (let f = 0; f < frames; f++) {
    const t = f * dt;
    for (let p = 0; p < propCount; p++) {
      const s = scaleAt(props[p], t);
      const base = p * vertsPerProp * 3;
      // 真实的重建路径：读原顶点 × 自己的缩放 → 写进上传 buffer（读+写，不是原地乘）
      for (let v = 0; v < vertsPerProp * 3; v++) dst[base + v] = src[base + v] * s;
      sink += s;
    }
  }
  const rebuildMs = performance.now() - tA;

  // B：只写实例记录
  const tB = performance.now();
  let sink2 = 0;
  for (let f = 0; f < frames; f++) {
    const t = f * dt;
    for (let p = 0; p < propCount; p++) {
      inst[p * 4] = scaleAt(props[p], t);
      inst[p * 4 + 1] = props[p].x;
      inst[p * 4 + 2] = props[p].y;
      inst[p * 4 + 3] = props[p].z;
      sink2 += inst[p * 4];
    }
  }
  const uniformMs = performance.now() - tB;

  return {
    frames,
    rebuildMs,
    uniformMs,
    perFrameRebuild: rebuildMs / frames,
    perFrameUniform: uniformMs / frames,
    ratio: rebuildMs / Math.max(1e-6, uniformMs),
    uploadBytesPerFrame: propCount * 4 * 4,
    sink: sink + sink2,
  };
}

/**
 * 道具增删时的**重烤**代价：并进同一份几何之后，加一个窗/删一棵树都得把整份 buffer 重建一遍。
 * 这才是那条帖子里真正麻烦的那一下（每帧动画反而不贵）。
 */
export function rebake({ propCount = 400, vertsPerProp = 24 } = {}) {
  const rnd = mulberry32(11);
  const local = new Float32Array(vertsPerProp * 3);
  for (let i = 0; i < local.length; i++) local[i] = rnd() - 0.5;
  const t0 = performance.now();
  const out = new Float32Array(propCount * vertsPerProp * 3);
  for (let p = 0; p < propCount; p++) {
    const ox = (rnd() - 0.5) * 20;
    const oz = (rnd() - 0.5) * 20;
    const rot = rnd() * Math.PI * 2;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    for (let v = 0; v < vertsPerProp; v++) {
      const lx = local[v * 3];
      const ly = local[v * 3 + 1];
      const lz = local[v * 3 + 2];
      const b = (p * vertsPerProp + v) * 3;
      out[b] = lx * cs - lz * sn + ox;
      out[b + 1] = ly;
      out[b + 2] = lx * sn + lz * cs + oz;
    }
  }
  return { ms: performance.now() - t0, vertices: propCount * vertsPerProp, bytes: out.length * 4 };
}

/** 一键体检。 */
export function audit({ propCount = 400, vertsPerProp = 24 } = {}) {
  const track = springTrack();
  const fast = springTrack({ stiffness: 900, zeta: 0.8 });
  const geom = bakeProps({ propCount, vertsPerProp });
  const cost = costBoth({ propCount, vertsPerProp });
  const rebakeCost = rebake({ propCount, vertsPerProp });
  return {
    spring: { settleTime: track.settleTime, settleFrame: track.settleFrame, overshoot: track.overshoot },
    disappear: { settleTime: fast.settleTime, overshoot: fast.overshoot },
    geom,
    cost,
    rebake: rebakeCost,
    staggerTotal: staggerAt(propCount - 1, propCount, 0.2),
  };
}
