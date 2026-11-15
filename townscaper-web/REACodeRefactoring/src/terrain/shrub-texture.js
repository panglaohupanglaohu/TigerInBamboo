// 纯纹理灌木（1707490932017279035 / 1707497006640365880，2023-09-28）。
//
// README 原文（先读原文再学）：
//   1707490932017279035 "They are of course 100% texture, painted onto a fairly low, poly mesh. I keep thinking I'm gonna need to give em
//     some volume with billboard sprites, but now I'm not so sure anymore. Especially with the lil' shadows, they look quite volumetric as they are."
//   1707497006640365880 "And here's a couple more being generated"（同一套灌木，在新生成的岛上出现）
//   上一条 1707490274425884929 "I added back the lil' shrubbery at the edges of things for like the 3rd time"：灌木在「东西的边上」。
// 逐帧（257 帧 / 600 帧，见 artifacts/coverage/<id>-review-r46.md）：
//   · 三角线框直接穿过灌木 → 灌木没有几何，就是贴在低模顶面上的颜色；
//   · 灌木是沿台地 / 崖顶边缘的一条鲑橙色带，宽窄不一、有的边没有；外轮廓是一串小圆齿（锯齿状扇贝边）；
//   · 灌木靠格心那一侧的草地上有一道窄的深色「小阴影」，灌木身上有更亮的团块 → 看起来有体积；
//   · 有一道细的深色描边勾住灌木内缘。
// 做法（不加几何、不加广告牌）：terrainmesh 给顶面扇形每顶点写 aEdge = 到崖边的归一化距离（0 崖边 → 1 格心），
//   着色器里 d = aEdge + 噪声扰动；d < 宽度 → 灌木；宽度由低频噪声调（有的边断开）；外缘高频噪声 = 扇贝齿；
//   [宽度, 宽度 + 阴影宽] 这一窄带 = 灌木投在草上的小阴影；灌木内部低频亮团 = 受光面。
// 依赖 BLOTCH_GLSL 里的 bn / bfbm 噪声（view.js 里先拼接 BLOTCH_GLSL 再拼本段）。
export const SHRUB_GLSL = `
uniform float uShrub;
uniform vec4 uShrubStyle;   // x 宽度（0–1，相对格心距离） y 锯齿幅度 z 小阴影强度 w 覆盖率（0–1）
// 第 72 轮：外缘齿距独立参数（每单位多少个齿；1 格边 ≈ 0.9 单位）。
uniform float uShrubTooth;
uniform vec3 uShrubColor;
varying float vEdge;
// 第 99 轮 · 逐三角带宽倍率（src/terrain/shrub-band.js）：三个顶点同值 → 沿一个顶面三角恒定，
//   所以「同格不同边宽窄、沿一条边不变」。缺属性（别的几何）时 aBand 读到 0，这里兜回 1。
varying float vBand;
vec3 shrubApply(vec3 base, float e, vec3 w) {
  // 第 70 轮：整面覆盖档（落差 ≥4 层，terrainmesh 写 aEdge = -1）。
  //   第 100 轮复核 600/257 全片（9 张联系表）：**没有任何一格是整片橙**——塔顶那几帧（600 的 0330–0430、
  //   257 的 0180–0270）中心始终留一条米白/浅粉的窄带，橙色仍在边缘一圈、只是带宽被拉到格宽的大半。
  //   所以这一档保留，但**标为本仓扩展**（不是原片实证的档位），只在 aEdge=-1 的极端落差格上出现，不再据它做标定。
  //   着色上仍直接整片铺：既不走阈值线（会插出一条假边界），也不叠细齿（宽档上齿距已无参照带宽）。
  if (e < -.5) {
    float litF = smoothstep(.45, .7, bfbm(w.xz * 2.4 + 31.0));
    vec3 wide = uShrubColor * mix(.90, 1.12, litF) * mix(.955, 1.02, bn(w.xz * 11.0));
    return wide;
  }
  float cover = smoothstep(.62 - uShrubStyle.w * .55, .7 - uShrubStyle.w * .55, bfbm(w.xz * .33 + vec2(17.3, 4.1)));
  // 第 60 轮：cover 只「收窄」不「清零」——直接乘 cover 会让带子在低频门控处整段消失，读起来是一坨一坨
  float band = vBand > .05 ? vBand : 1.0;
  float width = uShrubStyle.x * (band * (.55 + .9 * bfbm(w.xz * 1.1 + 3.7)) * mix(.5, 1.0, cover));
  if (width < .01) return base;
  // 第 66 轮：外缘拆两套尺度。原片一条格边上：大瓣 2–3 个（freq 9 → 3.3 个/单位 ≈ 2.3 个/格边），
  // 外沿再挂 20+ 个细密扇贝齿（freq 46 → 26 个/单位 ≈ 18 个/格边，齿尖是尖的，用 abs 造 cusp）。
  // 旧写法把 bfbm(6.5) 与 bn(23) 混在一起（≈每格边 6 个起伏），两样都不像。
  float lobe = (bn(w.xz * 9.0 + 9.1) - .5) * uShrubStyle.y * 1.6;
  // 第 67 轮：细齿按屏幕导数分级降频（原片远景的齿是「变粗」不是「被抹平」）。
  // 第 72 轮：**齿距成为独立参数** uShrubTooth（每单位齿数，默认 46 = 第 67 轮标定值，所以默认观感逐位不变）。
  //   far 档按比例降到 0.35×（46→16，与旧常量一致），下限 8 防远景出现低频摩尔纹。
  float dBase = e + lobe;
  float fw = fwidth(dBase);                                    // 像素跨度（以 e 的归一化单位计）
  // 只采样一次噪声、直接把频率往下降 —— 混两条不同频率的波不会变「粗」，实测峰数 25.9→30.3 反而更多
  float toothFar = max(8.0, uShrubTooth * .35);
  float toothFreq = mix(uShrubTooth, toothFar, smoothstep(.045, .075, fw));
  float tooth = (abs(bn(w.xz * toothFreq + 5.3) * 2. - 1.) - .5) * uShrubStyle.y * .55 * (1. - smoothstep(.085, .115, fw));
  float d = dBase + tooth;
  float aa = fw * 1.2 + .003;
  float body = 1. - smoothstep(width - aa, width + aa, d);
  float shW = .055 + .035 * bn(w.xz * 3.1);
  float shadow = (1. - smoothstep(width + shW - aa, width + shW + aa, d)) * (1. - body);
  float rim = (1. - smoothstep(width - .028 - aa, width - .028 + aa, d)) ;
  rim = body * (1. - rim);                                  // 内缘一条细描边
  float lit = smoothstep(.45, .7, bfbm(w.xz * 2.4 + 31.0));  // 受光亮团
  vec3 shrub = uShrubColor * mix(.92, 1.14, lit) * mix(.95, 1.03, bn(w.xz * 11.0));
  shrub = mix(shrub, uShrubColor * .55, rim * .75);
  vec3 c = mix(base, base * (1. - .42 * uShrubStyle.z), shadow);
  return mix(c, shrub, body);
}
`;
// 第 60 轮：原片带宽占崖高 8–12% 且每层台地都压一条；0.36 + 纯乘 cover 渲出来只是一条发丝状淡粉线。
// width 0.36→0.50、coverage 0.62→0.50（门控更松），并把颜色往饱和橙推（#e8876a→#e2723f）。
// 第 66 轮：ragged 0.15→0.22——大瓣（×1.6）要吃满约 5% 格宽、齿（×0.55）约 2–3px，0.15 时齿只有 1px 看不见。
export const SHRUB_DEFAULT_STYLE = Object.freeze({ width: 0.50, ragged: 0.22, shadow: 1, coverage: 0.50, color: '#e2723f', tooth: 46 });
/** 第 72 轮：外缘齿距（每单位齿数）。46 = 第 67 轮按原片量出来的标定值；调大齿更密、调小更疏。
 *  1 格边 ≈0.9 单位，所以 46 个/单位 ≈ 每格边 41 个细扇贝齿，另有 freq 9 的大瓣（≈8 个/格边）。 */
export const SHRUB_TOOTH = Object.freeze({ min: 6, max: 90, default: 46 });

/**
 * 叠层版（能力库显示层用；不碰宿主材质）：与世界网格**共用同一份几何**（要有 aEdge / aField / normal），
 * 第二个网格用这个 ShaderMaterial 只画灌木与小阴影，其余像素丢弃。需要在前面拼 BLOTCH_GLSL 的噪声。
 */
export const SHRUB_LAYER_VERT = `
attribute float aEdge; attribute vec3 aField;
// 第 100 轮：逐三角带宽倍率（第 99 轮 src/terrain/shrub-band.js 落的 aBand），叠层必须与宿主读同一个属性。
//   几何缺 aBand 时 WebGL 给该 attribute 的默认值是 0 → band 兜回 1，旧几何画面逐位不变。
attribute float aBand;
varying float vEdge; varying vec3 vField; varying vec3 vWPos; varying vec3 vN; varying float vBand;
void main(){ vEdge=aEdge; vField=aField; vBand=aBand; vec4 w=modelMatrix*vec4(position,1.); vWPos=w.xyz; vN=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*w; }`;
export const SHRUB_LAYER_FRAG = `
uniform vec4 uShrubStyle; uniform vec3 uShrubColor; uniform vec3 uSunDir; uniform float uShrubTooth;
varying float vEdge; varying vec3 vField; varying vec3 vWPos; varying vec3 vN; varying float vBand;
void main(){
  if(vField.z<.5||vField.z>1.5||vN.y<.8||vEdge>.999) discard;
  vec3 w=vWPos; float e=vEdge;
  if(e<-.5){ /* 第 70 轮：整面覆盖档，与宿主着色器同式 */ 
    vec3 wide=uShrubColor*mix(.90,1.12,smoothstep(.45,.7,bfbm(w.xz*2.4+31.)))*mix(.955,1.02,bn(w.xz*11.));
    gl_FragColor=vec4(wide*(.72+.28*max(0.,dot(vN,normalize(uSunDir)))),1.);
    #include <colorspace_fragment>
    return; }
  float cover=smoothstep(.62-uShrubStyle.w*.55,.7-uShrubStyle.w*.55,bfbm(w.xz*.33+vec2(17.3,4.1)));
  // 第 100 轮：接 vBand，与宿主 shrubApply 同式（第 99 轮之前这里漏了 band，能力库页面里带宽是匀的一档，
  //   而宿主每格每边 0.70–1.36 倍率 → 同一屏上叠层与宿主两条带子宽度对不上）。
  float band=vBand>.05?vBand:1.;
  float width=uShrubStyle.x*(band*(.55+.9*bfbm(w.xz*1.1+3.7)))*mix(.5,1.,cover); if(width<.01) discard;
  float lobe=(bn(w.xz*9.+9.1)-.5)*uShrubStyle.y*1.6;
  // 第 67 轮：与宿主着色器同步——细齿按 fwidth 分级降频（近 46 / 中 16 / 远只留大瓣）
  float fw=fwidth(e+lobe);
  float tooth=(abs(bn(w.xz*mix(uShrubTooth,max(8.,uShrubTooth*.35),smoothstep(.045,.075,fw))+5.3)*2.-1.)-.5)*uShrubStyle.y*.55*(1.-smoothstep(.085,.115,fw));
  float d=e+lobe+tooth, aa=fw*1.2+.003;
  float body=1.-smoothstep(width-aa,width+aa,d);
  float shW=.055+.035*bn(w.xz*3.1);
  float shadow=(1.-smoothstep(width+shW-aa,width+shW+aa,d))*(1.-body);
  float rim=body*smoothstep(width-.028-aa,width-.028+aa,d);
  float lit=smoothstep(.45,.7,bfbm(w.xz*2.4+31.));
  vec3 c=uShrubColor*mix(.92,1.14,lit)*mix(.95,1.03,bn(w.xz*11.));
  c=mix(c,uShrubColor*.55,rim*.75)*(.72+.28*max(0.,dot(vN,normalize(uSunDir))));
  float a=max(body,shadow*.42*uShrubStyle.z); if(a<.01) discard;
  gl_FragColor=vec4(body>.5?c:vec3(0.),a);
  #include <colorspace_fragment>
}`;
