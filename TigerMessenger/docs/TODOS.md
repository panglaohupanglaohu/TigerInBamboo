## 2026-09-09：最新检查点——新虎已进入原 Web 湖沼

此节更新下方历史状态中的“Web 尚未回接”。本次将已有 Blender anatomy-v3 的实际几何、材质、4 张纹理和原节点变换接回原角色，而不是再建一只独立展示虎。原角色身份、80 个节点、尾巴、灯光引用、巡游、饮水、相见回调和救援目标保留；默认使用新外观，可通过 anatomy:false 回退。旧原作采集页面显式使用原模型。

- [x] 修正新模型静止姿态与旧动画之间的偏移，尾根按实际 -150° 基准运动；脚掌增加平面支撑补偿，眼部灯光强度降为旧值的 4%，避免整个面部发红。
- [x] 浏览器 36 项检查通过：原身份、切换/回退、纹理解码失败恢复、资源释放、行走/饮水/相见与平面脚掌接触。最新证据：`artifacts/pipeline/local-runs/web-tiger-anatomy/11b8305744ac41b1856b78380159c18c/`。旧拓扑优化的 idle/walk/drink 对照也保持零像素差异。
- [x] 原游戏完整场景确认新虎默认加载、40 次真实帧更新、相见状态和救援目标仍是同一角色；无页面、控制台或请求错误。实景：`artifacts/pipeline/tiger-web-v3/world-2026-09-08T19-35-35-092Z/02-candidate-world.png`。
- [ ] **完整场景对话没有触发，world smoke 总结果仍为失败。** 必须查距离/阻塞条件并完成实际触发，不能把独立 fixture 的对话通过写成完整救援通关。详情与诊断入口：`artifacts/pipeline/tiger-web-v3/world-smoke-summary.json`。脚掌平面支撑通过也不等于球面坡地/踏水接触验收。
- [x] 本地执行器增加 Web 作业，现在有六个受审查的工程任务；修改输入会重新检查，已通过且哈希一致则复用。作业数不是新优化资产数。
- [x] 恢复用户原预览地址 `http://127.0.0.1:8765/TigerMessenger/`，HTTP 200；服务写入文件日志，避免原服务空响应。启动记录 `artifacts/pipeline/preview-server/server.json`。

**下一步顺序**：1. 依据 smoke 诊断补齐实际相见对话与地形接触；2. 同家族沉淀可审查的建模修改模板，推进红蓝兵的 Web 回接/真实战斗检查；3. 接通目标 Studio 后执行真实 Qwen 工具续答与双图理解，单独验证 LLaDA Mac 推理。当前连接主机仍为 M2 16GiB，未向它下载目标机权重。Godot 完整行为迁移和前台最新资源验收仍待做。

接手时先读此节、`docs/LOCAL_PIPELINE_RUNBOOK.md`、状态页与原始失败报告，再领取具体任务；不要重新生成已有虎，也不要把工程通过自动提升为美术/玩法完成。最新读取的现有续作任务已设为每 2.5 小时检查（ACTIVE）；未改动这个外部更新的频率。下方旧记录的“每小时”仅为当时状态。执行器本身运行一轮后退出。

## 2026-09-09：睡眠期间续作检查点——本地执行链已实际运行

用户要求持续推进，准备睡 5 小时；当前原任务已有每小时续作检查，保持启用，未创建重复自动化。最新操作指南 `docs/LOCAL_PIPELINE_RUNBOOK.md`；查看 `artifacts/pipeline/local-runs/status.html`；可双击项目根目录 `Check-Local-Pipeline.command` 重跑工程作业。此执行器一轮结束即退出，持续续作仍由现有任务调度触发。

- 已实现 runner：真实子进程执行、既有队列 validation 家族租约、资源互斥、输入/报告/导出文件哈希、断点恢复与两次失败上限。修复了恢复时占着自己的旧租约，以及 SIGTERM 留下子进程的问题。验证租约不能把候选美术或玩法阶段改成完成。
- 已实现 MCP stdio 客户端；真实 Blender get_scene_info 成功（28 个工具、94 个场景对象），只读，没有改/保存前台模型。
- 已实现 Qwen 6 轮/12 调用桥接：实际 HTTP 模拟服务验证工具结果续答、资产范围、两张参考/渲染图提交、错误与停止。真实 Studio 未连接，不能把模拟服务测试称为 Qwen 已上线。LLaDA 仍未部署。
- **五项真实作业通过**：虎与盔甲分别从保存的 .blend 导出 NEW GLB，经 Blender 重导入，再由隔离 Godot 导入同一新文件；另有虎世界变换、士兵 252 姿态、城堡 20202 节点/12 层替换回退检查。第二次运行五项全部返回 cached_pass，没有重复开引擎。
- 合并本地测试 57 项＋旧队列 8 项通过。`artifacts/pipeline/local-runs/checkpoint.json` 和每项 execution/report 保存证据。五项作业不等于五个新优化资产；此轮主要交付可运行管线。
- 补齐湖沼之虎队列中的认可图、现有 v3 .blend、Godot GLB 和静态原位证据。原 source/blend 归档保留，完整行为和视觉验收仍待做，避免接手重复生成已存在成果。

尚未完成：目标 Studio 真实模型联调；LLaDA MPS；可审查的家族建模修改模板和自动区域部署；Web 新虎行为回接；活动编辑器最新资源前台验收。电脑锁屏时继续在隔离副本工作，不能声称前台已刷新。

下一条独立动作：审计原 Web 虎的工厂/动作赋值，补新几何和 rest-offset 适配，先做可回退候选与行为对照；同时扩充模型可调用的审查模板。Studio 地址未提供，不重复询问，也不在当前 M2 16GiB 自动下载目标 M5 Max 64GB 的大模型。

## 2026-09-09：目标算力确定为 Mac Studio M5 Max 64GB

部署细节见 `docs/LOCAL_ASSET_FACTORY_MAC.md`；配置模板 `tools/pipeline/local/config.m5max64.example.json`。Qwen 首选 MLX 4 位 + oMLX 候选服务，初始单请求、32K 上下文；LLaDA 官方 CUDA/flash-attn 路径需独立验证 MPS，不能宣称开箱即用。现有认可图可先推进资产闭环。当前机器 M2 16 GiB，不是已验证的目标机；尚未下载模型、上线服务或实现常驻 runner，配置中的调度限制尚未执行。目标机入口已询问，硬件问题无需重复提问。

## 2026-09-09：本地生产线规划、虎与城堡对接检查点

用户要求减少 Astra 逐资产消耗，采用自己的 Qwen3.8-27B 与 LLaDA-Image 建立长期生产线。完整执行方案：`docs/LOCAL_ASSET_FACTORY.md`。已查官方模型卡/仓库，新增 `tools/pipeline/local/` 预检与工具调用探测包；8 项离线测试通过，旧队列8项测试通过，队列已同步92条登记与鲲/湖沼之虎名称。Qwen/LLaDA尚未配置和部署，目标硬件已确认是用户的 Mac Studio M5 Max 64GB，连接入口/服务地址待补充；当前工具主机是 M2 16 GiB，不能混用；常驻runner、MCP工具循环、LLaDA worker仍待阶段B/C，不能称全线运行。

本轮实际资产：
- 湖沼之虎（TigerMessenger待救援角色，非竹虎图）：真实Blender MCP三轮重塑，保留80原节点/父级，原比例与头腿尾静止姿态改造；Godot可见8376三角。`tiger_anatomy_candidate.tscn`提供用户图与同镜头对照，`tiger_world_adapter.gd`接原湖沼位置。源GLB未覆盖；Web尚未回接新形。
- 士兵：头盔和盔缨方向由+Z纠正至身体+X，裙甲/腰带/盾握持不转。`roman_armor_direction_adapter.gd`和v3GLB已接原候选UI，252组姿态与两色全身候选检查通过。v2历史图在 `artifacts/pipeline/romanSoldier/v2-before-direction-fix/`。
- 城堡：`castle_world_adapter.gd`已接`original_world.gd`，只替换原castleContainer的12个town层；共享边WFC输出92424三角/3内嵌纹理，20202原节点变换/回退检查通过。不是Godot原生WFC编辑，不是概念图完整美术复刻；山体/云和其它原环境仍需后续优化。

验证与显示：电脑锁屏，不能操作前台；为避免争抢当前编辑器缓存，复制到隔离Godot工程完成最新资源导入、虎/城堡原位部署、士兵同镜头截图。证据已复制回 `artifacts/pipeline/`，`20260909-integration-checkpoint.json`记录路径与资源SHA。主编辑器虎缓存可能旧、城堡尚待导入，解锁激活后核对重导入，再打开原世界/虎候选。不要误报前台已经显示最新虎或城堡。

下一步：1.解锁后更新主编辑器导入并前台验收；2.拿到目标机连接入口后执行LOCAL_ASSET_FACTORY_MAC接线与兼容性验证，真实文本/工具/视觉/图像/Blender/Godot闭环；3.旧队列上加执行runner与图像worker，完成可中断恢复的小批标定；4.按区域接入行为，再改地形。

## 2026-09-09：鲲入库与红蓝短剑兵概念候选

- **鲲**：用户正式命名；内部 `leviathanIsland` 保留。已补独立源快照、Blender 归档、309 KB GLB，并在 Godot 资产库实际检视。清单 92 项、Godot 实例化 92 项；这不是 92 项美术/玩法完成。鲲不等于 `swamp_whale`，归档不含运行时挂载的六景。证据：`artifacts/pipeline/leviathan-kun-review.png`。
- **红/蓝短剑兵**：内置生图生成 `assets/concepts/roman-soldier-target-v2.png`，真实 Blender MCP 两轮制作头盔、10 片裙甲与独立盾把；已接入 `roman_grip_blue/red.tscn` 候选。资产库选红/蓝 gladius → 查看优化候选，可切原作/候选、四视角和三种检查姿态。
- **验证**：新盔甲纳入 252 个离散姿态的盾/身体/剑几何分离检查；全候选两色三姿态运行通过；Godot 三项新资源导入缓存与 GLB 哈希匹配。`artifacts/pipeline/romanSoldier/full-candidate-validation.json`、`shield-armor-validation.json` 保存证据。
- **仍未完成**：士兵优化尚未回接原世界的战斗/程序步行；裙甲仍为静态几何，需要腿部动作与甲片碰撞验证。鲲的六景装配、升沉/摆尾/眨眼/雨滴程序未迁移。不要把单项候选或归档当作全局优化交付。
- **接续**：先将士兵适配器用于实际战斗角色生命周期和腿部运动校验；鲲保持原世界完整根节点，补六景及行为适配后再替换，不用独立鲸体覆盖现有鲸背世界。

# TigerMessenger 执行待办与续接检查点

## 2026-09-09：用户圣城概念图已接收

用户上传的蓝夜峡谷灯城作为当前圣城主要视觉目标，已保存 `assets/references/citadel/user-concept-20260909.jpg`，完整执行依据见 `docs/CITADEL_ART_TARGET.md`。概念输入已具备，不再将imagegen网络恢复作为开工依赖。采用青蓝暮光/靛蓝山体、层叠浅色塔城、暖金与桃红窗灯、原水系倒影；保留原中央圣塔、街巷关系与球面世界。下一可见交付是原圣城一片区同镜头的「原版／蓝夜候选」对照，Blender局部接缝与Godot材质灯光分别验证；当前未据此声称新渲染或建模完成。


## 2026-09-09：罗马短剑兵握持候选已可见

- [x] 红／蓝短剑兵的剑柄对齐原手部；保留原几何/材质/父级/朝向，关闭恢复原变换。72组变换测试通过，最大握持误差1.093e-6。
- [x] 独立Godot候选提供握持开关、红蓝选择、站立/摆臂/瞄准检视；资产库两个条目均有候选入口，已通过真实前台点击打开。两变体三姿态和同镜头前后图验证通过。
- [x] 原档案/currentResource保留。证据与查看指南：`artifacts/pipeline/romanSoldier/GRIP_CANDIDATE.md`。
- [ ] 后续：盾牌挂点、角色实际动作与世界兵团回接；完整士兵美术/玩法尚未验收。继续城堡共享边向屋顶/门窗/庭院迁移，五架侦察机待编队/驾驶/LOD。


## 2026-09-09：原位飞机候选与共享边墙体

- [ ] 后续握持修复：罗马短剑兵原factory把剑固定在独立装备组；源/snapshot/Blender/GLB一致，非导出错位。握柄距右臂末端约0.40339（fig缩放后），原瞄准只转方向不补位置。先做红/蓝共用可回退握持适配、站立/摆臂/瞄准验证，保留原档案，不能只补动画后声称已修。

- [x] 已核对旧 `tripleGateScoutAircraft` 地标其实是整个五架防卫队的别名，生产场景没有独立 mounted .86 门区飞机。五架皆为原factory scale .72；不编造额外飞机或门区hover。
- [x] Godot原世界五架候选按sourcePath+父路径核对后同父、同完整变换接入，原子树隐藏；界面可切回原版、近看原位置。实际渲染和重复开关/挂点/46节点检查通过。`artifacts/pipeline/scoutAircraft/deployment/`。只标staticWorldDeployed；驾驶、编队、LOD、完整worldIntegrated/gameplayAccepted仍未完成。
- [x] `faceCageFromGraph`稳定顶点环直接供墙体生成；真实共享边含异色边界与空占用邻面验证。`makeExposedFaceGeometry`从同图读取暴露面和笼形，抑制重合内墙，补浮空下表面；已有cage墙面修正真实法线。
- [x] 共享边墙体实际Three几何验证：60顶点法线与实际三角面一致，36斜面法线非轴向。完整原圣城92424三角面新旧图仍一致。`artifacts/pipeline/townscaper-contract/face-body.json`、`castle-geometry-scale.json`。
- [ ] 墙体接口不代表完整城镇不规则几何已接通：屋顶、门窗、庭院、跨格部件和导航仍需共同迁移后部署；当前接口拒绝带非零高度的3D face，避免错误压平球面。
- [ ] 圣城内置生图本次重试仍因 images/edits 网络错误失败，无图像产物；完整提示词见 `artifacts/pipeline/citadel/concept-request-20260909.md`。此前请求记录的undefined已明确纠正，不把旧失败记成功。


## 当前执行状态：共享边正式接线与侦察机减负（2026-09-08）

本节优先于下方历史记录。

- [x] 新增生产 `faceLayerGraph`：稳定 face/layer、共享顶点、双向半边、局部侧对与拓扑缓存身份。`solveTownSelection`、全量缓存及增量选择接收 graph；`buildOdysseyCitadel({wfcTownV1:true,wfcTopology:"legacy-faces"})` 可进入保留原街道连接的共享边模式，编辑沿用模式与种子。默认世界未强制切换。
- [x] 原圣城默认 978 格、三个种子：新旧选择哈希全部一致。小型真实浏览器场景初始/增量/全量三角数量一致；随后拆顶、两层改色、两层恢复连续检查通过。证据：`artifacts/pipeline/townscaper-contract/castle-scale.json`、`geometry-edit.json`；不是完整原城堡的通行或美术验收。
- [x] 侦察机候选 GLB 材质分组整理：同镜头实际 Godot 绘制 85→32，图元 2104 不变；截图通道最大差 1/255。46 原节点、23 可见网格及动态挂点保留。注册表已附材料等价证据；currentResource 仍指向原归档。`artifacts/pipeline/scoutAircraft/godot/materials-review.md`。
- [x] 侦察机 Godot 候选已实现原 mounted 悬停/尾灯、manual 防卫灯覆盖与座舱/双炮口挂点；6个时刻与实际执行原JS回调对照通过（不是手写同公式的自证）。驾驶、编队、开炮和正式世界部署仍未迁移。
- [x] 原圣城完整生产工厂（978格）新旧图的92424个镇体三角面位置/朝向一致（1e-4容差）；`castle-geometry-scale.json`。
- [x] 全量重建先生成独立候选，所有区域有解才替换；故意让第二区域无解，旧几何/缓存/spec/待合并任务均保留。第三参数可合法全量改变seed/开关/拓扑，局部重建拒绝全局配置变化。证据 `full-rebuild-transaction.json`。
- [ ] 接下来：共享边继续进入角模块/屋顶/庭院与碰撞的共同几何数据路径；侦察机按原世界唯一部署位置接入交通/驾驶。
- [x] 编辑面板已接通失败反馈：保留未应用草稿/撤销栈，禁止按钮与Ctrl+S误存；成功后恢复，各城堡目标隔离。真实浏览器测试 `test_citadel_editor_apply_failure.mjs` 通过。
- [x] Godot世界GLB的874个重名材质已唯一化；完整BIN哈希、其余JSON/PBR完全不变，生产导出器同步修复。通过Godot自身重新加载后，源MD5与导入缓存一致；`artifacts/world-migration/import-repair/editor-reload-verification.json`。历史递归导入错误不能仅凭材质修复宣称同源。
- [ ] 未完成：任意不规则 face 布局的完整几何装配、主线路径可达性、原世界动态迁移。legacy-faces 保留原方格街道，并不是已经生成 Townscaper 式不规则城堡。
- [ ] 圣城概念图此前两次内置生图网络失败，无新图像；已有原作三镜头参考可用于几何工作，不能把失败记成生成成功。


## 本轮收口状态：生成联动与可见资产入口

- 角图底部统一；WFC增量影响与几何替换做同一闭包；各区域独立缓存、种子持续、增量无解保留旧画面。小夹具实际浏览器增量/全量均3846三角形；原正式源布局978格的3种子全部可解。
- Godot资产库默认展示注册表currentResource，书店默认第三轮（含石径与花丛、材质/墨线适配），可切“查看原始归档（优化前）”；侦察机独立候选通过注册表入口检视，不替换正式世界。Godot实际渲染/切换/布局测试通过。截图 `artifacts/world-migration/registry-current-bookshop.png`。
- 原圣城3视角参考及真实半边迁移原型已保存。圣城目标图两次内置生成均网络失败，没有图像产物；见 `artifacts/pipeline/citadel/concept-request.md`。不要重复声称已生成。
- 下一可执行项：先让真实face邻接与原街道边保持一致，再让角模块装配消费定向求解结果；验证旧城堡屋顶/庭院/门口真实编辑；继续侦察机材质批次合并与行为回接。不要直接把候选GLB放到正式世界后标已验收。


## 2026-09-08 侦察机候选进入 Godot 检视

- 已从Blender候选导出 `godot/assets/art-pilots/scoutAircraft-art-v1.glb`，46原节点/挂点保留，18隐藏描边壳在适配脚本内隐藏，23可见网格，玻璃做明确Godot材质适配。
- 注册表 `replacement` 指向候选GLB和 `res://scenes/scout_candidate.tscn`，`currentResource`继续原归档；没有标为worldIntegrated或gameplayAccepted。
- 统一资产库现在按注册表显示“查看优化候选”按钮，后续资产可用同一入口。侦察机选中后可打开候选；检视器布局/取景/入口测试通过。
- 实际图片/验证/差距：`artifacts/pipeline/scoutAircraft/godot/`。当前玻璃非真实折射，座椅/面板/墨线尚待完善；单模型检视含UI约81draw，性能未收口，不能把导入当优化完成。
- 部署名称匹配可用 `tools/build_world_deployments.py` 重现：只读跑得到41/91匹配；`--write`更新候选位置清单，不自动替换。名称匹配不能证明父子归属与具体变体。


## 2026-09-08 后续实作：WFC 对应到实际几何重建

- `cornerGraphAdapter`纳入底部iy=-1，`cornerAssembly`删掉独立补底分支。同一图驱动全部装配，空/单格/三层/阶梯四例实际生产装配的网格数、顶点SHA及边界均与修改前一致。
- `odysseyCitadel.rebuildCitadelTownIncremental`在生成与删除前统一WFC影响分量和跨格构件闭包，避免选型改变但旧屋顶遗留。各terrace独立保存上一解；初建和编辑保存seed/显式开关。所有terrace成功才替换旧几何；增量无解保持旧几何和旧选择，不提前取消待合并装饰。
- 浏览器实际调用生产装配，12列两层建筑加一顶层格：重建25格，同布局增量/全量均3846三角形；种子37保持；两个非空terrace缓存各为24/2格且独立。小夹具编辑约25ms，此数不代表全圣城性能；还需正式原城堡、多轮编辑、碰撞和可达性验证。
- `tools/pipeline/test_wfc_geometry_browser.mjs`、`artifacts/pipeline/townscaper-contract/geometry-edit.json`与截图保留。对比只证明本夹具数量与接口，不把三角形数量相等宣称逐像素等同。
- 新真实半边原型验证了两端局部侧（含E:E）和反向共享边。`docs/TOWNSCAPER_TOPOLOGY_MIGRATION.md`记录现存位置双射破坏邻接反例；正式街道迁移必须先保留原连接关系再变形，未把原型直接覆盖当前城堡。

下一项：原圣城三个实际视角捕获 → 图/几何共用真实邻接的小批迁移；侦察机Blender候选→Godot独立检视并行。全机制清单仍有真实邻接和全局可达性两项未满足，不声称Townscaper复现完成。


## 2026-09-08 最新执行入口：原作全球、并发资产与 Townscaper 机制

本节优先于下方历史检查点。用户最新要求：完整 R160 原作世界为正式迁移对象；旧 R32 六地点实验游戏保留为镜像小岛的实验空间。不能用小球实验关卡代表完整原作。

- 当前 Godot 默认入口 `res://scenes/original_world.tscn` 已载入原 Web 组装世界的静态部署，含 21 个地标引用；这不是完整动画、战争、交通和主线迁移。源为新浏览器默认状态，不含用户已有浏览器的本地存档修改。GLB 的云、海洋等自定义着色仍需专门适配。
- 统一库 `godot/data/asset-registry.json` 已含 91 条目（原72 + 补19载具/角色配置），全部有归档与Godot实例检查；条目数不是91项美术验收。41条根名称匹配只作为部署候选，变体与父子归属仍需确认。
- 并发执行入口 `docs/ASSET_PIPELINE.md`、`tools/pipeline/asset_pipeline.py` 与 `assets/pipeline/queue.json`。同资产/家族互斥，前台Blender编辑单写者，概念准备与Godot集成可并行；未过行为/视觉验收不得标完成。
- 侦察机已生成原作参考概念，并由真实Blender MCP迭代两轮保存 `assets/models/optimized/scoutAircraft-art-v1.blend`。保留46原节点与变换，改善座舱穿模和玻璃；尚未回接Godot，玻璃需引擎适配，座椅/墨线仍有差距。证据 `artifacts/pipeline/scoutAircraft/model/visual-review.md`。
- 用户全球参考保存到 `assets/references/world/layout-reference.png`。`docs/WORLD_LAYOUT_V2.md` 与 `godot/data/world-layout-v2.json` 提供完整360°候选：14区域/19路线，保留区域内部设计，海运、迁徙与生态预留各有责任。Godot `res://scenes/world_layout.tscn` 可转至另半球、选区域、返回原作；这是导航规划覆盖，不是陆地面积验收，原地形/坐标未改。
- Townscaper 改造以机制正确性为准：先看作者访谈/原WFC库/已有演示帧，再做反例测试。最新矩阵与测试见 `docs/TOWNSCAPER_MECHANISM_AUDIT.md`；重点为真实face邻接、角模块解与装配一致、增量编辑传播、几何接缝和全局可走性。不能只检查功能开关，也不能只靠概念图证明算法。

本轮已修复求解器局部影响区过小导致的提前失败：按需扩大到受影响连通分量，固定无关分量；4项回归通过。完整机制检查9项通过、3项仍待满足。尚未据此声称正式城堡的几何重建及玩法已验收。

当前顺序：将求解变化范围与真实几何重建对应 → face/half-edge迁移与角模块合约 → 原城堡同镜头模块迭代/可达性 → 按全局布局准备地区唯一归属及地形迁移。资产候选和Godot回接并行，书店历史已完成项不重复制作。


## 最新执行：Godot 全局资产库

已将原 72 项与补充 19 个原作配置统一登记为 91 个唯一条目。`godot/data/asset-registry.json` 记录稳定 ID、原工厂/快照/Blender 来源、Godot 资源、家族与变体、独立阶段、当前版本与后续替换指针；`placementRefs` 留给真实世界位置映射，未编造坐标。涂装/武器配置与父场景子件不算独立新设计。

Godot 已实际导入补充资产，检视器合并两清单并去重，91/91 逐项实例化成功；原检视器布局、取景、旋转/缩放、缺失资源与释放回归通过。证据：`artifacts/supplemental-import/godot-registry-verification.json`。旧 72 项验证报告保留。

这完成统一管理入口，尚未完成全部原世界移植、程序动画或美术优化。书店当前版本保留已回接 v3；其他资源仍是原作档案。下一步按真实世界场景与主线路径填入 placementRefs 并接入原位置、碰撞与交互，不能把资产库当成已恢复完整世界。


## 当前续接：原作近景而非恢复停用道具

- [x] 五资产实际调用账目：`BOOKSHOP_ASSET_LEDGER.md`。默认随机房屋和街道列表停用，不新增路牌/灯/电线杆。
- [x] 完整Web现场6棵书店近景树的数据提取及合约检查，保留个体几何/颜色/墨线/尺度/布局。
- [x] Godot局部旧实验布景替换、6棵原树接入；实景/墙体/R与六地点连续步行通过。边界两棵仅AABB交叠而无表面交叉，保留不动。

源数据与来源截图：`artifacts/bookshop-surroundings/`。14m近景旧对象候选与边界检查：`artifacts/bookshop-context/`。

## 本批执行更新

- [x] Web 原 Blender 四块入口石板补回，修正导出副本面朝向与地面适配，实景截图/贴地/行走/R 检查通过。
- [x] 并发 Godot 两阶材质实测验收：原颜色/双面模式保留，真实行走/墙体/R通过，绘制703→703；`artifacts/bookshop-materials/godot-validation.json`。
- [ ] 后续场景批对根级附属与子级资产做覆盖清单，避免道路等再次漏接。

Web 石径证据：`artifacts/bookshop-path/README.md`。

## 当前执行入口：资产总规划

详见 [ASSET_ROADMAP.md](ASSET_ROADMAP.md)。本轮完成 72 项制作分组、按主线场景的阶段与验收标准；尚未执行下一批材质和环境制作。

- [x] Godot 书店两阶明暗材质与固定玩家镜头对照（本批完成，用户最终美术认可仍待检视）。
- [x] 书店/原房屋/路牌/街灯/低多边形树首批实际调用与依赖记录；停用对象不重新生成。
- [ ] Godot 原作书店近景布局、地形与出生→书店→离开检查。
- [ ] 虎三维解剖与动作改造准备；复用现有参考，保护源场景。
- [ ] 补登记现有 72 项之外的门、英雄、八音盒等主线对象及运行时系统。

## 2026-09-08 续接：书店周边与墨线

- [x] Web 书店局部林带避让：默认世界 3 棵遮挡树不再生成，招牌 9 采样与入口 3 条视线检查通过。
- [x] 固定种子保留树造型/变换和碰撞一致；两段陆路五项检查通过。
- [x] Godot 原建筑毛笔墨线回接，26 部件合批 1 次绘制；真实主场景同镜头开/关对照及交互检查通过。
- [ ] Godot 两阶明暗材质与完整原作书店镇；用户实际美术验收。

本节优先于下方旧队列。报告：`artifacts/bookshop-refinement/README.md`。原 Blender/GLB 未改。

## 2026-09-08 最新：书店 v3 回接（覆盖下方旧队列状态）

- [x] 核实磁盘已有第三轮 Blender/GLB，找出仅接到检视场景的断点。
- [x] Web 默认工厂使用真实 v3 建筑网格/窗框/变换，保留招牌编辑、原墨线、任务与地形接口；入口花丛同步两侧布局。
- [x] Godot 默认主场景书店地点加载 v3 GLB；球面庭园适配、碰撞、入口朝向与相机完成。
- [x] 实际运行接入检查：Web 世界行走/碰撞/R 接信；Godot 出生→书店→门前/R 交信与六地点路线；原无损拓扑回归。
- [ ] 用户实际美术验收；Godot 原墨线与完整原作书店镇环境仍待后续。

报告和真实游戏截图：`artifacts/bookshop-integration/`。Web 预览使用 `http://127.0.0.1:8767/TigerMessenger/`；原 8765 服务本轮无有效响应，未终止它。后续从本节继续，不重复导入 72 项，不重做已有概念图。

## 2026-09-08 新增：概念图驱动的美术迭代

采用用户给出的「概念图 → Blender MCP 建模 → 固定镜头游戏截图 → 逐项改进」流程。书店目标图已生成，MCP 已修改并保存独立 `bookshop-art-v1.blend`；仍待渲染审查与游戏回接。详见 `docs/美术截图迭代.md`。不把 72 项几何导入或概念图当作美术优化完成。


## 2026-09-08 实测检查点（优先于下方历史批次）

- 72/72 原作 GLB 已写入 `godot/assets/originals/`，已由 Godot 4.7.2 导入并逐项实例化成功。
- `artifacts/godot-export/glb-validation.json`：72 项可见三角面数量与原快照一致，无不匹配；`godot-verification.json`：72 项加载通过。
- `asset_review.tscn` 已实现独立视口、原名选择、旋转/缩放/重置、缺口提示和按需释放；行为测试通过。7 个代表模型有实际 Godot 渲染截图，书店与虎已人工查看。
- 全部暂标 partial：原作档案导入完成，不等于 72 项造型优化或游戏回接完成。墨线、程序动画、碰撞及交互仍需迁移；虎仍为旧造型。Web 回接仍为 2 项。
- 新导出器保护旧资产目录和已有文件，保留原 blend，不触碰前台未保存编辑；每项保存日志和报告。线段保留，关闭非 Points 模型的散点导出。
- 下一条动作：在检视器完成书店/虎狐材质和墨线适配及同角度对照，然后建立原作书店可走可投递的 Godot 场景。继续按真实虎参考重塑；缺生成凭据不阻塞本地工作。
- 操作方法：`docs/原作资产检视指南.md`。当前主场景还是旧实验关卡；请运行 `res://scenes/asset_review.tscn` 检视原作。


更新：2026-09-07。执行依据：[PLAN.md](PLAN.md)。本清单描述真实完成状态，不把计划项勾为完成。

## 主负责人接管与立即执行队列

用户已授权其他开发模型在 Codex 额度不足时接管整个项目。当前交接文档已准备好；**尚未启动 Claude 或自动切换模型**。新负责人先读 [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)，接管后填写自己的执行环境、工作项和证据，不重新制定另一套游戏。

| 顺序 / 工作项 | 当前状态 | 依赖与下一条动作 | 交付条件 |
|---|---|---|---|
| H01 接管核对 | ✅ Claude 已执行（2026-09-07，见下方接手批次） | 阅读约束和检查点；检查 git 未提交改动、后台进程及输出；声明本批文件归属 | 不覆盖旧成果，记录真实进程与工具状态 |
| G01 原作导入映射 | ✅ 已完成（godot-import-map.json，72/72 源存在） | 从 assets/models/inventory.json 建 72 项源文件与 Godot 目标映射；按已验证版/原作选择导出源 | 每项来源可追溯；旧 10 项实验资产不计入成果 |
| G02–G03 代表资产导出 | 通路已写好，**待有 Blender 的机器执行** | 先书店、虎狐、船、苔庭、圣城构件；验证 GLB 导出和 Godot 加载 | 记录比例、层级、材质/特效缺口与实际资源文件 |
| G04–G08 整批导入及检视 | 代表通路通过后执行 | 批量导入并制作资产选择、自动取景和缺失项提示 | Godot 中实际看到原作，逐项成功/部分/失败清楚 |
| T01 新虎三维重塑 | 仅此项有外部依赖 | 已有概念图；尚无 Tripo 密钥，也未收到本地重塑选择答复。复核新消息和凭据，仅探测是否存在 | 生成可打开三维候选，不将概念图充当模型 |
| V01–V07 书店镇可见改进 | 可做原 Web 缺陷采集；Godot 部分依赖 G | 记录窗户遮挡、接地、台阶和通行，逐项修复与对照 | 第一段可玩的明显改善区域 |

新虎依赖未解除时，先执行 G01，不原地等待、不反复询问同一个问题。用户有新的明确排序时更新队列。

### 接手批次 · Claude Opus（2026-09-07）

**H01 接管核对 — 执行环境（重要，与 Codex 不同）**

| 项 | 实际情况 |
|---|---|
| 执行客户端 | Claude（Cowork），通过桌面桥接连到本机 |
| Shell | **Linux VM**（aarch64），只挂载了 `TigerInBamboo` 这一个文件夹 |
| Blender | **够不到**。`/Applications/Blender.app` 在 macOS 上，这个 VM 里不存在 |
| Godot | **够不到**，同上 |
| `rtk` | **不存在**。PROJECT_HANDOFF 里的 `rtk proxy …` 是 Codex 的 macOS 环境，本客户端用不了 |
| Blender MCP | 未在本客户端注册；按 AGENTS.md 要求「接手客户端需核对自己的配置」——**未配置，未使用** |
| Node / Python3 | 有。Web 侧的 `tools/test_*.mjs` 全部可跑 |
| 无头渲染 | 云端容器里有 Chromium + Playwright，可离屏渲 three.js 做视觉对照 |

所以这一批能做的是**不需要 Blender/Godot 二进制的部分**：清单、脚本、Godot 场景文本、
Web 侧实现与验证。需要跑 Blender/Godot 的两步（G02 实际导出、G05 实际导入）
**写好了但没执行**，留给有那两个程序的机器。这一点没有绕过去的办法，也不假装做过。

未提交改动：接手时 `git status` 54 项，全部保留，没有 reset/clean/checkout。

**G01 原作导入映射 — 已完成并可复核**

- 新增 `tools/originals/build_godot_import_map.py`（纯 Python，无 Blender 依赖），
  已在本机跑过；产出：
  - `assets/models/godot-import-map.json`（72 项）
  - `godot/assets/originals/import-map.json`（Godot 工程内副本——`res://` 看不见外层 assets/）
  - `docs/GODOT_IMPORT_MAP.md`（人读版）
- 结果：**72/72 导出源文件真实存在**（`originals/blender-r3/<id>.blend`）；
  代表资产 7 项；`godot/assets/originals/` 目前 0 个 GLB（还没导，如实记为 0）。
- 导出源的选择规则写在脚本头部：默认取**原作存档**。
  `batch-candidates-v2` 自己标着「视觉对照未做」，拿它做「原作检视场景」自相矛盾；
  `optimized/<id>.blend` 只有 bookshop 与 moebiusTiger 两项，且是 Web 运行时优化产物。
  两者的路径与状态都逐项记在 `alternates` 里，将来要换源是改一个字段的事。
- **导入前就已知的缺口（70/72 项有）**，逐项写进 `knownGaps`：
  - 线/点图元 10 项 —— glTF 没有线图元，Blender 导出器会**直接丢**：
    `swamp_canopy` 108 个、`moebiusCity` 8、`moebiusSwamp` 4、`swampZone` 4、
    `moebiusTower` 3、`tramSystem` 2，其余 1 个。这是 Godot 迁移的第一个真问题。
  - 实例被展开 5 项：`moebiusSwamp` / `swampZone` 各 572、`moebiusCity` 420 ——
    层级与实例关系要复核，否则 Godot 里是几百个独立节点。
  - 70 项 `optimization=pending`（只有 2 项做过渲染对照）。

**G02 导出通路 — 已写，未执行**

- 新增 `tools/originals/export_godot_originals.py`。`--dry-run` 在本机跑通
  （7 项代表资产的源→目标映射逐条打印正确）；真正导出需要 Blender。
- 三条硬规则写进脚本并**断言**：① 只从映射指定的原作存档导，不碰任何通用模型生成器；
  ② 输出落在 `godot/assets/originals/`，**断言**不覆盖 `godot/assets/*.glb`
  那 10 个旧实验资产；③ 目标比源新时跳过，只读 .blend 从不保存回去
  （前台 Blender 可能有未保存内容）。
- 导出后会**再数一遍**只有边的网格与曲线对象，丢了就标 `partial` 并写进
  `export-report.json`——不拿一个能打开的 GLB 冒充导入成功。

**G06 检视场景 — 已写，未在 Godot 里打开过**

- 新增 `godot/scenes/asset_review.tscn` + `godot/scripts/asset_review.gd`。
- 读 `res://assets/originals/import-map.json` 列 72 项；**按需**实例化（一次一项——
  `moebiusSwamp` 4004 节点，开场全塞会卡死）；自动取景按包围盒算距离
  （bookshop 几米到 moebiusSwamp 半个星球，跨三个数量级，固定机位一定有一头看不见）。
- 每项在屏幕上显示**来源路径 + 导出状态 + 已知缺口**；没导出的显示占位与原因，
  不静默跳过——空场景最容易被误读成「导完了」。
- ⚠️ 我**没有 Godot 可以打开它**。GDScript 未经引擎解析，`.tscn` 未经加载验证。
  下一个有 Godot 的执行者第一步就是打开它，报语法/API 错误。

**下一条可以直接执行的动作**（需要 macOS + Blender + Godot）：

```sh
python3 TigerMessenger/tools/originals/build_godot_import_map.py      # 已跑过，可重跑
python3 TigerMessenger/tools/originals/export_godot_originals.py --representative
# 然后用 Godot 打开 godot/project.godot，运行 scenes/asset_review.tscn
```

**Web 侧本批实际完成（与 Godot 队列并行，不占用 G 的依赖）**

这几项是用户在本轮直接提的需求，已实现 + 有测试 + 有离屏渲染对照：

- 舰队编队学：僚机两档队形（密集/战术掩护轮）、气垫艇低通跟位、侦察机 standoff 盘旋
  与空中曳光指示。`tools/test_fleet_own_style.mjs`、`test_scout_fleet_wing.mjs`、
  `test_fleet_cohesion.mjs`、`test_flagship_autonomy.mjs` 全绿。
- 拆掉 `missionLock`：主舰只按自己的航线飞，登陆队对它只读不写；空降的唯一触发
  改成「主舰受到攻击」。
- 月亮湖的月牙（`src/world/moonOrb.js`）：`tools/test_moon_orb.mjs` 9 项全绿。
- 苔庭之鲸参战（`src/world/whaleMaw.js`）：被绳索拉扯的挣扎、沿口裂线切开的下颌下沉 +
  喉囊鼓胀、吞入重甲兵（一路挣扎）、腹中运送、排出后军服变土黄。
  `tools/test_whale_maw.mjs` 10 项全绿。
- 顺带修了一个真 bug：`updateLakeFx` 在此之前**全仓库没有调用点**，
  湖的涟漪 / 涉水水花 / 倒影呼吸三样写好了从没跑过；已接上主循环。

预存红：`tools/test_leviathan.mjs`「松树投影超出地壳板」。经核对与本批无关——
它依赖未提交的 `src/world/saihoji.js` 改动，那不是本批改的文件。

---

### 本次交接的实际状态

- 最后执行者：Codex；本轮只更新接管文档，未启动新建模/导入批次。
- 未提交内容：代码、原作资产、工具脚本和 Godot 工程有大量本地修改及未跟踪文件；已核对存在，不可 reset/clean 或以 Git HEAD 代替当前成果。
- 生成任务：新虎二维概念已完成，没有已提交的 Tripo 三维任务 ID；不可“恢复”一个不存在的任务。
- 工具服务：Blender MCP 在上一工作回合通过连接测试；端口、前台未保存内容、Web 服务和客户端接入在接管时重新核对，不将历史状态当实时状态。
- 下一条动作：H01 → G01；本轮未启动自动化，也未实际调用另一个模型接管。

### 每次额度不足、正常停工或转交前必填

```text
负责人 / 客户端：
本批任务 ID 与目标：
状态：进行中 / 已完成 / 依赖阻塞 / 已移交
已改文件及保留的用户编辑：
输出路径、版本与来源：
实际运行的检查及报告路径：
失败或未验证项：
仍在运行的作业：进程或服务、启动参数、日志、任务 ID；未核对则写未知
付费任务：provider、checkpoint、task ID、最后状态；未提交则写无
下一条可以直接执行的动作：
需要用户输入的唯一依赖（若无则写无）：
```

额度接近用尽时优先写检查点，不开始无法记录结果的新付费任务。突然中断来不及写时，新负责人从当前文件、日志和 checkpoints 恢复，不默认上一步未执行，也不重复提交生成任务。

## 当前检查点

### 最新续接（覆盖下方原文档交付检查点）

- [x] 核实已安装的 9 个 threejs-* 技能源为 majidmanzarpour/threejs-game-skills，读取本次相关技能。
- [x] 配置 Blender MCP、启用前台插件，真实 MCP 协议读取当前场景成功；遥测关闭。
- [x] 收集真实虎、Mœbius 漫画与传统建筑环境参考，记录来源。
- [x] 基于真实虎与旧角色身份生成新概念：assets/concepts/moebius-tiger-anatomy-v2.png。
- [ ] 新虎三维生成/重塑：Tripo 密钥未配置，已询问用户本机配置或 Blender 本地重塑选择；不要索取聊天中的明文密钥。
- [ ] 新虎四足、尾巴、行走/饮水验证及 Web/Godot 回接。
- 用户已授权上述实施，原“仅文档暂停”状态已被新请求替代。Godot 原资产导入仍未开始，继续保留为下一批明确交付。
- 最新制作检查点见 [game-progress.md](../artifacts/game-progress.md)。

### 原文档交付时的检查点（历史记录）

- 当前交付：已核对代码和资产，编写计划与待办。
- 游戏修改状态：沿用用户此前“暂停”；本次只授权并执行文档工作，没有启动 Godot 批量导入。
- 最近完成：72 项 Blender 候选保存后数据检查；书店和湖沼之虎 Web 回接与视觉对照。
- 当前主要缺口：Godot 仍引用 10 个旧实验 GLB，72 项原作未导入；可见缺陷修复尚未作为完整区域交付。
- 下一条执行动作：恢复实施时先读取本清单，核对 Godot 导出入口与原作清单，建立 `godot/assets/originals/` 的导出映射和代表资产导入验证，然后推进资产检视场景。
- 当前没有需要用户批准的常规操作；无需再次询问 allow。只有无法推断的设计取舍才提出具体问题，并继续独立工作。

## 已有基础（完成不代表整个游戏优化完成）

- [x] 72 项目录资产归档到 Blender。
- [x] 72 项生成候选副本；63 项重复顶点整理、9 项保留原网格。
- [x] 72 项保存后数据重读检查通过。
- [x] 书店 Web 回接、同机位零像素差异、招牌编辑检查。
- [x] 湖沼之虎 Web 回接、静止/行走/饮水对照、关节引用检查。
- [x] 确认 Godot 现有 10 个 GLB 与旧实验资产包内容相同。
- [ ] 目录外 95 个几何来源模块全部详细阅读、提取与变体映射。
- [ ] 其余原作完成视觉、动画和运行时验证。
- [ ] 72 项原作完成 Godot 导入与逐项状态记录。

证据：[全量来源清单](../assets/models/全量模型清单.md)、[候选清单](../assets/models/optimized/batch-candidates-v2/README.md)、[保存后检查](../assets/models/optimized/batch-candidates-v2/saved-verification.json)、[书店对照](../assets/models/optimized/verification/bookshop-web-comparison.json)、[虎对照](../assets/models/optimized/verification/tiger-web-comparison.json)。

## P0：Godot 原作资源与检视场景

- [x] G01 建立原资产 ID → 源快照 → Blender 工作文件 → Godot 资源路径的导入清单；原件、候选、验证版分开记录。
- [x] G02 建立可重复导出入口；已有输出使用版本/指纹检查，保留用户编辑，不盲目覆盖。
- [ ] G03 用书店、湖沼虎、红狐、船、苔庭、圣城部件验证坐标、尺度、层级、贴图、实例与可动部件。
- [x] G04 批量处理 72 项；每项写入成功、部分适配或失败状态与原因。暂不支持的特效显式列出。
- [x] G05 在 Godot 导入后逐项加载/实例化，记录缺失纹理、资源错误、异常尺寸和节点丢失。
- [x] G06 实现按资产选择与自动取景的 asset_review.tscn；显示来源和适配缺口，大场景按需加载。
- [ ] G07 为动态角色补动画预览；为线条、粒子和材质提供专门适配，不能用静态截图冒充动画通过。
- [ ] G08 实际打开 Godot 检视场景，并确认用户看到的是原作资产。交付可打开路径和操作说明。

验收界限：导入成功 ≠ 原世界已经迁移；有缺失项的资产不标完整可用。

## P1：第一段可见改善——出生点与书店镇

- [ ] V01 在原游戏记录同机位截图、通行路线和具体缺陷清单。
- [ ] V02 核对书店窗户与凸窗主体的位置，修复已确认的遮挡，保留原窗形、数量和配色。
- [ ] V03 处理建筑/台阶/招牌与球面地形的衔接，验证脚底、台阶高度及碰撞。
- [ ] V04 调整局部阴影和照明，让原装饰可辨，保持原低多边形色调。
- [ ] V05 Web 回接后实际走完整条路线；提供修复前后对照。
- [ ] V06 Godot 用同一批原资产搭起对应区域，接入球面移动和相机，验证碰撞及尺度。
- [ ] V07 提供用户可验收的区域入口、改进列表、遗留问题；用户验收前不标已验收。

## P2：分区完成资产、地形与交互

- [ ] W01 湖沼：地表与水域衔接、虎狐动画及跟随、交互位置、原植物和生物。
- [ ] W02 圣城：原模块/邻接规则/地形接口与种子映射、城墙门洞通行、原角色与装饰。
- [ ] W03 苔庭：植被、建筑、地表层次、原实例与材质、道路和碰撞。
- [ ] W04 科幻城市：原建筑、aircraft、光源、吸食反馈和场景关系。
- [ ] W05 载具：船、轨道/电车、飞行器等原节点结构，驾驶/乘坐、碰撞及离乘。
- [ ] W06 目录外模型：沿实际场景调用追踪，区分纯模型、生成规则、行为与特效；补资产清单和导出项。
- [ ] W07 区域串联后验证球面高度、相机过渡和相邻地形；修复跨区穿模及断层。

## P3：救援体验、声音与性能

- [ ] Q01 将家书背景映射为可玩的送信、获得能力、牵制 aircraft、救出虎狐及撤离步骤。
- [ ] Q02 每一步有交互、明确反馈和可恢复状态，不仅修改任务文字。
- [ ] Q03 检验角色跟随、能力生效、失败重试、存档与重新开始。
- [ ] Q04 加入并验证步行、交互、机械、环境和救援音效及静音行为。
- [ ] Q05 同设备、同路线记录加载、帧时间、绘制调用和内存，再判断合批、实例化与分区加载效果。
- [ ] Q06 完成 Web 与 Godot 的工程指南、资源更新方法、已知问题和验收路线。

## 每批完成时必须更新

- [ ] 记录具体资产/区域和本次可见变化，关联源文件、输出与检查报告。
- [ ] 分别更新 Blender 候选、视觉通过、动画通过、Web 回接、Godot 导入、Godot 玩法及用户验收状态。
- [ ] 记录失败项；能保留原网格继续的项不阻塞整个批次。
- [ ] 写清下一条可直接执行的动作、必要参数、仍运行的进程及日志位置。没有运行进程则明确写无。
- [ ] 交付可打开的结果，不仅报告文件数量；不宣称未验证的性能或完成比例。

## 中断恢复

恢复语句：**请接任 TigerMessenger 项目负责人，先读 AGENTS.md、docs/PROJECT_HANDOFF.md、docs/PLAN.md 和 docs/TODOS.md；从可执行队列继续，完成 Godot 原作资产检视场景，不要从头重做，也不要等 Codex 恢复额度。**

助手恢复时先检查上一批进程和输出，再执行第一个未完成且依赖满足的事项。普通回复结束后不保证自动续跑；没有配置无人值守自动化，不声称后台仍在持续优化。用户无需重新解释原审美与游戏背景。

## 72 项逐项跟踪

以下表格由当前 inventory.json 生成初始状态。更新后需与实际导出及测试结果一致。原作导入路径是计划位置，尚未创建。用户验收均未完成。

| ID / 原资产 | Blender 候选 | Web 回接及视觉 | Godot 原作导入 |
|---|---|---|---|
| bookshop / Hard To Find 书店 | 重复顶点已整理 | 通过 | 未导入 |
| house / 水墨小房 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| pine / 古松 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| signpost / 路牌 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| lamp / 街灯 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| pole / 电线杆 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| rock / 焦墨岩 | 原网格保留 | 待验证/回接 | 未导入 |
| hydrangea / 绣球花丛 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| flower / 水墨小花 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| lawnHill / 草坪山丘 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| fox / 阿狸（小狐狸） | 重复顶点已整理 | 待验证/回接 | 未导入 |
| fisherBoat / 古战船 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| harborCrane / 港口起重机 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| stackedCrates / 货柜木箱堆 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| oldHarbor / 修船厂码头 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| citadelWatchtower / 圣城瞭望塔 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| citadelElderTree / 圣城参天树 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| snowMassif / 雪山组 | 原网格保留 | 待验证/回接 | 未导入 |
| snowMountainPeak / 单座雪峰 | 原网格保留 | 待验证/回接 | 未导入 |
| moebiusSwamp / 莫比斯湖沼 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| moebiusTower / 莫比斯塔 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| moebiusAirship / 莫比斯航空艇 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| moebiusAircraft / 莫比斯飞碟 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| tram / 基督城电车 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| bubblePod / 气泡座舱 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| fence / 木栅栏 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| bridge / 木桥 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| lowPolyTree / 低多边形树 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| cloud / 云朵 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| blackRock / 黑岩 | 原网格保留 | 待验证/回接 | 未导入 |
| craneOnRock / 岩上鹤 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| classicAliFox / 阿狸（经典版） | 重复顶点已整理 | 待验证/回接 | 未导入 |
| moebiusTiger / 赛博水墨虎 | 重复顶点已整理 | 通过 | 未导入 |
| bird / Boids 小鸟 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| longWingGlider / 异星滑翔长翼鸟 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| craneNPC / 丹顶鹤 NPC | 重复顶点已整理 | 待验证/回接 | 未导入 |
| messenger / 送信人（玩家） | 重复顶点已整理 | 待验证/回接 | 未导入 |
| agentMessenger / 数字孪生送信人 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| bookshopHydrangeas / 书店绣球 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| grassTuft / 草丛 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| mossyGround / 厚涂苔藓地被 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_whale / 沼泽·白鲸 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_worldTree / 沼泽·世界树 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_nativeDoll / 沼泽·原住民人偶 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_lotusLeafBoat / 沼泽·莲叶舟 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_eel / 沼泽·黄绿鳗 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_tubeWorm / 沼泽·橙红管虫丛 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_mushroom / 沼泽·紫蘑菇/珊瑚 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_pinkHanger / 沼泽·粉垂生物 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_bird / 沼泽·沼泽鸟 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_monkey / 沼泽·长尾猴 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_lizard / 沼泽·发光蜥蜴 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_ribbonFish / 沼泽·发光带鱼 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_shell / 沼泽·贝壳 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_rimPalm / 沼泽·坑缘棕榈 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_toweringTree / 沼泽·苍天巨树 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_canopy / 沼泽·树冠顶棚 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_glowFlower / 沼泽·发光花蕊花 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_giantFlower / 沼泽·巨花 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_stamenSpike / 沼泽·花蕊尖锥 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_fishSchool / 沼泽·绿黑斑纹小鱼群 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| swamp_fireflies / 沼泽·萤火虫群 | 原网格保留 | 待验证/回接 | 未导入 |
| swampZone / 莫比斯湖沼生态区 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| moebiusCity / 莫比斯水晶城 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| startingCamp / 起始营地 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| saihoji / 西芳寺·苔海 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| planet / 小星球本体 | 原网格保留 | 待验证/回接 | 未导入 |
| hills / 岛丘地形 | 原网格保留 | 待验证/回接 | 未导入 |
| moonLake / 月牙湖 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| tramSystem / 电车轨道系统 | 重复顶点已整理 | 待验证/回接 | 未导入 |
| equatorialClouds / 轨道云墙（书店→峡谷） | 原网格保留 | 待验证/回接 | 未导入 |
| platforms / 平台土坡 | 原网格保留 | 待验证/回接 | 未导入 |
