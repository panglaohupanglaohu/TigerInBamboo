# 连续运行资源分配审计（2026-10-08，本轮）

本轮首先只读审计；主代理另授权只修 `swampBgm.js` 根查找缓存。随后主代理授权压力炮烟雾纹理生命周期窄修。没有改变美术图案、动作或剧情规则。**已复现并修复机器人压力炮烟雾的独立纹理释放缺口；湖沼自身600秒CPU更新未分配GPU资源。正式浏览器8分钟增长是否全部解决仍待GPU验收。**

## 实际执行范围

`performance-allocation-audit.mjs` 完整执行 `messengerIslandScene.loadSteps` 到返回正式 scene handle，等待正式虎异步资源，然后调用该 handle.update；不是只运行简化湖沼组件。调用链为 main.js:1907 → sceneApi.js:66 → messengerIsland.js:698 → updateIsland.js:23；湖沼由 updateIsland.js:83–93 收集根并调用 placement.userData.update → moebiusSwamp.js:3304 → inner.update。

探针用 Texture/BufferGeometry/Material 基类递增 ID 差统计全部子类新建（包括脱离场景的对象），另监听真实 dispose 事件，统计新 canvas 和 scene 可达唯一资源。源代码未插桩修改；只有 Node 工具内临时 prototype 监测。dt=.05，20 次/秒。真实 Three/模型/剧情；浏览器绘图 API stub，无 renderer、main 额外玩家/灯光/机器人/实际异步图片；同步模拟也没有推进墙钟定时器。**不是 GPU 内存或 FPS 基准。** 并行 CPU 探针的耗时不作性能前后比较。

| 实际窗口 | 更新帧 | 新 Texture / Canvas | 新 Geometry / dispose | 新 Material / dispose | 场景对象 | 场景唯一纹理引用 |
|---|---:|---:|---:|---:|---|---|
| 正式 handle t0–10 | 200 | 0 / 0 | 1569 / 221 | 274 / 0 | 42675→47272 | 135→135 |
| 正式 handle t10–130 | 2400 | 0 / 0 | 1089 / 349 | 352 / 152 | 47272→50069 | 135→135 |
| 实际湖沼 placement root 后续600秒 | 12000 | 0 / 0 | 0 / 0 | 0 / 0 | 50069→50069 | 135→135 |

`performance-allocation-audit.txt` 是实际日志，JSON 中窗口名字含 steady 只是预设标签；t10–130仍包含剧情创建，**不称稳定期**。另一个 `performance-allocation-trace.mjs/.json` 抓取实际 Object3D.add 新资源来源；随机分支导致数量稍异，未声称严格固定随机回放。

## 发现及最小处理

1. **实际新增主要是剧情运兵，不是湖沼 Canvas。** 栈已记录：updateIsland.js:119 → saihojiPhalanx.js:5009 update → :4499 spawnWave → :1325 createFisherBoat → warshipV6.js:31；以及 :1338 → spawnSoldier :1291/:1294 → harbor.js 的 createLongbowSoldier/createHarborPatrolSoldier → toon.js:164 addOutline。前20秒 trace 有44次步兵零件栈和30次弓兵零件栈。初始 SHIP_COUNT=2 (:75)；后续增援受 waves.length < SHIP_COUNT+6 (:4585) 限制。此证据说明延迟启动会增长场景和首次上传，**不说明8分钟内一直有界、不说明GPU纹理已查明**。
2. **正式 GPU 后段纹理持续增长仍未定位。** 根代理实际保存 `formal-resources-5min.json`：t192.5 textures211→t311.5 470；`formal-resources-8min.json`：t372.5 653→t493.5 1082，geometry4307→4381/program281；calls6602→11050。这与上面CPU口径不同，优先继续抓浏览器 Texture 构造栈、Source身份、shadow/render target和骨骼纹理。旧“1289”没有口径证据，已停止引用。没有给正常持续GPU增长签通过。
3. **每帧全场查找湖沼是确定的CPU冗余。** updateIsland.js:160 → swampBgm.js:19 scene.traverse，每帧访问约4–5万对象只取首个湖沼。最小修复是私有缓存 scene/root，检查根仍归属当前scene；根失效或scene切换重新查找，未找到不能永远负缓存，保持原进入/退出迟滞和每帧setSwampBgm调用。主代理已授权此唯一源码修改；单独测试记录待补。
4. **存在“重新开战清理”GPU释放风险，尚未复现为本轮原因。** saihojiPhalanx.js:1953 resetBattle 对 waves (:1978–1983) / garrison (:1987–1990) remove根并清空数组，未在该处逐项释放自有geometry/material。可能共享资源或有专属回收；不能贸然全dispose。若重复reset+重建并renderer上传，需统计旧自有UUID及释放；本轮不改剧情系统。炮击环反例 vanguardAssault.js:1867–1879 明确 remove+geometry.dispose+material.dispose，并非所有临时FX泄漏。

## 已核实的非泄漏模式

- moebiusSwamp.js:142–158 glow CanvasTexture模块单例；:3473–3483 firefly DataTexture单例。:1600–1608固定涟漪池，spawnRipple找空槽；果实和水面/鱼几何更新原buffer。未见update直接new Texture/Material/Geometry。
- holyCityStyleV2.js:110–136按来源纹理缓存重着色；:229只首安装安排1.5/5秒两次late pass；:232–242纹理pending每0.5秒最多40次。它们不等于无穷setInterval，但全图重新安装/替换生命周期的缓存清理未验证。
- miniBloom.js:147–150每帧setSize；vendor/three.core.js:3126–3144先检查尺寸变化，相同尺寸不dispose/重建GPU纹理。两个临时JS数组是GC开销，不是纹理泄漏。
- voxelAoRenderer.js:223初始化一次DataTexture，update:754以后处理dirty队列并上传原atlas；:661仅debug occupancy创建6张，刷新复用。dispose:813仅移除debug/contact meshes而没有全部释放，是“销毁系统生命周期风险”，不等于正常update持续增长。
- weather.js:121/134/183/204创建雨雪/闪电固定缓冲；闪电更新写原attribute。romanWorldArmor.js:12 update仅清除脱离actor的controller；灯池初始化固定灯，非每帧new PointLight。

## 下一步与边界

先抓正式浏览器新增纹理的构造栈和渲染目标归属，再决定是否需要修生命周期。不能把纹理数高、材质克隆、第一次可见上传统称泄漏。缓存BGM只能减少固定扫描；不能承诺解决10FPS或纹理增长。CPU工具不触及真实 localStorage，未控制浏览器、未改存档。


## 已证实并修复：压力炮烟雾纹理所有权

main.js:1912 → gameplay/robotOps/runtime.js:144 → createWeaponEffects 中 `shot`/`impact` → weaponEffects.js原:31 `steam` 每次调用 `puffTexture()`；world/citadel/ridgeFlowClouds.js:40–55每次创建独立128×128 CanvasTexture，无共享缓存。ant发射5烟团，命中1烟团；临时FX过期、clear和dispose原来仅释放材质，**Three Material.dispose 不会释放其map**。

独立真实执行 `weapon-steam-texture-audit.mjs`（无renderer，不冒称实测GPU）：20发、每发2模拟秒调用effects.update，全部特效已消失，原实现120个唯一CanvasTexture、0个dispose。源码备份 `weapon-steam-before/src/gameplay/robotOps/weaponEffects.js`，实测原证据 `weapon-steam-texture-audit-before.json`。

最小修复仅 `src/gameplay/robotOps/weaponEffects.js`：每个控制器闭包懒建1张steamMap，所有烟团共享。过期SpriteMaterial照旧释放；clear保留共享图用于后续炮击，controller.dispose释放且置null，重复dispose不会二次释放纹理。没有把puffTexture改为跨城全局单例，没有变云图或其它城市美术。

修复后相同20发：唯一纹理1、dispose1，证据 `weapon-steam-texture-audit-after.json`。更强专测 `tests/world/weaponSteamTextureLifetime.test.mjs` 100发=600烟团、600独立可动画材质、1张纹理，FX归零；两控制器独立所有权，clear后可重用，dispose仅1次。保留原颜色、alpha、深度、128像素sRGB纹理设置。**这证明生命周期修复，不证明整游戏FPS达标。**

## 已接入：湖沼BGM根缓存

`src/scenes/messenger/swampBgm.js` 增加以原state为键的WeakMap；缓存存在且root仍属当前scene时只沿父链验证。scene替换、原根被移除/改kind、顶层数量变化会重找；未找到的根不做永久负缓存，稍后插入能找到；缺玩家仍请求原false，不扫描。原迟滞33/37半径、28/34高度和每帧音频请求不变。

`tests/world/swampBgmCache.test.mjs` 执行生产模块，仅注入音频与Three依赖。4项：1000帧首扫描1次/音频调用1000次；入出边界；更换scene、同count嵌套换根、缺根后添加；缺玩家/根移动/独立state。备份 `bgm-cache-before/src/scenes/messenger/swampBgm.js`。现设计沿用单活跃湖沼假设；若未来在仍保留有效旧根时，额外插入排序更早的第二座嵌套湖沼，需要明确多湖优先级/注册机制，本轮不扩大模型。

7/7专测通过，`performance-allocation-fixes-tests.txt`；weaponEffects node --check通过。回退仅恢复上述两个源文件各自before副本，不恢复其它并行文件。主代理负责正式GPU长运行、烟雾视觉与音频进出场验收。


## 正式GPU九分钟验收补记（根代理执行）

fresh正式入口自然autostart运行到595.4秒，根代理保存 `formal-resources-after-steam-fix-9min.json`；最后120条t476.5–595.4：renderer textures112恒定、geometries3923恒定、programs273恒定；scene材质纹理/source151恒定，bone0，shadow maps3。对照修复前t493.5 textures1082，**本次持续纹理增长已消除**。GPU由根代理实际操作，本代理读取结果并记账。draw仍约9.5k–10.3k，未测/不声称FPS性能通过。两源文件和专测冻结。
