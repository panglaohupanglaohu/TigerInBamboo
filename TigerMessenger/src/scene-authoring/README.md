# 场景管线接口

pipeline.html 为游戏内管线工坊；REACodeRefactoring/pipeline.html 保留知识/来源视图并链接工坊。新增能力注册于 pipeline-model.js CAPABILITIES：稳定id、类别、来源、mode、checks、controls。live能力必须同时在场景插件settings/apply中显式接入；仅登记不代表可执行。editor复用原编辑器，recipe仅保留开发意图。

顺序当前为线性配方顺序；已接入参数相互独立，不伪造依赖计算。以后生成型节点需补输入/输出类型、依赖与Worker执行检查。能力新增不改写旧配方或旧定稿。

场景插件：id/name/open/play/encode/restore/validate/settings/apply。只读settings必须返回实际值（留意现有对象部分属性只有setter）；apply只允许已登记参数。bridge只接受同源父窗口的固定命令。配方和编码分别保存，生成型Worker必须在隔离候选中执行，不能调用此预览通道直接覆盖手工World。

扩展地形/建筑/植物位置/战斗时需实现候选变化、对象归属与区域锁、通行/性能验证；不能只为节点加开关。现有七分类并不表示七类生成能力已完成。实时显示对照不等同几何或视觉验收。

来源校核：tools/scene-authoring/audit_sources.py只读REACodeRefactoring/learn/{pipeline,data}.js和实际源码，生成capability-sources.js：原帖子ID、原库lane/group、原登记状态/覆盖说明、文件SHA256、游戏副本相同/不同/缺失。此字段不是实景验收。禁止用游戏适配文件代替能力来源，也不允许从目录life推导统一生命系统。库内层级保持原样，工坊分类是另一维度。

生命拆分：天气（Atmosphere；雾/风雪）、植被（Vegetation/Impostor）、动物（Birds；蝴蝶属Decor，尚未开放），烟和火作为独立特效节点。旧life.layers配方不自动改写，点旧节点可显式拆分，操作可撤销。当前风箭头为调试，不能当风开关；火开关仅控制已有火焰，不添加火源；Smoke在库中存在但当前stage没有导入。新增节点不代表联动模拟或生成方法已完成。

载具层：船（REA Boats/航迹+游戏boatRide分开列）、飞行器（游戏aircraft/scoutAircraft/airshipRide）、车（游戏tramRide）。当前REA的pipeline/MODULE-MAP未发现后两类对应执行器；不得凭游戏有模型和驾驶接口标为REA来源。三个工坊节点均待执行适配。

能力扫描器：点「扫描REA能力库」以no-store读取原站点相对路径的learn/pipeline.js，只解析window.PIPELINE的JSON声明，禁止eval。按库lane/帖子ID/toggle和重号序号生成扫描ID，保留原分组、实现位置及登记状态。新能力自动登记进可搜索能力库，点击＋插入管线；不自动插入所有节点，不改World、不提升为live。目录存tm.pipeline.catalog.v1；配方只附带选中扫描条目的声明用于可恢复加载。已接入的显式适配节点和扫描记录分开，避免自动把源toggle接成场景开关。未扫描learn/data中无pipeline登记的条目，也未把文件存在或源码注释判定为执行通过。未来需补代码导出/依赖/检查索引及稳定版本迁移；重号序号不保证库重排后的身份稳定，旧配方保留自身声明。

双向连通：学习工坊通过onAddCapability/getUsage/onLocateCapability操作场景工坊同一份配方与撤销链。学习方法登记来自同一扫描器，不用名称猜测来源；新增方法只以recipe节点进入场景，不自动执行。已存在方法显示定位，避免重复添加；同一来源对应的游戏适配单列定位按钮。场景详情openSource按原帖子ID或无ID方法名称定位学习管线。模块页可按实际文件路径查看相关管线方法，视频页列出该帖子对应方法。切换仅隐藏视图，不销毁iframe；学习搜索和页面模式在本次会话保留，保存的配方及discovered声明可刷新恢复。

菜单集中：同源authoringEmbed游戏把原morris-townscaper-hud的DOM（含原事件闭包）挂到父工坊editor-controls，原版本面板挂scene-versions；不是复制按钮再写第二套编辑逻辑。原游戏frame只保留渲染和输入；学习侧栏不再在frame加载。父工坊载入原局部CSS并用命名空间覆盖固定定位，整理成建造/色板/工具/场景参数及版本两个折叠区域。普通游戏入口默认UI_DEV=false，只显玩家界面；工坊iframe显式dev=1。遥控保留，首次进入主游戏默认展开，用户手动收起的偏好仍保留。初始化不再把工坊iframe的临时默认状态写成用户遥控偏好。

本地执行边界：pipeline-execution.js inspectExecution给出真实可执行/手工/未适配步骤；只允许显式supported-preview执行现有参数，不能把partial-preview说成完整pipeline或模型Worker。tools/scene-authoring/run_pipeline.mjs接收本地快照JSON和隔离候选目录。候选记录baseHash、配方、实际参数、锁和执行范围；inspectCandidate在工作区变化、锁冲突或候选被修改时拒绝。当前保护整个World编码，尚不支持几何生成/细粒度区域锁。候选持久化禁止覆盖同ID。此CLI供后续DSH Worker调用，不是已连接的DSH Source。

独立DSH诊断：python3 tools/scene-authoring/check_dsh.py --output <report.json>；只读本项目隔离实例的bootstrap日志于内存，输出setup/worker load，不输出token。实际profile路径与启动状态见PROJECT_HANDOFF最新段；默认不读其他DSH profile或用户凭据。

独立Source桥：tools/scene-authoring/source_bridge.py仅监听127.0.0.1:8933，精确允许游戏localhost/127.0.0.1:8931 Origin；只有health与requests两条路由，不提供通用原生管理代理。原生8932 bootstrap cookie只留Python内存，浏览器拿不到token。前端「检查本地服务」显示真实Source/deployment/暂停/模型目录状态，绝不把Source ready当Worker ready。显式「提交目标与场景快照」通过同源游戏capture拿到实际编码/参数/recipe并发送本机Source，不修改当前场景。纯服务失败不影响游戏。

提交将请求ID和快照指纹写本机ledger，不重复存整份场景；相同快照重试复用ID，刷新后保留收件状态线索。原生请求去重仍为最终依据。模型未配置/执行器暂停时请求只保存在Source，不报告已完成改造。CORS拒绝未授权Origin，JSON/尺寸有界，不打印认证数据。当前模型接口未执行验证，不能把状态面板当模型连通验收。
