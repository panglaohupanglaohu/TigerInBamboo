# 山体林冠候选1：接口与验证

新增 `src/world/citadel/mountainCanopyCandidate.js`，默认关闭，未修改共享山体、植被或发布接线。已经实际查看目标 `target-v10-low-new-city-ridge.png`：目标是灰青连片阔叶林冠、少数深绿竖向树、草坡留白与裸岩。此模块只处理林冠，不能宣称同时完成草岩过渡或改变山势。

## 接入

```js
import {createMountainCanopyCandidate} from './mountainCanopyCandidate.js';
const candidate = createMountainCanopyCandidate(castle, {
  enabled: canopyPass === 1,
  surfaceIndex, // 最终山体的 world-space exact index，不接受解析高度替代
  protectedBoxes, // 世界空间建筑、道路/通路保护盒
  rail, // 世界空间沿轨采样 Vector3[]，逐相邻段检查
  radius: 160,
  waterHeight: officialOceanLevelAt,
});
if (candidate.group) castle.add(candidate.group);
// 外部保存candidate；退出/切换时candidate.dispose()。
```

函数返回 detached group，不自动改场景，也不隐藏原植被。接入者仅在开关启用时隐藏旧山体 cypress / understory，而保留 groundcover/grass；旧版恢复由接入者负责。名字为 `citadel-mountain-canopy-candidate`；树干网格 `citadel-canopy-root-trunks`，阔叶0/1/2与柏形3分为实例批。实际根部验收请检查树干真实 geometry y=0 顶点乘 instanceMatrix / matrixWorld，不能沿用只识别旧树名的检测。

## 几何与材质

这是不透明的真实封闭3D树冠，三个低幅瓣状轮廓共享实例几何，圆润但保持少量轮廓变化。不是 billboard、体积云，也不是 Oskar impostor。灰青材质为本项目提出的色板 `#668e89 / #70958d / #5b817e`，柏形 `#315f59`；使用同场景标准光照，未烘焙夕阳。材质和网格均标记现有 material ownership，避免历史石墙纹覆盖。

低频世界布局场形成林带，边缘树冠渐小；并非WFC驱动。稀疏柏形只作垂直对比。固定seed；650株默认上限、5 draw calls上限。区域、间距和上限可显式传入；最多1200株及10000待测网格，超出抛错，避免静默预算膨胀。

## 承托与保护

根及六个真实树干底圈顶点针对最终 surfaceIndex 独立采样，最终再次检查真实放置后底圈：拒绝>2mm浮起或>30cm埋深。树冠/树干整个世界包围盒检查建筑盒+1m余量和铁路段+5m余量，覆盖树冠越轨问题。铁路数组跨lane若不连续只会过度拒绝，不会漏检。全株bbox保护较保守，可导致城边树量偏少，需实景观察，不应未经测量放宽。

报告存于 `group.userData.canopyStudy` / 返回 `report`，包含每株实际source mesh/face、世界根点、size、slope、底圈gap、世界bounds、seed、拒绝统计和三角数。使用真实surfaceIndex是硬依赖，开启但缺少index会抛错。默认关闭不读取或修改输入mesh。

## 已完成的测试（合成几何，不能称实际游戏验收）

命令 `node tools/tests/check_mountain_canopy_candidate.mjs`。

旋转的球面局部castle、起伏最终网格、建筑保护盒及61个轨道点；原生 THREE.Raycaster 独立检查全部4660个真实实例树干底部顶点。233株（228阔叶、5柏形），57784三角面、5 draw calls；本次构建约12ms。实际根gap范围 -0.187798m～-0.011800m，无悬浮；所有保护检查通过，稀疏轨道两端间交叉也拒绝。默认无变更、seed重复一致、源position未变、材质ownership通过。完整结果 `canopy-candidate-test.json`。

真实场景渲染、林冠是否仍像独立球块、沿山分布、阴影、实际GPU与铁路镜头尚待主线程接入验收。

## 参考与限制

已读仓库Oskar顾问技能及research/colour/rendering参考。2024树原帖 https://x.com/OskSta/status/1849427564034498642 的八边形impostor为已核查公开研究线索，但本候选没有采用该技术，不能以其名义称还原作者实现。Bad North森林共同色块与最终形变后附着来自已有演讲字幕研究；这里的低频场、真实网格和约束为项目设计。

AGENTS记载的 `/Users/panglaohu/.agents/skills/threejs-game-director/SKILL.md` 当前缺失，并已查本地两技能目录无对应文件；本次实际使用可用Oskar技能、项目工厂和Three现有实现，没有声称加载缺失技能。
