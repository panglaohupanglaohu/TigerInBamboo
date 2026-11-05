# 双工坊测试规范

## 执行

仓库根运行：

```sh
python3 TigerMessenger/tools/scene-authoring/test_workshops.py
```

每次输出 `TigerMessenger/artifacts/workshop-tests/<UTC唯一时间戳>/`：summary.json、unit.log、source-bridge.log、watchdog.log、browser.log、browser.json，以及成功生成的导出JSON与截图。失败也留原日志；不覆盖历史。退出码非0表示存在 FAIL/BLOCKED；summary PASS只表示已执行套件通过，不能称所有人工项目已验收。

可以 `--skip-browser` 单跑单元；必须记录浏览器 NOT_RUN，不能算全量。`--output` 指定一个不存在的目录。前提8931服务运行；不要在用户服务未识别时杀进程或替换端口。

运行器用当前Python、PATH中的Node或Codex缓存Node；可通过 NODE_PATH_BIN 指定Node。浏览器脚本可通过 PLAYWRIGHT_MODULE（包路径）、CHROME_PATH、WORKSHOP_BASE_URL 配置环境，默认本机Codex缓存Playwright和系统Chrome。没有依赖记BLOCKED，不自动升级项目依赖。直接浏览器命令：`<node> TigerMessenger/tests/workshops-browser.mjs <输出目录>`。

## 测试边界

全部测试使用全新非持久浏览器上下文；同源但不共用用户浏览器存档。不得通过 attach 用户profile、清空用户localStorage或导入覆盖其建筑来准备测试。测试定稿标TEST ONLY，关context即丢弃。网络故障可以在测试context拦截；实际Source提交/模型调用不能随测试自动执行。

## 功能矩阵（持续扩展，不漏项）

| 范围 | 自动覆盖与ID | 额外验收/缺口 |
|---|---|---|
| 入口/初始配方 | S01、G01、game-entry-ui单元 | 实际遥控移动/跳跃/交互手动测试 |
| 扫描、搜索、404恢复 | S02/S03、scanner单元 | 扫描记录≠执行能力；数量随原库更新不固定 |
| 节点增删、停用、按钮排序、撤销重做 | S04、pipeline-model单元 | 鼠标拖动排序需补自动或人工实测 |
| 目标、保存配方、导出、刷新 | S05/S06 | localStorage配额失败单元；UI提示需补 |
| 实际游戏连接、菜单迁入 | S07 | 不能只测试mock iframe |
| 实景点选、对象查看、切换、跨工坊保留与退出 | S18/S19/S20，实际画布射线及dispose事件 | 移动/旋转/造型/叶色/对象编辑保存尚未接入 |
| 建造/拆除/刷色/岩石、色板、帮助、收起 | S08检查选中和事件 | 真正点击体素的建造/拆除/刷色几何结果、编辑撤销重做须单独验 |
| 实时参数、原始/实验对照、保存 | S09，pipeline-model单元 | 全部波浪/倒影/昼夜/描线/网格/雾雪/植被/鸟/火逐项读实际stage并观察；仅控件切换不足 |
| 草稿空间不足、失败无副作用、恢复后重试 | S16（真实游戏编码/参数、全部localStorage前后对照） | 仅对测试iframe的版本键注入QuotaExceededError；不能清空用户数据 |
| 比较、恢复、旧版本拒定稿、隔离定稿、导出版本 | S10、experiment-session/store单元 | 新窗口加载/缺失版本由S17另验；用户真实视觉玩法确认仍独立 |
| 固定版本新窗口、缺失ID回退 | S17，精确比对实际World/settings及只读版本状态 | 本机同源存储；代码资源冻结/跨设备分享未验收 |
| 编辑/游玩切换、服务离线 | S11、代理4测试 | 实际移动/碰撞/通行/帧时间需单独记录，不用页无异常代替 |
| Source健康、收件去重、刷新账本 | 代理测试；旧source-bridge-browser证据 | 当前真实收件链需服务在线后独立诊断，禁止把旧PASS当本轮PASS |
| 共享学习进度/刷新/故障恢复 | L06对比原库updatedAt和latest标题，并模拟503后重试 | 库覆盖进度与游戏接入进度分别记录 |
| 模块页/搜索/源码链接 | L01/L02 | 抽样所有分组/链接，链接不存在报告原库问题 |
| 管线方法加入/定位/撤销/返回 | L03 | 页面切换必须保留同一iframe和手工编辑 |
| 视频笔记、搜索、播放关闭 | L04 | 错误视频提示、所有资源可读性另扫；加载元数据不等于观看学习 |
| 移动布局、切页保留iframe | L05 | 700px、桌面自动；更窄手机/键盘焦点/对比度人工补测 |
| 顶部配色/时段/生成/清空/导入导出、场景选择/保存 | 原编辑器复用，待补测试 | 只在隔离测试场景做破坏性操作，需验编码及撤销行为 |
| 候选隔离、锁、手改后冲突、防篡改 | pipeline-execution单元 | AI候选回收与局部区域/对象锁尚未实现 |
| Watchdog | 5项单元和历史受控恢复 | 不重启占用端口；不重启游戏；持续运行需明确窗口 |
| 天气/植物/动物/烟火/船/飞行器/车/战斗 | 能力模式及完整执行拒绝单元 | 待适配项记BLOCKED/NOT_IMPLEMENTED，禁止标生成通过 |
| 真实Router/Worker | 目前BLOCKED | 需可路由模型及授权；先清诊断队列再执行 |

## 状态与验收

PASS=本轮实际执行且断言满足；FAIL=执行后不满足；BLOCKED=依赖/实现缺失无法验；NOT_RUN=本轮未执行。每项附命令/操作、预期、实际、证据、环境/版本、下一动作。历史测试另外写日期。严禁“按钮存在”充当功能通过。

功能交付前须同时满足：相关单元、真实8931路由、真实浏览器行为、受影响截图实际查看、无用户数据破坏。完整闭环还须实际Worker模型候选、人工编辑、冲突保护、通行/性能验证、用户定稿与固定游戏版本加载。未达不能称全部完成。

## 每轮记录格式

在 WORKSHOP_LOG 追加：上海时间/UTC目录、工作树相关基线、缺陷及复现、优化文件与目的、测试命令和结果计数、原失败与重测证据、实际截图观察、JEV结果/失败、BLOCKED/NOT_RUN列表、交接下一条动作。不得只写“全部正常”。

定向重测：浏览器脚本支持环境变量WORKSHOP_CASES=L01,L06,L04，只运行选定ID，其余记NOT_RUN。定向成功不能当作全量套件成功；与原失败报告一起归档。

分类回归：capability-library.test.mjs覆盖显式场景层、生命/烟火/载具子类、真实扫描所有记录唯一归类、未知基础保留及不改变mode/provenance。浏览器S12检查十个分类入口、生命三类、载具三类、默认折叠方法、方法加入与撤销；S02/S03仍覆盖跨层搜索及扫描404恢复。分类不改变默认14节点，不自动将扫描方法加入配方。旧无分类长列表不得回归。

学习快照后端：learning_snapshot_test.py五项临时目录测试（内容身份/更新、观察到的并发写入拒绝、可选缺失与核心损坏、大小/缺失核心、目录外符号链接），已纳入统一入口。真实8931 API单独验证200及条件304；不把这项当作前端已消费或生产者事务一致性验收。

图标栏视觉回归：S13在真实游戏菜单迁入后读取computed style，断言获认可浅蓝底rgb(227,243,251)、图标颜色及对比度≥4.5，保留原工具按钮和聚焦截图。需要防止#editor-controls #morris-townscaper-hud .panel的通用!important背景规则覆盖浅蓝栏；获认可栏覆盖必须在相同HUD作用域使用更具体的选择器。程序聚焦截图不代表全键盘操作可达性验收。

学习声明准备层：learning-declaration.test.mjs实际解析原ARCH/PIPELINE/LEARN/REFACTOR_STATUS，检查注释/单引号/尾逗号/转义与拒绝代码/原型键/重复键/越界；learning-snapshot.test.mjs校验七文件内容hash、版本、时间、缺失/重复清单/结构损坏/可选缺失，不提交任何全局。六项加入统一入口，真实API解码另记snapshot-decoder-api.json。前端页面一致刷新另由L06/L07验证，不能以纯解析测试替代；本轮状态以browser.json为准。

P1页面接入：L06模拟快照API503，断言旧snapshotId、资料、配方保留并标stale，重试恢复current；L07签名fixture更新三视图/进度，recipe/iframe不变。L09/L10已补整页离线缓存与配额失败；生产者事务、依赖hash及固定版本历史缓存仍未验收。原库不写入。

L08：学习进度的证据/完成/缺口三组默认折叠；滚回页面顶部后资料页签位于首屏；证据展开后真实链接可见，刷新保留展开状态，完整说明可展开。保留源数据全部条目，不用删除旧记录换取简洁。定向成功不得替代整套/手机人工验收。

学习缓存回归：learning-cache.test.mjs三项检查跨读取实例的成功槽、配额/超限保留旧槽、篡改缓存拒绝，纳入统一入口。L09真实IndexedDB保存后模拟API503并整页重载，验证离线旧资料及原recipe保存不变，恢复在线刷新；L10仅对独立学习DB的put注入QuotaExceededError，在线视图仍current、localStorage全部键值不变，恢复put后缓存成功。损坏缓存与无IndexedDB的完整UI路径、历史定稿快照持久化不由这两项代替验收。

方法登记差异：learning-diff.test.mjs四项覆盖重排/改名/分类变化、增加重复帖子不改旧锚点、精确重复隔离、来源位置变化需核对、新增撤回和真实原库幂等。L07签名fixture新增一个保持来源锚点的方法改名，断言“修改1”且recipe不变。这里只读比较身份，不验收旧scanner ID迁移。失败报告新增cache/notice/version诊断；L09/L10先明确等待缓存准备成功，若已明确失败则进行一次用户式刷新重试，仍失败就保留FAIL，不加无限重试或放宽断言。

L11/L12补缓存负向UI：分别在新隔离context禁用IndexedDB、以及写坏学习DB自身last槽；只拦截这两个context的游戏iframe为学习专用空页，故不以此宣称游戏运行通过（真实游戏由S07/G01等另验）。验证在线无缓存仍可读、离线无缓存或坏hash明确error而非加载资料、在线恢复修复缓存、recipe存储不变；子页pageerror独立收集，失败保存子页诊断。初次失败状态必须显示“资料尚未加载”，不能仍显示“正在读取”。缓存超时消息增加mode/phase，cachePreparation记录是否发生前置准备重试；不能凭本轮未复现就关闭旧超时问题。

缓存适配器生命周期：learning-cache.test.mjs新增三项可控时钟测试，同步open抛错必须立即清理deadline；超时后迟到的upgrade必须abort、迟到onsuccess只close不发起事务；活动事务超时必须abort/close，不能发布已读但未提交结果。L13在单独学习context使IDBFactory.open同步抛SecurityError，验证在线资料及再次刷新仍current，采集子页pageerror。L13使用学习专用iframe隔离，不能代替S07/G01实景。同步open定时器泄露与此前间歇缓存等待不是已证同一根因。

场景分层工作流：S14验证初始九段场景层、无横向溢出、中央选载具联动左栏/右参数、加入水方法插在原水节点之后、同层节点归轨道、撤销恢复14节点、生命层选中后滚到管线顶部、搜索生命包含天气/植被/动物。新增插入位置单元验证不重排旧节点。S01检查扫描辅助区默认折叠；S12检查三种载具直接作为场景能力出现（状态可以待适配），不再强求在扫描方法抽屉中找它们。单纯分类计数不是分层交互验收。

媒体预览：learning-video-card.test.mjs两项验证内容标题/中文项目状态与去帧数前缀/长度限制；L14检查真实笔记缩略图解码、中文内容标题、项目标签、404缺图占位及方法行对应帖子缩略图。原L04继续验证播放关闭，L03验证加入/定位。真实图库复用，不计新视频学习；无关联方法分支有明确文本，后续可补专门fixture，不能把缩略图加载当实景效果或算法通过。

S15按钮职责回归：断言重复after/编辑/验证保存/返回入口不存在，实时能力只有一个入口；真实游戏手动切昼夜，再保存场景草稿，版本数恰好+1，settings.time与recipe.settings.time不同而编码检查通过，说明保存不隐式apply。草稿与定稿打开本页面板；建造撤销名称明确。只在隔离context定稿，不写用户场景。

浏览器时序诊断（2026-11-05）：不扩大12秒交互期限来掩盖失败。根context为真实页面及iframe注入有界PerformanceObserver，最多保留20项最长longtask；失败记录各frame的页面年龄/readyState/visibility和longtask，结束前保存同类证据。L07记录fixture/restore阶段、初始/fixture快照ID与命中次数，以区分并行来源变化、测试状态和主线程停顿。longtask是相关证据，不能单独证明超时根因；旧失败目录保留。

S16草稿配额失败：在已连接真实游戏的隔离context，先经版本面板对当前已保存实验做测试定稿，并断言非空finals，再经现有同源capture消息读取World/实际settings/recipe/locks；仅对iframe Storage.setItem的tm.scene-authoring.v1键注入QuotaExceededError。点击唯一草稿保存入口，断言顶部及版本面板同步报告保存失败、编码“未保存”，全部localStorage键值及capture结果完全一致。finally恢复原setItem，再保存一次应仅新增一个版本、已有非空finals不变。保留draft-quota-failure.png；此测试不模拟磁盘断电或跨设备存储恢复，不代表用户已定稿。

S17固定版本运行：依赖S07/S09/S15/S16/S10准备隔离定稿；将测试工作区设为不同的有效场景模式编码（只改编码头的场景模式位，不产生几何），从版本面板真实按钮获得新窗口，读游戏既有morrisViewer.sceneVersion只读状态，断言loaded ID/World编码/实际settings精确匹配所选定稿、dev=0且无编辑菜单。再开缺失ID窗口，断言loaded=null、失败与工作区回退提示、实际工作区标记、版本记录/工作区存储不变。两个窗口均真实加载游戏，finally关闭并恢复测试工作区；固定版/缺失版截图分别保存。不计代码/资源冻结、跨设备分享或玩法性能验收。单独定向命令需包含前置ID，不能只跑S17后把缺fixture记产品失败。

运行时探针等待必须同步判定：先用evaluate完成只读模块import，再用同步waitForFunction检查游戏__tm及sceneVersion函数，并在同一轮取得快照句柄。不要在waitForFunction谓词里返回Promise来等待ready。本机Playwright coreBundle实现对predicate()返回值直接作truthy判断，Promise会提前结束轮询；首次S17因此在游戏未就绪时读函数失败，属于测试错误，失败报告保留。探针通过不等于开始送信、进入湖区或玩法验收。

独立启动诊断（不与回归浏览器并行）：`<node> TigerMessenger/tools/scene-authoring/profile_workshop_startup.mjs <全新证据目录>`。启动独立非持久context，从#learning加载真实游戏iframe，用CDP Profiler以1000微秒采样，等待真实游戏连接后停止；保存startup.cpuprofile、profile-summary.json（self/inclusive采样时间、frame长任务）、profile-learning.png。CAPTURED仅表示取证成功，绝不能填成功能矩阵PASS或玩法性能验收；CPU采样存在开销，不能直接与未采样的秒数比较。脚本不清理浏览器数据、不提交Source任务。原始profile留本地，JEV只接收紧凑文字摘要。失败/部分profile同目录保留；不得反复并发采样给系统制造负载。

CPU窗口归因：profile-summary中的NavigationStart为CDP单调秒，CPU profile.startTime/timeDeltas为同一时钟微秒，longtask.startTime为文档相对毫秒。脚本只对父文档最长五项做近似样本窗口归因，输出longTaskStacks/topCallers；不是所有iframe独占长任务的完整覆盖，也不是精确函数耗时计量。frames附带原始长任务及游戏启动阶段标签供交叉核对。首次只有累计热点的采样与新增窗口归因后的重测分目录保留；不得以CAPTURED填PASS，不把两个有采样开销的启动秒数当性能前后对照。

S18真实悬铃树对象：前置S07显式切回场景页（避免定向L01遗留学习页），等待实际游戏__tm和目录中4棵悬铃树记录（目录还包含其他植物）；从辅助目录选桥边悬铃树，检查稳定ID、局部非空Box3高亮、右侧对象名称、全局应用停用与返回恢复；前后比较实际World/settings、树位置/缩放/旋转、recipe及全部localStorage均不变。保存对象卡与实景单独截图，必须实际看树/框，不能以“marker存在”代替视觉通过。S08/S13/L05/G01分别复查旧编辑器、蓝栏、移动布局、干净游戏；新S18不能冒称单物件编辑/保存已实现。
植物工厂保真补证：artifacts/workshop-tests/scene-object-geometry-parity-20261106/check.mjs仅在隔离工厂fixture中比较HEAD原morrisBotany与当前工厂全部合批几何attributes/index SHA、材质、树transform和原report，额外检查4棵局部选择边界非空。不是完整游戏测试，HEAD基线commit写result.json。该文件result为最终局部边界版本重测结果（早期同fixture输出未另存文件，不当两份证据）；不回滚工程文件、不改原REA。首次浏览器功能通过但镜头为空海面及之后world AABB框过大的截图保留，最后须以局部有向高亮截图验真。

S19对象查看生命周期：前置S07/S18，依次选择桥边与湖岸2号树，刷新列表并切学习工坊后返回，确认选择/只读范围与同一iframe保留；任何时刻仅一个高亮。通过geometry/material的dispose事件分别确认换树和进入编辑各释放一个暂态框（合计各2），进入编辑清掉对象范围、重新开放场景应用和原编辑器。前后World/settings、recipe与全部localStorage相同。此项验证查看/退出和资源生命周期，不能当移动树或对象修改持久化通过。

S20实际画布点选：从辅助目录先定位桥边树，按几何边界投影出可见冠层位置，开启实景点选并用Playwright真实canvas pointer点击；等待选择模式结束及“从实景选中”事件，验证plane-tree类型。再定位目录中的柏树并实际点击，验证cypress类型/名称不同。测试不是直接调用选择命令伪装点击；目录定位仅准备相机。退出后实际World/settings、recipe及localStorage不变。S21单独无游戏bootstrap的Three fixture验证合批顶点区间边界命中、两个实例的不同ID和实例矩阵边界（minX 2.5/11.5），geometry坐标不变；该fixture不能替代S20真实游戏交互。
