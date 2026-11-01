# Townscaper 逆向学习记录（REA 符号层）

来源：Oskar 官网 Townscaper WebGL 构建（`oskarstalberg.com/Townscaper/Build/`，本地副本于 `TigerInBamboo/townscaper-web/Build/`）。用户授权仅学习算法，不发布代码。本文件只保存架构与算法结构的摘要，不包含反编译代码或资源。

## 证据与边界

- REA `inspect-il2cpp-metadata` 读取 `Il2CppData/Metadata/global-metadata.dat`（版本 27，约 4.4 MB）：5414 个类型、37340 个方法、26587 个字段、8464 个字符串字面量。证据 id `ev_f9161a9a0145bb23ced2002bb77b66182167113e32b1565821afe09a2143f371`。
- 以上结论来自符号名（类名、方法名、字符串），属于“从符号推断”，不是读到的算法实现。
- 未能完成：`inspect-wasm-artifact` 需要 WABT 1.0.42 工具链，本机未安装；IL2CPP 的 `--binary` 链接只支持 Mach-O、PE、ELF，不支持 WebAssembly。因此方法体、常数与具体规则仍未验证。
- 发布的 Unity 数据包 `WebGL.data` 已解包为 10 个条目，包括 `data.unity3d`（约 23 MB）与 `sharedassets*.resource`，本次未深入检查其中的资源。

## 类型架构（命名空间 Placemaker，源自符号名）

- 体素式“方块”：`Qube` 池（QubePool、AddQube、GetQube、ByteQube）；相邻关系用 `GetQubeRelation` 与 `GetQubeRelation6`，即六邻接。
- 角点与模块：`Corners`、`CornerPool`、`CornerLookup`、`ModuleMath`。模块按角点的连接状态索引，`GetCornerLinkIndex`、`MulOrientations`、`MarkHiddenCornersAmbigous`、`GetBidirectionalHash` 表明模块在旋转与镜像下通过哈希识别等价形态。
- 模块容器：`ModuleContainer`、`ModuleContainerPool`、`ModuleBuilder`（`ApplyModule`、`ApplyDecor`、`MarkQubeForDeconstruction`、`DeconstructModuleContainer`）。删除方块时以容器为单位拆除，并回收对象池。
- 波函数坍缩：`WaveFunctionCollapse` 含 `QubeRemoved`、`QubeUpdated`、`FillQubePossibilities`、`FillDecorPossibilities`、`RemovePossibleModule`、`IteratePropagationCount`、`MaybeQueueQubeForRebuilding`、`Iterate0/Iterate1`、`IterateApplyModules`、`IterateDecor`。`Propagation` 类型实现 `IComparable`，说明传播以优先队列推进。字符串中出现 `Apply Modules`、`Basic Constraints`、`No module`、`No inital modules`，表示初始约束与无解回退。
- 网格生成：`Placemaker.Quads.GridGeneration` 下的 `HexCluster`、`HexPatch`；`GridGenerator` 含 `HexToPlane`、`PlaneToHex`、`HexToPatchHex`、`HexToGridCentroid`、`GetClosestClusterPos`、`GetSubdivisions`、`GetVertCost`、`PopulateBorderMesh`，字符串包含 `Cluster.Gather` 与 `Cluster.Patch`。这与用户已知的六边形分区与 patch 思路一致。
- 六边形洋葱迭代：`Os.Hex` 下的 `HexMath`（RotateCW/CCW、HexToPlane）与 `HexOnionIterator`（按层、顶点、对偶坐标遍历）。
- 道具与连线：`Placemaker.Props` 下的 `PropPlacer`、`PropNode`（父、子、重叠、锚点关系）、`PropWire`、`PropWireAnchor`、`PropWireItalianMesh`、`PropWireFlagMesh`、`PropCollider`、`PropNgonScaler`、`PropTransformer`、`PropPropeller`，以及 `IterateOnPropColliders`。
- 生命与动画：`Placemaker.Life` 下的 `BirdFlock`、`BirdLanding`（含邻接 `AddNeighbour`，`CalculateOptimalLandings`）、`ButterflyFlock`、`ButterflyLanding`。鸟类与蝴蝶在降落点之间形成图，实时选择可达的降落点。
- 渲染与性能：`BigMesh`、`BigMeshMaster`、`BigMeshList`、`BigMeshPart`、`BigMeshGroup` 为网格池，把小网格合并进大网格后统一提交；`AoBaker`（`BakeAo`、`GetShadowMesh`、`ApplyMaterialColors`）与 `ShadowBaker`（`BakeShadow`、`UpdateLamps`、`MaybeUpdateAngle`）把阴影与环境光遮蔽烘焙进网格，并支持 `NoShadows`、`OnlyShadows` 两种模式；`WaterSound` 另有水声。
- 存档：`SaveSystem`、`SaveData`、`MetaSave`、`SaveCamera`（截图存档）。

## IL2CPP 符号转储（Il2CppDumper v6.7.46，已验证）

- 对 `WebGL.wasm` 与 `global-metadata.dat` 运行 Il2CppDumper，得到 CodeRegistration 0x24b134、MetadataRegistration 0x24b628，并生成 `dump.cs`、`script.json`、`il2cpp.h`。注意：dump 输出的是类型签名、字段偏移与方法 RVA，不含方法体。
- 字段布局（来自 dump.cs，属于已验证的数据结构，不是算法本身）：
  - `WaveFunctionCollapse`（MonoBehaviour）持有多组 `List<Propagation>`：removeNeighbors、updates、propagations、validations、toCollapse，以及对应的 decor 版本 decorUpdates、decorPropagations、decorToCollapse、decorToBuild；另有 `lastRemovals`、`lastDecorRemovals`（`LastRemovedStruct`）、`qubesToRebuild` 与 `hashset`。这说明传播分为“移除邻居、更新、传播、验证、坍缩”几个阶段，装饰层单独一套队列。`propagationCounter` 与 `lastStartedPropagation`（ushort）用于批次计数。
  - `Qube`：`voxelCount`、`sideVariationMask`、`decorSideVariationMask`、`shadowIndex`、`possibleModuleListIndex`、`existanceIndex`、`lastFillIndex`、`lastPropagation`、`cost`、`cornerValues`（ByteQube）、若干 `awaiting*` 标志，以及 `possibleModules`（`List<OrientedModuleSides>`）。每个 Qube 维护一份可能模块列表，`cost` 用于选择。
  - `OrientedModuleSides`：`sides`（SideProfile）、`orientedModule`、`cost`，实现 `IComparable`，即按代价排序。
  - `OrientedModule`：`moduleIndex`（ushort）、`flags`（byte），通过 flags 读写 orientation 与 `isDecor`。
  - `ByteQube`：8 个 byte（v0..v7），即一个 Qube 的 8 个角点取值；预置 identity、rotateForward、rotateBackward、mirror、tipForward、tipBackward、upsideDown 七种变换；`uniqueOrientationCount = 48`，`uprightOrientationCount = 8`。这表明方块的朝向群大小为 48（立方体全部旋转与镜像），直立朝向为 8。
  - `ModuleMath`：`corners`（SbyteFloat3[]）、`qubeForward/qubeBackward/qubeUpsideDown`、`orientations`（List，Orientation 含 4x4 矩阵与两个角变换、一个边变换、是否翻转）、`orientationMulLookup`、`orientationInverseLookup`、`sideMatrices`、`cornerLinkLookup`（int[,]）、`baryVectors`（float2[]）、`groundByteQube`、`anyByteQube`。
  - `VoxelType`：Red..Color14（0..14）、Ground=15、Any=16、Water=17、Empty=18。`MaterialType`：None、Ground、Dirt、Water。这说明体素类型与材质分开编码。
- 仍未验证的部分：`GetBidirectionalHash`、`MarkHiddenCornersAmbigous`、`Iterate0/Iterate1` 等方法的具体逻辑需要反汇编 WASM 方法体（例如用 wasm2wat 按 script.json 中的地址定位），本轮没有完成。

## 对 Morris 岛的可借鉴点（待验证）

1. 以“方块 + 六邻接”为基本单元，模块以角点连接状态分类，并用旋转、镜像的规范哈希去重。这可以替代我们现在依赖逐个手工模块的做法，适用于城堡翼楼、台基和房屋外墙。
2. 波函数坍缩用优先队列推进传播，删除方块时只拆除受影响的模块容器，不必整体重算，适合编辑后局部更新。
3. 道具与鸟类用图结构（邻接、父子、锚点）描述关系，可用于树下花丛、鸟类降落点与溪岸植被的组织，而不是临时随机摆放。
4. 烘焙阴影与 AO 写入网格、按需合并网格，与我们目前的性能问题（实例过多、三角面过多）方向一致。

以上四条只是从符号名得出的结构推断，实现细节（传播规则、角点判定、哈希方式）还需要 WABT 工具链或更深的反汇编才能确认。在确认前不要把它说成 Townscaper 的确切算法。
