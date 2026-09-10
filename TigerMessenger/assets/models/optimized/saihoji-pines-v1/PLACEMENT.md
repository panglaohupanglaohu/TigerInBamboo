# 六庭古松 25 种子候选摆放契约

本目录是 25 个真实 `createAncientPineTree(seed)` 原树的独立 Blender 优化候选，每树三 LOD；本批未改 Web/Godot 世界。统一使用已确认的 `assets/concepts/ancient-pine-target-v1.png`，没有以一棵通用松树替换所有原树。

## 与实际世界逐树对应

`artifacts/pipeline/saihoji-pine-source-mapping.json` 对实际世界每棵树的五个可见 mesh 逐顶点匹配原 seed，25 树 / 125 mesh 最大位置误差 2.22e-16。不是列表顺序推断。每个 `SEED/placement-contract.json` 的 `verifiedWorldSource` 已复制确切 `sourcePath`、`originalRootMatrix`、来源哈希。映射可由 `tools/pipeline/map_saihoji_pine_sources.py` 复跑。

1. 以对应 `sourcePath` 找到原世界根，保留其父节点、地表朝向、位置和大小，并缓存以便恢复。
2. 导入对应 seed 和 LOD 的 GLB，依据 `three_node_id=n0` 找到真正资产根。将其变换**替换**为原世界根的实际变换；或将其挂在保留的原根下，并将候选 `n0` 设为 identity。不要让候选工厂随机 yaw / 1.02 再乘一次世界变换。
3. 保留所有子节点本地变换。`originalRootMatrix` 是 Three.js 列主序、Y 向上、与原父节点对应的局部矩阵；不是 Blender Z 向上坐标。Godot 若已有原根，优先复制原根实际 Transform3D，避免重复轴转换。
4. 仅切换这棵树的候选/原可见性；恢复开关必须回到原节点状态，不删除源对象。三 LOD 共用相同 seed 根与挂点，不能跨 seed 替换。

源 `src/world/saihoji.js` 的地表放置会覆盖工厂随机 yaw；最终缩放包括 1.02 × spec.scale × 6，布局间距乘 2，lift 为 spec.lift + .44。它们用于理解原规则，实际映射矩阵才是接入依据。不能在新父级下照抄旧局部矩阵而不转换。

## 几何、颜色与节点

每棵保留 17 个原 ID / 原父子关系；n8/n9 是木材两批，n10/n11/n12 是三层原绿，n13–n16 的旧轮廓保持为隐藏语义节点。每树 37 段枝干的中心线端点与 29 个冠团中心都保留为生成锚点；连续融合后体积重心可以改变，这不是逐顶点不变声明。候选连接木段与根盘、连续枝径、压扁并融合分层冠，不移动整棵树。

GLB 使用可导出的直接 Principled 颜色；实际回读核对原 palette / alpha，最大颜色因子误差 3.052e-9。不能以 Blender Object Info 预览材质通过替代 GLB 验证。

## 本批验证与限度

75 / 75 实际 GLB 通过：原节点 ID / 父子映射一致；源局部矩阵导出最大误差 1.069e-6；木材单连通且无边界/非流形/退化面；各冠连通片均与木材真实三角面接触。枝梢到冠表面最大距离 .1167；根部包围高度相对原源最大变化 .0192（资产局部单位），进入实际放大场景后仍需检查贴地。

原树每棵 3356 三角面；候选 LOD0 为 3594–3600，LOD1 为 2226–2230，LOD2 为 1220–1222。连接与冠轮廓改善在 LOD0 约增加 7% 面数，低 LOD 用于远景；本批不宣称最终帧率改善。

`artifacts/pipeline/saihoji-pines-v1/glb-contact-validation.json`、`glb-contact-table.csv` 是全部 75 项测试；最终对照是 `five-seeds-page-1.png` 至 `five-seeds-page-5.png`，每页 5 对原归档 / 当前实际 GLB，同相机同 Cycles 光照；逐图来源与当前哈希见 `final-contact-pages.json`。每页 960×750、顺序渲染以限制磁盘占用。旧整页 `25-seeds-source-vs-actual-glb.png` 留作两棵去除各 2 面离散体之前的过程记录，不作为最终哈希证据。尚需主任务视觉复核与世界接入后近远景 / 贴地 / 遮挡验收。
