# 新城围墙、错落住宅与后院喷泉

## 正式接入复核

主代理已在 productionOptions 默认启用 newCityWalledLayout（URL 参数=0可回退），candidate 显式选择 walled-court-1，公共支撑识别 newCityPublicWalkable。主代理复跑 Main、Enclosure、PublicSupport 共21/21通过。实际环池使用mesh三角而非外矩形支撑；中心contact=null，左右路径命中环池，没有把喷泉注册成可站地面。

正式全世界CPU构建exit0：115阶段累计65.17秒，最大单段6.66秒，峰RSS5406MB；landmarks和铁路城市support成立。守军28岗，公共mesh112，路线157点；mainHallReachable=false、connectedMainHallNodes=0仍是未解决问题。日志见production-profile.log。此结果不是GPU验收、浏览器稳定性或导航全部连通的证明；同机位四视图与真实通行仍待完成。

2026-10-07。目标是用户认可的新城三视图；已读 Oskar 顾问评审，保留原蓝穹顶、主殿真前后门、大阶/广场/铁路锚点。实现文件为 `src/world/citadel/targetNewCityMain.js` 与新 `targetNewCityEnclosure.js`。主代理拥有正式 candidate 接入；此说明不宣称 GPU 实景已验收。

API：`createTargetNewCityMain({layout:'walled-court-1',proportion:'expanded-1',courtyardSurfaceHeightAt:actualSampler,...})`。默认layout仍为`legacy`。新增物件在既有 expanded 几何形变之后加入，坐标是形变后 Main-local；只由主代理应用一次径向 placement。所有权/释放在 main handle 内完成，无新动画 update。

实际地形检查否决原x±23、后z−23、前z11.5矩形：这些线跨真实陡坡。未通过放宽允许高差或用高裙填谷绕过；把墙缩回已有可靠的平坦院落边界：两侧x±22、后z−20、左前z7.2、右前z8.2，四角塔在x±20.1、z−18.1/6.3。地基≤0.45单位网格采样，缺采样/局部高差>1.25拒绝并报告。正式实际径向地形fixture：10屋、50墙段、4角塔、3门洞，0拒绝。

十住宅稳定ID保留，位置变成左右错落两簇，左前住宅深度由4.1小幅减到3.9，给墙和主殿翼楼留空。屋体/屋顶footprints与彼此、主殿、翼楼、墙、塔无二维占地相交。纹理材质复用既有建筑色板。方塔下宽上窄、有橙屋顶；围墙石压顶和实体垛口，不用铁围栏。

后院喷泉中心[0,−15.51]（XZ），盆外半径1.3。原整张后院地板替换成有真实圆孔的环池地面，原中轴地面细条移除。原两列盆栽取消以让出绕池通道；旧树和其他dressing不动。左右净距各3.43、两条绕池路线真实地面实射线通过（每0.2单位及左右0.8余量）。喷泉池、柱、静态水弧不注册步行；池下没有残留可走圆盘。通过原后门/后院接阶进院，后门出口短路另采承托。门洞为挤出实孔，非涂黑假门。

所有新增可走面打 `targetWalkable` 和 `newCityPublicWalkable`；报告 `report.enclosure.publicRoutes`、`fountain`、`gates`、`footprints`、`rejected` 供主代理公共承托及全场景验证。环池footprint含 `holes`，禁止下游仅用外矩形填回水池。围墙无“城墙顶可走”标记。侧门有真孔，但尚未承诺与整城最终导航自动连通。

性能：212个墙/塔重复网格合并为3材质批次，保留逻辑三角范围；整个新增围墙/门道/喷泉模块约23网格。没有新增灯源或每帧循环。这是几何批次数量，不是实测GPU帧时。

验证：新专属7项＋既有Main9项共16/16通过，见`focused-tests.log`。包括实际径向地面、门洞真穿透/门垛真命中、环池脚下采样及中心无隐藏支撑、缺地/陡坡拒绝、住宅占地相交检查、释放、当前source-before对照。`source-before/targetNewCityMain.js`保留改前版本；旧default在original/expanded × windows on/off四组合全部几何/世界矩阵/颜色SHA256一致，footprints亦一致。

旧 `targetNewCityMainWindowBatching.test.mjs` 的历史快照为10月6日没有庭院住宅的版本，断言34窗而当前改前已74窗；3个旧断言失败，历史快照全数组diff进程异常退出。没有修改/删除这些测试，也不将它们报告为通过。本次source-before合同单独证明未回归默认几何。

待主代理整合：正式candidate显式开新layout；公共支撑收新标记；最终轨道/士兵/公共步道扫掠复验；同机位俯视、前视、木马侧视、后院GPU检查。围墙/喷泉不能替代之前`mainHallReachable`问题的独立解决。回退只需layout设为legacy，不写玩家存档。

## 正式接入与最终CPU证据（本批追加）

主代理已接入 `targetCityProductionOptions`（默认开启，`newCityWalledLayout=0`回退）、`targetCityDetailCandidate`显式layout选择、runtime/Main import revision及`newCityPublicSupport`的显式公共面标记。主代理专项21/21通过；该结果由主代理报告，未在本子代理重复整套运行。

本子代理只读复核：公共支撑和玩家承托都用实际网格三角形，footprint只用于保护/名称注册，没有按环池外矩形重新填地。candidate的基础填隙只处理floorY===0；当前环池底约−0.20，不进入该分支。独立真实`createNewCityPublicSupport`合同检查：ringRegistered=true，喷泉实体注册列表为空，池中心contact=null且sample=false，两侧8个路线端点全部命中真实环池面。

正式完整场景脚本 `startup-unresponsive-20261007/profile-world-cpu.mjs` 已运行完成，exit 0，没有改生产源代码。证据复制归档于本目录：

- `production-profile.log`：115个CPU构建阶段，总阶段用时65.17秒；最长单阶段6.66秒；峰值RSS **5406MB**。无WebGL，不能据此宣称浏览器崩溃/卡顿已解决。
- `production-world-cpu.json`：默认空存档、实际正式工厂，ok=true、landmarks=true、rail/city support=true。
- `production-garrison-cpu.json`：112个公共面，新增环池面、3门槛及后门路径已在正式列表；28个守军岗位、505个相连台阶节点、157路线点、16.45高差。**connectedMainHallNodes=0 / mainHallReachable=false仍未解决**，路线终点仍是有承托的入口。脚本的成功断言不包括主殿可达，因此不能把exit0说成整城导航完全贯通。
- `production-scene-audit.json`：湖沼3层/120路径点、66株/3批植物，全部66株完整包络通过通行检查，居住节点ready；这验证此前Greg湖沼模块实际接入，没有GPU验收含义。

脚本只写了`integrated-production-geometry.json`和`integrated-production-rails.json`等当前集成结果，未覆盖船侧调查的原始`production-geometry.json` / `production-rails.json`基线。GPU、正式守军进入主殿、侧门与全城导航连通继续明确待验；没有为等待GPU扩大功能范围。
