# 下一步：双层联合可通行拱门实施规格

状态：**只读实施规格，未实现，未通过玩家通行验收**。当前 `junctionWfcPassage=1` 仍为默认关闭的视觉结构实验：净高 1.428 m，低于玩家 1.66 m；不得把现有 23 处视觉拱洞标成可通行。这里是基于当前项目代码的工程推断，不是 Oskar 私有实现的复述。

## 已核实的现场条件

- `canalJunctionEditable.js` 的 `construct()` 固定 cellSize=1.60、cellHeight=1.70；11 个 region 的 x/z/baseY/seed 来自 `junctionFoundationData.js`。默认 398 个非空 cell。不能通过提高楼层、移楼、改变玩家体型或删除上格来凑净空。
- `townPassageGeometry.js` 使用 width=1.056、spring=0.952、rise=0.476，拱顶 1.428、实体冠厚 .272。`core/constants.js` 的玩家高 1.66、半径 .35。现测试证明低拱在玩家头部高度确实有实体，不是假阴影。
- `townModulePrototypes.js` 当前 body.passage：水平 N/S=PASSAGE、E/W=WALL，U/D=STACK。`townBanPolicy` 要求 passage 仅 iy=0，且非顶格；它**没有**要求上格一起开洞。`wfcTownWiring.js` 的 `passageAt()` 只解释 builderKey=passage。
- 独立只读重新运行现有 solver（原 region seed、原 occupancy）：23 个 passage 均有 iy=1 上格；18 个上格角色 body，5 个为 terrace。具体如下。该统计是现默认布局，不替代用户保存布局的逐次验证。

| region | 底层 passage 数 | 上格 body / terrace | 轴 |
|---|---:|---:|---|
| left-front-coral | 3 | 0 / 3 | X |
| left-mid-yellow | 3 | 3 / 0 | X |
| left-rear-teal | 3 | 3 / 0 | X |
| left-watchtower | 2 | 2 / 0 | X |
| right-front-teal | 6 | 4 / 2 | Z |
| right-mid-coral | 6 | 6 / 0 | Z |

- 既有实几何地基射线：22 处底面与固定 foundation Y=3.35 对齐；`left-watchtower/0,0,1` 的实际 irregular-quay 在底面下 2.70 m。两层开洞不会解决它。先禁用该位置的可通行候选；不能自动补地基或把 metadata 的 supported 改成 true。
- `wfcGraphAdapter.js` 已有 U/D 邻接且竖向不按颜色分裂，因此可表达上下配对，不必改变 graph 398 个节点；水平只连同色格，foreign 开口仍应禁用。不同 region 是各自独立求解器；不能宣称跨 region 端口已连通。

## 最小样区与可行性

先只在 `left-mid-yellow` 的 `(0,0,1)、(1,0,1)、(2,0,1)` 及其 iy=1 上格做一个三连 X 通道：6 个既有格改语义及局部实体，所有 occupied key/颜色/region transform/baseY 不变，上方 iy=2/3 仍保持原建筑。三处在已测 22 个承托集合内；仍需补两端接近路线和完整脚底面积验证。

结论：**不增加/删除格、不移动建筑而容纳双层洞体，在几何上可行；当前 solver/catalog/renderer 并未具备完整实现。** 两层总高 3.40 m，可把楼层内部的实心板改为洞两侧承重墙与上部拱冠。占用格表示模块体积域，并不要求域内每一点都是石头。不能声称室内楼板原样保留：iy=0/1 之间洞口范围的楼板必须取消，原标高不变。

建议首件工程尺寸（新的候选值，未验收）：保持净宽 1.056，拱起高 1.90、拱升 .40，中心净高 2.30，外顶 Y=3.40。两侧净宽外仍各 .272 m 石墩。球冠/拱弧的侧向净空需按胶囊实际半径检查，不能只比较中心 2.30>1.66。先用原 footprint 的闭合实体，额外倒角不得侵入净空合同。城堡真实局部轴与玩家径向 up 不完全一致，最终必须在世界坐标测量。

## 跨层 socket 与求解合同

1. 新候选 catalog，不修改老 body.passage 的含义。增加 `passage2.lower` / `passage2.upperBody`，首版只允许底格 iy=0、上格 iy=1，且两格真实占用；upperBody 还须有上方占用格。保持原 catalog 默认路径和 seed。另行提供候选版本和 moduleCatalogHash，避免改变旧保存记录的隐式语义。
2. 下格 U / 上格 D 使用只允许彼此匹配的 `archpair.x` 或 `archpair.z`，不得使用泛 STACK。下格 D=STACK，上格 U=STACK；水平出口下半部用 `passage2.lower`，上半部用 `passage2.upper`，两侧 WALL。同一串通道的 lower 与 upper 两套端口均必须匹配；单格孤立拱允许两端面对空气，但仍需最终接近路线验证。
3. **朝向不能只靠两个相同竖向 socket 字符串。** 当前 Y4 转换会置换面方向，但不会将 U/D 上 connector 名中的 x/z 自动转换。最小安全实现是分别写 X/Z 两套 NONE 朝向原型及明确横向接口；或扩展编译器使 socket 自带方向数据并正确旋转，同时新增回归。前者风险更小。上下旋转错配、孤立 upper、缺上格、对 foreign 墙出口均须产生 contradiction/禁域，不能生成半个拱。
4. 5 个 upper=terrace 的位置不在首样区。后续若覆盖它们，需增加 `passage2.upperTerrace`：U=SKY，并保留原屋顶高度、露台表面、栏杆和与邻顶格的横向兼容。不得把 upperBody 的 STACK 强塞到暴露顶面，也不能一律抹掉露台。需要单独的复合 role/roof predicate，避免 builderKey 改名后失去露台消费。
5. `solveTownSelection()` 已支持 prototypes/pins/banPolicy；`resolveTownSelection()` 现在仅以 grid签名和 seed 缓存，候选必须把 catalog/pairPolicy/routeConstraint 的版本与哈希纳入缓存键。solver success 不代表内部通行或全局可达。
6. 保持样区外已接受角色 pin，候选不能使整城屋顶随机重选。先固定上列三对的 X 方向测试，再允许有限候选域。无解/预算用尽按现事务失败保留旧场景，不随机填充、不偷换回视觉低拱并标成功。

## 实体消费、所有权和编辑联动

- `wfcTownWiring.js` 新增 pair 查询，返回 pairId、两个 owner cell、axis、上下角色；`citadelTown.js` 在现单格 passage 分支之前消费验证完整配对。上下原 box、楼板、门窗、外伸 portico、悬挂构件必须按洞体禁入包络过滤，不能只隐藏底层 box。
- 推荐以同一数学拱截面在 1.70 m 切分成上下两份闭合石体，各自保留所属 cell，接缝同坐标；上半部不要再添加横穿洞口的全宽底板。这样右键命中上/下石体仍知道原来的格。若统一一个合并 mesh，则必须为三角范围提供 owner 映射，不能把所有命中均归底格。
- 两格仍分别计算 occupiedCount（不得把 398 变为 395），统计另列 pairCount。候选提供双层与单层几何接口、准确 minClearance，而不是继续写死 `playerTraversable:true`。
- `canalJunctionEditable.js` 当前 edit 是单格 mutation、整 region 重建、publish 成功后入一条 undo。保留这一编辑语义：删上格时撤销配对，下格按新占用求成合法顶格；不能留下旧高拱。删下格时上格若失去真实支撑，先拒绝该事务；只有独立证明邻跨支撑合法后才能保留上格。**不暗中删除另一占用格**。这是结构校验，不是新增人工批准步骤。
- 增删/重涂任一半都必须使配对和整条端口连通路径失效重算；当前 full-region rebuild 足够，未来 dirty 模式必须显式扩展到 pair、相邻端口和上层承托依赖。无需在本轮引入增量重构。
- Undo/Redo 必须一次还原完整 occupancy、pair assignments、geometry hash和支撑状态；失败不能动 revision/undo/redo。`junction-regions-v1` 继续只保存 levels/id，pair从候选版本确定性重算；任何新 module 版本须独立记录诊断，不能靠悄悄写入原存档。原 Save/Load、默认关闭回退、旧用户改过的非默认 levels 都要测。

## 地基和真正玩家净空验收

当前 `auditTownPassageClearance()` 是三角射线样本；`createJunctionPlayerSupport()` 用径向地面射线和按 revision 更新的 `createCitadelPlayerWalls()`。后者实为 3 个高度 × 3 个侧偏移的扫掠射线，**不是完整胶囊与三角形接触解算**；它还忽略 |normal·up|>.7 的面，不能靠现墙测试确认拱底不顶头。

新增独立验收器应至少：

- 明确定义测试胶囊：总高1.66、r=.35，脚点 f、径向 up，轴端 f+up*.35 与 f+up*(1.66-.35)。建议额外安全裕量 .05 m 为本候选设计目标，须单列其最小实测值，不冒充原碰撞器既有常数。
- 胶囊/实际三角形距离与连续移动扫掠覆盖两端外至少1 m、每个 cell 接缝、侧偏路径、正反方向；纯中心线射线不够。必须包含 unchanged邻楼、门饰、固定地基、上层板、桥栏、所有 `citadelSolidExterior`，并针对不同世界旋转/球面径向验收。允许贴地接触，仅在可行走面分离该接触，不得笼统排除全部朝上面。
- 两端必须接入连续可步行承托面；全路径脚底承托片覆盖身体截面并不悬空、不穿基础。左 watchtower 异常位置继续禁入，除非未来独立修复并验证其原地基；本规格不修改它。记录底面差、坡度、台阶高度、最窄宽度、最小头部距和 worldUp偏差。
- 先测试人工3连模块，再测相同 constraints 的真实 WFC 输出；加入反例：上下X/Z错配、上半缺失、出口墙、薄楼板横穿、台基侵入、悬空地基、只有中心线可过而肩部碰撞、最大单帧步长跨过墙。必须失败且维持旧事务。
- 用真实 `createJunctionPlayerSupport().ground/walls` 进行脚本位移，再浏览器实际双向行走；若胶囊证明可过但现 ray 控制器错误挡住/漏碰，需在 `playerWalls.js` 增加候选范围的形状精确窄相，保留其它城墙行为。此项尚未实现，不得以渲染通道截图代替。
- 固定验证：初始398cells/11regions、positions/baseY/层高/地基hash不变；所有样区外屋顶role不变；删除、undo/redo、save/reload哈希确定性；反复编辑无资源增长；GPU编译/页面错误与实际截图独立记录。

## 涉及文件与尚缺条件

| 文件 | 下一步责任 | 当前缺口 |
|---|---|---|
| `socketVocabulary.js` / `townModulePrototypes.js` | 候选pair sockets、lower/upperBody/未来upperTerrace | 无跨层拱配对 |
| `wfcTownSelection.js` / `wfcTownWiring.js` | 候选域、pin、版本缓存、pair oracle | 当前只返回单格角色 |
| `townPassageGeometry.js` / `citadelTown.js` | 两层闭合实体、楼板与装饰禁入、owner | 当前只1.428m低拱 |
| `canalJunctionEditable.js` | 事务式pair联动、失败回退、存档回归 | 无上下模块完整性检查 |
| `canalJunctionTarget.js` / `citadel/playerWalls.js` | 实际ground/walls联调、必要窄相 | 样本射线非胶囊；入口可达未证 |
| 新独立geometry/capsule tests | 实体净空/地基/路径/生命周期 | 现552射线与69实墙射线不足以认证通行 |

首个可实现交付应是3连双层样区+真实胶囊/玩家行为证据，而非把全23处直接升级。18个body上格的方案与5个露台上格分开落实；无新增占用与建筑位移的可行性已明确，完整通行仍待上述条件逐项实现、测量。
