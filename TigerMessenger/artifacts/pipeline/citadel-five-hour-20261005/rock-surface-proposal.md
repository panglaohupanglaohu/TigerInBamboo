# 圣城岩面语义降噪候选

2026-10-05；顾问只读代码审阅。本轮只写本文，没有修改运行时或验证新候选效果。

## 建议

先做**保持全部位置不动的语义法线候选**，同时提供独立的纹理扰动开关。普通岩坡连续受光，海崖折角、主脊、材质界仍分开计算法线。之后只在候选仍明显碎裂时降低 `refineRockFaces` 生成的浅浮雕幅度；不对整座山做无差别 Laplacian 平均。

这应叫“语义法线平滑与浅浮雕降噪”，不能叫“已经按 Oskar 私有算法重建地形”。法线改变不会修复真实剪影折角，也不会改变碰撞形体。

## 本轮证据

- 实际查看 [r00 日间无云图](r00-old-mountain-day-noCloud-plants.png)：山体大轮廓已有连续山势，但普通斜面遍布尺寸接近细分三角面的明暗碎块；不能从这一张图断言每块都由同一个原因产生。
- 阅读 `mountainStudy.js`、`mountainRockGeometry.js`、`mountainLandform.js` 的细分/保护/平滑段，以及研究入口、交接和本批记录。
- 使用个人 `oskar-world-advisor` Skill 的 rendering / implementation-recipes 资料。项目曾指定的 `threejs-game-director` 安装路径不存在，搜索本地技能目录仍未找到，故未加载；不影响本次只读建议。
- 复用已有 [2023 演讲原创笔记](../../research/oskar-2023-pcg/ADVISOR.md)，没有重复观看视频。既有证据是完整自动转译字幕阅读及主线程另行抽帧，不能改称连续 720P 音画观看。

## 已确认的代码原因

| 位置 | 实际行为 | 影响 |
|---|---|---|
| `mountainRockGeometry.js:6–35` | 默认 `amplitude=.65`；每个原三角形内部施加沿原面法线的多频位移，原三角边界因重心权重为零不移动 | 增加的是每个原三角形内部的起伏，容易显露原面分区；不是主脊/海蚀等语义构造 |
| 同文件输出 | 每个子三角形独立写入非索引顶点，再 `computeVertexNormals()` | 相邻子三角形没有共享索引，因此仍是逐面法线；单独关闭材质 `flatShading` 不够 |
| `mountainStudy.js:37` | `flatShading:true` | 着色明确强调每个子面 |
| 同文件 shader | `mtN=normalize(cross(dFdx(vMt),dFdy(vMt)))` 再用于三向纹理权重、坡度苔色；另用 `.38` 的导数 bump | 即使换平滑顶点法线，纹理混合仍可能逐面突变，高频 bump 也会重新制造碎纹 |
| refine 中独立选择细分数 | 每个原三角形独立得到 `n=1` 或 `3…6` | 共边可能出现不同分点，即 T-junction。几何边仍共线不等于拓扑一致或法线插值一致 |
| 保护判定 | `selectTriangle` 检查三角形质心的海拔、坡度、保护盒和轨道距离 | 不应把质心筛选称为对整个三角形/位移扫掠体的连续净空证明 |

`maxEdge=4` 也不是严格保证全部子边小于 4 米：当前存在 `n<=6` 上限。本次不建议顺便重建所有三角网格。

## 最小模块接口

建议新增一个独立纯几何辅助模块，先只处理主岩面，不处理 `cragGeometry()` 的破碎块或城市建筑。

```js
const surface = buildRockNormalDomains(source, {
  faceRegion,          // 离散材质/玩法/海崖区域，按面记录，不能数值插值
  explicitHardEdges,  // 主脊、崖顶折线等；没有标记就明确记为 fallback
  lockedVertices,     // shoreBoundaryBottom、城基/海岸/路线保护点
  creaseAngleDeg: 42  // 仅候选起值，不能替代语义标记
});

refineRockFaces(source, {
  amplitude: 0.65,    // 第一轮不改任何生成位置
  surfaceNormals: surface.cornerNormals,
  recordProvenance: true
});
// provenance: 每个输出角点的 sourceFace + barycentric，及 sourceEdge/t（若在边上）
```

`buildRockNormalDomains` 不改输入 positions。以原面邻接为单位，在同一语义区域内建立角点法线扇区，普通区用面积/角度加权。硬边两侧保留独立扇区，交叉硬边与非流形节点不跨扇区平均。细分点从对应原面的三个**角点法线**插值，而不是把原来单一 flat normal 重复给所有子面。这样主要压低后来生成的微小折面，保留作者造型尺度上的坡面变化。

候选开关建议 `citadelRockSurface=0|1|2`：0 原版；1 法线与视觉纹理权重；2 在 1 的基础上再试 bounded relief。默认先保持 0，获同机位验证后再决定是否接入。开关必须写进材质 cache key 与审计 metadata，不能复用旧 shader program。

**语义数据的实际缺口：** 当前这两个文件没有完整可直接调用的“硬边/材质域/主脊边链”。可复用 `shoreBoundaryBottom`、`landformProtection(castle)`、当前山势图和网格名称；但不能仅凭它们声称已标注每条崖顶线。第一版应保守地在不确定边界留硬边，并输出 fallback 数量。`RIDGE_GRAPH` 不是所有当前候选使用的唯一山势图，需取本次实际选用的 massif/east-shoulder 图；不能按旧图误判新山。

## 三种改变必须分开

### 1. 法线连续性：不动几何

- 只改法线属性，候选材质 `flatShading=false`； positions、index、UV、语义属性、局部变换保持字节相同。
- 明确保留 `Ngeometry` 和 `Nshade`。真实承土面、保护检测、地质折边仍依据前者；照明与视觉三向纹理混合可用后者。不要用软法线判定陡壁上可种草。
- shader 新增一致坐标空间的 shading normal。法线经过正确的 normal matrix，不能直接按位置矩阵乘；非均匀缩放和球面旋转必须测。几何法线、radial up 与 shading normal 比较时必须位于同一空间。
- 材质界只是色彩边界时可以保持位置连续，但法线域/色域按设计分离；不应为颜色接缝制造真实裂缝。

### 2. 材质降噪：不冒充造型修改

先单独禁用当前导数 bump，保留宏观矿物色与真实大面；再比较把 bump 系数从 `.38` 降到 `.10–.15`。层理/接缝/颗粒对比也单独控制，避免一次改色、改光、改形后无法判断原因。数值是本项目试验起值，不是 Oskar 参数。

纹理权重可从 `Nshade` 获取，真正苔藓可生长区域仍沿用真实坡度约束。着色器里的绿色苔色本身不是新增植被几何，不能把颜色改善报成已补齐植被。

### 3. 真正几何调整：仅降低已生成浮雕

若 1/2 后白模剪影仍有微锯齿，再将普通区 amplitude 试为 `.20`（对照 `.65`）。更稳妥的写法是保留原插值点 `p0` 和原浮雕向量 `d`，输出 `p0 + k*d`，`k∈[0,1]`；保护点与特征边使用原位置，普通内部缩小 `d`，避免把大山的主脊/鞍部一起拉平均。

此步相对当前实际表面最大可能位移为 `.45m`，不是“原形完全不变”。必须在最终 mesh 上重做铁路/步道净空与根部承托，并在 planting/cloudField 创建之前执行；若更改已经放好植物的场景，则需重新采样/重烘焙并更新 surface revision。缩小位移也不能直接推导铁路必然更安全：原位移可能恰好在避让方向。

后续需要真正沿特征边链松弛时，才增加“普通点可受特征点影响；特征点只沿同类边链；交叉点/固定边界不动”的单向分层规则。本批优先级低于法线/材质消融，不建议仓促把整个山输入通用平滑器。

## T-junction 与法线风险

1. **简单 weld 不够。** 同坐标去重只找到已有顶点，找不到落在粗边内部的悬挂节点，也可能误焊接近但独立的崖面。邻接应来自已知 source edge/face；空间量化只能辅助手段。
2. **插值法线也不自动严格连续。** 共边两端相同而一侧增加归一化的中间法线，光栅插值可能出现不同曲线。小候选应测共边多个相同 t 处的最终插值角差；不能只检查重合端点。
3. 要求严格连续时，取共享原边所有分点的并集，只给较粗一侧相邻子面补共边顶点并在原子面内重三角化，坐标仍落在原子面上。先完成这个局部共形步骤，再计算最终面法线域。不要为修一条边将整片连通山体所有面提升到 n=6。
4. 在尚未处理 T-junction 的版本中，不宣称已闭合流形；报告悬挂点数量与边插值误差，并保留线框近景。大视角看不见不等于问题不存在。
5. 当前 refine 不显式复制 groups/drawRange，且把除 normal 外属性都当连续数值插值；未来的离散 faceRegion/featureId 不能走同一插值路径。原 `normalized` 等属性语义也需按类型保留。当前调用排除了多材质数组，不能以此假定工具永远没有材质域。
6. 跨 mesh 的独立海崖/封边网格不自动共享法线；除非存在可靠的明确边界匹配，否则保持其硬接缝。非流形边、反向重复面、零面积面应隔离并报警，不参与平均。

## 最小验收

| 测试 | 必须证明 |
|---|---|
| 原版回退 | flag=0 的位置、法线、材质参数及 shader key/输出分支与基线一致，固定输入可重复 |
| 法线模式不改形 | positions/index/UV/变换/保护属性 hash 不变；城市与步行面 hash 不变 |
| 两个软面 fixture | 共有边多个 t 点连续；法线有限、长度正常且与原正面不反向；误差记录而非硬编码 0 |
| 硬海崖/材质界/主脊 fixture | 两侧法线分组保持；不跨材质/特征扇区平均；锁点坐标完全相同 |
| T-junction fixture | n=1 对 n=3、n=3 对 n=4，检查中间点法线插值；若做共形修复，还测无悬挂点、面覆盖不变、无翻面/退化 |
| 坐标变换 | 球面旋转与非均匀缩放后法线方向正确；不是把 local Y 当世界 up |
| relief 模式 | 保护点/原特征边零位移，普通点位移≤声明预算；面积>0、无翻面；铁路/通道与植物承托按最终 mesh 复测 |
| 生命周期 | normals-only 不虚报 surface position revision 改变；relief 改变时 planting/cloudField 的来源版本匹配 |

视觉对照固定当前机位、太阳、天气和曝光：A 原版；B 只法线；C 法线+降低 bump；D C+降低真实浮雕（仅必要时）。每组附岩壁近景、主脊逆光剪影和无纹理白模。白模仍碎说明尚有几何/法线问题，颜色关闭后才改善说明主要是材质。不得用雾、云或植被遮挡碎面作“修复”证据。

本轮没有运行这些候选测试，以上为实现与验收规格。

## 作者资料与项目推断的分界

作者演讲 [26:21–30:56](https://www.youtube.com/watch?v=NpfoRAzfGDg&t=1581s) 的现有字幕研究支持“硬边、材质界、玩法界、普通内部的分层松弛”，并反对等权平均毁坏房屋/沙滩；[34:42–38:57](https://www.youtube.com/watch?v=NpfoRAzfGDg&t=2082s) 支持几何、颜色、法线笔刷与线条控制分工。这里提出的角点法线扇区、开关接口、42°回退阈值、`.20` 浮雕幅度与 T-junction 修补均为**本项目工程推断**，不是作者公开源码或经本轮验证的复原。

## 后续最小候选实施记录

主线程随后授权了上述法线/材质候选。已增加 `mountainRockNormals.js` 并接入 `refineRockFaces` 的可选 source-face/重心坐标法线插值；**未实施位置平滑、降低 `.65` 浮雕、重三角化或全局焊接**。

- 实际开关为 `citadelRockSurfacePass=1`，默认 0。开启时 bump 默认 `.12`；`citadelRockBump=0` 可关闭 bump，`.38` 可恢复该通道作消融对照。
- Shore/protected 面完整保留原法线；主脊用当前实际山势图的保守峰脊走廊保护，海崖/封边网格保守保护。其余精确共边按语义/角度分类，metadata 明记 `angleFallbackEdges`，不宣称完整语义地质图。
- T-junction 不修拓扑。精确共边两侧细分数不同记录 `subdivisionMismatchEdges` 并锁相关角点；未匹配源边记录 `unmatchedEdges` 并保持硬边，不能把这些报告成“共形修复通过”。
- shader 的真实坡度仍使用几何法线；三向纹理混合用 mesh→castle 的逆转置法线矩阵与插值法线。crag 碎岩保留旧材质路径。
- [Node 证据](rock-normal-candidate-tests.json)：9 个案例通过，测试源 `tools/pipeline/test_mountain_rock_normals.mjs`。普通曲面 fixture 位置/index/UV 不变、605 个普通共享采样法线差为 0；材料域、保护、硬崖、不同细分、非均匀球面变换均独立检查。候选与批次 `source-before/mountainStudy.js` 的实际 material 工厂对比，默认关闭分支 vertex/fragment shader、flatShading 与 program key 完全一致。

这是 Node 层候选完成，**不等于已通过 GPU 编译、全场景固定边界哈希或美术验收**；主线程负责真实浏览器 A/B。所有候选修改仍是本项目适配，不是复原作者私有 shader。

## 后续显式浮雕与 normal pass 2 候选

新增 `citadelRockRelief=0…0.65`，未提供、空值或非有限值保持原`.65`；`.22`为待看图的候选。它只向原refine传幅度，不改细分数、原三角形边界、语义属性、位置选择保护或硬边规则。`geometry.userData.rockRefinement`记录`reliefAmplitude/reliefCandidate`，让最终植物、云、高场在修改后几何上重新构建。它**实际改变原面内部位置**，不能与仅法线开关混称“不改形”。

[幅度测试](rock-relief-candidate-tests.json)：0/.22/.65均为150顶点，78个原边界采样精确不变、72个内部点；`.22`实测最大内部位移0.163748m，`.65`为0.483800m；缩放误差≤6.16e-7。未传幅度与显式`.65`位置及法线hash完全相同。测试没有宣告实际图改善。

主线程报告r07主山71440源面中60231被法线保护，新城山肩2974中2967被保护。结合球面旋转，世界轴对齐包围盒过宽是合理嫌疑，但没有把全部保护逐项归因，**尚不能称已证明实际场景全部根因**。

新增 `citadelRockSurfacePass=2`：只有**法线保护**改用现有 `landformProtection(castle)` 定向几何bounds；0仍关闭，1仍使用原AABB。海岸/shore属性、铁路、峰脊保护、42°回退规则不变；实际浮雕 `selectTriangle` 仍原AABB保护，没有跟随法线改动。program key区分surface1/2，normal审计新增`protectionBounds`。

合成回归使用真实`landformProtection`函数：旋转45°长步道的AABB误包住一片无接触岩面；pass1保护32面，pass2为0，position/index/UV均相同，几何细分仍被原选择器禁止。它证明存在这个机制，不等于替代真实场景分项统计。10项normal测试及relief/light测试均通过，待主线程加载实际r07场景比较。

## 后续 shading-only pass 3

新增 `citadelRockSurfacePass=3`，默认0及旧1/2行为保留，未改palette、ridge、浮雕幅度或几何保护。它跳过法线阶段旧`protectedFace`回调，因此仅由铁路/城基邻近、低海拔、宽峰脊走廊或网格名称触发的整面法线锁定不再生效；实际位置仍由原`selectTriangle`与上游地形保护约束。

仍保留：`shoreBoundaryBottom`真实岸底属性、42°源面锐边、反向接边、开边、非流形边、细分数不匹配边、材质与语义边界。已有不确定边端点仍保守阻断平均，没有跨T-junction焊接。

峰脊改为窄边代理规则：只有当前实际ridgeGraph附近≤2m且相邻源面确有≥20°折角的共边才额外锁定，不再锁整个峰脊带。真实位置不动。这个规则明确称`crest-fold proxy`，不是作者完整地质标记；普通10°缓变面不会因处在山顶而被锁死。

审计新增`pass/facePolicy/reasonCountPolicy/reasonCounts`，区分岸底、回调整面保护、开边、非流形、细分不匹配、受保护面边、混合语义、材质/语义界、实际锐角、绕序和峰脊折角。计数记录每面/边的**第一个阻断原因**，不是所有重叠原因，更不是可见面覆盖率；pass3的回调计数0表示该规则未评估，不表示附近没有铁路或城基。

13项Node案例通过：强制旧回调锁全部72面时，pass3不调用它并产生连续源角点法线；position/index/UV字节不变，几何细分仍由同一个拒绝选择器保持0。另实测90°共边两侧法线仍90°、岸底法线不变，语义/非流形/开边保留，峰脊25°折角/10°缓面/离脊折角分别符合规则。程序key明确surface3。真实场景与GPU效果待主线程验证，未宣称解决纸皱。

## Pass 4 proposal: constrained corner fans (2026-10-05)

This is a project experiment, not a claim about Oskar's private implementation. The actual r10 audit reports 154,535 smoothed source corners and 272,376 interpolated output vertices on the main surface; the remaining visible facets therefore cannot all be attributed to locked normals. The cliff seal is a sharper diagnostic: 175 soft edges but zero smoothed corners under the all-endpoint lock.

Pass 4 will join face corners across soft edges, with explicit cannot-link pairs for the opposite sides of every genuine hard edge. A proposed union is rejected if an alternate soft path would reconnect a forbidden pair. Open-edge endpoints may smooth within their existing same-side fan; no missing face, position or topology is manufactured. A closed fan with a lone hard edge may require an additional soft join to be rejected, deterministically; that cost is reported.

Different output refinement counts on one exact original shared edge are not themselves a geometric discontinuity: edge relief is zero. Such edges may share an affine normal field if angle, semantic, shoreline and manifold checks pass. Inserted normals must remain unnormalized barycentric vectors, and the material must also preserve their magnitude through vertex interpolation, normalizing in the fragment shader. Normalizing separately at each inserted vertex would break equivalence between unequal subdivisions. Unmatched original T-junctions remain unrepaired.

The experiment retains 42-degree creases, actual semantic/material boundaries, shore attributes, non-manifold constraints and the measured crest-fold proxy. It changes only normal attributes and the pass-4 vertex normal transport; all position/index/source-boundary hashes and earlier pass behavior must remain unchanged. Tests will exercise indirect forbidden reconnection, open-boundary fans, unequal subdivisions with transformed interpolated normals, determinism and real hard boundaries. Actual visual benefit and GPU compilation remain to be measured by the parent agent.

Pass 4 implemented as an opt-in candidate. `citadelRockSurfacePass=4` leaves the prior 0–3 branches unchanged, with a distinct material cache key. The report adds `cornerFanConstraints`, `rawAffineNormals`, `cannotLinkPairs`, `constraintRejectedSoftJoins` and `mixedSubdivisionSoftEdges`. Its open-source-edge policy explicitly means no cross-edge repair, while permitting smoothing within an existing same-side fan.

Validation: all 17 normal test cases pass, alongside the existing relief and light-field suites and JavaScript syntax checks. The alternating-path fixture retains the marked hard seam and records a rejected soft union; the unequal-refinement fixture checks 41 interpolated positions after a nonuniform normal transform, not merely matching endpoint attributes. Shore normals, 90-degree creases, material boundaries and non-manifold constraints remain protected. Position/index and other source-attribute hashes are unchanged. Results: `rock-normal4-candidate-tests.json`. GPU compilation, full-scene cost and visual improvement are not established by these Node checks.

A separate remaining hypothesis from the parent is facewise procedural moss: `mtLedge` still uses the geometric derivative normal, and palette 2 retains a 0.24 moss share. That is intentionally unchanged in this experiment so its effect can be isolated later.

## Independent procedural moss diagnostic

`citadelRockMoss=0..1` explicitly controls the rock shader's procedural moss gain through `mtMossGain`; `0` is truly zero. An absent, empty or invalid parameter preserves the previous generated shader and default gain (round >= 12: 0.60; older rounds: 0). Palette 2 retains its 0.24 cap for both the existing numeric shader path and the optional uniform path. Real turf/grass geometry and materials are unaffected. The explicit uniform has a separate `moss-uniform-v1` program key; the chained field/palette hook is now `mountain-field-v2`. Material `userData.effectiveMossGain` records the effective value without retaining a shader object.

Nine explicit gain/palette combinations (0, 0.1, 1 crossed with palettes 0, 1, 2), zero/clamp/invalid query handling, clone isolation and grass exclusion pass. Existing default-shader comparison, all 17 normal tests and relief tests still pass. Report: `rock-moss-candidate-tests.json`. This is a diagnostic switch; neither moss defaults nor palette, geometry, normals or planting defaults were changed. A same-camera moss=0 visual comparison is still needed to attribute any triangular color boundaries.

## Independent detail diagnostic

`citadelRockDetail=0..1` scales only the existing `mtDetail` variable through optional uniform `mtDetailGain`. Existing seam/joint/grain color modulation and `mtRelief` consequently attenuate together. Macro color, wet-line factors, moss, actual geometry and transported surface normals remain unchanged. Missing/invalid input and explicit `1` produce the exact prior shader and cache key. Values below 1 use `detail-uniform-v1`; material metadata records `effectiveRockDetailGain`, including cloned receivers. This is not a geometric repair. The next visual candidate is 0.35.

Tests cover clamping, explicit zero, exact default shader, removal of the two optional shader insertions recovering the original shader byte-for-byte, unchanged vertex shader, palette/light hook composition, clone isolation and grass exclusion. `rock-detail-candidate-tests.json` passes along with the normal and relief suites. GPU and visual acceptance remain separate.
