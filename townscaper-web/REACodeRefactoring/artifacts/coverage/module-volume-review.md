# 显式模块的共享World体量放置

沿用1751932427272909032已看552帧，不计新增帧。原文说先生成特定模块所需网格，本批把显式footprint接入真实体素占用；不是原作完整prefab或socket求解。

build/module-volume.js先做整体刚体几何匹配，再审核全部目标列：同楼层实心支撑、无河道、放置体量范围内无占用、楼层及颜色范围合法、expectedVersion仍有效。全部通过后一次写solid/color并仅发布一次World版本，不覆盖rock/river。无效几何、支撑、占用、河道或过期版本保持World不变。

撤回凭据为冻结对象，内部WeakMap绑定原World/grid及每列before/after。撤回前逐列核对当前after；有用户修改则拒绝整批撤回，其他格修改允许保留。成功只恢复目标列并发布一次版本，凭据只可用一次。凭据没有持久化，不是统一编辑器撤销系统，也不是防恶意脚本的权限机制。

tests/module-volume.mjs验证5格整体/两层、单次版本、支撑/占用/河道/版本/几何拒绝零写入、错误World凭据、目标列变更拒绝、其他列修改保留和单次撤回。真实patch页预留空地后5格放置，经同一个WorldMesh显示；撤回恢复快照，非均匀拉伸拒绝且无部分写入。报告module-volume-browser.json，截图module-volume-placed.png/module-volume-rejected.png，errors[]。已有patch搜索和三主场景回归通过，报告module-patch-browser.json。

只认证当前共享World体素体量与离散支撑/占用，不代表复杂预制模型碰撞、形变表面支撑、socket、完整外观或WFC约束。周边补网/接缝、联合WFC及实例身份持久化待续。没有同步游戏vendor副本。
