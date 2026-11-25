# 旋涡与可变密度 · 2026-11-04

按README精确ID先读：line47旋涡湿润团块1703750394164199473，line45可变密度和不太机械的高度分段1704246032626762189。视频仅展示效果，没有给出内部旋转/图集采样方程。

592帧0–591与564帧0–563，共1156帧。两段各sheet-00至05全部逐格核验，原尺寸分别500/200回看。原帧、帧号、时间戳及逐帧阶段观察保存在各ID目录。多个岛体间有空背景/黑轮廓切换；纹样有从简到细显现的过程，只记观察，不将它归因到未经展示的调度机制。旋涡片末段有细小相互卷入的曲线，当前本地三档噪声无法完全复现。

原版engine/blotch.js使用atlas、角度场旋转和另尺度密度通道、rim/高度场；它的实现也是本地重建，不等同视频作者原代码。现有重构只有域扭曲噪声三档。保留旧模式，新增可选旋转场（worldXZ的低频角度）与独立低频密度阈值场。密度作用于阈值而非整片统一明暗；fwidth对色块阈值柔边。真实View新增setBlotchStyle，所有数值先校验再更新uniform。沿用上一批几何身份隔离和真实层高。

blotches.html载入真正共享World/View，可切旧/旋涡/旋涡密度、两网格与参数；浅层线复用sediment shader且强度0.2，不重新造层理几何。默认主游戏模式仍旧值，实验页显式启用新模式。只是本地近似：没有原作atlas、独立细卷墨线、精确配色和连续跨崖/反射同步；不声称视觉等价/全API迁移。

测试见tests/blotch-style-browser.cjs：实际View渲染GPU比较旋涡/密度参数，零强度与关闭一致；5组非法参数拒绝且不部分提交。World/position/geometry身份均保持；结果blotch-style-browser.json，双网格截图blotch-style-{mixed,quad}.png。

实测：mixed旋涡/密度改变8299/6217像素，quad为7985/6100；零强度差异均0，5组非法参数均拒绝。截图已目视：当前角度场出现偏强的大环纹，缺少原片细密互卷边，配色仍灰褐；继续列视觉缺口。页面回归确认两页82/285、旧默认/原fields增量/strata开关通过，无页面异常。首次收口因favicon的404失败，改为按响应URL排除favicon，真实资源及shader错误仍检查；复跑通过。

## 裁判参数对齐轮 · 2026-11-24（1703750394164199473 / 1704246032626762189）

残差拆分：「配色」与「跨崖/反射一致性」可执行，「原作atlas/细卷边」为原素材卡点·B。

- 配色：旧噪声路径 mode1 由灰度三档改为裁判 engine/blotch.js BODY 逐式参数——vec3 tint（橄榄 .86,1.02,.74 / 锈红 1.16,.88,.70）、cold .44/.60、warm .55/.70、edge .36/.48·.70/.54×.10、密度改裁判权重式 mix(1-d,1+d*.45,ss(.34,.66) 低频 .22 旋涡后尺度，不再平移阈值)、细颗粒 step(.80)·w·.22·fwidth淡出（本地 p*12 = 裁判图集 B 通道 12× 基频比率）；角度场换裁判 bWobble 逐式（.72/.28·2.07+17.3，Node 断言与 blotch-atlas.js blotchWobble 逐位一致）。edge 压暗按含强度 wgt 计（裁判 topW 不含 uBlotchAmt 是 strength=0 仍留压暗的特例；本路径保零强度=关闭契约）。
- 图集路径补裁判 BODY 末项细颗粒：CPU blotchRimTint 增 grain 返回项，BLOTCH_RIM_GLSL 同式；grainRes 极近景才出（|fwidth|*14<.03 → 像素宽<~.002wu），远处淡出防噪闪。
- 高度分段线：裁判崖面式 y*1.8·强度 .12 早已逐式在 uBlotchRimSeg（图集路径）；旧路径仍走共享层理着色，不重复造。
- 反射一致性：两条着色路径都只乘 diffuseColor（color_fragment 注入、光照之前，无 roughness/metalness/specular/envMap 项），与裁判 MeshStandardMaterial 只改 albedo 同构——复核无可移植高光项。
- 跨崖一致性：图集路径共享 World rim 场，顶面边前停→bleed 内受控渗→等深归零；旧路径 vUp>.8 顶面闸门，边界一致。

测试 tests/blotch-judge-style.mjs（Node）：GLSL 常数断言、JS 镜像橄榄混合 ±.02、密度权重式、strength0 恒等、uniform=3 纯函数、238 个共享 World 共边点双侧逐位一致、颗粒正/负/像素宽淡出、崖肩顶面停/墙面渗/过深归零全过。GPU 复跑：blotch-style-browser.cjs 双网格 mixed swirl 8432/density 5083px、quad 7809/4884px、零强度 0、5 组非法拒绝；blotch-atlas-rim-browser.cjs PASS（新 grain 编译通过、渗漏等深剖面复测）。剩余残差=原作本人图集文件与细卷边手绘细节未公开（卡点·B，裁判自身图集也是重建）；本地 fbm 场替裁判图集通道为程序近似，不宣称视觉等价。
