# 旧城两翼连续街区候选

源码 `targetOldCity.js`；新增后置模块版本 `old-wing-streets-1`。启用后资产 report 版本为 `target-old-city-12-wing-streets-candidate`，默认保持 v11 原几何及外观。没有修改 main、candidate、山体、轨道、城台或既有公共接点。没有自行提交、推送或浏览器操作。

## 实际依据与结果

实际看过 `citadel-east-joint-startup-20261006/live-front.png`、`VISIBLE_PANORAMA_REVIEW.md`，对照 `citadel-rail-cliffs-20261006/target-v11-smooth-east-connection.png`。这一轮回应旧城左右实台裸空、横向城群窄的问题。没有用 CPU 通过抬高原 58 分。

首轮选择两翼中/前两个带，共 4 对、8 间上限。实际 exact final 山面接受 **3 对、6 间**：

| 成对簇 | old-local 中心 x | 两间中心 z | 地板 y | 体高 | 基础最大高度 |
|---|---:|---|---:|---|---:|
| 左中 | -22.05 | -3.95、-.75 | -.11583 | 6.10、5.15 | .37847 |
| 右中 | 22.05 | -3.95、-.75 | -.09776 | 6.10、5.15 | .09661 |
| 右前 | 22.05 | 5.45、8.65 | -.00861 | 4.70、3.85 | .38717 |

每间宽 3.65m、深 3.20m；同对两间共用一面真实墙，屋脊错层。彩墙沿外侧街缘布置白小窗，门为真实拱形开口，内部有短墙、地板、屋顶；没有在共墙上画窗。门通向私人房间，**不是贯通公共廊道，也未注册为公共地面**。不复制造高塔。配色完全复用原黄、青、粉、蓝、橙顶与浅石材质。

左前一对的实际山面从 -.16992 降到 -2.61040m，高差 **2.44048m**，超过新候选 1.25m 的短基础限制，因此整对拒绝。未扩大城台、填山或用高裙房隐藏这个问题。保留 rejected 记录。

旧城横向包络从约 39.60m 扩为 **47.90m**，约增加 **21.0%**，最高仍 33m；这里指几何包络，不是同机位可见像素面积。实际后续截图才能判断六屋是否显著改善两翼，以及左前缺组的视觉影响。

## 后置接口

```js
const oldCity = createTargetOldCity({ wingStreets: false }); // 默认不构造新屋
// 先让 oldCity.group 按当前旧城位置和 yaw 挂入最终 candidate/castle。
const wings = oldCity.completeWingStreets({
  enabled: true,
  sampleSurface: (oldLocalX, oldLocalZ) => actualOldLocalHeightOrNull,
  collisionGroups: actualWorldObject3Ds,
  protectedFootprints: [
    // 可选额外公共足印：旧城局部 XZ，凸多边形，按完整垂直柱保护。
    // { id: 'public-port', polygon: [[x,z], ...] }
  ],
});
```

`sampleSurface` 可返回数值或 `{height}`。应使用实际 final 山面索引；缺采样拒绝，不提供解析替代。当前 yaw-only 变换下，可 `xzAt(oldPlatform,yaw,x,z)` 后调用 candidate 的 terrain sampler，返回 `hit.height-oldPlatform[1]`。输入都在 **oldCity.group 局部坐标**，collisionGroups 则是实际世界 Object3D。

方法自带原旧城几何碰撞快照及中央主阶、z=-7.6/2.4/12.4 三条横街保护带；原 house footprints、主塔、门、桥口、瀑布供水口、40 阶均未改变。建议外部传入当前 candidate 的实体结构、两城连接阶、瀑布石口/供水槽及真实 tram group。云、水粒子和 turf 不作为实体障碍。**显式传入的 root 即使启动时 visible=false 也会审查；其内部 hidden 子对象仍按状态跳过。** 此规则避免漏检 pending tram。

短基础下方的真实地板不会因包围盒重合误拒；房体包络从统一地板 y+.025m 开始，与实际障碍三角做相交检查。如果公共踏面真正穿入新房体，则必须拒绝，不应删掉该支撑障碍。此碰撞检测是保守房体包络对实际表面三角，未宣称验证任意封闭大实体的内部包含情形。

返回 `{group,report,dispose}`。可能有 rejected 且只建部分对；**零模块不等于建成**。重复安装会抛错，先调用旧返回值 dispose 后才能重新采样。dispose 只撤新增、释放新增几何并恢复原 bounds/performance/version；原共享材质不释放。原 oldCity.dispose 自动撤新增，不需要另外双重销毁。

安装后需刷新现有 provider/植被避让。新增房组带 `targetProtectedArchitecture`，不加入原 15 房屋实体/WFC 域。WFC rebuild 时先在新资产完成放置后重新调用；若提交失败，恢复原旧资产及其旧翼楼，不操作旧 handle。不得仅复用上一次地面采样结果。旧城工厂不自动修改主线程的 editor 或导航缓存。

## 资源与 CPU 证据

- 新增 **14 个合并 Mesh、2,076 三角形、0 新材质**，按左右翼及材质合批；没有隐藏旧件假装优化。共享墙只生成一次。
- 432 个实际地面承托样点；短墙脚随已采边界落地，底边埋入 .025m，未改变地形。
- 331,680 次保守房体包络/实际障碍三角检查；接受对无接触。
- 原主阶、门、三横街：396 条新增房体身体射线，无命中。
- 实际组装 gallery 及两城连接路径：每 .15m、横向 ±.4/0、身体 .55/1.2/1.8m，共 31,554 条新增房体射线，无命中。
- 实际完整新全球红蓝线：每 .5m，共 10,395 个载货 OBB 姿态与新增房组世界 bounds 分离，0 接触、**0 窄阶段三角测试**。这里是包络分离证据，不能把它称为进行了 10,395 次窄相交通过，更不能外推动态演员或原世界其它结构。
- 默认旧城几何、材质、坐标、公共报表保留；实例所有权、真实门洞、缺地面/陡坡/公共足印/隐藏 pending 障碍拒绝、回退释放有专项测试。
- 命令：`node --test tests/world/targetOldCityWingStreets.test.mjs tests/world/targetOldCity.test.mjs tests/world/targetOldCityRoofWfc.test.mjs tests/world/targetOldCityRoofSession.test.mjs`，44 项通过。最终一次结果见同批交接。

依据为 strict source epoch **2638422502** 经实际 exact final artifact 原 Mesh 安装后的 CPU fixture，并构建当前真实 candidate 和 crossing release。数据保存在 `actual-final-cpu.json`。原源码快照 `targetOldCity.before.js` 和 `first-survey.json` 保留；原目标与实景截图未覆盖。

尚未主游戏启用、同机位 GPU 复核或连续实际行走。屋群仍是手工确定性组合，不称 WFC 自动街区，也不声称解决右岸高崖、全局铁路水储备或完整场景验收。
