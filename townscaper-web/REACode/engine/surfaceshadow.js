/**
 * surfaceshadow.js — 贴图空间的面阴影，**投射高度**与 **z 测试高度** 解耦。
 *
 * 两条原文（前后两版，正好是一组 A/B）：
 *
 * (1) x.com/OskSta/status/1704218784028905984
 *   "I tried some texture based shadows. Note the shadows on the grass and along
 *    the roof edges. Looks kinda cool, but feels a bit too 3D for what I'm going
 *    for this time. I feel like it clashes with lines, and I like lines more."
 *
 * (2) x.com/OskSta/status/1705195380457996629
 *   "I tamed the texture based surface shadows a bit, so the shadow casting
 *    height is independent of the z test height. Now I only get shadows over
 *    grass-cliff edges and under roofs. It has some artifacts across UV borders,
 *    but it's quite subtle so I might not actually have to fix it."
 *
 * 拆开这句话：贴图阴影里有两个完全不同的高度量。
 *
 *   · **z 测试高度**（test height）：在哪儿测。把采样点沿太阳方向推多远，
 *     也就是"影子能伸多长"。它决定影子**落点**，是一把空间尺。
 *   · **投射高度**（casting height）：多高的东西才算数。采样到的那个点比
 *     接收面高出多少，才判定为遮挡。它决定**哪些东西投影**，是一把阈值尺。
 *
 * 第一版把这两件事绑在一起（高出一点点就投），于是**每一级台阶**都投出一圈
 * 影子 —— 一座由方块堆起来的地形被画成了"处处有接触阴影的写实模型"，这就是
 * 他说的 "too 3D / clashes with lines"。第二版把阈值单独拎出来调大：
 *
 *   阈值 ≈ 1.5~2 级 → 一级台阶（地形的基本步长）不投影，只有
 *                      「崖（≥2 级）」「屋顶（房身 + 屋面）」够高，才投影。
 *
 * 于是画面里只剩两种影子：草地贴着崖脚的一道（草-崖交界），和屋檐下的一条。
 * 这正好是我们这台机器能复用的东西：高度图（vertexlight.js 的 24² 那套）本来
 * 就有"每格最高列"，再补一张"含屋顶的投射体高度"就能算。
 *
 * 画面实测（1705195380457996629 第 12 帧，640²）：
 *   · 绿色草地上一道道深绿的长条，起点都在崖脚，朝背离崖的方向拉出去
 *   · 条带长度 ≈ 1.0~1.6 个格子（世界 0.8~1.3），宽度 ≈ 半个格子
 *   · 没有硬边，最深处比周围暗约 18~22%（不是纯黑，也不是接触阴影那种渐变）
 *   · 屋顶下沿（白墙与黄屋顶交界处）有一条窄的暗带，宽度 < 0.1 世界单位
 *   · 一级台阶（台地之间 0.42 的落差）**看不到**影子 —— 这就是阈值存在的证据
 *
 * 所以我们烘一张 res² 的"投射体高度"图（单位：层）：
 *   r = 该格最高柱面（含屋顶/塔尖）的层数
 * 着色时沿太阳方向打 3 个探针 × 横向 2 个偏移，取最大值；再拿
 *   d = caster - (vert + testLv)
 * 与 castingLv 比。两个 uniform 互相独立，正好对应原文那句话。
 */

import * as THREE from 'three';

const VERT_DECL = /* glsl */ `
  varying vec2 vShUV;
  varying float vShVert;     // 接收点的层数
  varying vec3 vShNrm;
  uniform vec4 uShXform;     // xy = min corner, zw = 1/span
  uniform float uShLevel;    // world y -> 层数
`;

const VERT_BODY = /* glsl */ `
  {
    vec3 wl = (modelMatrix * vec4(position, 1.0)).xyz;
    vShUV = (wl.xz - uShXform.xy) * uShXform.zw;
    vShVert = wl.y * uShLevel;
    vShNrm = normalize(mat3(modelMatrix) * normal);
  }
`;

const FRAG_DECL = /* glsl */ `
  varying vec2 vShUV;
  varying float vShVert;
  varying vec3 vShNrm;
  uniform sampler2D uShMap;
  uniform vec2 uShSunUV;     // 太阳方向的 xz，已经除过 span（uv 单位 / 世界单位）
  uniform float uShReach;    // z 测试高度：影子最长伸多远（世界单位）
  uniform float uShTestLv;   // z 测试偏移：在接收面之上多高做测试（层）
  uniform float uShCastLv;   // 投射高度：高出多少才投影（层）—— 与上两者独立
  uniform float uShStrength;
  uniform float uShMaxLv;
`;

const FRAG_BODY = /* glsl */ `
  {
    // 沿太阳方向 3 个探针，横向再偏一点，把"贴脚的一道"抹成软带
    // （原文自己承认 UV 跨界有 artifact —— 这里用多探针把它摊薄，不额外修边界）
    float reach = uShReach;
    float caster = 0.0;
    for (int i = 0; i < 3; i++) {
      float t = (float(i) + 0.55) / 3.0;
      vec2 base = vShUV + uShSunUV * (reach * t);
      for (int j = 0; j < 2; j++) {
        float side = (float(j) - 0.5) * reach * 0.22;
        vec2 uv = base + vec2(-uShSunUV.y, uShSunUV.x) * side;
        caster = max(caster, texture2D(uShMap, clamp(uv, 0.0, 1.0)).r);
      }
    }
    caster *= uShMaxLv;

    // 两个高度量在这里各就各位：testLv 改落点，castLv 改"谁能投"
    float d = caster - (vShVert + uShTestLv);
    float sh = smoothstep(uShCastLv - 0.45, uShCastLv + 0.55, d);

    // 朝上的面吃满影子；竖直面只在檐下露一小条（参考片里墙上只有屋檐那一窄条）
    float upW = smoothstep(0.20, 0.72, vShNrm.y);
    float k = 1.0 - sh * uShStrength * mix(0.28, 1.0, upW);
    diffuseColor.rgb *= k;
  }
`;

/**
 * 烘"投射体高度"图。
 * @param houses 房子列表（{cell, top, spire}）—— 屋顶必须算进投射体，
 *               否则"屋檐下的影子"这条就没了。
 */
export function createSurfaceShadow(town, grid, houses = [], {
  res = 40,
  levelHeight = 0.42,
  castLv = 1.55,
  testLv = 0.14,
  reach = 1.35,
  strength = 0.42,
} = {}) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let maxTop = 1;
  for (const c of grid.cells) {
    minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX);
    minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ);
    maxTop = Math.max(maxTop, town.top(c));
  }
  const spanX = Math.max(1e-4, maxX - minX);
  const spanZ = Math.max(1e-4, maxZ - minZ);

  // 层单位的投射体高度（0 = 没有东西）
  const maxLv = maxTop + 3;
  const caster = new Float32Array(res * res);

  const put = (x0, x1, z0, z1, lv) => {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) caster[z * res + x] = Math.max(caster[z * res + x], lv);
    }
  };
  const box = (c) => {
    const x0 = Math.min(res - 1, Math.max(0, Math.floor(((c.minX - minX) / spanX) * res)));
    const x1 = Math.min(res - 1, Math.max(0, Math.floor(((c.maxX - minX) / spanX) * res)));
    const z0 = Math.min(res - 1, Math.max(0, Math.floor(((c.minZ - minZ) / spanZ) * res)));
    const z1 = Math.min(res - 1, Math.max(0, Math.floor(((c.maxZ - minZ) / spanZ) * res)));
    return [x0, x1, z0, z1];
  };

  for (const c of grid.cells) {
    const top = town.top(c);
    if (top <= 0) continue;
    const [x0, x1, z0, z1] = box(c);
    put(x0, x1, z0, z1, top);
  }
  // 房子：房身 1~2 级 + 屋面（rise ≈ 0.62*cell.size，折算成层）
  for (const h of houses) {
    const top = h.top ?? town.top(h.cell);
    if (top <= 0) continue;
    const bodyLv = h.spire ? 2 : 1;
    const rise = Math.min(0.62 * h.cell.size, 0.5) / levelHeight;   // ≈ 0.7~1.2 层
    const [x0, x1, z0, z1] = box(h.cell);
    put(x0, x1, z0, z1, top + bodyLv + rise);
  }

  const data = new Uint8Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    const v = Math.round(Math.min(255, (caster[i] / maxLv) * 255));
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
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

  const uniforms = {
    uShMap: { value: texture },
    uShXform: { value: new THREE.Vector4(minX, minZ, 1 / spanX, 1 / spanZ) },
    uShSunUV: { value: new THREE.Vector2(0, 0) },
    uShReach: { value: reach },
    uShTestLv: { value: testLv },
    uShCastLv: { value: castLv },
    uShStrength: { value: strength },
    uShMaxLv: { value: maxLv },
    uShLevel: { value: 1 / levelHeight },
  };

  return {
    texture,
    uniforms,
    res,
    maxLv,
    /** 太阳方向（世界 xz → uv 单位的每世界单位增量）。 */
    setSun(dir) {
      const l = Math.hypot(dir.x, dir.z) || 1;
      uniforms.uShSunUV.value.set((dir.x / l) / spanX, (dir.z / l) / spanZ);
    },
    /** A/B 用：单独改投射高度 / z 测试 / 强度。 */
    setCast(v) { uniforms.uShCastLv.value = v; },
    setReach(v) { uniforms.uShReach.value = v; },
    setStrength(v) { uniforms.uShStrength.value = v; },
    get stats() {
      let lit = 0;
      for (let i = 0; i < caster.length; i++) if (caster[i] > 0) lit++;
      return {
        res,
        maxLv,
        covered: lit,
        castLv: uniforms.uShCastLv.value,
        reach: uniforms.uShReach.value,
        testLv: uniforms.uShTestLv.value,
      };
    },
    dispose() { texture.dispose(); },
  };
}

/** 把面阴影挂到一个已经有 onBeforeCompile 的材质上（surface.js / vertexlight.js 之后）。 */
export function attachSurfaceShadow(material, shadow) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey;

  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, shadow.uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_BODY);
  };

  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : '') + '+ss1';
  material.userData.surfaceShadow = shadow;
  return material;
}
