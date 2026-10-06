# 新东岸路线与实际廊道：有限联合检查，拒绝整体安装

仅新增离线脚本/报告；没有安装，没有改 main、现生产、gallery/structure 或地形。必要修正只有本人新建 wrapper 的 final nonindexed artifact 合同及专测。新路线完整 rail curves 始终保持，未为结构裁线或改轨。

## 最终epoch局部修复候选：1.05m脚宽，结构有限检查通过

最新证据为 `final-refined-pier-105.json`，重放命令：

`EAST_FINAL_PIER_TRIAL=1 node tools/pipeline/audit_target_east_release_structure.mjs`

这次实际加载顾问 `remesh-final-surface-geometry.json`，origin/source frame为 **[-52,0,0]**，production source position hash2638422502/index:null/vertices331512。没有把旧[85,0,82.5] frame套到新数据。

- 原1.2m脚宽在最终refined岩上仍失败。station5/side−1的脚角castle[67.827955,-18.037166,97.318043]，实际山面Y=-17.762868，高出检测起面 **.2742976m**。柱角跨到崖坡高面；不是柱顶太低，也不是可忽略的轻触。真实5点脚面中其它点较低，地面不平使整个1.2m足印不能按当前工厂下轨起面落脚。
- 最小参数试验 **newShore pierWidth1.05 / maxSpan18**：只缩15cm，侧柱中心随既有安全距离公式向轨内侧少量收回，但完整载货重新校验保持净空。全部22脚seated。更窄.9也通过，故没有采用；改maxSpan16仍有另一脚失败，未选。
- 实际165.37m城市新岸+原中央/旧岸+两接城阶生成后，`structure.finitePass=true`、issues=[]；1390红蓝载货姿态对实际结构/当前候选城组三角0碰撞；14460ground/14418body查询0失败。实际结构164mesh/59172tri/24材质，仍仅比原结构+6mesh/+1636tri。
- shared structure/gallery/terrain未修改。候选参数仅 `cliffTransitStructureOptions.galleryPierWidths.newShore = 1.05`，并要求wrapper `cityGalleryScope:true`。这是传参建议与已执行离线试验，**未写进生产默认**。原1.2失败/完整319m失败/.5m粗步失败全保留。

局部实际剖面 `final-pier-section.png` 已看：岩面在脚角外侧陡升并穿过原柱脚检测起平面。图由真实final网格竖直采样数据绘制（`final-pier-probe.json`/`plot_pier.py`），不是概念图。它解释接地失效；不作为结构力学承载证明。

**全线仍不可accepted**：wrapper `GLOBAL_APPROACH_SUPPORT_UNBUILT` 原样保留；此次不重复顾问最终岩体红线2个parity内点检验，不取消该失败。原全球演员/船、真实车辆动态海浪、GPU新结构均未验。这里的有限structure通过只覆盖已建城市结构，不能扩写为所有地形/远端支撑/正式玩法通过。

## 前一轮：城市作用域已实现，1.2m原脚宽失败（保留）

新wrapper增加 `cityGalleryScope:true`（省略/false完全保持原合同）。它只改变结构segments/ranges，完整replacement/global三线逐点不变；新增 `segments/ranges.globalApproach`，城市newShore从实测X=120入口起，中央与旧岸引用保持。现 `joint-structure.json` 是这一最新165.37m候选；原319m完整输出已保存 `full-319m-rejected.json`，原粗步失败另存。

- 城市新岸165.370m；完整结构164mesh/59172tri/24材料，相对旧结构 **+6mesh/+1636tri**。
- 同1390载货姿态对已建实际结构/当前城组三角0碰撞；14460 ground/14418 body有限0失败，含两接缝/两回城连接。55/65链接仍关闭。
- 临时pre-refine地形表面检查0issue/0unknown；**新岸22个基础仍1个未seated，finitePass=false**。station5/side−1的中心castle `[68.46345776,-18.51613748,97.61252998]`，一个脚角 `[67.82795528,-18.03716554,97.31804316]` 命中terrainAboveDeck。不是简单missing。根因是当前固定桩位/足边跨到崖侧高面，应以真实footprint在最终epoch局部移动柱站或缩足并重验真实支撑/车体，不能忽略该角、降低阈值或假造柱脚。
- 新wrapper `cityGalleryCoverage.hardFailures` 还有 `GLOBAL_APPROACH_SUPPORT_UNBUILT`。即使修完城市这一柱脚，远端global接驳承托仍未造，不允许全线accepted。
- 新wrapper10项专测通过（原9项+作用域逐点不改/新参数映射/缺承托硬标记），最终地形/actor/水储备/GPU仍未通过。

准确接入字段是 `release.cityGalleryCoverage.globalParameterIntervals[lane]`，其 `cityStructure`/`globalApproach` 均是**最终完整global曲线getPointAt归一化弧长域**：

|lane|城市结构排除通用柱区|另需通用支撑区|
|---|---|---|
|center|[.6571460749924487,.7971950588698637]|[.5977307684417302,.6571460749924487]|
|red|[.6559928972206444,.7961312241630516]|[.5954583056623739,.6559928972206444]|
|blue|[.6582820441771315,.7982569162860367]|[.5977490515821939,.6582820441771315]|

root未来可让通用viaduct/piers对center.cityStructure排除，而不是整个railStartup replacementInterval；红蓝需要排除时用各自lane区间。不要把这些数字写成original source u。城市边界是新替换内部几何点，`cityStartOriginalSourceU:null`，不存在保世界位置的原源u反算；原全球切换区间仍由specs原start/end定义。保留旧岸openCoastEnd必须继续按原source endpoint经过startup splice映射，不能套这张表替代。

转换公式：`globalU = splice.report.replacementInterval[0] + replacementU * (interval[1]-interval[0])`。已在测试验证该globalU位置与每线城市newShore起点一致。这里只提供正确排除接口，未修改tram/main，未构造全球支撑。

## 之前全319m构造诊断（保留失败证据）

## 实际构造与证据范围

运行 `tools/pipeline/audit_target_east_release_structure.mjs`，输出 `joint-structure.json`。真实 source工厂→production retained release→新east包装器→真实 `createTargetCliffTransitStructure`。当前候选城市工厂提供真实公共出口与碰撞几何。三廊、两回城连接实际构建，上廊6.9m、净宽4.4m、回城2.4m，载货halfWidth1.75/halfLength3.49/top5.36+margin.35，55/65追加广场链接关闭。

仅读取顾问已经保存的 pre-refinement remesh 作为临时基础采样，不重复构造/变形地形。它不是生产 `mountainStudy→refineRockFaces` 最终epoch；以下不能称新版最终山体碰撞已通过。原全球演员/船/动画也不在本次覆盖范围。

- 新红蓝1390个载货姿态，对**已生成**廊道/柱拱/步道及当前候选城组三角 OBB/封闭体检测：0碰撞。缺承托处尚未生成的柱脚不在这0中，不能称完整支撑通过。
- 三廊、两连接、两跨段接缝，共18168 ground、18126 body查询：细步有限0失败（廊道≤.5m，接阶≤.1m，±.4m/中心，双向）。测试报告保留实际坐标和查询计数，不是实机连续通行。
- upperPath 接缝 world gap：新→中央 .0001115m、中央→旧 .0003226m。
- 结构 `finitePass=false`：新东廊地形采样532条issue/1245条unknown，38个基础中12个未seated。远端chart误用需先分段，不能将这些unknown当通过或把0载货碰撞覆盖掉。
- 中央52.891m、旧岸145.061m保持；新东廊156.595→319.505m。实际结构158→212mesh、57536→79556triangle，+54mesh/+22020triangle，24材质不变。它不是renderer.info真实draw或FPS测量。

## 根本范围错误：全球接线不应全变为城市上廊

`survey_target_east_release_extent.mjs` 输出 `extent.json`；沿真实中心新东段约.499m采样。这里的s均从**新的中心东源接头**起算，不是旧原全球u。

|范围|实测含义|
|---|---|
|s0–42.43m|world径向与castle +Y点积≤0，在该chart背半球。highest-local-Y会取另一侧表面|
|s0–102.84m|x>143，超出实际山体chart外界；无artifact竖直山列|
|s≈103.34m|第一次进入矩形和实际山列，castle[142.94,-101.47,46.70]；仅为图域进入，不是已验城市廊道入口|
|s≈154.135m|建议城市结构作用域入口：castle X=120，见下文；没有自动安装或宣布基础通过|

原城市东头为castle[120.1238,-54.5283,69.2917]，在新线上最近点距原头11.31m，不能把原点原样复用。最低限度应把远端globalApproach和城市廊道分开；不能给319m全段填同一localXY基础回调。

建议默认关闭分段候选，以既有城市东界X≈120附近为保守作用域入口：

- 中心world `[-10.8858219986,88.7803056759,139.5791516070]`。
- castle-local `[120,-57.6546698201,57.3709533973]`。
- s=154.135259m；新东廊自身u=.4824185203；完整replacement中心u=.297874403599。
- 城市新东廊长度165.370m。未重建这一截的支墩，未宣称该分界基础验收。

实际横断面最近对应（非相同fraction）：red replacement u=.301658001569，s155.174454m，castle[119.7301,-57.3082,55.3686]；blue u=.301898345511，s158.872546m，castle[120.2169,-58.0403,59.3721]。各自剩余城市newShore长162.889/167.805m。

下一实现建议是另加 `ranges/segments.globalApproach`，城市 `newShore` 从上述各自截点开始，central/oldShore及全球specs全部保持。不能只是删掉远端结构：目前tramSystem的 `inReplacement` 会排除整个replacement上的通用高架/柱，root需让排除区跟随**城市结构覆盖**，并对globalApproach以世界径向/真实全球表面构建独立支撑。其原全球线几何已经改变，不能沿用旧位置的桥柱假装承托新线。全局支撑方案未完成前不得发布裁短结构。上述分段后来经root授权实现为默认关闭的cityGalleryScope；仅分段数据已实现，全球支撑尚未实现。

## 旧城接阶粗步失败与实际玩法调用

第一次全部使用≤.5m路点，得到24个body失败；原报告保存在 `coarse-connection-step-050.json`，没有删除或改成通过。全部撞 `old-city-link-treads`，向旧城上行、body样高.45m，涉及路径j39–45及65、三条横向线。castle范围 x[-32.0499,-29.2651]、y[15.6992,17.15]、z[7.1170,19.0924]。真实相邻阶面升高约.15m；粗移动约.42m加身体前伸会扫到连续后续台阶。

随后只把接阶路径细化为≤.1m，**没有更改步升阈值、body射线、几何或地面判定**，全部有限失败归零。该结果不能说明所有大步都安全：粗步直接调用provider仍拒绝，记录保留。

已只读核查当前正式调用：

- `main.js:1739`：dt=`min(timer.getDelta(),.05)`。
- `main.js:1805`起：physicsSteps=`ceil(dt/(1/120))`，每个子步执行control、resolveCollisions及localGround、citadelPlayerWalls、其他墙与资产碰撞。
- `params.js`默认moveSpeed7.2，sprintMult1.45；因此稳态默认单物理步约≤.06m，疾跑≤.087m。当前确有子步，不能按低FPS直接把整.48–1m帧距离当一次body sweep；但可变参数或其它直接调用仍可能超出该范围。
- `collision.js`先位置积分，再ground回调，末次局部地面采样吸附；上跳正径向速度保留。通用platform STEP_UP=.75，candidate provider自己的maxStepUp=.4是不同合同；墙体最低body样高.45、对旧脚点发射。

本轮没有执行完整真实controller的玩家旅程，只做几何/provider采样和调用链阅读。所以细步有限通过、粗步直接调用未解、实际GPU行走未验证应分别保留，不能写连续通行完成。

## 新最终artifact合同小修

顾问另交 `remesh-final-surface-geometry.json`。本人wrapper现在允许明确 `{index:null,indexed:false,indexCount:0}` 的生产nonindexed源，仅当 position/vertices/triangles/refinement、provenance.baseline.after完全匹配，rawCandidate闭合单连通/边0且finalCandidate三角数匹配真实position数据时。缺hash、未声明indexed:false、缺provenance或不闭合raw仍拒绝。

实际源position hash2638422502、331512顶点；report明确 `topologyScope='raw-welded-candidate-before-refinement'`、`finalRefinedTopologyVerified=false`。这不是把raw拓扑假冒refined最终拓扑，也不覆盖顾问报告的当前红线2个parity点。wrapper9项专测通过；新结构本报告仍使用之前pre-refine artifact，不能悄悄改成最终artifact通过。

所有权交回root。后续优先：划分globalApproach结构作用域并补独立真实支撑，再对顾问最终epoch重新构造有限联合场景，最后才GPU核验。
