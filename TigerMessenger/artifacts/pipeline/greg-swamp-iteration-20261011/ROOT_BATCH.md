# 湖沼岸根合批 · 2026-10-11

状态：默认接入生产工厂，CPU7/7专测通过，GPU待主代理。仅 `swampV2Art.js` 两处接入与新 `swampRimRootBatch.js`；没有其它模型或入口改动。

## 为什么没有共享源几何

54个露根均由相同 bowed Tube 生成，但正式 `finishSwampV2Art` 要用各根最终世界位置射线查询真实道路，独立调整各根Y与法线，未命中的根隐藏。因此源几何必须保持54个独立可写副本。直接共享会使一根的落地变形污染其他根。

## 实施及安全范围

- 每株树一个 render-only 根几何，合并子根的 tree-local position/normal/UV/index，并保留独立 `rootLocal` attribute。
- 保留54个原语义节点、原几何、变换、材质引用与 raycast；仅抑制原材质绘制。根原 `mesh.visible` 保留，供后续道路命中与生长净空判断。新渲染批不参与 raycast。
- 安全扫描同场景其它mesh对材质的使用；如某根的material同时被其它非根节点使用，跳过该根，避免隐藏枝/角色。fixture当前0个跳过。不同颜色/shader/layer/order/shadow属性分批，不强行同材质。
- 克隆批材质 `visible=true`；调用原 `onBeforeCompile`，只把 `gregLocal=position` 改读每根原局部 `rootLocal`。bark fragment与原材质逐字相同，视深仍按实际合并后投影。
- 正式根最终道路拟合后重建一次batch，纳入各根最终变形与visible。不增加逐帧callback。

## 可核实收益与边界

seed7711：54 source draws→9 render draws，省45；10,368三角保持，合并顶点6,318；新渲染副本buffer340,200bytes。世界顶点误差最高6.78e-8。省draw以素材全部可见为统计口径，实际摄像机剔除会不同。

这是以约340KB复制buffer换局部少45draw，不是减少整个游戏约11,932draw或帧率必然提升。树干285→11、树冠10batch、花船16batch已有优化未重复。GPU材质编译、正式根露出外观、道路实际遮蔽与帧时仍待主代理检查。

## 验证

`root-batch-tests.txt`：7/7。覆盖全6318世界顶点/原局部纹理坐标、法线、全部索引；54原源节点/几何/材质/变换/raycast保持；语义射线前后完全相同；共享外部材质跳过；不同材质不合；球面放置、单根变形、隐藏根与rebuilt资源释放；真实finishSwampV2Art道路拟合接入；dispose幂等。

四环境/冠/根整合 **42/42通过**，最新整合日志 `environment-root-integration-tests.txt`，与此前日志分别记录。

## 比较与恢复

- 原绘制：完整重新加载时添加 `&gregRootBatch=0`。
- 批报告：`inner.userData.gregRimRootBatch` 暴露sourceMeshes/renderMeshes/savedDrawCalls/renderTriangles/geometryBytes/sharedMaterialRootsSkipped。
- 运行时 `.dispose()` 恢复原材质visible，移除并释放批几何/材质；保持原根最终道路变形。
- 改前 `swampV2Art.js` 保存在 `source-before/root-batch/`。恢复时移除两处helper接入及import，删除新helper，或逐文件恢复该快照；不能重置共享仓库。原件包含本轮其它成员此前改动，未回退。

未提交、发布、外发、改用户存档。此次没有自己的新GPU截图，不能称视觉验收通过。
