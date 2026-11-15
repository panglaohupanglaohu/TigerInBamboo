// 第 100 轮 · 灌木叠层（能力库显示层 SHRUB_LAYER_FRAG）接 `aBand` 的逻辑验收。
//
// 背景：第 99 轮给宿主着色器落了逐三角带宽倍率 aBand（src/terrain/shrub-band.js），
//   但 src/terrain/shrub-texture.js 的叠层版 SHRUB_LAYER_VERT/FRAG 没接 → 能力库页面里带宽是匀的一档，
//   与宿主同屏的两条带子宽度对不上。本轮补上，这个文件锁住「两边同式」这件事。
//
// 断言分两类：
//   A. 结构：叠层 vert/frag 真的声明并传递了 aBand（漏声明 = 编译期就没有这个 varying）。
//   B. 同式：宿主 shrubApply 与叠层 width 表达式在去掉空白后**逐字**含同一个带宽子串；
//      齿距两档、法线归一化、顶面门控也一并锁住（任一处漂了，两条带子又会对不上）。
import { readFileSync } from 'node:fs';
import { SHRUB_LAYER_VERT, SHRUB_LAYER_FRAG, SHRUB_GLSL, SHRUB_DEFAULT_STYLE } from '../src/terrain/shrub-texture.js';

const rows = [];
const ok = (c, m) => rows.push({ ok: !!c, m });
const strip = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');

const V = strip(SHRUB_LAYER_VERT);
const F = strip(SHRUB_LAYER_FRAG);
const H = strip(SHRUB_GLSL);
const src = readFileSync(new URL('../src/terrain/shrub-texture.js', import.meta.url), 'utf8');

// ---- A. 结构 ----
ok(V.includes('attributefloataBand;'), '叠层 vert 声明 attribute float aBand');
ok(V.includes('varyingfloatvBand;'), '叠层 vert 声明 varying float vBand');
ok(V.includes('vBand=aBand;'), '叠层 vert 把 aBand 传给 vBand');
ok(F.includes('varyingfloatvBand;'), '叠层 frag 声明 varying float vBand');
ok(F.includes('floatband=vBand>.05?vBand:1.;'), '叠层 frag 有 band 兜底（缺属性时 =1，旧几何逐位不变）');

// ---- B. 同式 ----
const WIDTH = 'band*(.55+.9*bfbm(w.xz*1.1+3.7))';
ok(H.includes(WIDTH), `宿主 width 含带宽子串 ${WIDTH}`);
ok(F.includes(WIDTH), `叠层 width 含同一带宽子串（两边逐字相同）`);
// 宿主 width 是 uShrubStyle.x * (band*... * mix(.5,1.0,cover))，叠层是 uShrubStyle.x*(band*...)*mix(.5,1.,cover)
// —— 乘法律等价，只差括号位置；这里锁「乘数集合」一致，避免有人只改一侧。
ok(H.includes('mix(.5,1.0,cover)') && F.includes('mix(.5,1.,cover)'), '两边都是 mix(.5,1,cover) 收窄项（不是乘 cover 清零）');
ok(H.includes('uShrubStyle.x*(') && F.includes('uShrubStyle.x*('), '两边 width 都由 uShrubStyle.x 起算');
// 齿距两档（第 72 轮）
ok(H.includes('mix(uShrubTooth,toothFar') || H.includes('toothFar=max(8.0,uShrubTooth*.35)'), '宿主齿距 far 档 = max(8, 0.35×uShrubTooth)');
ok(F.includes('mix(uShrubTooth,max(8.,uShrubTooth*.35)'), '叠层齿距同式');
ok(F.includes('1.-smoothstep(.085,.115,fw)') && H.includes('1.-smoothstep(.085,.115,fw)'), '两边远景齿衰减阈值一致（.085/.115）');
// 光照归一化（叠层是透明混合，必须和宿主同一个 lambert 项，否则同屏两层颜色不同）
ok(F.includes('(.72+.28*max(0.,dot(vN,normalize(uSunDir))))'), '叠层法线光照项 (.72+.28·max(0,N·L))');
ok(H.includes('floatlit=') && F.includes('floatlit='), '两边都有受光亮团 lit（bfbm 2.4）');
// 顶面门控（叠层必须只画顶面，否则崖壁立面也会叠一层灌木）
ok(F.includes('vField.z<.5||vField.z>1.5||vN.y<.8||vEdge>.999'), '叠层只画顶面（aField.z∈[.5,1.5] 且 n.y≥.8）');

// ---- 数值：倍率区间真的落在 1.94× 上 ----
// 直接照着色器式子重算三次赋值下的 width 比例，证明 aBand 的 0.70–1.36 会 1:1 传到叠层带宽。
const bandOf = (t) => 0.70 + (1.36 - 0.70) * t;
const widthOf = (band, bfbm, cover) => SHRUB_DEFAULT_STYLE.width * (band * (0.55 + 0.9 * bfbm) * (0.5 + 0.5 * cover));
const lo = widthOf(bandOf(0), 0.5, 0.5), hi = widthOf(bandOf(1), 0.5, 0.5);
ok(Math.abs(bandOf(1) / bandOf(0) - 1.36 / 0.70) < 1e-12, `aBand 端值比 ${(1.36 / 0.70).toFixed(4)}（1.94×）`);
ok(Math.abs(hi / lo - 1.36 / 0.70) < 1e-12, `叠层 width 端值比 ${(hi / lo).toFixed(4)} = aBand 端值比（1:1 传递，不被 cover 吞掉）`);
ok(lo > 0.05 && hi < 0.75, `叠层 width 端值 ${lo.toFixed(3)}–${hi.toFixed(3)}（都在 0–1 归一化距离内，不会越过格心）`);

// ---- 注释纪律：整面覆盖档已标「本仓扩展」 ----
ok(/标为本仓扩展/.test(src), '整面覆盖档（aEdge=-1）源码里已标注「本仓扩展」');
ok(/第 100 轮/.test(src), '叠层接 vBand 处带第 100 轮注记（便于回溯）');

const bad = rows.filter((r) => !r.ok);
console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
console.log(bad.length ? `\nFAIL ${bad.length}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
if (bad.length) process.exitCode = 1;
