# 管线工坊第一版

已实现TigerMessenger/pipeline.html、studio.js/css、pipeline-model.js与同源pipeline-bridge.js。七能力类别增删、排序（拖动/键盘按钮）、启用、参数、配方撤销/重做、配方保存/导出。实景使用原游戏iframe；明确区别游戏已连接与智能Worker未接入。水/光/世界/现有生命显示参数已接；地形建筑用原编辑器；战斗待适配。

模型与存储5项行为测试通过；模块语法及diff空白检查通过。首次真实浏览器7节点、战斗移除/重插、保存配方、场景编码不变，pageerror=[]。第一次studio.png仍有游戏开始遮罩，已实际查看；更新实景/参数往返补测以browser.json为准，不得将初次截图算通过。

用户已确认原建筑群恢复，程序不生成替代地形。测试浏览器不含原浏览器存档。管线节点的目前变化限实时参数；顺序对这些独立显示参数无依赖影响。未声称地形/建筑/战斗Worker改造完成。智能执行、区域锁、通行战斗性能验收和知识反馈审核仍待接入。JEV真实文本调用见jev.json，不批准验收。

实景补测browser.json：wavesDisabled=true，wavesRestored=true，sceneDataUnchanged=true，nodes=7，errors=[]；新截图已完成渲染，无开始遮罩。测试浏览器为空湖，不能认作用户已恢复的建筑群。再补编辑态UI层与游玩切换，截图以最终studio.png为准。最终6项行为测试通过，含配方和baseline独立快照。

来源和层级补测source-audit-browser.json：新配方11节点，天气2参数，烟标为「尚无场景执行适配」，库Smoke实际源码链接HTTP200，pageerror=[]。sources-smoke.png实际查看，来源详情可见原帖子、库登记、游戏副本缺失；此截图不是烟效果验收。7行为测试通过，含旧life配方兼容。实际天气/火焰视觉与完整互动仍未测。

能力扫描与载具补测：scanner-browser.json实际读取197条REA管线记录，搜索船来源ID返回显式适配和扫描记录两项；插入长船记录后15节点，刷新后仍15节点，errors=[]。scanner-vehicles.png实际查看，飞行器标为游戏既有模块来源及待适配；截图游戏仍启动中，仅验证扫描前端，不算载具实景执行。9行为测试全通过，扫描元数据强制recipe/controls=[]，不执行库JS。源扫描范围仅pipeline声明，非全源码能力语义发现。

顶部学习工坊：learning-workshop-browser.json记录39模块、搜索长船来源命中、原素材URL正确、切回场景管线节点保留、700px无页面横向溢出、errors=[]。截图learning-workshop.png已实际查看。901469409579061248.mp4实际存在；未做全视频播放复核。来源直接读REA三份数据，场景iframe不重载。

双向工坊实测workshop-link-browser.json：adapterLocated=true、14→15→撤销14→重做15、sameGameFrame=true、保存刷新15、目标保留、noDuplicate=true、errors=[]。来源往返测试发现并修复goal失焦重绘导致节点点击失效；重测完整通过。workshop-link.png已实际查看，学习条目显示已在当前管线及定位方法/关联适配两个入口。此测试验证前端操作连通，不代表新增学习方法已能由Worker执行。

菜单迁移最终补测：menus-clean-game-browser.json中startup ready、release true、workbench false、editorVisible false、remoteOpen true、errors[]，指定localhost8931主游戏完整渲染截图已实际查看。移动/环视/跳/E/F/C/G遥控可见，原大编辑面板不在游戏。父工坊刷色/色板选择及快照保存通过。10项CPU行为测试通过。保留用户称赞的图标栏浅蓝圆角与原按钮事件；未用长文字代替原图标。

四小时窗口第一批：13行为测试通过；统一实验真实浏览器完成参数/配方差异比较、拒绝未恢复定稿、备份恢复及测试定稿，errors=[]。测试仍有启动遮罩，不声称完整实景验收。临时heartbeat super-agent已建立，上海07:05截止，后续以交接记录续做。固定上游源码官方codeload已取到~/.local/share/tigermessenger-superagent/source-6337fc823ce2，安装依赖启动；还未build/加载独立profile/验证Worker模型。

04:05后端推进：本地Source插件真实注册/服务运行/快照持久化/原生Engine.receive通过（201 stored），重放200duplicate、冲突409、跨Origin403；扩展60上游测试文件1199项通过、build/typecheck成功。当前GitHub硬耦合尚未解除、模型未运行，执行器主动paused，不能把intakeReady写成Worker connected。代码和重放补丁在项目tools/scene-authoring/dsh-local，不仅缓存修改。服务重启后仍status intakeReady=true/executionReady=false；具体setup见dsh-runtime-status.json。无前端/渲染修改，本轮不需要用图片证明后端状态。JEV真实调用heartbeat-0405-jev.json。

04:35：localRoot显式部署消除GitHub必要条件；当前实际runtime setupProblem=null/GitHub身份null/本地root真路径/paused=true，Source明确deploymentReady而executionReady=false。模型目录0路由provider/0groups，未调用模型。61上游文件1201测试、typecheck/build通过，项目16行为测试通过。版本化补丁记录全部变化与base SHA，未改主游戏前端或用户存档。真实状态local-deployment-status.json/model-catalog-status.json，JEV真实heartbeat-0435-jev.json。

05:05：8933独立代理真实连8932，原生认证留服务端内存，只有受限health/requests两条路由和精确8931Origin。前端显式检查/提交当前实际场景快照，真实浏览器Source接收/重复去重/断线模拟保留14节点、errors=[]；截图已实际查看，不算游戏玩法验收。模型仍未执行，executor paused。请求ID指纹与当前recipe在提交时持久化，刷新恢复结果见最新source-bridge-browser.json。4 Python代理边界测试+16项目行为测试通过。JEV heartbeat-0505-jev.json。
