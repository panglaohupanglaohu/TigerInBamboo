# Greg 湖沼新版目标 · 环境批次 2026-10-11

后续：中央冠用户截图反馈已另行修正（有中央叶几何变化），见 `CANOPY_CORRECTION.md`，本文件描述第一批色彩/岩面改动；最新整合 CPU 35/35，日志 `environment-canopy-integration-tests.txt`。

状态：四个生产模块已修改，CPU 验证通过；本代理没有 GPU 验收权限/画面，正式游戏前后截图由主代理完成。没有给出美术分数或声称超过 90 分。

## 范围与依据

已读 `AGENTS.md`、`docs/PROJECT_HANDOFF.md`、`docs/greg-team/TEAM.md`、`docs/MOEBIUS_GAME_ART_STUDY.md`；实际查看 `artifacts/pipeline/greg-swamp-target-20261010/target-v3-current-courier.png` 全图。未重新观看 GDC/作者视频，未声称取得作者 shader。

- 画面观察：目标蕨叶是深蒂、较浅外叶与冷暖青绿成簇，叶背偏灰绿；主体水体/树干/步道保持可读。岩壁有大范围潮湿斑、矿物黄赭痕与少量细结构线，大片安静岩面穿插其间。
- 本项目推断：先修叶片现有机械亮暗半叶、局部过亮黄绿叶背，再增强壁面稀疏矿斑。不增加株数、遮挡物或碰撞面，保留当前约 1 px 描线规则。
- 作者陈述：沿用已归档研究中的空间/色块/稀疏线条方法；本批没有新增作者事实。
- 待验证：新版青绿在正式昼夜光照中的明度、矿斑在中岸距离的实际可辨识程度、透明水面下的视觉干扰、帧时。

## 实际默认调用链

正式 `loadMoebius` → `moebiusSwamp` → `swampV2Art`：`installSwampCoralCanopy` → `applyGregLakeVisuals` → `installSwampCoralTrunkDetail` → `installSwampNaturalCliff`（实际调用 `applySwampCoralWeathering`）→ `installSwampCoralUnderstory`。`finishSwampV2Art` 在最终球面树变换后重新附着林下植物。

本批没有修改入口/main/moebiusSwamp/V2Art，默认调用已有模块即可取得变化。树皮 aged-clefts、岸簇 v9 已存在，未重复重建。

## 已实施

1. `src/world/swampCoralUnderstory.js`：原同一叶片两半独立强对比改为连贯青绿色面；根部偏深，外叶随长度柔和提亮，跨中脉仅 7% 亮度差。仍保留丛间和叶间明度差。仅 vertex color，不修改 position/UV/normal/index、株数或矩阵。
2. `src/world/swampGregVisuals.js`、`swampCoralCanopy.js`：同七色散布规则采用冷暖玉绿，不改变冠几何；叶背从强黄绿混合改灰绿、混合权 .45→.30。原五条弯脉、投影 footprint 淡出与描线宽度保持。
3. `src/world/swampCoralWeathering.js`：增加宽尺度矿物斑、沿旧接缝的潮湿渗流、少数赭色层理痕。全部锚于原 inner 3D frame；`fwidth` 淡出小于像素的层痕。无纹理、无时间 uniform、无逐帧回调、无额外 draw。外壁原顶面珊瑚土带最终混回逻辑保持。

## 固定对照开关

- 新版默认：`http://localhost:8931/TigerMessenger/?tour=swamp&autostart=1`
- 仅恢复旧叶色/叶背/半叶：追加 `&gregTargetFoliage=0`。
- 仅恢复旧岩壁 weathering v4：追加 `&gregTargetPatina=0`。
- 两项都恢复：同时追加两个参数；需要重载以重新构建材质/色缓冲。

这些只用于本批色彩对照。不能把 `gregUnderstory=0` 或 `gregLakeVisuals=0` 的整体关模块画面当本批准确 before。

## CPU 验证

命令：bundled Node `--test tests/world/swampCoralUnderstory.test.mjs tests/world/swampCoralCanopy.test.mjs tests/world/swampGregVisuals.test.mjs tests/world/swampCoralWeathering.test.mjs`。

34/34 通过，日志 `environment-tests.txt`。新增检查覆盖连贯叶色、浅端/深蒂、7% 中脉两侧差；旧叶背 shader 对照恢复；岩壁旧 hook 组合、frame、静态 uniform、细痕抗锯齿、旧 v4 开关。已有检查覆盖真实根接触、球面前后附着、所有叶顶点避开四内单位/两世界单位步行带、桥区净空、原角色节点几何/变换、冠端点、资源 dispose。

seed 7711 fixture：508 株（95 蕨、50 扇、363 垂叶）、93 岸株、18 墙殖群、180 藤段、41 低岩、5 个 instanced draw、54,862 三角；投影岸叶角覆盖 0.511，不是可走面积或美术分数。植物最高 inner Y 52.968；墙群 282 对相邻叶 279 对重叠。未增加本批顶点/绘制调用，shader 算术成本没有做 GPU 帧时测量。

## 恢复与边界

四源改前原件在 `source-before/environment/`；`environment-source-manifest.json` 记录前后 SHA256。恢复时仅逐文件复制这四个原件，不重置共享仓库或其他成员改动。

没有修改信使模型、10 个孩子身份、五花船/两桨、鲸/虎/猴动画、玩家位置、存档或碰撞。没有提交、发布、外发。现有树冠遮挡、船桨可读性、生物动作是否符合目标及整体性能须以主代理正式 GPU 报告为准。
