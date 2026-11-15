# 早期台地与薄平台：真实World结构诊断

先准确README：815236105079398400（2016-12-31）是“irregular is the new hex”，并非无文字；781957658597269506（2016-09-30）才无文字。前185帧/后109帧，全部4张联系表逐格看，原尺寸前0/50/120/184、后0/50/108；逐帧PTS与观察分别存ID目录。原注释称6帧不符。

灰岛片有台阶下行、路径白点、洞口/柱/岸线；黄色片是层叠薄黄平台、支柱、梯洞、红屋/烟、桌椅和下层树，转镜显露平台底面。两者不能简单当同一套单值高度量化；影像也不证明原作floor/noise算法。

Workbuddy terracecliff独立二维高度场量化/classify思想有用，重构generateTerrain早已写共享World岩石位，不重写已有量化、河流、洞口和features。新增core/terrace-profile.js只读同高边邻接连通片、未形变顶多边形面积、边长×柱顶高度差代理及海边长度。页面terraces.html读取真正terrain场景World，双网格可切换。代理不等于变形Mesh坡角、实际墙面积、洞内/悬垂底面、身高净空或可走性认证。

逻辑tests/terrace-profile.mjs：正方/混合连片、面积总和、snapshot不变、版本和单格解析（顶1/侧4/岸4）通过。实际浏览器terrace-profile-browser.json：quad736陆格/90片，mixed592陆格/106片，读取不改World；临时改测试浏览器一柱为12层被检测，恢复原solid/rock与诊断；43绘制调用，截图双网格查看，无pageerror。未动用户浏览器、原版或游戏副本。黄色片本批仅学习，不记实现验收。


## 第 56 批（C04）

815236105079398400：补片子里命令落点的不规则六边形——battle-c04.js hexSlotOutlines：目标格各顶点的顶点对偶格（同台地层楔块并集外边）画白框浅填并淡出，`?c04=hexslots`。截图 shots-r56/815236105079398400-hexslots-mixed.png（真实 onPointer 3 次命令，边数 6/10/6）。判定 done。781957658597269506 见 wood-ladders-review.md 本批段。 详见 [r56-C04-bn-world.md](r56-C04-bn-world.md)。
