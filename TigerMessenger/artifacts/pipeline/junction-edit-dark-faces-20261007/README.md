# 交汇城堡删除后的深蓝残面修复

2026-10-07。用户截图 codex-clipboard-7a37c1c7-db3c-4415-8dcd-b9dc51bc7598.png 已查看。

## 确定根因

有自定义旧交汇布局时，loadTraffic.js 保留原布局，走 buildOdysseyCitadel + 增量编辑，而非新 eleven-region 工厂。首次和全量 mergeCitadelTownStatic 只向合并器传 onSurface，漏传已经存在的 citadelTownMergeOnOutline。实体有面到格子的归属，深蓝 BackSide 描边壳却没有；删除格子后实体被删除，原壳继续留在原位置，成为深蓝实心面。

CPU 实际 CANAL_JUNCTION_TOWN_SPEC 重现：首次深蓝壳 55,396 三角；原故障路径删一格后这批壳数量不变，另外追加 2,904 新描边三角。受影响层仍有 138 个不再对应任何实体的描边三角。补齐初始归属后，连续 5 次删除，每个描边三角都有真实实体对应，孤立残壳为 0。没有禁用描边、没有修改材质颜色、没有移除用户布局。

## 修改

src/world/odysseyCitadel.js：mergeCitadelTownStatic 的分层和兜底整组合批均传相同 onOutline 归属回调。快照 odysseyCitadel.before.js 保存修改前代码（仅用于恢复本改动，不能覆盖同期其他代理修改）。

新增 tests/world/junctionEditOutlineOwnership.test.mjs：
- 首次和全量重建，描边归属完整；
- 连续 5 次删除，布局保持精确、缓冲/索引/法线有限有效、所有描边都有同位置的真实表面；
- 故障夹具移除初始归属，可再次重现 138 个孤立描边三角，证明测试能抓住本错误。

已有 tools/test_geometry_merge.mjs、tools/pipeline/test_canal_junction_editable.mjs 均通过。

## 限制与后续

浏览器仍处崩溃/安全拦截状态，本批没有GPU验收，不能声称截图黑面已经实机消失。已经运行的旧页面持有无归属旧网格，需要从当前用户布局进行一次完整重建才可清除；不得删除 localStorage 或回默认城堡，未保存布局也不能丢弃。

额外严格比较发现旧增量路径的装饰描边数量与同布局全量重建仍存在差异（第一步总描边 27,246 对 27,818）；这些差异不是孤立残壳，本批未扩大修改组内装饰/增长动画代码。体量和黑面修复已被针对性CPU检查支持，完整美术一致性仍需单独审核。
