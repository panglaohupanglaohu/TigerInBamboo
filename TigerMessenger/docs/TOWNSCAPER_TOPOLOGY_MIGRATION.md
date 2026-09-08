# Townscaper 真实拓扑迁移设计

状态（2026-09-08）：共享边图与定向兼容已进入生产选择接口，并提供 `wfcTopology: "legacy-faces"` 保真基线选项；默认未启用。完整不规则几何、交互和碰撞迁移仍未完成，不修改原作存档或街区布局。

## 生产接线新增证据

- `faceLayerGraph.js` 生产图；`compileSidePairCompatibilityTable` 共用原兼容判定，两端局部侧可为 E:E。13824 个旧定向原型组合完全一致。
- `wfcTownSelection` 支持 graph、face/layer role 查询；`wfcTownWiring` 使用 topologyHash 缓存。输入 graph 与 grid 不一致会拒绝，缓存命中也不能跳过检查。
- 原圣城978格三种子选择与旧图完全一致；真实浏览器连续编辑比较见 `artifacts/pipeline/townscaper-contract/geometry-edit.json`。
- 下表描述最初断点；选择接口与共享边基线已接通，其余整数邻居依赖仍待迁移。

## 最初确认的生产断点

| 接口 | 当前行为 | 迁移影响 |
| --- | --- | --- |
| `src/world/citadel/gridMigration.js` | 将 ASCII 占用列按位置代价分配给 quad face，保留楼层与字符；v6 经 `facesToAscii` 又返回规则网格 | 双射和可逆存档不等于邻接保真；分配没有保住原街道边的约束 |
| `wfcGraphAdapter.js` | 通过整数 N/E/S/W/U/D 偏移找邻居；水平异色为 foreign，垂直可跨色 | 仍是方格图，不是实际 face 图 |
| `wfcTownSelection.js`、`wfcTownWiring.js` | 固定建立规则图；部分楼层从旧字符串 ID 解析；缓存围绕 grid 与 seed | 需要显式 graph 输入、节点元数据与拓扑版本缓存键 |
| `cageDeform.js` | bilinear cage 接受 c00/c10/c01/c11；部分四角以 nearestUnused 单独选择 | 各 face 独立选角不能作为一致局部方向、共享边端点顺序的保证 |
| `citadelTown.js` | 生产构建、屋顶/庭园/立面/桥与局部重建仍依赖整数邻居或规则网格集合 | 仅替换 WFC 图不足以迁移整套城镇 |
| `halfEdgeGraph.js`、`simpleTiledModel.js` | 已有共享顶点 ID 的边邻接；half-edge 求解入口每原型仅 r0，边界规则为空 | 可复用思想，不能直接替代带旋转、层高、屋顶与颜色边界的 Town 规则 |

现有求解器与传播器接受 `neighborsOf()` 和兼容方向 token，可以保持核心求解算法不变。需要迁移的是输入图、兼容表、边界约束和生成器对图的使用方式。

## 最小迁移顺序

1. **先建立保真基线。** 以原规则网格的共享顶点和边生成 face 数据，只移动顶点、不改变连边。这样可以先验证图接口与 cage，而不同时改变原街道拓扑。原版、基线版使用同一存档和固定种子对照。
2. **加入明确的面与半边数据。** 每个 face 保存稳定 ID、逆时针顶点环、局部 frame、地区 ID；每条 half-edge 保存所属 face、localSide、起止顶点、twin 和 boundary。四边形是第一阶段的明确限制；非四边形不能填补四角后静默使用。
3. **替换输入适配，不重写求解器。** `solveTownSelection` 可接收 graph；旧入口仍创建旧图。新图节点为 faceId + level，楼层、颜色和地区是元数据。扩展 role 查询为 `roleAtFace(faceId, level)`，保留旧接口供旧世界运行。
4. **编译实际两端侧的兼容表。** 复用现有 Y4 原型展开、权重、pin、ban、排除规则。通过 sourceSide 与 targetSide 查双方 socket，不能使用固定 `OPP(sourceSide)`。生产实现应提取共享兼容谓词，避免长期复制规则。
5. **几何和组件消费同一个图。** 墙、入口、立面和共享边先改；再迁移屋顶连通分量、庭园、桥、道路、碰撞。所有跨 cell 组件记录其成员集合与所属区域。任何仍用整数偏移的组件必须明确留在旧模式，不能宣称整个街区已完成迁移。
6. **最后允许新拓扑。** 不规则图的导入必须输出新增边、丢失边、区域边界与关键门口路径报告。先锁定书店入口、主街、门、庭园边界等设计约束，再做受约束嵌入或区域接缝；任意两个图通常不存在保留所有边的占用双射。

同时把增量重建的输入统一为稳定 face-layer ID 的 affectedCells。通过图邻接传播，再扩展到屋顶、桥等整组件拥有的几何；缓存键至少包含 topologyHash、frameVersion、occupancy、seed、boundaryPolicy 和 moduleVersion。本项仅设计接口，不修改正在并发处理的生产增量重建。

## 局部方向、旋转与共享边

quad 顶点环使用 `[c00,c10,c11,c01]`，传给已有 cage 的顺序是 `[c00,c10,c01,c11]`。局部 N/E/S/W 表示四条参数边，不代表地球上的绝对北东南西。Y4 表示模型在此局部参数框中的旋转。

两张合法的相邻面可能是 **E 对 E**。边记录必须携带 `{sourceSide, targetSide, edgeId, edgeParameterReversed}`；共享半边端点应严格反向。普通网格的 E 对 W 只是其中一个特例。兼容 token 可采用 `pair:E:E`，基本水平类型最多 16 种，另加 U/D；不必为每条物理边复制整张兼容表。反向兼容表应为正向表的转置。

非对称边形状需要在 twin 上应用 `u → 1-u`，并区分框架旋转、模型镜像和 socket parity，避免反转两次。原型目前只验证已有 connector/parity 合同；带采样轮廓的精确拼缝仍需新增验证。

四角必须来自同一稳定顶点环，而非按各 cell 最近距离重新排序。变形后要检查 Jacobian 正向、三角形绕序、共享边采样、法线与 UV。顶点周围可有 3、5 或更多 face，不能把任意顶点强塞为四个规则邻居的角单元；角图几何需要按 incident face 环独立迁移。

## 边界与地区保真

- 保留原水平颜色分界：不同颜色占用邻居暴露为 foreign，不能让 WFC 把两地区自动焊成同一种立面；垂直叠层保持原跨色行为。
- 区分实际地图外边界、内部空 cell、海岸、不可通行地区边界、地基与顶部空气。缺邻居不是一律可以开门的空气。原型提供 boundaryOf 元数据，生产 banPolicy 尚需消费这些细分类别。
- 栏高与孤立柱由同 face 的占用层和真实侧邻居计算。庭园、道路入口、屋顶连续性、桥端点与海岸约束分别验证，不能只检查求解是否成功。
- 地区 ID、标志建筑、入口朝向与主线路径是保真约束；全局球面布局改变时，先整体搬动地区，再重新建立跨地区连接，不用随机建筑填补空白。

## ASCII 与存档兼容

已有 v6 保存 gridHash、seed、层数、cells、legacy 等；hash 不同会拒绝读取，这是必要保护。但保持 ASCII 往返不能证明拓扑相同。

不要改变既有 v6 含义。面原生存档使用新的 schema，显式保存 face/vertex ID、顶点环、frameVersion、拓扑 hash、face-layer 占用、地区和 legacy 对照。不要依赖 JS 数组额外 `.id` 属性，它在常规 JSON 序列化时会丢失。

ASCII 导入保留原始文本和原存档键，生成独立迁移结果及报告；有损导出必须明确列出无法映射的 face 编辑。新 face 编辑不能静默丢弃，也不能编造旧坐标：可提供 sidecar 或拒绝“无损 ASCII 导出”。原作高地等不同存档入口逐一纳入兼容测试。

## 独立原型与实际证据

文件：`tools/pipeline/face_wfc_prototype.mjs` 与 `tools/pipeline/test_face_wfc_prototype.mjs`。运行：

```sh
node tools/pipeline/test_face_wfc_prototype.mjs
```

原型只创建数据图和侧对兼容表，调用现有 `compileVariants`、`solveWfc`、`cageMapUnit`；未修改任何生产源码。测试覆盖真实反向 twin、E:E 旋转端点、非邻居隔离、异色边界、垂直跨色、输入重排稳定性、共享边 cage 采样、非法绕序及非流形边拒绝。合法约束求解成功，故意破坏兼容约束求解失败。

另一个固定种子反例直接使用生产 `citadelIrregularGrid` 与 `migrateAsciiToFaces`：5×5 填满 ASCII **完全往返成功**，但原 40 条水平邻接仅保留 **29** 条，丢失 **11** 条，gridHash 为 `e26516ae`。这说明 nearest/位置配对即使可逆，也不能当作拓扑迁移验收。

该原型不是可部署城镇生成器：尚未连接生产屋顶/庭园/桥、存档升级、渲染与碰撞，也未验证原作完整模块在新图上的可解性。下一交付应是一个保留原规则连边的书店附近小区域，分别对照原外观、入口通路、动态编辑后的几何和存档往返，再开放新拓扑。
