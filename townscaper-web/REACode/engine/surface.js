/**
 * surface.js — the texture layer: projected patches blended by slope and height.
 *
 * Two source notes drive this file.
 *
 * (1) x.com/OskSta/status/1781405550061687016
 *
 *   "Ok this might not look like much but I've got seamless patch blending!
 *    Some of the patches are projected (like the grass and the water) and some
 *    are manually UV-mapped (like the shoreline). With some good textures and
 *    some height based blending this is gonna be great."
 *
 *   So the island is not one UV-mapped mesh. It is a set of *patches*, each
 *   with its own way of getting a texture coordinate, and the seams between
 *   patches are hidden by blending. Projected patches have no seam at all
 *   because their coordinate is world position — that is the whole trick: a
 *   projected patch is continuous across every triangle, no matter how the
 *   topology wanders. Only the shoreline needs real UVs, because it follows a
 *   curve rather than a plane.
 *
 *   Here every patch is a projection: ground projects on XZ, cliffs project on
 *   the vertical plane, and the two are mixed by how flat the surface is
 *   (`smoothstep(0.45, 0.8, n.y)`). Blending by *normal* rather than by a
 *   hand-painted mask is the same idea as "height based blending" — the mask
 *   is derived from the geometry, so it stays seamless when the mesh changes.
 *
 * (2) x.com/OskSta/status/1241096929490149376
 *
 *   "I make the UVs speed past every 2nd pixel before sampling. It's core to
 *    my art style and what lets me get away with one 128² texture and crisp
 *    antialiasing up close."
 *
 *   His 128² atlas puts every line in every second texel; the UV is warped so
 *   the *fill* texels own most of the cell and the line texel is squeezed to a
 *   sliver. The result: lines that stay one pixel wide from any distance, with
 *   no mip blur, out of a tiny texture.
 *
 *   We have no texture pipeline, so the same split is made analytically from
 *   the screen-space derivative (`fwidth`): the line width is measured in
 *   pixels, not in world units, so it holds at ~1.2 px whether the camera is
 *   30 units away or 3. That is the property the note is after. (This is the
 *   fwidth trick he points at in 978211952504852480 — "use fwidth, ddx and ddy
 *   to create crisp, pixel perfect, zoom independent, antialiased lines".)
 *
 * Cost: three fwidth calls and a handful of smoothsteps per fragment, no
 * texture fetches at all. That is the same budget class as one 128² lookup.
 *
 * (3c) x.com/OskSta/status/1714613599035863191
 *
 *   "Another strange texturing style. This time trying to look a bit like
 *    abstract fields. A nice thing is they show the game tiles quite clearly."
 *
 *   淡黄岛面上密布**同心波纹状细线**（间距 4~8px），线跨过格子连续不断，
 *   于是格子边界反而被线"衬"了出来 —— 这就是原文说的 "show the game tiles clearly"：
 *   线是投影的、格子是几何的，两套网格叠在一起时，直线的格子边会从弯曲的线里跳出来。
 *
 *   画面上量到：岛宽 ≈ 520px 时线距 ≈ 6px，全岛 ≈ 38 世界单位 → **线距 ≈ 0.44**；
 *   但同一片区域里相邻线的间距在 4~9px 之间浮动，说明是**干涉场**（两个方向的正弦
 *   叠加），不是等距条纹。所以这里用两路 sin 相加造场，再对场取细线。
 *
 * (3b) x.com/OskSta/status/1313841094069817344
 *
 *   "Because I'm quite proud of my lighting (and because Townscaper is basically
 *    just a tech demo anyway) I added texture-only and light-only render modes"
 *
 *   他加了两个纯调试视角：只看贴图（无光照）、只看光照（无贴图色）。
 *   为什么值得做：这一层现在叠了 6 个东西（贴图/沉积线/色块/坡向条纹/面阴影/
 *   顶点光），互相干扰的时候光看合成图判断不出是谁的问题。有了这两个模式，
 *   "线没了" 到底是贴图层没启用，还是光照把它压掉了，一眼就分得出来。
 *
 *   实现上不换材质（换材质会丢掉所有 onBeforeCompile 链），而是在标准材质的
 *   最后一步把输出换掉：
 *     uViewMode = 0 正常 / 1 纯贴图（albedo） / 2 纯光照（亮度）
 *
 * (3) x.com/OskSta/status/1699146321318314094
 *
 *   "Oh! And now I finally figured out how to make non-straight sedimentary
 *    lines! Most of the texturing math is kinda linear, so I though the lines
 *    had to be linear too. But I could (obviously) just make the whole world
 *    wobbly, do the texturing math, then simply undo the wobble."
 *
 *   贴图数学（沉积线）是线性的：线 = fract(y * k)，所以线永远是水平直线。
 *   他的做法是把**采样位置**抖一下再算：p' = p + noise(p)，用 p' 去算线性
 *   数学，得到的线就自己弯了。注意抖的只是"取纹理的坐标"，几何、法线、光照
 *   都不动 —— 这就是"再把歪的撤掉"：世界没有被真的扭曲，只有纹理被查到了
 *   一个错位的点。
 *
 *   画面实测（1699146321318314094 的第 0 帧）：
 *     · 崖壁上每 0.18~0.20 世界单位一条细暗线（一次崖高 2 单位 ≈ 10 条）
 *     · 线的偏移量约 ±0.4 条间距，波长约 4~5 个格子（≈ 2 世界单位）
 *     · 线本身不抖不噪，是干净的 S 弯 —— 说明抖动用的是低频噪声，不是抖动
 *   所以这里用两路低频值噪声（振幅 ±0.5）去偏移 y 和 xz，幅度取 0.16，
 *   也就是 ±0.08 ≈ 0.43 条带间距。
 */

import * as THREE from 'three';

const CHUNK = /* glsl */ `
  varying vec3 vSurfPos;
  varying vec3 vSurfNrm;
  uniform float uSurfStrength;
  uniform float uSurfScale;
  uniform float uSurfBase;   // world y of sea level, so patterning is level-relative
  uniform float uSedAmp;     // 沉积线抖动幅度（世界单位）
  uniform float uNormalMix;  // 1 = 平滑法线，0 = 原始硬法线（原文 929417420921556993）
  uniform float uSedFreq;    // 抖动噪声频率（每世界单位几个周期）
  uniform float uViewMode;   // 0 正常 / 1 纯贴图 / 2 纯光照（调试视角）
  uniform float uFieldAmt;   // 抽象田野的线强度（0 = 关）
  uniform float uSlopeGrass; // 坡面草强度（0 = 关，原文 1063115611289645057）
  uniform float uFieldFreq;  // 场的频率（每世界单位几个周期）

  // --- 低频值噪声：只用来抖纹理坐标，不进光照 -----------------------------
  float sHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float sNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = sHash(i);
    float b = sHash(i + vec2(1.0, 0.0));
    float c = sHash(i + vec2(0.0, 1.0));
    float d = sHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  // 两层足够：一层给大 S 弯，一层给小的不规则；三层以上在崖面上看着像噪点
  float sWobble(vec2 p) {
    return sNoise(p) * 0.72 + sNoise(p * 2.07 + 17.3) * 0.28;
  }

  // "把世界弄歪"：只返回抖动量，调用方自己加到采样坐标上
  vec3 sWarp(vec3 wp) {
    vec2 q = wp.xz * uSedFreq;
    float a = sWobble(q + 3.1) - 0.5;
    float b = sWobble(q * 0.87 + 41.7) - 0.5;
    // y 抖得最多（沉积线是水平带，弯的是它）；xz 也抖一点，
    // 否则线只是"上下浮动"，看起来像整块崖壁在抖而不是岩层在弯
    return vec3(b, a, b * 0.7) * uSedAmp;
  }

  // One cell of the "line texel": returns 1 on the line, 0 in the fill.
  // The width is pulled from the derivative, i.e. it is a *pixel* width, which
  // is what keeps lines crisp up close instead of turning into fat bands.
  float surfLine2(vec2 p, float px) {
    vec2 fw = fwidth(p);
    vec2 f = fract(p);
    vec2 d = min(f, 1.0 - f);
    // clamp: at grazing angles the derivative explodes and an unclamped width
    // swallows the whole cell, which reads as a checkerboard of dark blocks
    float w = clamp(max(max(fw.x, fw.y) * px, 0.0015), 0.0, 0.24);
    float line = 1.0 - smoothstep(w * 0.3, w, min(d.x, d.y));
    // once a cell is ~2 px across the lattice can only moire, so fade it out
    float fade = 1.0 - smoothstep(0.16, 0.38, max(fw.x, fw.y));
    return line * fade;
  }

  // 1D version: horizontal strata only depend on height.
  float surfLine1(float p, float px) {
    float fw = max(fwidth(p), 1e-4);
    float f = fract(p);
    float d = min(f, 1.0 - f);
    float w = clamp(fw * px, 0.0015, 0.24);
    float line = 1.0 - smoothstep(w * 0.3, w, d);
    float fade = 1.0 - smoothstep(0.16, 0.38, fw);
    return line * fade;
  }

  // --- patch A: ground. Fine dashes (grass tufts / cobbles) plus a broad
  // lattice at 1/4 the frequency, which reads as plots without a second texture.
  float surfGround(vec2 p) {
    float fine = surfLine2(p, 1.35);
    float broad = surfLine2(p * 0.25, 1.15);
    return clamp(fine * 0.9 + broad * 0.7, 0.0, 1.0);
  }

  // --- 抽象田野（1714613599035863191）--------------------------------
  // 两路低频 sin 相加成"场"，场值再取细线。线的形状是两族波纹的干涉，
  // 所以既不等距也不平行 —— 这正是参考片里那种"波纹"的感觉。
  float fieldLines(vec3 wp) {
    // 线的**间距**必须由 sin 的频率决定，不能靠"把场值乘大"。
    // 踩过的坑：第一版把场值乘 4（p = f*4）来加密，结果把抖动项的高频也放大了 4 倍，
    // fwidth(p) 直接顶到 0.3 以上 → 线宽覆盖整个格子 → 画面上看不到条纹，
    // 只是一片"均匀压暗"的草地。改成频率进 sin、倍数保持 1。
    float f = sin((wp.x + wp.z * 0.35) * uFieldFreq + sWobble(wp.xz * 0.28) * 1.6) * 0.5
            + sin((wp.z - wp.x * 0.30) * uFieldFreq * 1.13 + sWobble(wp.xz * 0.28 + 11.0) * 1.6) * 0.5;
    // 高度也进一点，崖面上的线才会跟着"缠"下去，而不是直着穿过崖体
    f += wp.y * 0.5;
    float p = f;
    float px = max(fwidth(p), 1e-4);
    if (px > 0.50) return 0.0;               // 线细到亚像素时只会闪，直接关掉
    float d = abs(fract(p) - 0.5);
    float w = clamp(px * 0.55, 0.003, 0.07);   // 细线：约 1~2px
    return (1.0 - smoothstep(w * 0.45, w, 0.5 - d)) * (1.0 - smoothstep(0.22, 0.46, px));
  }

  // 沉积层的**两色**（原文 1699038611125985317）：
  //   "Looking at sedimentation lines again. Helps make large cliffs more
  //    interesting. Also makes their shape a bit more readable maybe."
  //   画面里那根砂色柱子是**米黄/浅粉两色交替**的横带，不是"只有深色细线"。
  //   所以这里除了线，再返回一个按层序奇偶的二值，让调用方给每层上不同色调。
  float surfBandTone(vec3 wp) {
    float bandIdx = floor((wp.y - uSurfBase) * 5.4);
    // 不平滑：层与层之间要有一条硬边，软过渡会变成渐变污渍
    return mod(bandIdx, 2.0);
  }

  // --- patch B: cliff. Sedimentary bands (constant in y) crossed by rare
  // vertical cracks. The bands are what make a tall cliff readable.
  // 这里的 wp 已经是"歪过的"坐标（见 sWarp），所以线是弯的。
  float surfCliff(vec3 wp) {
    float band = surfLine1((wp.y - uSurfBase) * 5.4, 1.25);
    // 每第三条是一道更宽的主层理：参考片里能明显分出"大层/小层"
    float major = surfLine1((wp.y - uSurfBase) * 1.8 + 0.31, 1.7);
    float crack = surfLine2(vec2((wp.x + wp.z) * 0.75, (wp.y - uSurfBase) * 0.22), 1.1);
    return clamp(band * 0.9 + major * 0.55 + crack * 0.35, 0.0, 1.0);
  }

  // 沉积砂砾：细点被限制在层理线附近，随像素宽度淡出（远处只会闪）
  float surfGravel(vec3 wp) {
    vec2 cell = floor(vec2((wp.x + wp.z) * 26.0, wp.y * 26.0));
    float px = max(fwidth(wp.x + wp.z) * 26.0, fwidth(wp.y) * 26.0);
    if (px > 0.55) return 0.0;                        // 一像素比一颗石头还大 → 关掉
    float g = step(0.80, sHash(cell));
    // 只在层理线附近撒（abs(fract-0.5)→0.5 就是线的位置）
    float band = smoothstep(0.26, 0.47, abs(fract((wp.y - uSurfBase) * 5.4) - 0.5));
    return g * band * (1.0 - px * 1.6);
  }
`;

/**
 * A MeshStandardMaterial whose albedo is modulated by the two projected patches.
 * Keeps vertex colours as the base, so palette work is untouched.
 */
export function makeSurfaceMaterial({
  roughness = 0.92,
  strength = 1.0,
  scale = 1.0,
  base = 0.0,
  sedAmp = 0.24,
  sedFreq = 0.52,
  fieldAmt = 0.0,
  slopeGrass = 0.0,
  fieldFreq = 13.5,
} = {}) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness,
    metalness: 0.0,
  });

  const uniforms = {
    uSurfStrength: { value: strength },
    uSurfScale: { value: scale },
    uSurfBase: { value: base },
    uSedAmp: { value: sedAmp },
    uNormalMix: { value: 1.0 },
    uSedFreq: { value: sedFreq },
    uViewMode: { value: 0 },
    uFieldAmt: { value: fieldAmt },
    uSlopeGrass: { value: slopeGrass },
    uFieldFreq: { value: fieldFreq },
  };
  material.userData.surfaceUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // "final lighting 里混平滑/硬法线"：几何上两份法线都在，
    // 混合只发生在光照计算前一步。缺 aFlatNormal 的网格（屋顶）会读到 0，
    // 所以这里用一个长度判断回退到自己的 normal —— 否则 uNormalMix<1 时
    // 屋顶法线会被乘成接近零向量，整片变黑。
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         {
           vec3 hn = aFlatNormal;
           if (dot(hn, hn) < 0.01) hn = objectNormal;
           objectNormal = normalize(mix(hn, objectNormal, uNormalMix));
         }`
      )
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 aFlatNormal;\nuniform float uNormalMix;\nvarying vec3 vSurfPos;\nvarying vec3 vSurfNrm;'
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vSurfPos = (modelMatrix * vec4(position, 1.0)).xyz;
         vSurfNrm = normalize(mat3(modelMatrix) * normal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CHUNK)
      .replace(
        '#include <opaque_fragment>',
        `if (uViewMode > 0.5) {
           // 1 = 纯贴图：直接输出 albedo（所有贴图层已经在 diffuseColor 里了）
           // 2 = 纯光照：输出 outgoingLight 的亮度，去掉色相只剩明暗
           vec3 dbg = uViewMode < 1.5
             ? diffuseColor.rgb
             : vec3(dot(outgoingLight, vec3(0.299, 0.587, 0.114)));
           gl_FragColor = vec4(dbg, diffuseColor.a);
         } else {
           #include <opaque_fragment>
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           vec3 sn = normalize(vSurfNrm);
           vec3 wp = vSurfPos;
           float sc = uSurfScale;

           // Both patches are projected from world space, so they cannot seam
           // across triangles — that is the "seamless" half of the note.
           float ground = surfGround(wp.xz * 2.1 * sc);
           // 先弄歪，再算线性数学，几何/法线/光照一个都没动（"再把歪的撤掉"）
           vec3 sed = wp + sWarp(wp);
           float cliff  = surfCliff(sed / max(sc, 0.25));
           float gravel = surfGravel(sed) * uSurfStrength;
           // 两色层理（1699038611125985317）
           float tone = surfBandTone(sed);

           // height blending: a slow tint shift with altitude, so a mesa top is
           // not the same value as the beach at its foot
           float alt = clamp((wp.y - uSurfBase) / 7.0, 0.0, 1.0);
           vec3 tint = mix(vec3(1.0), vec3(1.06, 1.01, 0.93), alt);

           // slope blend between the two patches = the blend mask, no art needed
           float flatness = smoothstep(0.45, 0.82, sn.y);
           float mask = mix(cliff, ground, flatness);

           vec3 c = diffuseColor.rgb * tint;
           // 层理两色：只在陡面上生效（平地上不该出现横向条带），
           // 幅度很小 —— 参考片里是"同一块岩体深浅交替"，不是两条不同材质
           float steep = 1.0 - smoothstep(0.35, 0.80, sn.y);
           c *= 1.0 + (tone - 0.5) * 0.16 * steep * uSurfStrength;
           // 高度分段线：压暗一档，比层理更淡
           c *= mix(1.0, 0.54, clamp(mask, 0.0, 1.0) * uSurfStrength);
           // 抽象田野：在**所有朝向**上都画（参考片的线也爬上了崖面），
           // 但崖面上压到 0.6，避免竖面被线切得太碎
           if (uFieldAmt > 0.001) {
             float fl = fieldLines(wp);
             // amt 必须夹在 1 以内：mix 的 t>1 会**外插**，颜色被推到负数变纯黑，
             // 于是"调强一点"变成"全是黑线"。所以强度靠目标色控制，不靠 amt 超 1。
             c = mix(c, c * 0.45, clamp(fl * uFieldAmt, 0.0, 1.0) * mix(0.55, 1.0, flatness));
           }

           // 坡面草（原文 1063115611289645057）：
           //   "I finally added grass to slopes to make navigability easier to read
           //    (especially on overcast levels where the lighting ain't helping much)"
           // 判据是**坡度**而不是高度：崖面太陡不长草，台地顶归色块管，
           // 只有中间那条"能走上去"的坡带被草标出来 —— 这就是"可读性"。
           if (uSlopeGrass > 0.001) {
             float slope = 1.0 - abs(sn.y);
             float band = smoothstep(0.16, 0.30, slope) * (1.0 - smoothstep(0.60, 0.80, slope));
             // 草茬：用现成的像素级细线当"草叶"，远看融成一层绿雾
             float stub = surfLine2(wp.xz * 8.0 + wp.y, 1.0);
             vec3 grass = mix(c * vec3(0.84, 1.05, 0.72), c * vec3(0.70, 1.00, 0.58), stub);
             c = mix(c, grass, band * uSlopeGrass);
           }

           // 砂砾比层理线亮一点：参考片里颗粒是浅色的小点，不是黑洞
           c = mix(c, c * 1.45 + 0.02, gravel * (1.0 - flatness) * 0.5);
           diffuseColor.rgb = c;
         }`
      );
  };

  // Distinct cache key: three would otherwise reuse the stock standard program.
  material.customProgramCacheKey = () => 'oska-surface-v1';
  return material;
}
