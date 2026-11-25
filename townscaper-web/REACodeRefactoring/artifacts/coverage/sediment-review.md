# 直/弯沉积层理 · 2026-11-04

先按README精确ID读配文：1699038611125985317（line49）说沉积线帮助大崖阅读；1699146321318314094（line48）说整体坐标变得wobbly，做纹理数学，再undo wobble。未给原位移场/采样代码，不能把本地公式说成原式。

## 两段1076帧

- 直层理620帧0–619，0–19.83秒；sheet-00至06全部逐格核验，原尺寸100。高崖宽窄两色层带，沿多面连续；镜头绕背面再回转。202后多次空背景、红线框/黑轮廓、不同岛体依次显示，不把红线框猜成层理实现。后半多组岛形也核验。
- 弯层理456帧0–455，0–14.43秒；sheet-00至04全部逐格核验，原尺寸100。青灰大崖跨多个面有连续弯层带、细线和两色层；191/233附近短暂黑轮廓后换岛，随后环绕小岛。原版wobbletex.js注释“24帧”不能代表本地实际456帧，不沿用其学习计数。
- 每帧时间、编号、阶段观察、原尺寸标记存各ID/review-observations.json，原帧保留。只新增这两段。

## 代码实际变化

原本terrainmesh在崖面外偏移0.006的窄条网格，只在边端采噪声，既不等于宽窄两色层带，也不能说明完整坐标纹理法。保留旧网格并提供对照；新增core/sediment.js，W(p)只改变Y：y加一个世界XZ连续函数，因此W的逆是减去同一函数，精确可逆。shader在原位置p采W(p)的层理，几何、法线和World不改变，不需要真的移动网格再还原。

这是本地可逆Y剪切场，原作可能使用其他场。不是完整通用3D位移场/定点逆解，也未逐一迁移原版CPU曲率、缝差、漂移等指标接口。

复用已有aField属性：-1岩壁、-2旧窄条，+1田纹顶面/0其他维持原行为。MeshWriter/ChunkRouter/WorldMesh统一携带、hash与缓存；View只对岩壁套层理，新模式隐藏主体的旧窄条片元，顶面/洞顶/建筑不套。直/弯层带和薄线用屏幕导数过渡，过密细节淡出。mode0保留旧外观，1直层、2弯层，仅uniform更新。主系统默认仍mode0；pipeline的strata开关/URL可选启用，sediment.html实际操作同一World/View。

注意：旧几何仍被反射、阴影及轮廓层使用；本轮未使这些通道与新层理完全一致。不存在“整个表面/atlas管线全部完成”的结论。

## 测试

- tests/sediment.mjs：10000个坐标的W/精确逆，最大残差8.9e-16；零幅度直层、同位置相位、非法参数拒绝。几何恒等性来自只对采样坐标运算，未动位置数组。
- tests/sediment-browser.cjs：实际双网格，岩壁/旧条/其他mask分别混合5250/4542/19158、四边6744/5724/25104顶点。旧→弯改变7593/6543像素；直→弯改变6243/5772像素。World版本672/781、几何对象与position全部不变。
- 同一生产SEDIMENT_GLSL在连续平面用两种三角剖分渲染，最大逐通道像素误差0，证明该fixture没有三角相位接缝；不把它扩大为所有复杂UV/3D接缝证明。
- 保存sediment-browser.json、sediment-{mixed,quad}-{curved,legacy}.png，已目视。效果相对旧窄条可见，当前灰褐配色/波形、层带比例与原作仍明显不同，不标视觉等价。反射/阴影/轮廓也不计同步验收。

累计78/285，剩207；136模块27增强/71静态/38部分/0未覆盖。原版只读。下一批草色块跨崖边/防跨重要边渗色两段尚未全帧，继续共享顶面与岩壁过渡。

收口回归：sediment-pages.cjs确认首页/pipeline显示78/285，小镇/北境默认strata=0；URL on=strata实际为2，原fields开关/增量属性仍通过，无页面异常。aField新增岩壁/旧条枚举后，既有texture-fields-browser测试接受这些合法非田纹标记并复测通过，四档像素线积分宽度仍0.99608px。素材/README匹配285、历史笔记243，管线缺0段，diff空白检查通过。

## 弯层理剪切场残差收口 · 2026-11-26

针对 learn 残差「场形=裁判二倍频值噪声 vs 本地解析正弦场」与「位移 xz 分量（y-only 可逆设计）」：

- **场形可逐式移植**：裁判 REACode engine/surface.js 把场逐式写出（sHash→sNoise→sWobble 二倍频值噪声→sWarp），不是只给参数。sediment.js 与 SEDIMENT_GLSL 换成同一套式子；tests/sediment.mjs 直接从裁判文件提取四函数体（空白归一）断言逐字一致，JS↔测试内独立转写 4096 同点采样 maxΔ=0（位级一致）。
- **xz 分量**：裁判位移 vec3(b,a,b*.7)·uSedAmp 已含 xz（裁判注释：xz 也抖，否则线只是"上下浮动"）。W=p+D(x,z) 不再是纯 y 剪切，解析逆不存在；但 D 只依赖 (x,z)，逆问题降为二维定点迭代 u←w.xz−D_xz(u)，位移雅可比实测≈0.19<1 收缩——与裁判自己的量具 src/wobbletex.js 定点迭代同款做法。unwarpSediment 迭代至 1e-15 停，10000 点往返残差 3.55e-15（阈值 1e-9），iter3→iter12 单调收敛 4.5e-7→0。「可逆」保留为迭代可逆，不再宣称解析逆。
- **GLSL 侧**：uSedAmp/uSedFreq 裁判同款 uniform 进 SEDIMENT_GLSL（view.js 接线，uSedAmp=uStrata.y×2 同源同步）；弯层模式（uStrataMode>3.5）裂纹/砂砾改吃 sed.x+sed.z，与裁判 sed=wp+sWarp(wp) 同构；mode1/2 相位行不变（c09 断言保留）。
- **GPU 复测**（sediment-browser.cjs，standalone 材质补 uSedAmp=.28/uSedFreq=.52）：mixed wobblePixels 5596、quad 5209，旧→弯 7593/6497 像素；三角剖分对换缝 0；World/几何零漂移。
- **残差**（如实）：原作真实场仍未知——裁判场本身是重构近似，移植裁判≠拿到原作算法（卡点·C，需新证据再立项）；vendor 未接 SEDIMENT_GLSL（B 批换库项，scene-consumer-notes.json sediment 键已记）。
