# 交汇城堡 WFC 接入只读审计

状态：建议，未实施；不是完整 Townscaper 引擎或 Oskar 私有实现复刻。

依据现有 `canal-junction-editable/IMPLEMENTATION.md`、`canalJunctionEditable.js`、`citadelTown.js`、`wfcTownWiring.js`、`wfcTownSelection.js`、`townModulePrototypes.js`：已有真实区域内 WFC 求解，其实际几何消费目前是坡顶/平顶分区及围合花园。墙、墙角和拱门仍走占用邻接工厂，审计元数据也如此声明。11 个区域、基础、位置与占用由作者或玩家决定。

最小下一步应消费已有 `body.passage`，而非另起全城 solver。求解结果已有 `{variant, rot, key, family}`，但 `roleAt` 丢失了旋转。建议：

1. `wfcTownWiring.js` 提供完整 `assignmentAt` 与旋转后的开口面。
2. `citadelTown.js` 在约 1827 行实体/corner 分支之前，把 passage 路由为实际侧墩、拱顶与两面贯通洞口；相应立面禁窗，抑制约 2987 行后的旧拱重复生成。不能在完整实体 box 外叠拱装饰。
3. 若 `cornerModulesV1` 开启，也必须将同一洞口合同送入其实体工厂；未支持时明确拒绝候选，不能只记录 WFC 表。
4. `canalJunctionEditable.js` 审计记录消费的 cell/key/rot、实际构件与洞口轴。当前原型没有独立 corner 角色；本轮墙角可按 passage socket 收口，通用墙角仍声明为邻接构造。

合同与测试：固定占用，仅 pin plain/passsage 时实际顶点/索引 hash 必须改变；旋转 90° 后穿堂射线方向随之旋转，垂直侧墙必须阻挡；洞口中不能残留 box、窗或重复旧拱；净空、上层承托明确；禁入地基的 passage 应在域内被 ban，不能挪基础；不相容 pin 回滚旧区域，其他十区和基础 hash 不变；Undo/Redo 同时恢复赋值与几何。原 policy 已限制 passage 只在 iy=0、开口不朝 foreign，但地基是否堵洞仍需要额外真实几何约束。
