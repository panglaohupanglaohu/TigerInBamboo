# 山腰云带候选1

独立新增 `src/world/citadel/mountainCloudBanksCandidate.js`，默认关闭；未修改已有云、山体或共享接线。

```js
import {createMountainCloudBanksCandidate} from './mountainCloudBanksCandidate.js';
const banks = createMountainCloudBanksCandidate(castle, {
  enabled: cloudBankPass === 1,
  surfaceIndex, // 必须是最终真实山面
  protectedBoxes, // 标准THREE.Box3，世界空间
  rail, // 世界Vector3采样
  radius: 160,
  waterHeight: officialOceanLevelAt,
  timeOfDay: () => P.timeOfDay,
});
if(banks.group) castle.add(banks.group);
// 每帧使用运行时绝对秒数，而不是帧delta：
banks.update(elapsedSeconds);
// 切换/退出：banks.dispose()
```

返回 detached group / report / update / dispose。不自动隐藏原 `citadel-ridge-flow-clouds`，由集成者在候选开时隐藏原云并在回退时恢复。未加入任何localStorage或发布默认。名字 `citadel-mountain-cloud-banks-candidate`，子项 `citadel-cloud-bank-N`，统计在 `group.userData.cloudBankStudy`。

## 实现与参考界限

已读 `ridgeFlowClouds.js`、`ridgeCloudField.js`、目标v10及Oskar研究技能。复用现有 `buildRidgeCloudField` 的最终面缓存与梯度，选少量点，沿等高方向追踪19个真实surfaceIndex落点，再构造一条闭合低矮云体。每条一个连续网格，而非把384个sprite再加密。默认8条，上限12；默认每条528面，共4224面/最多8次绘制。

真实三维空间轮廓不随相机转向，普通depthTest让山面与建筑遮挡云；透明边缘用视线与表面法线夹角柔化，depthWrite关闭。暖白顶部 `#f4f0dc`、灰青底部 `#91b3b1` 配标准场景光照，夜间减弱opacity。这是项目的封闭薄云体近似，不是体积光散射、impostor、Oskar私有源码或GI。

每条云体预留±1.5m全部运动范围后，整个world AABB检查建筑盒+4m与铁路段+6m余量；长度约22.5m，宽7.2m、高4.4m。相邻锚点至少26m，减少透明排序交叉。绝对时间低频位移保证重复时间得到相同状态；不累计漂走，不触碰其他动画。使用真实山面采样确定云带位置并允许低端与岩体相交，由深度遮挡形成绕山关系，不能把这称为云粒子完整碰撞模拟。

## 已有独立测试

`node tools/tests/check_mountain_cloud_banks_candidate.mjs`。旋转castle与起伏最终网格、建筑保护盒、铁路：8条/4224面，合成构建约12.7ms。152个真实锚点由原生THREE.Raycaster独立对照，最大位置差6.70e-14m。400秒范围的58个采样时刻全部云体bbox留在预留范围，最大运动1.5m；建筑/铁路净空、默认关闭、源几何不变、确定性、绝对时间回放均过。

测试结果 `cloud-banks-candidate-test.json`。**未进行实际GPU编译验证，未声称实景遮挡、云色或性能已通过。**

## 三视角验收建议

1. 中湾固定日光全景：确认只有少量云带贴山腰，轮廓仍读得清，不遮新旧城主体。记录8条上限下实际接受数量；若全部被约束拒绝，不能称云已实现可见。
2. 旧城山肩近景，绕转约±45°：检查是否读成白色石条/管道，透明边缘有无硬缝，山前/山后深度遮挡是否合理。正面和侧面都应稳定，不能仅一个角度好看。
3. 新城港口/沿轨眼高：检查运动极值时云不盖城门/港口通道或铁路；20秒相同机位视频确认轻移，不因噪声跳动。另采日/暮GPU shader与GL错误，确认onBeforeCompile语句实际编译。

若读成白色管道应否决或改几何与shader，不应以“连续体已写好”自动接受；若透明排序暴露交叉，先减少/重排云带，不以提高雾遮挡掩盖问题。
