/**
 * blotch.js — 大笔触色块，且色块不越过重要的边。
 *
 * 原文（x.com/OskSta/status/1696864977171189980）：
 *
 *   "I'm slowly emerging from a huge refactoring... While this here is not
 *    exactly the look I'm going for, it's showing off a big improvement to the
 *    texturing. I'm now able to draw with much bigger blotches without the
 *    blotches bleeding across and messing up important edges."
 *
 * 这条是上一轮留下的欠账（STUDY-INDEX 五.3）：「贴图层还是格纸，不是色块」。
 * 原文说的其实是两件事，必须同时成立才像：
 *
 *   1. 笔触要**大**。一坨色块的直径约等于岛宽的 1/4，所以贴图里的噪声频率
 *      必须远低于格子频率，否则看到的还是格纸。
 *   2. 笔触**不能过界**。草地色块画到台地边缘就得停，不能糊到崖面上；不然
 *      整座岛会变成一坨，台地轮廓也没了。
 *
 * 第 2 点是几何问题，不是贴图问题：贴图是平铺的，它根本不知道边在哪。所以
 * 这里在 CPU 侧烘一张「离台地边缘多远」的场（和 vertexlight.js 的高度图同一
 * 套做法：光栅化到小图，着色器里按世界 XZ 采样），着色器把色块按这个距离淡出。
 * 于是同一张贴图既能画大色块，又能在边缘处自己收住 —— 这正是原文那句
 * "without the blotches bleeding across" 的可实现版本。
 *
 * 画面实测（来自 1696864977171189980 的帧）：
 *   · 台地宽度 ≈ 全岛 0.55，最大色块直径 ≈ 0.22 全岛 → 约 2.5 个台地宽
 *   · 色块边缘是柔的（过渡带 ≈ 0.06 全岛），且**离边缘还有一小条纯草地**
 *   · 崖面完全是干净米白，没有任何色块渗下去，连过渡都没有
 *
 * 第 5 轮加了两条同族的原文：
 *
 * (a) x.com/OskSta/status/1696896119794479541
 *   "Look how neat and controlled the grass blotches bleed over the cliff edges."
 *   注意不是"不渗"，而是"**受控地**渗"：渗漏底边是一条等深线，宽度跟着色块走，
 *   于是形成圆润的瓣。做法见 BODY 里的 bleedMask —— 靠 rim 场新加的 G 通道
 *   （每格顶面世界高度）算出"悬在顶面下方多深"，到 bleed 深度就齐平收住。
 *
 * (b) x.com/OskSta/status/1786014232594485497
 *   "Mountains kinda need lighting and normals, but with my texture blending tech
 *    I don't think I can afford that on low-end devices"
 *   他不在贴图上加法线，而是**把光画进贴图**：沿坡向拉长的条纹既是岩脉也是明暗。
 *   做法见 BODY 里的 suv —— uv 沿 downhill 压扁 ~8 倍、沿横向拉密，条纹直接乘进色。
 */

import * as THREE from 'three';

// --- 贴图：一张 128² 的 DataTexture，三个通道各管一件事 -------------------

/**
 * 整数哈希。
 *
 * 踩过的坑：这里最初写成 `seed * 1442695040888963407` 直接做浮点乘法，结果
 * 乘积超过 2^53，低位全被吃掉，噪声值的分布被压成 0.09~0.39 —— 阈值 0.42
 * 永远进不去，于是整层色块**一点都没画出来**，而 shader 编译是成功的。
 * 所以必须全程 Math.imul（32 位饱和乘法）。
 */
function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 平铺（periodic）值噪声：必须周期，否则贴图接缝处会出现一条直线边。 */
function valueNoise(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wrap = (n) => ((n % period) + period) % period;
  const h = (a, b) => hash2(wrap(a), wrap(b), seed);
  const n00 = h(xi, yi);
  const n10 = h(xi + 1, yi);
  const n01 = h(xi, yi + 1);
  const n11 = h(xi + 1, yi + 1);
  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sy;
}

/** 分形叠加。period 逐层翻倍，所以整张贴图仍然可无缝平铺。 */
function fbm(u, v, basePeriod, octaves, seed) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let p = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(u, v, p, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

/**
 * 生成本轮用的「笔触图集」。
 *
 *   R = 冷色块（橄榄/深绿），G = 暖色块（锈红/鲑鱼粉），B = 细颗粒（砂砾）
 *
 * 不用现成的 png，是因为整个 engine/ 没有美术资源；canvas/DataTexture 现做
 * 一张 128² 就够 —— 和原文一样「一张小图走天下」。
 */
export function createBlotchAtlas({ size = 128, basePeriod = 3, seed = 11 } = {}) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // 低频：大笔触。basePeriod=3 → 一张图里约 3 坨，铺开到岛上就是 2~3 个台地宽
      const cold = fbm(u, v, basePeriod, 3, seed);
      // 暖色块换一个种子 + 略低的频率，两套笔触错开，不会永远叠在同一个位置
      const warm = fbm(u, v, basePeriod - 1, 3, seed + 977);
      // 颗粒：高频，只用来在带子里撒砂砾
      const grain = fbm(u, v, basePeriod * 12, 2, seed + 313);
      const i = (y * size + x) * 4;
      data[i + 0] = Math.round(cold * 255);
      data[i + 1] = Math.round(warm * 255);
      data[i + 2] = Math.round(grain * 255);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return { texture, size };
}

// --- 边缘场：离台地边缘多远（世界单位，光栅化到一张小图）-----------------

/**
 * 把「到台地边缘的距离」烘成一张 clamp 到边的灰度图。
 *
 * 源点 = 顶面高度和任一邻居不同的格子（也就是台地的崖肩）。
 * 然后跑两遍 chamfer（3-4 距离变换），得到每个纹素到最近源点的距离。
 *
 * 为什么不放顶点属性：色块是逐像素的，顶点级距离在长条三角形上会被线性插值
 * 拉成斜的，边缘那条干净的「收住」就变成锯齿了。小图 + 双线性插值反而更稳。
 */
export function createRimField(town, grid, { res = 96, maxDist = 1.0, levelHeight = 0.42 } = {}) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let maxTop = 1;
  for (const c of grid.cells) {
    minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX);
    minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ);
    maxTop = Math.max(maxTop, town.top(c));
  }
  const topSpan = maxTop * levelHeight;
  const spanX = Math.max(1e-4, maxX - minX);
  const spanZ = Math.max(1e-4, maxZ - minZ);

  const dist = new Float32Array(res * res).fill(1e9);
  const solid = new Uint8Array(res * res);
  // G 通道：这个纹素所在格子的**顶面世界高度**。
  // 有了它，着色器才知道"我现在悬在这层台地顶面下方多少" —— 崖肩渗漏就靠这个量
  // 收口（原文 1696896119794479541 说的"controlled bleed"）。
  const topY = new Float32Array(res * res);

  const cellBounds = (c) => {
    const x0 = Math.min(res - 1, Math.max(0, Math.floor(((c.minX - minX) / spanX) * res)));
    const x1 = Math.min(res - 1, Math.max(0, Math.floor(((c.maxX - minX) / spanX) * res)));
    const z0 = Math.min(res - 1, Math.max(0, Math.floor(((c.minZ - minZ) / spanZ) * res)));
    const z1 = Math.min(res - 1, Math.max(0, Math.floor(((c.maxZ - minZ) / spanZ) * res)));
    return [x0, x1, z0, z1];
  };

  // pass 1: 铺实心 + 标记崖肩（自己高、邻居矮 → 这里就是边的位置）
  for (const c of grid.cells) {
    const top = town.top(c);
    if (top <= 0) continue;
    const [x0, x1, z0, z1] = cellBounds(c);
    let isRim = false;
    for (const nid of c.edgeNeighbors) {
      const n = nid >= 0 ? grid.cells[nid] : null;
      if (!n || town.top(n) !== top) { isRim = true; break; }
    }
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const i = z * res + x;
        solid[i] = 1;
        topY[i] = top * levelHeight;
        if (isRim) dist[i] = 0;
      }
    }
  }

  // pass 2: chamfer 3-4 距离变换（正向 + 反向各扫一遍）
  const texelX = spanX / res;
  const texelZ = spanZ / res;
  const d1 = Math.hypot(texelX, texelZ);
  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) {
      const i = z * res + x;
      if (dist[i] === 0) continue;
      let best = dist[i];
      if (x > 0) best = Math.min(best, dist[i - 1] + texelX);
      if (z > 0) best = Math.min(best, dist[i - res] + texelZ);
      if (x > 0 && z > 0) best = Math.min(best, dist[i - res - 1] + d1);
      if (x < res - 1 && z > 0) best = Math.min(best, dist[i - res + 1] + d1);
      dist[i] = best;
    }
  }
  for (let z = res - 1; z >= 0; z--) {
    for (let x = res - 1; x >= 0; x--) {
      const i = z * res + x;
      let best = dist[i];
      if (x < res - 1) best = Math.min(best, dist[i + 1] + texelX);
      if (z < res - 1) best = Math.min(best, dist[i + res] + texelZ);
      if (x < res - 1 && z < res - 1) best = Math.min(best, dist[i + res + 1] + d1);
      if (x > 0 && z < res - 1) best = Math.min(best, dist[i + res - 1] + d1);
      dist[i] = best;
    }
  }

  const data = new Uint8Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    const d = dist[i] >= 1e8 ? maxDist : Math.min(maxDist, dist[i]);
    const v = Math.round((d / maxDist) * 255);
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = Math.round(Math.min(1, topY[i] / Math.max(1e-3, topSpan)) * 255);
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return {
    texture,
    res,
    maxDist,
    topSpan,
    // xy = 世界最小角，zw = 1/跨度 —— 和 vertexlight 的 Xform 同格式
    xform: new THREE.Vector4(minX, minZ, 1 / spanX, 1 / spanZ),
    dispose() { texture.dispose(); },
  };
}

// --- 着色器：把两张图接到已有材质上 -------------------------------------

export function createBlotch({
  town, grid,
  seed = 11,
  scale = 0.09,
  strength = 1.0,
  // 崖肩渗漏：色块允许越过崖沿往下挂多深（世界单位）。0 = 关掉。
  // 实测 1696896119794479541 的帧：下挂深度 ≈ 崖面高度的 0.25~0.35，
  // 而一格高 = 0.42，所以取 0.14。
  bleed = 0.14,
  // 坡向条纹（山体贴图）：0 = 关掉
  streak = 0.75,
  levelHeight = 0.42,
} = {}) {
  const atlas = createBlotchAtlas({ seed });
  const rim = createRimField(town, grid, { levelHeight });

  const uniforms = {
    uBlotchTex: { value: atlas.texture },
    uBlotchScale: { value: scale },     // 世界单位 → 贴图 uv 的倍率（越小笔触越大）
    uBlotchRim: { value: rim.texture },
    uBlotchRimX: { value: rim.xform },
    uBlotchRimSpan: { value: rim.maxDist },
    uBlotchTopSpan: { value: rim.topSpan },
    uBlotchAmt: { value: strength },
    uBlotchBleed: { value: bleed },
    uBlotchStreak: { value: streak },
  };

  return {
    uniforms,
    scale,
    bleed,
    streak,
    dispose() {
      atlas.texture.dispose();
      rim.dispose();
    },
  };
}

const DECL = /* glsl */`
  uniform sampler2D uBlotchTex;
  uniform sampler2D uBlotchRim;
  uniform vec4  uBlotchRimX;
  uniform float uBlotchScale;
  uniform float uBlotchRimSpan;
  uniform float uBlotchTopSpan;
  uniform float uBlotchAmt;
  uniform float uBlotchBleed;
  uniform float uBlotchStreak;
  // 注意：vSurfPos / vSurfNrm 由 surface.js 声明，这里不重复声明
  // （重复 varying 声明在 GLSL 里是编译错误）
`;

const BODY = /* glsl */`
  {
    vec3 wp = vSurfPos;
    vec3 n  = normalize(vSurfNrm);

    // 边缘场：世界 XZ → 小图 uv → 世界距离 / 本格顶面高度
    vec2 ruv = clamp((wp.xz - uBlotchRimX.xy) * uBlotchRimX.zw, 0.0, 1.0);
    vec4 rimTex = texture2D(uBlotchRim, ruv);
    float rimDist  = rimTex.r * uBlotchRimSpan;
    float localTop = rimTex.g * uBlotchTopSpan;
    // 悬在这层台地顶面下方多少（崖面上 > 0，顶面上 ≈ 0）
    float below = localTop - wp.y;

    // 0.06~0.30 世界单位（约 1/4~1 个格子）内让色块收住。
    // 上界刻意取小：实测参考片里色块到边缘前就没了，崖肩上永远剩一条纯色。
    float rimMask = smoothstep(0.06, 0.30, rimDist);

    // 只画在"顶面"上：0.94 起步是很陡的 ramp，因为体素顶面法线正好是 1，
    // 崖面是 0，中间几乎没有过渡三角形 —— 于是切口就是那条干净的边。
    float flatMask = smoothstep(0.88, 0.985, n.y);

    // --- 崖肩**受控**渗漏（1696896119794479541）------------------------
    // 原文："Look how neat and controlled the grass blotches bleed over the
    // cliff edges." 关键词是 controlled：渗漏不是随机糊下去，而是
    //   ① 只在水平距离贴边的地方（rimDist≈0，也就是正上方就是崖沿）
    //   ② 垂直方向上到 uBlotchBleed 就**齐平**停住（这里的 smoothstep 是"下方
    //      越深越淡"，到 1.0×bleed 处正好归零，所以渗漏的底边是一条等深线）
    //   ③ 用的还是同一张笔触图 → 水平方向的宽窄天然跟着色块走，于是形成圆润的瓣
    float bleedMask = (1.0 - flatMask)
                    * smoothstep(0.10, 0.02, rimDist)
                    * smoothstep(uBlotchBleed, uBlotchBleed * 0.35, below)
                    * smoothstep(0.0, 0.04, below);

    vec2 buv = wp.xz * uBlotchScale;
    vec4 bl = texture2D(uBlotchTex, buv);

    // 大笔触：把噪声推到软阈值外，剩下的才是"块"，中间那段是柔和过渡
    // 阈值按实测分布定：中位数 0.50、p90 0.635，取 0.44~0.60 大约覆盖 1/3
    float cold = smoothstep(0.44, 0.60, bl.r);
    float warm = smoothstep(0.55, 0.70, bl.g);
    // 笔触边缘稍微压暗一点，色块才有"盖上去"的厚度，而不是一块平涂
    float edge = smoothstep(0.36, 0.48, bl.r) * smoothstep(0.70, 0.54, bl.r);

    // 顶面走 rimMask，崖面走 bleedMask，两者互斥（flatMask 已经在两边分开）
    float topW = cold * rimMask * flatMask;
    float cliffW = cold * bleedMask * 0.9;
    float w = (topW + cliffW) * uBlotchAmt;
    float w2 = warm * rimMask * flatMask * uBlotchAmt * (1.0 - cold * 0.75);

    // 乘法上色：不改调色板，只在原色上做色相偏移，所以崖体、屋顶都不受影响
    vec3 tint = vec3(1.0);
    tint = mix(tint, vec3(0.86, 1.02, 0.74), w);    // 橄榄/深绿
    tint = mix(tint, vec3(1.16, 0.88, 0.70), w2);   // 锈红/鲑鱼
    tint *= 1.0 - edge * topW * 0.10;

    // --- 坡向条纹（山体贴图，1786014232594485497）---------------------
    // 原文："Mountains kinda need lighting and normals, but with my texture
    // blending tech I don't think I can afford that on low-end devices."
    // 他的解法不是加法线，而是**把条纹画成顺着坡向的贴图**：远看像被光打过的
    // 岩脊，近看才知道是贴图。所以这里
    //   ① 用 downhill = -normal.xz 当"顺坡方向"，把 uv 沿它**压扁**（周期拉长 5 倍）
    //   ② 条纹只在陡面出现（steep），顶面不画
    //   ③ 条纹本身当明暗用（乘法），所以看起来像"被烘过的光"，不需要逐像素光照
    float steep = 1.0 - flatMask;
    vec2 dn = n.xz;
    float dlen = length(dn);
    vec2 downhill = dlen > 1e-3 ? -dn / dlen : vec2(0.0, 1.0);
    vec2 perp = vec2(-downhill.y, downhill.x);
    // 横向 7.0/世界单位（一格里 3 条），纵向 0.9/世界单位（拉长 ≈ 8 倍）
    vec2 suv = vec2(dot(wp.xz, perp) * 0.055, dot(wp.xz, downhill) * 0.008) + buv * 0.0;
    vec4 stex = texture2D(uBlotchTex, suv);
    float stripe = smoothstep(0.46, 0.60, stex.g);
    float st = stripe * steep * uBlotchStreak;
    tint *= 1.0 + 0.34 * st;                       // 条纹提亮（白色岩脉）
    tint *= 1.0 - 0.15 * steep * uBlotchStreak * (1.0 - st);  // 条纹之间压暗 → 有面
    // 高处（接近本层顶面）条纹更强：参考片里雪线就在山脊下方
    tint *= 1.0 + 0.12 * steep * uBlotchStreak * smoothstep(0.40, 0.04, below);

    diffuseColor.rgb *= tint;

    // 细颗粒：只在冷色块里撒，且随像素宽度淡出（否则远处是噪点闪烁）
    float grainRes = 1.0 - smoothstep(0.010, 0.030, length(fwidth(wp.xz)) * 14.0);
    float grain = step(0.80, bl.b) * w * 0.22 * grainRes;
    diffuseColor.rgb *= 1.0 - grain;
  }
`;

/**
 * 把色块层挂到已有材质上（chained onBeforeCompile，和 vertexlight 同一套路）。
 */
export function attachBlotch(material, blotch) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey;

  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, blotch.uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + BODY);
  };

  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : '') + '+blot2';
  material.userData.blotch = blotch;
  return material;
}
