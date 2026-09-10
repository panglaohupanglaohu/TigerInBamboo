# 原飞艇 v1 候选：放置、动画与可见性契约

原 `createMoebiusAircraft()` 单机归档经过 Blender 结构优化；未声称整编队或世界行为已经移植。

橙色卵形 hull n1 几何保留；奶油鼻锥 n22 变为带内壁和开口的采集口，探针 n30 局部几何向后延长并增加三个支撑；纵向黑色环箍原姿态保留，新增支脚接到锥面。尾喷环 n19 的几何法线改为机身轴向；4 片浅色尾翼及棕色拼片仍是原件，只有小倒角。增加三条贴壳接缝及原 cockpit-anchor 下的外舱盖。

原 67 个 three_node_id、父级、局部矩阵、three_userData 中全部 nodeRef 保留。新静态结构按父级和材质合为 5 个节点，共 36 个默认可见网格；可见三角数 4782 → 5878。摄像机/审查灯不在 GLB。

## 不透明证据

`src/assets/moebiusAircraft.js:99` hullMat 调 crystalToon 的 transparent=false；`crystalToon` 默认 opacity=.85 是同文件第 43 行的独立参数。在 Web 工厂中 transparent=false 不使用 alpha 混合，因此导出橙壳 effective alpha=1/OPAQUE。原 Blender 预览材质错误地应用了 .85 透明度，出现内霓虹透壳的白色波纹，不能把这当成原真实不透明壳的实体贴花。

源所有材料颜色直接来自 moebiusAircraft.source.json，真实 GLB 的因子与透明度已逐项校验。原 n14 霓虹 COLOR_0 顶点色保留。Toon 梯度 / 加色特效是引擎专属适配，当前 Principled 仅为可导出近似。

## 引擎接入必须遵循

- 单机 n0 local 原点 / 比例保持；Three.js / GLB 的机头是 +Z，+Y 向上，Blender 对应 -Y / +Z。不额外转整个机身。
- 在旧单机的原父级下用旧单机 local transform 放置候选，保留编队、巡航路径、缩放、扫描落点与碰撞规则。
- n62/n63/n64 是扫描 beam/spot/ring：GLB 保留原几何与 source_visible=false，加载后必须先设不可见；后续仅由原扫描逻辑决定启用。glTF 没有核心 visibility 字段，不能忽略这份 extras。GLB 回读图已按 source_visible 恢复可见性。
- 原描边节点以 candidate_hidden_outline=true 的 metadata 空节点保留在 GLB；完整原轮廓几何仍在 blend 副本。不要把旧外壳轮廓再亮起。
- thrusters n11；flames n56..n61；cockpit-anchor n52、core n53、glow n54、light n55；orangeDot n65、orangeLight n66；energyTube n14；neonLight n16；thrusterLight n21。准确原引用见 animation-contract.json。
- n56..n61 的局部 Y 是原 Cone 高度轴，updateAircraftHover 的局部 Y 缩放脉动要沿原轴；不要按模型世界方向猜轴。
- 新 5 节点带 candidate_node_id / source_parent_id / candidate_components，不加入原动画引用。新舱盖/舱框跟 n52，其他跟 n0。

原文件前后哈希一致见 report.json；节点、父级、矩阵、原 hull/动态几何边界与霓虹顶点色验证见 validation.json。全景、采集口、驾驶舱、尾翼四机位都有 before / after / glb-roundtrip，对照相机与灯光相同；回读图不等于运行时动画验收。
