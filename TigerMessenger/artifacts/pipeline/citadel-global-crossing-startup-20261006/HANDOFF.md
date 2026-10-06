# 原生 tram 工厂接线：默认关闭

本轮仅修改 `src/world/tramSystem.js`，新增专属测试和本目录证据；未修改主入口、loadTraffic、messengerIsland、mountainStudy、terrain或已有候选结构。施工前完整源码为 `tramSystem.before-crossing.js`。依照已读Oskar技能的真实几何接口/事务原则实施，不将本项目铁路算法归于作者；AGENTS引用的threejs-game-director路径及技能目录未找到该技能，本轮未宣称加载它。

## 创建（root在animate之前）

```js
const tram = buildChristchurchTramSystem(scene, R, {
  ...existingOptions,
  citadelEastGlobalCrossing: {
    enabled: true,
    candidateInput: shiftAudit.candidateInput,
    terrainArtifact: finalRemeshArtifact,
  },
});
```

未给新选项或`enabled:false`保持原默认user-marked行为。新选项自身默认off，不与`citadelRailSplice`同时使用；冲突/坏artifact/坏路线直接抛异常，不偷偷降级成另一条轨。

新整包在工厂内使用**刚创建的同一组sourceCurves**及旧`createTargetUserMarkedProductionRelease`。钢轨、枕木、车辆、货运站点最近位置、interlocking、trackLen、弧长进度均来自同一个新`startupPreview`。返回：

- `crossingBundle`：已交整包，含新release/精确参数/待激活覆盖区间。
- `citadelTransitRelease`：新release，供实际城市结构构造。
- `terrainPreparation`：bootstrapRelease、bootstrapStartup、bootstrapCurves、artifact、castleMatrix。
- `bootstrapRelease` / `bootstrapCurves`：上项便捷引用。只供旧山bootstrap→refine→严格hash→原Mesh换exact artifact。之后才创建surfaceIndex、植被、云、城、导航。
- `curve` / `curves.red/blue`：新完整global消费曲线，与车辆服务引用相同；不是地形bootstrap输入。
- `crossingState`：pending/active等实际状态，`group.userData.citadelEastGlobalCrossing`同一个对象。

候选初建`group.visible=false`且`update`暂停、不能登车；所有临时通用承托仍在，覆盖区间未激活。只用于animate尚未开始的明确启动候选阶段。根调用方必须在animate前完成下面事务；失败应显示启动拒绝或重新构造旧配置，不把隐藏新线当可交付世界。

## 最终面与城市结构就绪后

```js
const cityStructure = runtime.root.getObjectByName(
  'citadel-target-cliff-transit-structure');
const tx = tram.prepareCrossingSupport({
  sampleGround, sampleSea, cityStructure,
});
try {
  tx.commit();    // 真实结构替换、激活覆盖、显示轨车并update(0)
  // root其余启动验证/提交；任何失败先tx.rollback()
  tx.finalize();  // 成功后释放旧临时通用承托；此后不再允许局部rollback
} catch (error) {
  tx.rollback();
  throw error;
}
```

`installCrossingSupport(args)`等价prepare+commit并返回同一事务，**不会自动finalize**。

回调都是WORLD径向合同：

```js
sampleGround(worldPoint) -> { point: THREE.Vector3, objectName: string } | null
sampleSea(worldPoint) -> {
  radius,              // 实际静海面first-hit半径
  upperRadius,         // 实际海面三角顶点沿径向外移shader最大.067后的first-hit
  officialUpperRadius,// R+officialOceanLevelAt(direction)+.067，另守连续径向上界
}
```

使用最终remesh、真实planet-surface与已按新曲线carve的hills共同查询最外层支撑。禁止用castle+Y穿另一半球，也不用解析sea-3造柱脚。缺地面/波上界直接拒绝。

城市group验证：名字与工厂report版本匹配，`finitePass`、vehicleClearance.pass为真，三段真实长度匹配新release，6.9m上步道；再从report三个区间各3个实际点对真实`targetWalkable` mesh向下射线验证，共9点。空group/虚报旧路径会拒绝。root候选闭包无须暴露私有handle。

## 末跨不是理论坐标通过

prepare脱离scene重新生成生产`addViaductDeck`、涵洞、圣城结构和通用柱。新replacement排除只作用在这个尚未挂入的staged group。

在真实生成的viaduct mesh上，对expectedSourceDeckInterface的4个底角和中心点逐三角求最近点；5点必须落在同一实际mesh表面，容差.00005m。成功后才把该界面交给独立approach工厂。此次最大偏差 **0.0000039159m**；证据包含实际meshUUID、face indices、各点误差和global station interval。把expected角点平移25m的反例被拒，没有拿理论公式替代几何。

随后用真实最终表面创建approach，并按完整global红蓝运行有限载货检测；任何失败销毁staged资源、旧临时group/可见性/覆盖状态不变。commit再次核对城市实际几何，然后一次替换；若初次update抛异常会内部rollback。仅两种实际结构均就绪后，`exclusionPlan.active=true`并移除本实例`GLOBAL_APPROACH_SUPPORT_UNBUILT`。

## 回退/释放

- `tx.rollback()`：prepare或commit后均可；恢复原临时通用group、隐藏pending新轨、停止车辆、恢复hard flag/未激活区间，销毁新支撑。幂等。
- `tx.finalize()`：只在commit后；释放175个本次实际临时geometry，重复调用不重复dispose。共享toon/outline材质不释放。
- finalize后若回退整条路线，调用`tram.dispose()`并按旧opts重建旧工厂。局部tx不能恢复已释放临时资源，明确抛`CROSSING_TRANSACTION_FINALIZED`。
- `tram.dispose()`：本工厂geometry与非shared material清理、remove group、停止更新，幂等；未finalize事务先rollback。不要再对同一工厂做第二套手工dispose。

## CPU证据与明确未验项

`tests/world/tramEastGlobalCrossing.test.mjs`五项：默认off、真实工厂统一数据、坏输入零挂入、实际final面/实际city group/末跨/prepare-commit-rollback-finalize、保存前实际工厂viaduct顶点索引与曲线完全相同。加source曲线、startup、整包回归共 **11项通过**。

`native-factory-cpu.json`保存实际末跨及支撑结果、9点walkable射线、原临时group恢复、175 geometry释放记录。默认新选项未启用；没有浏览器或GPU动作。

本CPU fixture读取已有final artifact，**没有替root证明主游戏“旧bootstrap→refine→hash→exact换面→首次消费者”顺序**。本次实际工厂创建了统一站点和联锁，但未做全圈运行/上下货动态实测。既有全球构筑物、道路和活动演员的全量联合净空仍不在这5项工厂测试中；此前全global车辆对新支撑/新廊0碰的范围不扩大。
