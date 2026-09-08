# 城堡共享边 WFC：生产接线与 Godot 原位候选

本批已从现有原作城堡工厂导出可逆候选，并在真实 `original-world-v1.glb` 的实际城堡位置完成隔离 Godot 实测。没有重新设计城堡布局，没有修改正在并行更新虎的 `original_world.gd`。前台入口接线见 `entry.patch.json`，由主任务汇合并验收。

## 哪些已进入生产代码，哪些尚未默认运行

| 层 | 真实状态 | 证据入口 |
|---|---|---|
| 原城堡本体与原town布局 | 已在默认Web世界运行，Godot也有静态世界快照 | `src/scenes/messenger/loadCitadel.js` 的 buildOdysseyCitadel；Godot `castleContainer[69]` |
| WFC选择、共享边图、局部侧对兼容 | 已接生产工厂、增量编辑和全量重建，但默认P.wfcTownV1=false | `citadelTown.js:1594–1598`；`wfcTownSelection.js`、`wfcTownWiring.js`；`odysseyCitadel.js:3117/3422` |
| face→cage几何 | 生产构建可读取 graph 的同一角点环，校验绕序、Jacobian和共享边；legacy-faces保留原街道连接 | `citadelTown.js:491`；`cageDeform.js:26–100`；`faceLayerGraph.js` |
| 任意新不规则城镇拓扑 | 尚未完整接管屋顶、桥、庭园、道路、存档、碰撞；不能宣称已生产完成 | `docs/TOWNSCAPER_TOPOLOGY_MIGRATION.md` |
| 角模块 | 默认P.cornerModulesV1=false；不能把单独组件测试当成默认世界 | `src/core/params.js:90`；`citadelTown.js:1823` |
| Godot共享边WFC | 本批接入的是已计算好的静态mesh输出；没有Godot原生求解、可编辑WFC、碰撞或战斗 | `castle_world_adapter.gd`、`godot-validation.json` |

## 本批工厂与验证

导出命令：`rtk proxy node TigerMessenger/tools/pipeline/export_castle_world_candidate.mjs`。使用独立Chrome上下文和已运行的本机8767服务，不读取用户浏览器数据，也不写 localStorage。

构建源 `src/world/odysseyCitadel.js::buildOdysseyCitadel`，原 `HIGHLAND_TOWNSCAPER_TOWN_SPEC`，seed=20260808，wfcSeed=37，latestDesign=true，wfcTownV1=true，wfcTopology="legacy-faces"。保留同一原town layout，仅导出12个citadel-layer，其他高地、主堡细节、地形、云、外部器物保留原Godot世界。

必须区分两项结果：

- 原WFC旧图 vs 新共享边图：92424个镇体三角面位置及绕序在1e-4下完全一致；原town layout相同；WFC成功、unresolved=0、topologyHash=face-layer-v1:1b5fbb95。
- 默认世界WFC关闭 vs 共享边候选：95396 vs 92424三角，**不是逐三角相同**。本批首次明确量到了这个差异；不能把旧的“保真”报告扩展为默认画面完全相同。保留的是占用布局和街道连接，WFC会影响构件细节。

原墙砖、屋瓦、阳台纹理为Three.DataTexture；旧通用导出器的drawImage无法直接处理，曾丢失这三张图。本批在独立导出脚本把原RGBA像素转换为内嵌PNG，源NoColorSpace线性RGB显式转换为PNG sRGB；128×128、repeat=[1,1]、offset=[0,0]，没有引入外部新纹理。最终GLB导出无纹理缺失警告，详见export-report.json。仍不宣称完全复现Web着色器/描边/灯窗动态。

## 原位对接与回退

资源：`godot/assets/art-pilots/castle-shared-edge-town-v1.glb`，约11.44MB，1033节点、796网格、88材质、3纹理。

`godot/scripts/castle_world_adapter.gd` 按extras.sourcePath定位唯一 `castleContainer[69]`，确认其 `odyssey-citadel-mountain-valley-assembly[4]` 和12个原town层。候选以identity挂在原castleContainer下；只隐藏12个原town层，不移动整个城堡、不更改其他节点姿态。关闭恢复原显隐，解绑释放候选。若原世界源路径或层结构变化，拒绝绑定而不是误替换运河城堡。

隔离测试命令使用 `godot/scripts/test_castle_world_adapter.gd`。真实原世界GLB共检查20202个Node3D，启用仅隐藏12层；原城堡global transform及所有原节点local transform保持，重复绑定不重复创建，关闭/解绑恢复通过。测试与资源哈希已落 `godot-validation.json`、`hashes.json`。

本批没有操作用户前台Godot，也没有让新候选自动进入现有主场景。主任务可按entry.patch.json接现有城堡区域入口与原版/候选开关；这一步完成并截图验收后，才能说当前用户打开的世界已经显示候选。

这是一条原作城堡到Godot的可验证静态资产通路，不是Townscaper完整复刻。继续应验证实际入口通行、柱廊遮挡、连续编辑、存档、碰撞和角色战斗；本地模型流水线不能代替这些确定性工程检查。
