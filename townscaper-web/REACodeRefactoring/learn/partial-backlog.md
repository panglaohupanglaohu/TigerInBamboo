# partial 批次清单（自动生成，勿手改）

- 生成时间：2026-11-24T14:18:24.409Z
- partial 总数：**47**
- A 12 · B 18 · C 15 · D 2 · E 0

> 生成器：`node tools/audit-partial.mjs --write`。分类依据是 `reviewStages` + `note` 里的自认缺口词，不等于真实结论——A 类仍需逐片复核才能转 done。

## A · 机制未做（本仓无对应实现，可做但没做）（12 条）

| # | id | 帧 | impl | runtime | 落点 | 现状摘要 |
|---|---|---|---|---|---|---|
| 1 | 1593215065423245313 | 164 | 1 | 1 | src/life/impostor.js · atlas-live.html | 164帧全核验；原片释放后仍留暗纹理。共享8视角Baker补整组预留、清padding/释放、异常恢复与满板回滚，真实GPU验收；本地清透明不等于原调试残影，自动扩容/重排、原素材/完整SpriteAtlas接口仍缺。；【卡点·A 机制未做… |
| 2 | 823848950553780226 | 227 | 0 | 0 | artifacts/coverage/path-samples-review.md | 227帧全核，尘粒AO仅学习；命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。；【卡点·A 机制未做】命令路径弧长采样是独立工程迁移，不冒充原尘粒实现。 → 还差一层没写的机制（本仓无对应实现，属于可做但没做的活） |
| 3 | 784847933686575104 | 268 | 1 | 1 | src/sphere/planet.js · planet.html | 268帧全核；planet.js 补 assemblyOrder/assemblySlice + planetMesh(only)，页面加装配滑杆/白模/薄壳，铺满618格，四档顶点 5907→19797→29508→24765（铺满后断口… |
| 4 | 784847588893814785 | 270 | 1 | 1 | src/sphere/planet.js · planet.html | 270帧全核；与 784847933686575104 共用同一落点（装配生长/断口侧壁/薄壳/白模）；片中多一层两级尺度——跨多格的大平板 + 一整片格内细分的小方块碎片堆，本仓胞元只有一级，碎片堆未实现；【卡点·A 机制未做】片中多一层… |
| 5 | 784848286272327680 | 272 | 1 | 1 | src/sphere/planet.js · planet.html | 272帧全核；planet.js 的 assemblyOrder(frontier)/assemblySlice/planetMesh(only) 三档实测 37/185/383/618 格、前沿断口侧壁可见，与片子单粒起点→前沿铺满一致；… |
| 6 | 1430224300003545091 | 288 | 1 | 1 | src/tools/objexport.js | 288帧全核验。保留共享主体OBJ导出，默认精确值避免1e-4量化吞掉细小有效三角，缺失法线时用合法无vn语法；检查有限属性/索引/完整面，显式量化才统计掉面。双网格实际下载并独立解析拓扑/逐坐标一致；第三方DCC及水/植被/材质尚未验收。… |
| 7 | 1015142746372366336 | 303 | 1 | 1 | life/smoke.js#CROWN_STYLE · smoke.html · battle-c01 | 303帧重抽帧；柱身连续发射未化开、羽顶恒被上缘裁→顶团存活比不可标定，本次确认永久降级不再排期；已实现CROWN_STYLE/setTopBreak/setHaze保持现状 |
| 8 | 943230620242796544 | 306 | 0 | 0 | src/life/atmosphere.js · src/badnorth/battle.js（组合待验） | 306帧全核验；0–209安静雪岛，210突切为满船/士兵旗帜/血迹黑烟景观，不是积雪增长。已有雪/战斗主体保留；完整冬景美术/植被覆盖及船群战斗组合未实现验收。；【卡点·A 机制未做】完整冬景美术/植被覆盖及船群战斗组合未实现验收。 → … |
| 9 | 1198957499027795969 | 321 | 1 | 1 | src/world/save.js · src/world/app.js · save-mesh.html | 321帧全核验，左上字符串随建造/旋转变换，未从视频推断位流。本地v5补第三可选尾段（标志链末节+3b metaVer）：调色板（预设序号或自定义色数+24b RGB）与玩法/天气状态（光照时段/北境主题/flatRoofs等五世界开关/雪… |
| 10 | 1849427564034498642 | 334 | 1 | 1 | src/life/impostor.js · impostors.html | 全帧已核验；共享锚点随实例/父组旋转、正交平行选图、透视视差/64步周界GPU通过。octagonal不独立证明八水平图；原球面卡片/多俯仰仍缺。；【卡点·A 机制未做】原球面卡片/多俯仰仍缺。 → 还差一层没写的机制（本仓无对应实现，属于… |
| 11 | 1371460793032716290 | 524 | 1 | 1 | src/core/palette.js · src/world/app.js · wall-palette.html | 524帧全核验。Photoshop Palette.png窗口编辑色条与墙色联动；新增独立墙色色槽API与真实小镇编辑/还原，不修改预设。原PNG热重载、多行贴图和完整渐变/色彩接口仍待补。；【卡点·A 机制未做】新增独立墙色色槽API与真… |
| 12 | 1168571866405097472 | 551 | 1 | 1 | src/world/worldmesh.js · src/light/bake.js · ao-stages.html | 551帧全核，保留分层烘焙，已有实际遮蔽/反弹分离对照及恢复验收；本轮补单次烘焙逐顶点通道分离读数：bakeLighting({channels}) 输出 ao/bounce/air/sun 四通道，≤1e-6 重构顶点色，与仅遮蔽/仅反弹… |

## B · 缺原片美术资产（贴图/模型/动画/UI 稿，无源素材只能近似）（18 条）

| # | id | 帧 | impl | runtime | 落点 | 现状摘要 |
|---|---|---|---|---|---|---|
| 1 | 827216768783495168 | 23 | 1 | 1 | src/core/banner.js · src/badnorth/battle.js | 23帧全核，三队徽记/雕饰盾。复用现有Bezier旗面新增可选本地骷髅/剑/三叉戟；真实GPU纹理与开关通过。金饰盾/竖旗/原图集仍缺。；【卡点·B 美术资产】真实GPU纹理与开关通过。金饰盾/竖旗/原图集仍缺。 → 卡在原片美术资产（贴图… |
| 2 | 1010979395719319552 | 100 | 1 | 1 | src/core/part-random.js · src/ui/game-portrait-c01.js · src/… | 100帧全核验，切角卡/头盔/兜帽/锁甲/配饰组合。本地卡片绘制与稳定种子身份已验；本轮接游戏角色接口：sampleSlots 加 {pin} 钉槽（钉住值必须在槽 variants 内、钉表外槽位报错），squadPortraitIden… |
| 3 | 1260586697538113537 | 167 | 1 | 1 | src/core/snapshot-replay.js · src/core/edit-fx-schedule.js ·… | 167帧全核验（历轮sheet/裁切证据沿用）。「动作特效」可做的部分本轮收口：撤销/重做/历史回放本就走 worldMesh.edits 体素差分→effects.onEdit（弹性弹出/落水水花/拆除灰尘）+sound.onEdit 音… |
| 4 | 1768627849529893109 | 229 | 1 | 1 | src/sphere/planet.js · src/sphere/world-sphere.js · src/sphe… | 229帧全核验；r205 补「平面World→球面」接线层 src/sphere/world-sphere.js：'bend' 模式与实景十二门徒 bendU/uBend=S/(2Rw)/帽面法线/锚点 frame 逐式同口径（抛物面下弯）… |
| 5 | 1852334860137849222 | 235 | 1 | 1 | src/life/impostor.js · impostors.html | 235帧全核验，云与树共享impostor原文确认；共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景云层次及完整风材质仍未复现。；【卡点·B 美术资产】共享修复与背景云GPU时钟/连续运动/遮挡回归通过。原蓬松云形、前景… |
| 6 | 1215642481162887168 | 330 | 1 | 1 | src/water/shore.js · src/core/shore-loops.js · src/world/tow… | 330帧全核验：空水面逐块长出码头/房屋/拱口/多塔，岸线与倒影跟随。2026-11-25残差核账（tests/water-town.mjs 四场景锁定）：水上码头=1层灰石基座自y=0入水外鼓+压顶铺地+临水栏杆；水上悬浮块=钢腿端停y=… |
| 7 | 828984794407170048 | 387 | 1 | 1 | src/core/unit-ground-height.js · src/badnorth/battle.js | 387帧坡地接敌/火焰/房屋焦黑；每人navFloor+footHeight踏面与1-exp(-10dt)帧率无关缓动已在，本批把同一次缓动上移覆盖全接地状态（近战/横扫/刺击/眩晕/待命不再冻在半空，坠落/船上/跃起自有y），tests/… |
| 8 | 1205420678859632640 | 443 | 1 | 1 | src/core/leaf-atlas.js · src/life/leaf-surface.js · src/life… | 443帧全核验：盆栽球冠随镜头俯仰旋转，242附近线框开启并保留至结尾。保留旧噪声，对照新增对象球面坐标纹理/视角alpha、导数过渡/MSAA覆盖，双网格三角度GPU通过；本轮补匹配的阴影caster（leaf-depth.js：树冠cu… |
| 9 | 1197909675443916803 | 456 | 1 | 1 | src/core/town-visual.js · src/build/courtyard-grass.js · src… | 456帧全核（沿用）。r208 用只读裁判 REACode 把四子项参数化：STYLE/BUILD 重叠22键逐字节相等+BUILD补path #a49c8a；colorgamut 屋顶/草地 HSV 色容体入 town-visual.js… |
| 10 | 1710031224838771027 | 515 | 1 | 1 | src/core/color-volume.js · src/world/view.js · color-lab.htm… | 515帧全核验，实际画面为五特征H/S/L范围调色，不证明地形三轴/八角点。新增HSL范围与跨零色相，接实际View顶面。三特征各接独立HSL域（setFeatureColorVolumes + featVolumeSample 按 vFi… |
| 11 | 1482346496460828674 | 517 | 1 | 1 | src/core/contrast-field.js · src/world/view-shading.js#contr… | 517帧全核验（沿用原记）；图集预览、灰岛上色和两组岛环绕。核旧账：实景接入早已落码——view-shading.js#contrasttex 把 worldContrastMesh+solveContrastColors 烘成 uShCT… |
| 12 | 827215002448846848 | 524 | 1 | 1 | src/core/unit-tier.js · unit-tiers.html | 原文单位等级，非无文字弧长教程；本地可选头盔/盾牌色阶与实际Battle通过，原雕饰/旗徽/升级机制未复现。；【卡点·B 美术资产】本地可选头盔/盾牌色阶与实际Battle通过，原雕饰/旗徽/升级机制未复现。 → 卡在原片美术资产（贴图/模… |
| 13 | 1704246032626762189 | 564 | 1 | 1 | src/terrain/blotch-pattern.js · src/world/view.js · blotches… | 564帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证；本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。；【卡点·B 美术资产】本地近似，原… |
| 14 | 1703750394164199473 | 592 | 1 | 1 | src/terrain/blotch-pattern.js · src/world/view.js · blotches… | 592帧全核验。共享View补可调旋转角度场、独立低频密度阈值场与导数柔边；浅高度层理复用已有共享着色。实际双网格GPU及参数/零强度验证；本地近似，原作atlas/细卷边、配色、跨崖/反射一致性仍待补。；【卡点·B 美术资产】本地近似，原… |
| 15 | 1699038611125985317 | 620 | 1 | 1 | src/core/sediment.js · src/core/sediment-bands-c09.js · src/… | 620帧全核验：宽窄相间直层带，多组岛形与红线框/黑轮廓生成显示。补实际岩壁专用着色、直/弯层理模式与抗锯齿，保留旧窄条网格对照；双网格GPU通过。2026-11-24 裁判对照（REACode engine/surface.js 逐式提取… |
| 16 | 890611046435627008 | 666 | 1 | 1 | src/core/house-door-presence.js · src/badnorth/battle.js | 666帧全核，层间指令/阶梯支援/房屋遇袭和守卫。保留逐人层高，修房屋燃烧/守卫仅看XZ导致跨层干涉；双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。；【卡点·B 美术资产】双网格实际burn检查通过。原火焰/抛射/奖励动画仍缺。 … |
| 17 | 906416813810049025 | 725 | 0 | 0 | artifacts/coverage/cloud-depth-review.md | 725帧全核，紫色厚岩拱洞/多层战斗与船只，仅学习。保留既有分层导航，不冒充原tileset或完整关卡已实现。；【卡点·B 美术资产】725帧全核，紫色厚岩拱洞/多层战斗与船只，仅学习。保留既有分层导航，不冒充原tileset或完整关卡已实… |
| 18 | 865200072685912064 | 908 | 1 | 1 | src/core/wfc.js · wfc-trace.html | 908帧候选收缩/红色冲突/重置求解，非旧注释无文字6帧静态。复用共享求解器加有界不可变真实候选快照和回看页；本批补逐步轨迹导出：决策帧点名决定格/选定块、矛盾帧点名掏空格与红链，wfcTraceSteps 差分逐帧缩域与回溯重开，Node… |

## C · 原片算法未公开（配文与画面不足以反推）（15 条）

| # | id | 帧 | impl | runtime | 落点 | 现状摘要 |
|---|---|---|---|---|---|---|
| 1 | 793557992931266561 | 6 | 0 | 0 | src/world/worldmesh.js · src/light/bake.js · ao-stages.html | 6帧全核；五阶段可观察行为均有本地落点（bake.js 四档 aoMode + view-c04 SSAOPass；tests/ao-stages-coverage.mjs：格级事实与裁判逐值一致、探针顶点色一致、整镇 pearson 0.… |
| 2 | 1580835075629133825 | 185 | 1 | 1 | src/core/voxel-distance.js · src/light/lightvolume.js · src/… | 185帧全复核：拱洞峡谷的转光照，没有独立反弹开关，不能从画面证明逆平方/表面形因子。保留既有共享体素反弹，补距离场保守步进与DDA兜底对照。形因子/参考接口残差核销（2026-11-25）：裁判 bouncegi.js 本有真形因子 F=… |
| 3 | 815236105079398400 | 185 | 1 | 1 | src/core/terrace-profile.js · terraces.html | 原文irregular is the new hex，185帧；既有量化保留；真实World同高片/逻辑阶差面积诊断已落地（plateauRuns/stepDropArea，能力 scene.plateau-diag，擂台与复算通过），非原… |
| 4 | 1238474550511308800 | 202 | 1 | 0 | src/core/courtyards.js · src/build/buildings.js · garden.htm… | 202帧全核验。共享classifyCourtyards按地面上实际第2层实心判封边；本轮补两件可验残差：①开口按真实墙层分型——ground-opening（街/水/岩整列空）与 wall-layer-gap（第2层缺、更高层仍有实心=桥… |
| 5 | 1708815475801505819 | 267 | 1 | 1 | src/terrain/features.js · shape.js · src/core/deformation-gu… | 267帧全核验：游戏中斜向狭长崖脊/柱群、小屋和环绕镜头，并非实景照片或确证蘑菇帽生成。保留本地石柱扩展并纠正归因；共享形变新增面积/边长/三角扇回退，双网格薄檐AB通过。未复现原作斜脊布局和整体视觉。；【卡点·C 算法未公开】共享形变新增… |
| 6 | 1727324352264474664 | 303 | 1 | 1 | src/core/camera-motion.js · src/world/view.js（历史帧近似） | 303帧全核验；结合相邻motion blur smear配文纠正为快速转镜拖抹，不是调色算法。保留历史帧叠加，修复角度周界误速、关闭历史失效及resize纹理/材质/几何释放。原作强几何轮廓拖抹、速度场/CPU审计接口仍待补。；【卡点·C… |
| 7 | 1664566546683899905 | 340 | 1 | 1 | src/water/shore.js · src/core/shore-profile.js | 340帧全复核：旋转岛屿与缓动近岸裙；README称distance-field-like，不证明精确欧氏距离或不折叠。保留chamfer栅格；修复最大步进越界/起点已达阈值及预算；真实双网格通过，独立原版buildShoreDistanc… |
| 8 | 1579474420749725696 | 454 | 0 | 0 | src/terrain/generate.js · cage.html | 454帧全核验，片中两组岛线框构建/着色/转镜；原文未揭示生成器算法，完整坡面/模块联合生成仍待补。；【卡点·C 算法未公开】原文未揭示生成器算法，完整坡面/模块联合生成仍待补。 → 卡在原片算法未公开：配文只说"某算法"，画面也不足以反推… |
| 9 | 1699146321318314094 | 456 | 1 | 1 | src/core/sediment.js · src/terrain/terrainmesh.js · src/worl… | 456帧全核验：青灰多面崖壁上层带弯曲连续，换岛后继续环绕。原文说整体扭曲/纹理/还原；本地用可精确逆的Y剪切场采样，几何原位，10000点逆变换及生产GLSL三角剖分无缝/双网格GPU通过。2026-11-24 剪切场尺度按裁判实测标定：… |
| 10 | 1769641473895432220 | 479 | 1 | 0 | src/sphere/planet.js · src/sphere/module-group-fit.js · plan… | 479帧全核验；r207 补多格模块联合形状拟合 src/sphere/module-group-fit.js + planet.js solver:'joint'：整组格共享一个相似变换（组质心+面积收缩率+墙倾斜上限）+有界逐边精修（逐… |
| 11 | 974325184525201409 | 504 | 1 | 1 | src/core/obb.js · src/badnorth/landing-plan.js · src/badnort… | 504帧全核；本轮补齐岸礁后两段与动态避让：seawayBox 航道地形检测延伸 0.8→19.94 覆盖离港全程，corridorBlocked 母船航线检测（origin→泊位外沿压陆地则退回标准走廊并计 originBlocked），… |
| 12 | 926903893866541057 | 516 | 1 | 1 | src/life/atmosphere.js · src/core/wind-flow.js · src/core/wo… | 516帧全核验；按层避障/三线性风场与共享uWind保留，双网格通洞/封洞及改风向复核。完整轨迹接口已补：makeWindField解析场（dir/lift/swirl/seed定相位、种子确定）与WindPath/traceWindPat… |
| 13 | 1471817524148940807 | 556 | 1 | 1 | src/core/corner-footprint.js · src/core/rock-island-c08.js ·… | 556帧阶段生成/旋转岩岛。岩岛生成层补齐：裁判 squarehex.islandMask 两档低频噪声+椭圆径向衰减逐点移植（rock-island-c08.js#rockIslandLand/Field/Levels/Generate）… |
| 14 | 1459169210752507904 | 609 | 1 | 1 | src/core/grid-wireframe.js（patchLayout/cellAxisDeg）· grid-gr… | 609帧全核（r19 七张联系表 + r116 重看 sheet-00 与原尺寸 0150/0200/0420 含 3× 放大）；纠正 r19 三条误读：格心没有彩色小块（是补丁缝折线与三角带小三角边，格心只有对角线 X — 本轮补画）、全… |
| 15 | 1344290848180203523 | 814 | 1 | 1 | src/core/qa-replay.js · qa-replay.html | 814帧全核验，纠正旧说明：原片主要是复杂悬空建筑连续增删QA，不足以证明随机/模块调试配色。新增共享World确定性16步压力回放、属性/索引诊断及异常恢复；不冒充原作QA、无漏面或完整几何验收。；【卡点·C 算法未公开】不冒充原作QA、… |

## D · 需接主管线（battle.js / 共享 World / 游戏语义）（2 条）

| # | id | 帧 | impl | runtime | 落点 | 现状摘要 |
|---|---|---|---|---|---|---|
| 1 | 1016680972610359298 | 370 | 1 | 1 | ui.html（本地UI实验，未接游戏指令） | 370帧全核验。原片既有单Move目标确认也有横排三项，纠正旧圆弧描述；本地横排/生命周期清理、快速切队、Esc、手机边界通过。未实现目标位置单Move/地面标记/移动交换游戏语义。；【卡点·D 需接主管线】本地横排/生命周期清理、快速切队… |
| 2 | 1798310423554658732 | 614 | 1 | 1 | src/core/field-plots.js · fields.html | 614帧全核；新片是六边格地形工具实录：农田按地块共用耕纹主轴并中线折成人字，本仓原为逐格hash随机角，已新建 field-plots.js 并加 fields.html 左右对照；尚未接回 terrainmesh 实际着色；【卡点·D … |

## E · 环境不具备（job/线程、主机性能、跨平台）（0 条）

| # | id | 帧 | impl | runtime | 落点 | 现状摘要 |
|---|---|---|---|---|---|---|

