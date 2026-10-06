# 圣城最终山面局部光照候选

2026-10-05；已实现可关闭候选并通过 Node 合成测试，真实 GPU 编译、场景截图与性能由主线程验收，本文不提前宣告视觉改善。

已看本批 r04-old-mountain-day-noCloud-plants.png：岩面仍偏青灰，植物/草皮与山坡存在明暗分离。新候选独立处理有限地形遮蔽与材质本色，未更换全局灯光系统或移动任何模型。

## 开关与对照

| 对照 | 参数 | 含义 |
|---|---|---|
| 原版 | 不加新参数 | 不烘焙字段、不克隆材质 |
| 仅局部遮蔽 | `citadelMountainLightPass=1` | 保留原色，统一山岩与山地植物的 terrain occlusion 接收 |
| 同字段关闭遮蔽 | `citadelMountainLightPass=1&citadelMountainOcclusion=0` | 仍绑定字段与shader，AO/遮蔽乘数为1 |
| 仅本色 | `citadelMountainPalette=1` | 不分配高场纹理；石色低饱和暖灰，植物绿适度去饱和 |
| 两者 | `citadelMountainLightPass=1&citadelMountainPalette=1` | 同时试验；不能只比较这一张与原版就归因于光照 |

与 `citadelRockSurfacePass`、`citadelRockBump`、`citadelSurfaceIndex` 各自独立。最终图像对照必须固定其余开关、机位、太阳与天气。

## 实际实现

新模块 `src/world/citadel/mountainLightField.js`：

- `prepareMountainLightField(castle, surfaces, {resolution})`：对最终几何在同一 castle frame 栅格化顶高。默认128²，接口允许192²。覆盖区来自真实最终顶点包络，16位RG编码高度、B为有效覆盖。
- `bindMountainLightReceiver(mesh, castle, options, {rock})`：仅为获准岩面、碎岩组与本轮 planting 组绑定；每个 receiver 克隆 Standard 材质，保留原 onBeforeCompile、自定义 program cache key、onBeforeRender。实例矩阵只读。
- `updateMountainLightDirection`：每渲染帧从当前实际 scene 选可见有效主 DirectionalLight（优先投影灯），将其世界方向变换到 castle frame；不写灯本身的方向、颜色、强度。
- `sampleMountainHeight` / `sampleMountainOcclusion`：CPU 样本供独立合成测试。
- `disposeMountainLightField(castle)`：释放生成材质和字段纹理、恢复原材质与render回调。castle 的 removed 事件也调用清理；显式句柄 `castle.userData.disposeMountainLightField()` 可用于场景拆卸。以后如把同一castle移出再插入，需重新调用 apply，不能假设已释放字段仍生效。

在 `mountainStudy.js` 尾部、最终 planting/cloud 构建后追加调用，保留此前 `surfaceIndex` 构建与传递。字段只读最终位置，不参加BVH或碰撞计算。

片元仍走 MeshStandardMaterial 原有照明。仅在 `lights_fragment_end` 后对 `reflectedLight.indirectDiffuse` 加局部AO，对 `directDiffuse` 加低强度地形遮蔽；未将阴影乘入albedo。AO最低0.74、直接漫反射遮蔽最低0.76。间接镜面/直接镜面不改。

暖灰色表单独替换新编译shader中的 mtBase/mtShade/mtChalk/mtVerdure uniform 值（`#929082/#696e69/#c1bda7/#637052`）；不修改被克隆源材质或全局颜色对象。植被仅在其片元本色阶段去饱和20%并轻微暖化，原顶点色数组不变。它是美术候选参数，不是作者公开色表。

## 版本与资源

sourceRevision 来自全部参与surface的 position/index 原始字节及 mesh→castle 相对矩阵；分辨率另作复用判定。输入不变重用同一DataTexture；输入改变重建时释放旧纹理，已有 receiver 下一次渲染转用新字段。每个绑定材质的metadata记录实际字段revision。

重复绑定同参数不增加包装层或再次克隆。参数改变时先恢复旧绑定再建立新绑定。只接受 MeshStandardMaterial；其他材质记录 skipped，不能悄悄替换成不保留原shader的新类型。该候选不自动侦测每帧几何变形：最终源面更改后调用 prepare/apply 是调用方责任。

## 已验证

脚本 `tools/pipeline/test_mountain_light_field.mjs`；[结果JSON](mountain-light-candidate-tests.json)。用实际 Three 几何和旋转平移的castle构造平地+高岩条带：

- 已知平地/岩顶分别采到0m/12m，外部无覆盖；字段确定性复用。
- 遮挡方向直接漫反射系数0.76，太阳反向为1.0；近崖AO约0.8864。射线搜索范围固定为13.5个cell，这是局部测试，不是无限远山影。
- 每帧太阳方向改变会更新同一shader uniform，隐藏太阳后无direct shadow。
- positions及instanceMatrix绑定前后hash相同；共享给“城市”对象的原材质保持同一对象且颜色不改。
- 原compile/key/render hooks保留；重复绑定材质身份不变；源面变化后revision更新，旧texture释放；显式dispose及removed释放生成资源并恢复原材质。
- palette-only无需字段纹理即可绑定/释放；关闭遮蔽和本色试验相互独立。

同时重新运行9项 rock-normal 候选检查通过。以上不是实际浏览器 WebGL shader 编译或性能证据。

## 限制及验收注意

这是本项目对已有 seaStackLighting 的2.5D思路适配，**不是 Oskar 的私有GI/体素光照算法**。

1. 字段只含最终山体surfaces。植物是共享接收者，尚未烘叶冠/草丛/城市建筑/动态角色遮挡；不称“已有全部植物对岩面投影”。碎岩接收同一字段，但自身不额外成为字段caster。
2. 每个XZ仅存最高Y，不表达洞穴、多层悬崖、悬垂底部。垂直立面下方可能被上方顶高过度遮蔽；低强度上限只是限制错误幅度，不能消除信息缺失。若实际图出现整片脏灰应关闭候选或进一步限制receiver，而非扩大阴影强度。
3. 有限分辨率有米级偏差与轮廓泄漏，bias按cell大小设置；不能据此测厘米级草根接触。CPU采样原Float32高度，GPU采样16位编码高度，量化误差上界约range/65535；仍需真实画面对照。
4. `directDiffuse` 是Standard已经累积的漫反射和，候选按主太阳方向对该和低强度衰减；不是逐灯可见性求解。多灯场景不能说每个灯的投影均正确。
5. 每个受影响片元约12次字段采样，初始化需要CPU栅格化。没有宣称性能提升；主线程需记录开/关的实际帧时间与GPU错误。
6. 相机、全局灯、海面、城市材质不改。拆卸时 restored 源材质仍由原拥有者管理，候选不dispose它们。

真实验收至少包含：仅遮蔽/仅本色/二者的同机位图，低太阳方向变化，岩坡与turf/grass/tree接收连续性，海崖底部过暗检查，以及默认关闭场景不变。

## r05 之后的 palette 2 候选

已实际看 r05-bay-ridge-day-noCloud-plants.png 和 r05-old-mountain-day-noCloud-plants.png：山体与城市呈接近的灰绿色，配色1并未形成清楚石面/植被分离。主线程授权新增独立 `citadelMountainPalette=2`，不覆盖配色0/1，不改灯光、遮蔽系数或geometry。

- options.palette 改成数字0/1/2。配色0仍默认；1保留原暖灰色表与原程序苔色比例。
- 2 的岩石 base `#a7a9aa`、shade `#747d83`、chalk `#cec8bb`：中性偏冷浅灰底色与略暖矿物色块。实际受光颜色仍由场景真实灯决定，没有伪造额外暖光。
- 2 的 verdure `#647363`，仅将岩石已有 shader 的 `mtMoss*.60` 收敛到 `mtMoss*0.24`。既有无苔色轮次仍为0；真实草皮、草和灌木不应用这一覆盖上限。
- 2 的植物本色去饱和12%，乘色 `(.985,1.01,.985)`，保留灰绿与石面区别；配色1的20%与暖乘色不变。
- 程序缓存键保留材质类别 `R0/R1`，并以 `P0/P1/P2` 区分配色路径。

回归使用真实 `mountainStudy.js` material 工厂编译文本检查：配色1仍 `.60`、2为 `.24`；植物shader没有引入 `mtMoss`；配色0原始shader不变；positions/instanceMatrix hash不变；P1/P2缓存键不同。全部既有光照测试通过。配色2的真实GPU和实际画面尚待主线程验收，不能据色表或测试先称改好。
