# 已有模块拓扑候选搜索

沿用1751932427272909032已看552帧，无新增帧。原版findPatch使用递归且未验证连通，limit与预算混作capped。本批新增core/module-search.js：describeModule提取选区，校验边数、对称邻接及连通；findModulePatches用显式栈进行诱导子图匹配，所有已映射节点的边和非边都必须一致。结果按cell footprint去重，reason区分complete/limit/budget，预算耗尽的空结果不能当不存在。

纯逻辑测试通过：环与链的诱导约束、非边拒绝、自同构去重、单节点、预算0/1、限额、稳定结果、输入校验与不修改宿主。页面在混合5格找到完整模板1处，四边形4格0处且complete；0预算返回budget，World快照不变。真实WorldMesh及三主场景回归通过，errors[]，见module-patch-browser.json和patch-*.png。

只提供拓扑候选，不证明几何、边长、socket、支撑或实体适配。未自动放置、不改World、不接WFC。剩余几何兼容、周边补网/接缝、联合WFC、完整稀有率演示。tileforce仍部分覆盖。
