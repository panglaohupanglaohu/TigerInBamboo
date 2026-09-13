# 广场前缘与植物分组（2026-09-13）

前一批为进展：圆台底座与200米BGM实际合入。本批按目标图补齐临水广场前缘，不改成布满建筑的广场。

- src/world/citadel/plazaEdgeGarden.js：前墙、东西短返墙、错缝石块、压顶、7个墙墩；西侧z=82港口进场通道开放，木马台退出路径未动。
- 四个沿墙花池、20丛复用原灌木、三株既有Blender柏树，土层与根部贴合。环砖范围保留，不把植物塞进中心。
- Blender场景 TigerMessenger_Plaza_Edge_Review；来源实际Web墙体，焊接面片后0.018米单段倒角。assets/models/optimized/citadel-plaza-edge/plaza-edge-r01.blend 和 plazaEdgeR01.js。两材质面共5676三角形。运行时核对源几何摘要，后续改墙必须再走Blender导出。
- tools/pipeline/export_plaza_edge.mjs → bake_plaza_edge_blender.py → Web同步几何 → test_west_city.cjs --common-frame --current-runtime → Godot导入。未增加Godot常驻实例。
- 网页广场1406点及相关路线3255点通过；Godot test_front_harbor_march.gd 原装备短剑兵202段通过。不是完整战争验收。

对照图 artifacts/pipeline/citadel-plaza-edge/index.html。下一重点：下层平台与岩体立面的衔接、旧城悬空冠丛和主体建筑比例；整体目标仍未完成。
