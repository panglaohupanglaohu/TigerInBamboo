# 月湖水面岸带 R2（2026-10-25）

Oskar方法研究顾问的有限实施，不是作者本人或作者源码复制。

作者陈述：2024-04-19原帖（https://x.com/OskSta/status/1781405550061687016）把水/草域投影与岸域定向UV分开；本批仅复用已存研究记录，没有声称重新完整观看。项目推断：应先修真实水域边界，再补低湿岸，而不是用雾或线盖掉错面。

代码观察：原外圆r3.5与偏心孔r2.52、孔心(1.1,.7)相交，孔跨出外圆约.324m，却被传入Shape.holes。独立固定相机GPU“before-high-r1”可见直切片，深水圆也越过干缺口。

R2改为两圆交点组成的一个闭合月牙边界，保留圆参数、湖位、水位、路径与碰撞。深水按水面真实三角裁切，不再让独立圆片横过干缺口。新增浅水台与湿岸斜面最大外扩.27m、最大r3.77，未到pathInner3.8。外环392个顶点在正式installMoonLakeSceneGarden链中射线贴最终hills表面，不修改承托源。

验证：4项测试通过，包含水面三角域、深水裁切、路径净空和旋转坐标下真实网格承托。组件GPU（当前生产lake/buildWorld/buildHills，非完整游戏）固定机位看过before-high-r1、after-high-r2、after-low-r2；392/392贴地，0缺失，无console error。JEV R1/R2实际调用且R2缓存复用已记录；它不代表看图验收。

**未完成/不声称**：用户宽水域截屏的具体岸线身份尚未确认。其尺度可能为外围主岛海岸，修好r3.5小月牙不能据此称大岸已修。独立正常入口已实际启动，但现有“月湖四松检查”点击无效且无console error，父任务正在统一缓存后复核。完整场景、角色绕岸通行、原用户机位对照仍待父任务。不改全球海平面、hills或轨道以猜测修补。

文件：src/world/lake.js、src/world/moonLakeShore.js、src/world/moonLakeSceneGarden.js，测试tests/world/moonLakeShore.test.mjs。原源见source-before，R2见source-r2与SHA256。父任务负责main/index/正式缓存链，顾问未修改这些文件。

组件：http://localhost:8931/TigerMessenger/artifacts/pipeline/moon-lake-shore-20261025/component.html

## R3：用户澄清为松林外侧临海岸边

已实际看补充全景（新城/雕塑、弧形桥、彩绘帆船、右方松月），不再把小月牙当主问题。旧HARBOR常量并非当前港口位置；实际港口已由loadCitadel迁往圣城range。按当前RANGE_SITE方向，组件相机flat eye=(61,2,59)、target=(48,.3,44)复现大幅绿板侵入海。关闭**仅旧平台壳**，绿板消失而真实山坡岸线保留：diagnostic-city-facing-coast.png / diagnostic-city-facing-no-platform.png。

已找到实际所有权错误：platforms.js在hills矩形[-46,66]×[-62,50]内丢弃旧壳；矩形外剩余72×72旧方壳继续浮出海面，形成大绿薄片。R3用moonCoastOwnership在向圣城的东南外岸两个有限窗口移交给已存在的hills/闭合坡岸：east x>66,z0..53；south z>50,x20..72；端部3m渐退。地面附近轨道与现有colliders脚印从窗口中扣除。其它海岸、月湖内岸、城市不改。

渲染与支撑同mask：仅主岛原平台的topHeightAt和hills.sampleRadius在窗口内读取最终hills+skirt真实三角径向支撑，空海面为-Infinity；不再保留已删方片的幽灵地面。开局一次建3m角向三角桶，4096条坐标缓存，玩家查询不会每次扫全岛。source positions/index未改。平台材质克隆，不改共享材质原对象。

8项总回归通过，包括窗口外原支撑、无网格海面无承托、真实坡岸支撑一致、缓存、地面轨道与人物脚印保护、shader与CPU有限mask。实际组件GPU after-city-facing-coast-r3.png显示installed/1shell、无consoleerror、原hills山坡仍在而穿水板消失。初次组件因platforms旧缓存没有新标记而status=main-shell-not-found，已发现且改明确r3 query，不能把该失败图称成功。JEV R3实际调用并复用cache=true；仍硬标完整正常场景轨/人/船保护及同机位尚待验收。

正式集成依赖：messengerIsland调用installMoonLakeSceneGarden须传platforms；平台query统一moon-coast-r3-20261025、SceneGarden刷新r3。父任务负责缓存和唯一正常游戏启动，本文不冒充其验收。报告挂lake.coastOwnership，同时在lake.shore.userData.report.outerCoast。
