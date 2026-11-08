# 双工坊优化与测试记录

## 2026-11-04 16:14上海：学习快照接入页面

本轮实际08:14UTC核对最新聊天、交接和工作树，不补造排队轮次。learning-workshop改用同源API与受限解码器，三视图使用同一局部data，不执行原库classic脚本。learning-progress先构造临时DOM，再commit资料与进度；失败保留本页旧资料/snapshotId并标stale，初次失败标error。刷新按钮更新全部资料，60秒内切页复用、之后进入重检，pending合并请求；配方和iframe不重建。

首轮定向learning-snapshot-ui-20261104为4PASS/2FAIL：L07测试split等号截断源码已改slice；L03发现返回学习后按钮使用状态未重绘，已修复。修复后learning-snapshot-ui-final-20261104六项PASS/pageErrors0，覆盖API503保留旧数据与签名fixture三视图/进度同版本更新。fixture仅独立context，不改原库。最终提交顺序调整后整套20261104T081809380346Z执行中。跨重载离线缓存、生产者事务、依赖hash与升级候选仍缺。无用户存档或模型操作、无提交发布。

记录规则见WORKSHOP_GUIDE/WORKSHOP_TEST。保留原失败和重测；以下时间均按Asia/Shanghai标明，证据目录名为UTC。未来每轮追加，不覆写历史。

## 2026-11-04 首轮周期体系及学习进度联通

用户授权每两小时测试优化；已创建automation-2（双工坊每两小时测试与优化），不动其他学习与归档任务。建立WORKSHOP_GUIDE/WORKSHOP_TEST及可执行test_workshops.py、workshops-browser.mjs；AGENTS增加接手入口。文档列已测与未测全功能矩阵，不能把覆盖清单当全通过。

- 背景：8931为uvicorn，前轮修复未挂载原库路径导致扫描404，本轮加入真实404重试回归。
- 优化：新learning-progress.js直接读取与原库index/pipeline相同的coverage.json/coverage-progress.json，进入学习页与手动刷新读取，展示更新、计数、最新批次、完成记录、缺口、证据；learning-workshop.js接入。不拷贝原库数据、不改其他学习任务。
- 用户新增要求：学习持续接入设计及测试文档。新增pipelineLearningGuide.md/pipelineLearningTest.md，划分P0共享进度、P1一致快照、P2更新收件箱/稳定ID、P3适配器验证、P4隔离升级候选、P5固定代码资源版本。明确当前实现与待落地、接口/数据/冲突/失败/验收和接手第一动作。
- 证据：artifacts/pipeline/scene-authoring-20261103/learning-progress-sync.json与learning-progress.png。原库与新工坊updatedAt及latest一致；当前双格房屋工程批次；截图已实际查看，无页面异常。
- 统一测试首轮：artifacts/workshop-tests/20261103T181045094418Z。16行为+4代理+5watchdog通过，浏览器视频关闭异步等待不足引发后续切页失败，保留原报告。修正测试等待，不改产品关闭逻辑。
- 第二轮：20261103T181223170275Z，单元/代理/watchdog均过；浏览器16通过/1失败、pageErrors0。失败为测试点击工坊中刻意隐藏的旧收起按钮，已改为实际editor-dock折叠summary。实际游戏连接61秒、版本保护、离线编辑、干净游戏启动均过。最新修正及新增L06正在下一独立目录全量重测，结果以该目录summary/browser为准，未结束前不能称全过。
- JEV：workshop-cycle-jev.json实际调用成功，明确完整浏览器最终重测、真实Worker与玩法验收仍缺。文本分类不是验收。
- 保护：隔离新context，不使用用户profile，不动湖上建筑原存档；无提交发布，无自动造山、无真实模型提交。
- 遗留：WORKSHOP_TEST矩阵内体素鼠标编辑、完整顶部破坏性工具、所有参数实景逐项、固定新窗口加载、遥控互动/通行/性能等仍需逐步补；真实Worker无模型，不能称全功能验收。
- 下一动作：先读最新重测结果修复首个真实问题，再按pipelineLearningGuide P1做只读一致快照+并发更新测试，原库内容生产由另一automation负责，禁止重复视频学习。

### 本轮新增进度同步验收
第三次完整运行目录20261103T181559439292Z已通过新增L06：原库updatedAt/latest相同、模拟503显示失败、恢复后刷新成功。新增进度卡影响原测试的泛`.learning-card`定位，视频用例误展开进度卡而未展开视频记录，已收窄到`.learning-content .learning-card`；这是测试定位修正，原失败保留，仍需最终重测。工坊折叠改为实际dock后S08通过。设计与测试文档明确P1一致快照尚未实现，不把进度同步当全部能力热更新。

视频定位修正后定向实际重测：artifacts/workshop-tests/learning-targeted-20261104/browser.json，L01/L06/L04三项通过、pageErrors0，其余NOT_RUN。验证视频真正readyState>=2并关闭释放src；进度一致及503重试通过。不把定向结果改写成原整轮全绿。

### 本轮结束核对
第三次整轮最终：20261103T181559439292Z，16行为/4代理/5Watchdog全过；浏览器17通过/1测试定位失败、pageErrors0，干净游戏启动通过。唯一失败为视频卡泛选择器，修正后定向3项全部通过；整轮原报告保持FAIL，不伪造全绿。最新脚本已修正并支持定向NOT_RUN记录。完整suite下轮继续验证，其余人工/未实现项仍按矩阵保留。JEV learning-guide-jev.json实际成功，仍标记P1–P5实现和完整用户验收缺失。无残留本轮测试进程。


## 2026-11-04 04:11上海：场景层分类修正（automation-2）
最新用户指出能力库将14场景节点和198扫描底层方法铺成长列表，缺乏场景管线分类。本轮优先处理用户反馈，不先做学习快照P1。新增capability-library.js：十场景用途入口、生命/烟火/载具子类、可用能力与折叠待适配方法分区、搜索跨层与无匹配提示；来源lane/group不改写，未知基础工具保留待归类。studio接分类组件，pipeline节点增加父层标识；撤销后所选节点若已不在配方则回到有效节点，避免inspector残留未加入方法。样式增加分类格和分层内容，保持真实编辑器与浅蓝栏。
新增2项分类行为测试纳入统一入口；当前18行为+4代理+5watchdog已过。定向真实浏览器S01/S02/S03/S12四项通过、pageErrors0（library-categories-20261104），真实扫描此时199条，不硬编码数量。截图已实际查看：左侧十入口、生命天气/植被/动物可用能力及27待适配方法默认折叠；画面为隔离存档开始遮罩，不当游戏验收。整轮目录20261103T201316502438Z执行中，最终结果待核对；定向结果不等全功能通过。原库内容并行更新保持不动，用户存档未操作、无提交发布。

本轮最终：20261103T201316502438Z整套unit/source-bridge/watchdog/browser均PASS（18行为+4代理+5Watchdog；浏览器18项PASS、pageErrors0）。新增S12与最后选择状态修正定向重测library-categories-final-20261104为4PASS/pageErrors0；整套在新增S12前启动，分类新用例由独立定向证据证明，不将两个报告伪装同一套。现有整套全绿不代表矩阵人工/未实现项验收。JEV本轮evidence/jev在整套目录。下一轮优先继续学习接入P1与未覆盖编辑交互，保留当前分类设计。


## 2026-11-04 06:13上海：学习接入P1后端基础（automation-2）
核对实际UTC22:13、最新聊天与交接后，先启动统一回归，保持上一轮场景分类。推进pipelineLearningGuide P1：新增backend/learning_snapshot.py和main.py只读learning-snapshot路由，七文件固定白名单、内容SHA版本、目录外symlink/大文件拒绝、核心JSON检查、可选缺失标记、观察到并发变化则有限重试409；ETag/304实际验证。只返回原始JS文本，不eval；不接触用户场景/模型认证。稳定双读并不等于生产者批次事务，Guide已说明需要generation manifest，前端消费、ARCH安全解析、模块依赖hash仍待完成，不宣称P1全部落地。
5项临时目录测试通过并已纳入下次统一入口；本轮实际API200、7文件、条件304，sourceUpdatedAt读取原库05:58上海，报告snapshot-api.json在本轮唯一目录。原库学习生产并行改动不动。无美术/渲染变更，不以旧截图冒称新验收；浏览器套件最终结果/JEV待核对。

本轮最终：唯一目录20261103T221413518532Z，现有18行为/4代理/5Watchdog及19项浏览器全部PASS、pageErrors0；新增后端5项测试单独learning-snapshot.log/result通过（总32本地检查，不伪称启动时尚未加入的新测试在原summary中）。真实API200、弱ETag条件304重测成功；weak ETag用于排除fetchedAt变化后的语义版本缓存。JEV实际调用成功，明确前端消费和生产者事务仍未验证。实际查看本轮workshop.png：场景分类、迁入菜单和实验面板可见；测试Source断线提示属于故障模拟，测试定稿仅隔离context；不是用户场景验收。发现原顶部图标栏对比度偏低，下一轮优先核对其浅蓝样式是否被原CSS覆盖，再继续P1前端解析与版本切换。后端本轮未改视觉，未声称新视觉验收。自动任务保持active，无提交发布。

## 2026-11-04 10:15上海：原浅蓝工具栏对比度修复（automation-2）
本轮实际检查UTC02:15，对此前排队08:15 heartbeat不补造施工记录。依据最近交接优先修复已观察的顶部图标栏暗底暗图标：studio.css通用两ID+.panel的!important背景优先于原两ID浅蓝规则，导致底色被覆盖而图标仍为深色。增加完整HUD作用域三ID的浅蓝栏与深色图标/蓝焦点覆盖，删除失效的旧浅蓝重复块，保留原DOM/按钮事件。无场景或原库内容变化。
新增S13真实computed-style/对比度及焦点截图回归，矩阵明确程序focus不等于完整键盘可达性测试。统一入口运行唯一目录20261104T021525489910Z；5学习快照+18行为+4代理+5Watchdog已通过，浏览器仍执行中，以最终报告为准。不重复实现P1未完项，先确保用户认可的工具栏视觉回归不再丢失。

本轮整套最终已通过：20261104T021525489910Z为32本地检查、20浏览器案例PASS、pageErrors0；S13实测浅蓝rgb(227,243,251)、深色图标rgb(23,55,68)，对比度11.09，9个原按钮。toolbar.png已实际查看，浅蓝图标可读。截图还揭示同一通用.panel优先级也将圆角压成5px，因此同作用域补回获认可14px圆角/8px内边距，并新增圆角断言，最后定向S07/S13正在toolbar-final-20261104验证；不覆盖整套旧结果。JEV实际调用成功，完整键盘可达性与真实Worker/玩法验收仍标未测。

最终定向toolbar-final-20261104：S07/S13两项PASS、其余NOT_RUN、pageErrors0；14px圆角断言通过，最终toolbar.png实际查看，浅蓝圆角/原9图标已恢复。无残留测试进程。本轮未触碰原用户存档、REA原版、学习生产或其他自动任务，无提交发布。下一轮按pipelineLearningGuide推进P1纯声明安全解析/前端版本刷新及矩阵未测项目，保持获认可工具栏的完整HUD作用域覆盖。


## 2026-11-04 12:14上海：P1纯声明解析和快照准备（automation-2）
先核对实际04:14UTC、最新交接/矩阵/并行改动，保留场景分类及浅蓝栏。继续P1所缺ARCH安全解析：新增learning-declaration.js有限数据语法解析，无eval/Function/script，支持当前原库注释/单引号/裸键/尾逗号；代码表达式、原型键、重复键、尾随程序、深度与大小越界均拒绝。新增learning-snapshot.js按七文件hash/版本/缺失清单/更新时间一次解码，不更新全局、配方或DOM；错误返回前不激活部分数据。六项真实源码+恶意/损坏fixture测试通过，已加入统一入口；时间metadata补校验后另重测六项通过。真实8931 API到decoder端到端200、7文件SHA通过、39模块/243记录/7lane、源进度12:01上海；本轮目录snapshot-decoder-api.json留证。
当前没有切换工坊实际UI读取路径，所以不称页面已按同一snapshot刷新。生产者事务generation、依赖源码hash与完整嵌套schema还缺，Guide和Test已明确。下一步接UI准备值一次提交/保留旧数据/错误回滚，并更新L06 API故障测试。原库只读、不重复学习视频、不碰用户浏览器/模型凭据，无提交发布。整套回归执行中以最终summary为准。

本轮最终：20261104T041646364263Z整套38本地（5后端快照+24Node行为含新6项+4代理+5Watchdog）、20浏览器PASS、pageErrors0。sourceUpdatedAt最终校验修改后新6项另写decoder-final.log，实际API端到端snapshot-decoder-api.json通过；JEV实际成功，保留UI提交/离线回滚/生产者事务缺口。本轮toolbar.png实际查看：获认可浅蓝圆角与图标仍在，未改变场景渲染，不把复查当新美术验收。无残留本轮测试进程；下一条动作明确为将已验证准备值接入工坊，并补API失败保留旧视图/并发刷新/三视图同版本浏览器测试。

本轮最终：20261104T081809380346Z整套38本地检查/21浏览器PASS、pageErrors0，最终prepare进度DOM后再commit的实现已在整套验证。实际新页live-learning-snapshot.json：资料与进度snapshotId相同、current、原库脚本执行数0，源批次15:58上海；截图已实际查看。JEV实际成功，仍标跨重载离线缓存/生产者事务/依赖hash与真实Worker场景升级未测。截图发现上游证据链接/后续任务持续增长，进度卡已撑满首屏，下一轮优先将证据及缺口分组折叠，保持当前批次与资料入口易找，再补缓存/稳定ID差异。无本轮残留测试进程，无用户数据或原库写入，无提交发布。

## 2026-11-04 18:15上海：学习进度首屏整理（automation-2）
实际10:15UTC核对最新交接、矩阵、工作树。本轮针对已观察的原库证据/缺口增长撑满首屏：learning-progress将证据实景入口、完成记录、后续学习缺口分三组默认折叠，摘要显示三行并可展开完整说明，主来源链接保留；刷新保留三组打开状态。studio.css桌面三列、窄屏单列，长ID和链接换行。没有改原库学习生产、来源或配方。
新增L08首屏可达性/展开链接/刷新状态测试，先启动整套20261104T101623243704Z；摘要补可展开完整说明后定向learning-folders-final-20261104的L01/L08两PASS/pageErrors0，测试已修正为先scrollTo(0,0)再断言页签首屏，避免自动滚动产生假通过。实际查看最终截图：54证据入口、111完成、24后续任务默认折叠，最新批次与资料页签/搜索和系统流程同在首屏。其余未执行人工项目不标通过，等待整套最终和JEV记录。

本轮最终：20261104T101623243704Z整套38本地检查/22浏览器PASS、pageErrors0；最终完整说明与严格首屏断言另定向两PASS，证据learning-folders-final-20261104，未伪装成同一轮。JEV实际成功，保留跨重载缓存/生产者事务/依赖hash/真实Worker升级缺口。截图已查看，来源记录没有因简洁而删除。下一动作回到P1跨重载离线最后成功快照与配额失败，先测试不挤占用户场景存档；再接P2稳定来源ID/差异收件箱。无残留本轮测试进程，automation-2继续，无提交发布。

## 2026-11-04 20:15上海：跨重载离线学习缓存（automation-2）
按12:15UTC实际时间核对Guide/Test/最新交接及并行工作树。新增learning-cache.js独立IndexedDB单槽，1.5MiB上限，原始snapshot读写校验，不读写/清理场景localStorage或其他DB。UI成功提交后异步缓存；失败显示未保存但在线继续，API失败且本页空时读缓存、再校验并标离线旧资料；已有本页资料则保留。IDB三秒/请求十五秒超时，不自动申请持久化权限。旧槽因配额/事务失败保持；单槽不是定稿历史引用，不宣称历史资产冻结。
新增三项缓存单元、L09离线整页重载恢复与L10学习DB专用put模拟配额，全部已初步通过；L10核对localStorage所有键值不变。完整统一目录20261104T121739789361Z仍在运行，以最终报告为准。Guide已重写旧“无跨重载缓存”说明；损坏/无IDB完整UI路径、生产者事务/依赖hash和P2稳定ID尚缺。原库只读、无用户profile操作/模型调用/提交发布。

本轮最终：20261104T121739789361Z整套41本地检查/24浏览器PASS、pageErrors0；补离线截图后另定向learning-cache-final-20261104三PASS，其余NOT_RUN。learning-offline.png已实际查看，离线旧资料、缓存保存时间/来源批次和资料视图可见；在线重试及配额恢复有行为断言，不把截取时的刷新中按钮状态当死锁。JEV实际成功。没有触碰用户profile/场景localStorage；L10模拟仅针对学习DB，后已恢复。下一步按P2先补稳定来源ID和新增/修改/撤回差异，保留生产者generation/依赖hash与真实Worker缺口，损坏缓存/无IDB完整UI路径仍需补。无残留测试进程、无提交发布，周期继续。

## 2026-11-04 22:13上海：P2只读方法登记对照（automation-2）
实际14:13UTC按最新交接启动。新增learning-diff.js：帖子/toggle/来源位置生成比较锚点，名称与排序不影响身份；条目/lane/group改变列revision。重复/无锚点及来源位置潜在移动列冲突，不猜迁移；前后重复冲突合并，不双计数。页面按本页或最后缓存的可信基线展示新增/修改/撤回/需核对折叠区，注明只比较登记、代码依赖未纳入；不改scanner旧ID/recipe/定稿、不删除撤回节点。
新增四项纯差异测试通过纳入入口；L07签名fixture方法改名断言“修改1”，三个定向项通过（learning-diff-final/visual），修正后含缓存的六项定向learning-diff-cache-recheck-20261104全部PASS。首次整套20261104T141636333069Z为45本地PASS、浏览器22PASS/2FAIL：L09/L10等待缓存成功超时，原报告缺诊断，定向无法重现，不能推断已定位产品根因。新增失败时cache/notice/version证据，并为缓存前置条件设置一次明确刷新重试，仍失败即FAIL，禁止无限等待。最终独立整套重跑中，以最新目录summary为准。
Guide已标这是只读比较身份，不是旧ID自动迁移或完整升级收件箱。生产者generation、源码依赖hash、审核回执仍缺；原库和用户profile不动、无模型调用/提交发布。

本轮最终：第二套20261104T142216829051Z为45本地检查/24浏览器PASS、pageErrors0；首次22PASS/2缓存等待FAIL保留，不能把一次重跑绿说成初始缓存等待根因已解决。六项含缓存定向也PASS，测试新增失败诊断和一次明确准备重试。最新签名fixture截图已实际查看，“方法登记更新：修改1”与比较基线、4个需核对来源显示正确；这是测试fixture，不是宣称真实库只改了1项。JEV实际成功，缓存初始等待若复现优先凭诊断定位；旧ID迁移/生产者generation/依赖hash/审核回执/Worker升级仍缺。下一轮先补损坏缓存/无IDB页面路径及缓存时序诊断，再推进持久身份映射与审核，禁止自动迁移用户节点。无残留测试进程，无用户或原库数据改动/提交发布，周期继续。

## 2026-11-05 00:16上海：缓存负向UI与时序诊断（automation-2）
实际16:16UTC核对最新交接/矩阵/工作树，优先补上一轮缺项和未定位缓存时序。learning-cache超时消息增加readonly/readwrite及opening/transaction/commit阶段；测试cachePreparation记录初始状态及是否发生明确重试，不修改生产重试策略、不假称修好根因。
新增L11新context无IDB：在线资料可用/缓存未保存，离线重载明确error，回场景管线仍可导航，恢复在线可读；L12只破坏测试学习DB的last槽，离线hash拒绝而不显示部分资料，在线刷新后重新校验缓存通过，recipe不变。这两个子context特意隔离游戏iframe以检验学习错误，不当真实游戏验收；根context原S07/G01继续实景测试。新增子页pageerror与失败诊断。初轮两负向PASS后观察到初次error下统计仍提示“正在读取”，补progress onError回调让未加载页显示明确待重试，最终定向learning-cache-error-state-final-20261105两PASS/pageErrors0。
整套唯一20261104T161748621327Z在回调修正前启动，最终状态另核对；新的定向证明最终错误提示状态，不覆盖先前报告。cachePreparation本轮两次均已缓存且retried=false，旧超时根因仍未复现/未定位。无用户profile/原库改动或模型操作，无提交发布。

本轮最终：20261104T161748621327Z整套45本地检查/26浏览器PASS、pageErrors0；初次error统计提示修正后两负向定向learning-cache-error-state-final-20261105为两PASS，已采子页pageerror和诊断。corrupt-learning-cache.png实际查看：错误与“资料尚未加载”一致，无半份资料，图为隔离损坏缓存模拟，不是当前真实服务故障。JEV实际成功。缓存准备两次均retried=false；旧超时根因仍开放，不能据本轮通过关闭。下一轮按P2补审核回执/身份映射的可测试契约，若缓存时序复现先据mode/phase和子页诊断处理。无残留测试进程，无原库/用户数据改动或提交发布，周期继续。

## 2026-11-05 02:15上海：存储拒绝与超时资源生命周期（automation-2）
按18:15UTC实际轮次读最新交接/矩阵/工作树。围绕仍开放的缓存时序审计适配器，增加可控时钟测试并真实复现同步IndexedDB.open抛错后deadline残留（pending=1而预期0），before.log保留失败。learning-cache将同步open异常交finish统一清理；超时后的迟到upgrade主动abort，迟到成功只关闭DB，不再发起新事务。三新生命周期测试及原三缓存测试全PASS，after.log留证。此处只证明同步拒绝资源泄露已修，不能推断先前间歇缓存等待就是这个根因。
整套20261104T181700092799Z为48本地检查/26浏览器PASS、pageErrors0，缓存准备本轮均成功无重试。新增L13同步SecurityError在整套启动后加入，和L11/L12另定向cache-lifecycle-browser-denial-final-20261105三PASS，不能算原整套已有27项。阶段证据cache-lifecycle-20261105的before/after；另一次早期定向只有L11/L12两项，保留，不冒充三项。没有改用户profile/原库/模型，不提交发布。

本轮收尾：JEV实际成功，仍将旧缓存等待根因/旧ID迁移及Worker升级列缺口。toolbar.png实际复查，分类、原菜单和获认可浅蓝圆角栏保留，未声称新美术验收。缓存准备均已成功retried=false，不能以此关闭旧间歇问题。下一轮可继续P2持久映射/审核回执契约；若旧时序复现优先取phase诊断。无本轮残留测试进程，无用户/原库写入、提交或发布，周期继续。

## 2026-11-05 用户再次纠正分类：中央管线重构
用户指出分类和设计仍不符合场景工坊。本次确认之前只重整左栏，中央仍14卡横向长队；现改按真实配方顺序编号的层导航与连续层轨道，生命三类/烟火两类/载具三类同层展示。左右分类及中央选层联动inspector，新能力插同层末尾，原配方不自动重排，保留撤销。节点选择只滚管线内部并将选中层置顶，旧RAF已断开节点忽略，避免整页跳动。
场景能力与扫描方法重新分开：静态船/飞行器/车等即使待适配也直接显示；只有扫描底层方法进方法抽屉。来源扫描默认折叠，左侧显示10分类，搜索包含层名/子类。缩短上下文标题、两工坊导航sticky、实景紧接管线、原菜单版本dock放实景后，未改原游戏模型或用户存档。入口资源scene-layers-r2版本用于更新UI。
新增同层插入单元和S14；两轮整套20261104T183513042995Z及20261104T183817890073Z均49本地/28浏览器PASS/pageErrors0。最后静态待适配槽直接显示、选层置顶和搜索别名改动有独立5项定向scene-layer-selection-search-final-20261105 PASS，不能冒充在旧整套开始前已测试；最终classified-workshop-final.png实际查看，层导航箭头、生命三节点和天气参数清晰可见。JEV实际成功，用户美术/玩法认可和真实AI生成未验收。Guide/Test已更新，其他旧缺口继续保留，无原库/用户profile写入、提交发布。

## 2026-11-05 用户要求视频缩略图（含方法行）
先完成重复按钮只读审计：preview/after完全相同，编辑/游玩意图重叠，验证保存入口副作用不同，保存/撤销存在独立数据范围；误导版本链接需定位本页。audit证据button-audit-20261104T190609Z，JEV实际调用，未在本轮盲合并按钮。
按最新截图给视频与笔记加图文卡片，给管线方法行加对应来源缩略图；共用learning-video-card.js，直接读取原库thumbs，不重学视频/造图。标题从既有笔记/原文提取，ID次要；项目/主题/状态可读；缺图404或无视频关联显示文本。保留原播放/展开/加入操作，未新增重复播放按钮。两项展示单元和L14加入统一入口。
定向learning-thumbnails-20261105五项PASS，真实查看攀爬架缩略图与网格线框缩略图，均与源ID对应；源other/na明确标其他内容/不适用，不冒充场景能力。整套20261104T190937167097Z为51本地/29浏览器PASS、pageErrors0；额外video-card-preview.png和method-card-preview.png裁取真实组件便于用户查看。媒体JEV另存该目录，原库/用户存档不动、无模型调用/提交发布。下一轮优先按钮职责收敛与错误版本链接，保留来源、建造、完整实验不同保存语义。

## 2026-11-05 08:26上海：按钮职责收敛验真与刷新超时诊断
实际UTC00:26接到本轮，未为排队heartbeat补造施工记录。先核对AGENTS/Guide/Test/Log/交接和并行状态；继承上轮未收尾按钮改动，未回滚原库/其他模块改动。
按钮去重已落地：移除after、版本区重复编辑/保存、迁入的返回玩家入口；保留单一应用实时能力、实景编辑/游玩检验、保存场景草稿。保存草稿共用session保存实际World/settings/recipe/goal且不隐式apply；配方保存与建造保存独立，撤销标明管线/建造；草稿与定稿定位本页。Guide重写旧待整理说明。
历史20261104T202416161457Z为51本地PASS，浏览器28PASS/2FAIL（L07/S06超时），S15实际已PASS；最初定向选择器/固定节点数测试失败仍保留。当前统一入口20261105T002631595675Z：51本地PASS、29浏览器PASS/1FAIL（L07刷新waitForFunction超时约31秒）、pageErrors0；S06本轮PASS，S15保存实际dusk/配方day、版本恰好+1，S10隔离定稿/G01真实游戏入口PASS。不能宣称全功能全通过。
新增验证改进：根页面和真实游戏iframe有界longtask记录（最长20项）、失败/收尾frame年龄和页面状态；L07记录fixture/restore阶段与快照ID/请求命中次数，不放宽12秒交互时限。新诊断代码的学习定向3PASS及包含前置场景操作的10PASS，分别learning-refresh-diagnostics-20261105T0031Z、learning-refresh-sequence-diagnostics-20261105T0030Z。目录名是唯一标签，真实startedAt以报告为准，不以名称推算时间。两次fixture命中1、成功恢复；定向长任务最长约2.9秒，不足以解释完整套件31秒失败。尚未在失败当轮捕到新诊断，根因仍开放；下一轮优先整套带诊断复现，区分fixture/restore、并行来源变化与主线程停顿，不盲加超时或取消用户场景。
实际查看本轮consolidated-scene-actions.png：浅蓝九图标栏保留，实景下一个草稿保存、编辑/版本dock与本页入口；画面为隔离测试世界，不能冒充用户已恢复建筑群。JEV实际紧凑文字调用成功，iteration-evidence/iteration-jev.json在本轮目录；明确完整回归和玩法/Worker缺口。无用户profile/REA/.workbuddy写入，无新视频学习、模型执行、自动造山或提交发布。原Worker零模型/未验收等已知缺口不因Source状态升级。周期继续。

## 2026-11-05 10:24上海：带诊断整套复测与草稿配额失败提示
实际UTC02:24开始，先读AGENTS/Guide/Test/Log/交接并核对并行工作树。统一入口20261105T022419848592Z：51本地PASS、30浏览器PASS、pageErrors0。L07 fixture命中1，更新与恢复都成功；旧间歇超时不因此关闭。记录到父页/游戏iframe最长longtask均9654ms，仅说明有长停顿，不证明历史31秒失败根因；保持12秒交互期限，不放宽断言。
本轮新增S16存储负向回归：仅在独立context游戏iframe的tm.scene-authoring.v1写入注入QuotaExceededError，通过同源capture比对World/实际settings/recipe/locks，并比对localStorage全部键值，失败均不变；恢复原setItem后重试只新增1版，finals相等。此fixture未单独建立非空定稿指针，不能宣传已覆盖该分支。首轮draft-quota-20261105T0227Z六项PASS，但实际看图发现版本面板仍残留上次“已保存”文案，顶端失败与其矛盾。
修复workbench.js的onSave catch，同时更新版本面板失败提示，明确未新增版本；后续提示尾句改成通用“检查原因后重试”，适用于验证及存储错误。S16新增面板失败断言。draft-quota-status-final-20261105T0229Z六项S07/S09/S15/S16/S10/S11全PASS、pageErrors0，截图实际复查顶部和版本面板均报告失败、编码未保存、浅蓝栏仍保留。最终尾句通用化发生在该测试页面加载后，截图仍为存储专用尾句；失败状态同步逻辑及断言已实测，不冒充截图逐字对应最终尾句。全套30浏览器发生于本修复前，最终修复有6项受影响定向回归，不能写为31项整套全过。测试和Guide更新，顺便纠正Test中P1页面一直未测的过期表述。
两份JEV紧凑文字调用分别在定向目录iteration-evidence/iteration-jev.json；最后一份明确记录新提示修复、旧时序及Worker/玩法缺口。未改用户浏览器/原库/.workbuddy，未新学视频、自动造山、提交或发布。下一轮：新31浏览器整套、继续抓L07失败阶段；补非空final指针的配额保护fixture；P2持久身份/审核回执和生产者事务等缺口继续保留。没有为凑频次改稳定场景。

## 2026-11-05 14:24上海：已有定稿的草稿配额保护补测
实际UTC06:24开始，仅执行当前轮次，不给排队12:21 heartbeat补造记录。已读AGENTS/Guide/Test/Log/交接、核对并行状态。统一入口20261105T062450367249Z：51本地PASS、31浏览器PASS、pageErrors0。包含上一轮最终通用失败提示，截图实际查看两处失败提示/编码未保存、浅蓝栏保留。L07 fixture命中1，更新和恢复均成功；记录最长longtask9659ms，仅为观察，历史学习刷新/缓存间歇超时根因仍开放。
本轮无产品实现变更：未复现新缺陷，不为频次修改稳定功能。针对交接的保护缺项强化S16：在同一隔离context先通过版本面板确认当前测试实验定稿，明确断言finals非空，再注入版本键配额失败。全部localStorage键值与capture的World/settings/recipe/locks均不变，恢复存储后显式重试只新增1版且已有finals不变，输出existingFinalPreserved=true。此前空对象相等不再充当已有定稿保护证据。
新定义定向draft-existing-final-quota-20261105T0628Z六项S07/S09/S15/S16/S10/S11全PASS，pageErrors0；其余NOT_RUN。新截图实际查看版本选项仍标定稿、两处保存失败、未保存编码及原浅蓝图标栏。全套31发生在S16强化前；强化后的六项单独记录，不混成全套新定义已过。Guide/Test更新了非空定稿前置条件。JEV实际紧凑调用存该定向目录iteration-evidence/iteration-jev.json；文字筛选不代替看图或用户定稿。
用户profile、湖上已恢复建筑群、原库/.workbuddy均未写入，无视频重学、自动造山、模型执行、提交发布。Worker/通行/玩法/性能、P2持久身份审核/生产者事务等未完成项保留。下一轮先跑强化后31项整套；优先补固定版本新窗口真实加载及不存在版本错误路径，继续抓旧超时失败阶段。automation-2继续，不动其他调度。

## 2026-11-05 16:27上海：固定版本实际运行补测，启动切页超时留证
实际UTC08:27开始，已读AGENTS/Guide/Test/Log/交接并核对并行工作树。统一20261105T082735293078Z：51本地PASS、30浏览器PASS/1FAIL(L04)、pageErrors0。强化非空final的S16整套通过。L04已完成视频播放/关闭，失败在随后点击场景工坊，约14.1秒。失败诊断游戏iframe的任务8726ms开始持续4093ms，12837ms开始持续9590ms，中间18ms，覆盖交互等待；父页也记录4.093秒任务。这是启动响应问题的新证据，不按视频文件坏归类，也不扩大12秒期限；尚无CPU调用栈，不能把它当旧L07/缓存问题的统一根因。
新增S17真实固定版入口：在隔离workspace写入与所选定稿不同的有效场景模式编码标记（只改编码头，不生成几何），点击版本面板按钮取得真实新窗口；比对游戏只读sceneVersion探针的ID/World/实际settings精确相等、dev0且无编辑菜单。再开不存在ID，确认loaded=null、明确失败/当前工作区回退、实际workspace标记及版本存储不变；finally关闭并恢复测试工作区。
首轮fixed-version-runtime-20261105T0831Z为7PASS/1FAIL(S17)，原因是新测试async wait谓词返回Promise而提前通过，读未就绪函数；本机安装Playwright coreBundle.js 23886处对predicate()直接truthy判断可证。探针改成先evaluate import，再同步wait游戏__tm/函数，并在同一轮取快照句柄。修正后fixed-version-runtime-readiness-20261105T0835Z八项L01/L04/S07/S09/S15/S16/S10/S17全PASS、pageErrors0，其余NOT_RUN；旧FAIL保留。L04定向过不关闭整套启动卡顿。
实际查看fixed-version-game.png/missing-fixed-version.png：顶部明确固定ID和失败/本机工作区两种状态，游戏仍有开始送信遮罩，不能当湖区视觉/玩法验收。当前仅场景数据/参数精确加载，同源localStorage仍是依赖；代码资源不可变发布包/跨设备分享未完成，Guide/Test明确边界与S17等待规则、矩阵更新。本轮无产品实现改动，未凭不完整性能证据动稳定渲染。JEV紧凑文字实际调用在修正定向目录iteration-evidence/iteration-jev.json。
用户profile、已恢复湖上建筑、原库/.workbuddy未写入，无新视频学习、模型执行、自动造山、提交发布。下一轮优先统一32项及启动长任务CPU调用栈采样，定位具体构造器再选择分段/后台生成措施；保留原失败与旧学习时序缺口，不能用定向PASS抹平。真实Worker/导航/性能/用户玩法及P2持久审核/生产者事务仍未完成，周期继续。

## 2026-11-05 20:27上海：整套32项与启动CPU窗口归因
实际UTC12:27开始，只执行当前轮次；排队18:27未补造记录。先读AGENTS/Guide/Test/Log/交接并核对并行改动。统一20261105T122758533338Z：51本地PASS、32浏览器PASS、pageErrors0，350.31秒；含强化非空final保护、S17真实固定版/缺失版新窗口。旧L04/L07/缓存时序故障本轮未复现，不能关闭。
新增tools/scene-authoring/profile_workshop_startup.mjs独立只读采样，统一回归结束后才运行，不并发重浏览器。新非持久context从#learning启动真实iframe，CDP Profiler 1000us采样，保留原始startup.cpuprofile、self/inclusive汇总、各frame长任务和启动阶段、学习页截图。首次startup-profile-20261105123629Z为CAPTURED，连接37765ms；累计热点有云脊线射线采样、V9/V10收尾、台阶岩/圣城山体等。累计热点不能替代连续阻塞归因。
针对这一限制补CDP NavigationStart单调时间对齐，重测startup-profile-stacks-20261105124046Z CAPTURED、连接47087ms；父文档最长五项longTaskStacks实际有样本。最长4537ms窗口内finishCrystalV9/V10Scene约4200ms inclusive，installGateTargetThirty/mountains约2554ms；3918ms窗口内applyCitadelMountainStudy约3669ms；另有moon garden/coast、moebiusSwamp构建窗口。数字是带采样开销的近似归因，不是优化前后比较，也未覆盖所有iframe独占长任务。云采样累计高但不是本次最长单段，避免改错模块。
本轮无产品/世界生成实现变更：已读取具体调用点及既有startupCloudParity测试，尚缺拟改步骤的保真基线，不盲删模型、关场景或重写算法。新取证工具两次实跑验证；Guide/Test补命令、CAPTURED与PASS边界、时间基准/窗口限制和下一步修复顺序。实际看最终profile-learning.png，原共享快照、折叠分组和资料页签保留，不等于玩法/帧时间验收。JEV紧凑文字实际调用留iteration-evidence/iteration-jev.json。
无用户profile/已恢复湖上建筑/原库/.workbuddy写入，无视频重学、Source提交/模型执行、自动造山、提交发布。下一轮按已定位最长窗口，优先研究finishCrystalV9/V10Scene/叹息之门同步子步骤分段yield；必须保持调用顺序，并补完整几何/材质/参数与同步路径一致性、失败清理，再在隔离工坊重测响应。先核对相关模块所有权；不能把现有云parity当其他场景parity。旧超时、真实Worker、通行/性能/用户玩法、P2持久审核及不可变代码资源包继续未完成；automation-2保留。

## 2026-11-06 用户要求修改界面：具体悬铃树选择入口
本轮按最新用户请求做对象界面，未继续排队heartbeat的性能改造。实景上方新增“场景对象 · 悬铃树”，动态读取四棵真实对象；桥边树与其他湖岸树可选、镜头定位并有局部朝向绿色框，右侧切对象说明，返回整个场景清除。明确仅查看，移动/旋转/树冠/叶色/对象修改保存尚未接入；选中时禁用整场景apply/原始参数、隐藏建造面板、体素指针guard，编辑/游玩先退出对象模式。
修改入口pipeline.html、studio.js/css、object-browser.js、新runtime scene-objects.js；morrisBotany只加稳定种植点ID/名称及合批前局部几何边界，morrisIsland注册/注销，bridge固定list/select/clear，morrisTownscaper暂态框与相机。原库/.workbuddy不动，没有真实用户profile操作、存档写入或自动造山。对象选择不进入recipe/定稿。
首轮scene-object-browser-20261106为3PASS/4FAIL，因定向L01留在学习页，后续场景按钮隐藏；测试S07加显式场景切页。scene-object-browser-final-20261106六项S07/S18/S08/S13/L05/G01 PASS，但看图发现海面：植物已合批，逻辑tree Group空，不能以marker存在冒充实景定位。补合批前边界后world AABB较松、局部框矩阵不对的旧截图都保留；改在工厂直接记录局部mesh bounds，再在逻辑树下挂局部Box3Helper。scene-object-oriented-highlight-20261106两项PASS，实景图确认只框桥边树。最终补右侧对象inspector，scene-object-inspector-final-20261106五项PASS/pageErrors0；S18检查4树/稳定ID/非空且正确父级框/右侧对象名/全局应用禁用与返回恢复，实际World/settings、树transform、recipe及全部localStorage前后相同。其余NOT_RUN，不宣称新33全套已测。
最终本地51PASS：20261105T165347912688Z（skip-browser）。工厂独立parity fixture scene-object-geometry-parity-20261106，对HEAD原morrisBotany与当前合批geometry attrs/index SHA、材质属性、树transform及原报告精确一致，4边界有效；仅工厂fixture，不算游戏完整验收。result为最终局部边界实现重测，早期同fixture输出未另存文件，不当两份独立证据。最终对象卡/实景截图均实际查看；绿色有向框围住画面中桥边树，右侧当前对象说明已切换。JEV紧凑文字真实调用在最终定向目录iteration-evidence/iteration-jev.json。
下一步先全33回归；若继续单树编辑，必须先保留合批三角形/对象来源映射，接候选、撤销、草稿恢复与定稿保护，不能直接移动空Group冒充移动树。旧启动卡顿及Worker/P2等缺口仍开放，无提交发布，automation-2未动。

## 2026-11-06 00:56上海周期：对象查看生命周期与完整回归
实际UTC11-05 16:56开始，先读AGENTS/Guide/Test/Log/交接，核对最新对象界面请求和并行工作树。统一20261105T165631610662Z为51本地/33浏览器PASS、pageErrors0，328.35秒，含当前S18与S17。旧启动/学习间歇超时未复现，不关闭；真正对象编辑及Worker仍未验收。
无产品实现变更：未复现新缺陷，不为频次重写稳定场景。新增S19有针对性验证：桥边→湖岸2号树仅保留一个高亮，刷新和学习页往返保留选择与同一iframe；进入原编辑器自动清除对象范围/恢复场景应用。通过真实dispose事件验证两次暂态框的geometry/material各释放2次。World/settings、recipe及全部localStorage前后相同，不用“marker存在”代替生命周期检查。
定向object-view-lifecycle-20261105T1702Z的S07/S18/S19三PASS，pageErrors0，其余NOT_RUN；33整套发生在新增S19前，不宣称34整套已过。实际查看second-tree-after-learning.png，湖岸2号树与绿色局部框正确，前方柏树有部分遮挡，未改植物或冒充无遮挡视觉验收。Guide范围保持只读，Test矩阵/定义更新。JEV紧凑实际调用在该定向目录iteration-evidence/iteration-jev.json。
未访问用户profile、未改已恢复建筑/手工/定稿及原REA/.workbuddy，无视频重学、Source/模型执行、自动造山或提交发布。无需要用户动作的新故障，保持安静；automation-2继续。下一步34整套；对象移动/造型前仍需合批来源映射和候选/撤销/版本契约，启动CPU证据/旧学习超时继续单独追踪。

## 2026-11-06 06:26上海用户纠正：由固定树目录转为真实实景点选
先按“继续”检查对象变换/存档接入，尚未写变换代码时用户指出当前是专用树按钮而不是选择。按最新指示先修真正选择入口，原移动/旋转/缩放/撤销/持久化目标保留未完成，未伪装已接通。
前端改为通用“场景对象 → 在实景中选择物件”，单击实际canvas经当前相机Raycaster最近有效可见mesh命中，拖动不选；保持镜头，局部有向高亮和右侧实际名称/类型。“定位选中对象”单独取景。名称目录默认折叠且支持搜索，从真实运行记录生成（本测192项），没有四个固定树按钮/物种标题。底部状态同步说明只选择、未改场景或草稿。
morrisBotany在原材质合批保持顺序和geometry不变的同时，为每个来源plant保留顶点区间，用WeakMap绑定mesh；face.a回溯悬铃树/柏树/蜀葵，不只靠包围盒猜中。morrisIsland登记实际全部植物。非语义mesh只读按运行时UUID登记；InstancedMesh带instanceId/实例矩阵边界。建筑/地形合并proxy明确显示合批只读，不能说已选中独立一栋房。新增固定同源objects.picking命令与可信选择事件，体素笔刷在选择模式guard，原编辑/游玩/取消仍恢复原范围。
证据：live-scene-picking-20261106四项S07/S18/S19/S20 PASS，真实pointer分别选中桥边树、柏树1（不是直接发选择ID冒充点击）。最终live-scene-picking-final-20261106九项S07/S18/S19/S20/S21/S08/S13/L05/G01 PASS/pageErrors0。S21为独立无bootstrap Three fixture，验证合批区间边界、不同实例ID和边界minX 2.5/11.5、geometry坐标不变；不当真实游戏测试。S20实际World/settings/recipe/localStorage不变；选中柏树与绿色框的最终截图实看。S18/S19已适配辅助目录而非原按钮。
最终本地51PASS：20261105T223903780856Z（skip-browser）。独立原HEAD植物工厂geometry/index属性SHA、材质/transform/原report对照仍PASS，result-raycast-owner-map.json为新增来源映射后的独立证据，原result保留。相关文件改前拷贝scene-picking-baseline-20261105T222933Z，未回滚并行改动。JEV实际紧凑调用在最终定向目录iteration-evidence/iteration-jev.json；Guide/Test已重写旧“树专用入口”说明并加S20/S21。非36整套，不谎称全部通过。
未访问用户profile/恢复建筑存档、未改原REA/.workbuddy，无模型执行/自动造山/提交发布。下一步先36整套；继续变换编辑时利用合批来源范围建立不可变基线buffers、候选、对象历史、草稿恢复/定稿及Source目标scope，不能只改空Group或仅发无objectId的目标。通用UUID对象尚无稳定跨版本身份，编辑器保持未开放。旧启动/学习超时与Worker/P2缺口继续保留。

## 2026-11-06 23:10上海 用户接手指令：能力代码化 + 本机 super agent 跑通（Claude）
用户要求先把场景工坊改到能用：能力是代码不是 skill，Router/改造 Worker/验证 Worker/Watchdog 真正运行，场景工坊与学习工坊联动。
新增 REACodeRefactoring/src/capabilities（ops/terrain/build/layers-meta/layers/registry/verify + README，tools/test-capabilities.mjs 8/8 通过），8 个能力：石拱/天桥、崖顶悬垂、海中石柱、穿山隧道、海边灯塔（改体素），灯室光束、体积浅水、烟囱炊烟（显示层）；src/build/lighthouse.js 仅加一行：岩柱顶不算灯塔。
TigerMessenger 新增 capability-runtime.js（cap.* 固定命令）、agent-panel.js、agent/{orchestrator,transform-worker,verify-worker,world-cache,rea}.js、tests/capability-code.test.mjs（3 PASS）；修改 studio.js/pipeline-model.js/capability-library.js/pipeline-bridge.js/learning-workshop.js/morrisTownscaper.js/pipeline.html/studio.css/README。改前核对设备 mtime 未变，带 expectedMtime 写入。
证据：容器内隔离副本 Playwright 端到端（测试岛注入新上下文 localStorage）：连接 → 扫描 7/8 能力 359 处 → Router 4 条建议 → 生成候选（石拱 2、灯塔 1、浅水层、烟层）→ 验证 5 项（范围/建筑/承托/通行/几何量）pass+warn → 原始/候选对照截图 → 写入后工作区存档变化、经验 previewed/committed，pageErrors 0。用户 8931 实服（内置浏览器空存档 profile）确认：游戏连接、能力 Worker 就绪、扫描完成，无错误。未碰用户 Chrome 存档。
未做：第 8 轮的半影/左行/隧道导航改动因设备 REA 已被并行修改未部署；未跑 36 项浏览器整套。下一步：在用户真实湖上建筑群上实测匹配质量，按经验调整能力规则；把更多已学方法写成能力模块。

## 2026-11-07 · sys-r1 系统工坊：球系统 / 场景 / 物件三层管线 + super agent

- pipeline.html 改为系统工坊四个标签（球系统 / 场景 / 物件 / 学习）；场景与物件共用实景，iframe 不重载。
- 公共 super agent 运行时抽出到 `src/scene-authoring/agent/runtime.js`；球系统、物件层用 `src/system-workshop/tier-agent.js`。
- 球系统：5 个能力代码（海平面 / 重解地形 / 地表分辨率 / 切图数 / 网格细分）；候选星球在 Worker 里编译，验证独立复算。
  实测：海平面 +0.5 通过（陆地 76%→65%）；+1.5 失败（saihoji-moss-garden 被淹，不能写入）；网格细分 2 级失败（编译停在 landform-chain）。
  定稿写入 `tm.planet.final.v1`，`planetV8/runtime.js` 只覆盖改过的配方项；没有定稿时游戏行为不变。
- 物件：3 个能力代码（同类尺寸变化 / 朝向变化 / 间距松弛）。莫西斯湖实测：192 个可编辑植物，占地重叠 56→24 对，最大移动 0.35，验证全过；
  实景预览、对照原样、放弃恢复、写入（一步撤销）均在隔离浏览器上下文验证，未碰用户存档。
- 能力目录 `system-catalog.json`：REACode 原版 285 条 + 重构版 259 条按三层分区放进泳道，原版占位节点标原版文件位置。
- 未验：球系统定稿后游戏星球场景的画面（需进星球场景对照）；物件层只有莫西斯湖的合批植物可编辑。

## 2026-11-07 · sys-r3 系统工坊新布局（按画布定稿）

- 顶部并列：系统工坊（编辑管线）｜学习工坊（学习管线）。
- 系统工坊：左栏能力库（三条子管线共用，⚙ 可拖入；○●◐ 占位只列来源；能力卡可调配归属 / 标公用，存 `tm.capability.ownership.v1`）；
  上方管线区域三条子管线（球系统 / 场景 / 物件），每条按分区泳道排，管线里只放能执行的节点；下方一个实景游戏，三条管线共用。
- 球系统管线：实景切到绕星球中心的轨道镜头（去掉雾，看整颗星球）；候选可「在实景中预览（重载游戏）」，前后同镜头截图对照；配方以游戏实际配方为基线。
- 物件管线：在实景或对象目录里选中物件 → 自动切到物件管线，范围可选「只改它 / 同类物件 / 整个场景」，验证新增「作用范围」检查。
- 已测（隔离浏览器）：星球扫描 / 执行 / 验证 / 实景预览 / 放弃恢复；物件选中悬铃树 → 同类 4 棵尺寸与朝向变化，验证全过。
- 未验：编译地形默认关（planetTerrainV1），星球配方改动在默认游戏里主要体现在云和海；天色随游戏时间变化，前后截图可能有色差。

## 2026-11-07 · sys-r5 全部场景可选 + 通用场景编辑插件 + 能力集合

- 场景下拉列出游戏登记的全部场景（main.js 只读暴露 `__tmSceneTargets`）；选中后实景镜头飞过去。
- 通用场景编辑插件 `src/scene-authoring/generic-scene.js`（参考 GenAIWorkPipeline：先登记、原件不动只存增量、接入检查 passed=true/false/null）：
  物件自动登记、对象目录 / 物件编辑 / 物件管线 / 实景点选、存档 `tm.scene-objects.edits.v1:<场景>` 启动回放。旋转缩放绕包围盒中心；未命名网格按结构件处理，批量能力默认不动。
  书店镇实测：登记 29 个（5 个有名字），「自然化同类」只动有名字的 5 个，建筑不散架。
- 能力集合：左栏预置集合、分区标题整组拖入、「存为能力集合」；拖到不对应的泳道时不显示「+」并说明原因。
- 球系统编译失败的说明改成中文（例：网格细分 2 级 → 地形链要求场景锚点连成一块陆地）；网格细分默认 1 级、标注实验。
- 未做：通用插件的风格与场景草稿 / 定稿；体素场景管线仍只作用于莫西斯湖。

## 2026-11-07 · sys-r6 通用场景插件补齐：风格 / 草稿定稿 / 场景管线 / 水晶城 / 物件命名

- 场景管线（通用场景）：作用在场景材质色表上——风格统一（主色归并）、整体色调、套用风格包（莫里斯色板）；验证：明度预算、明暗层次、颜色数。书店镇实测风格统一 21 种材质改色，四项通过。
- 风格面板：逐个材质改色、预览、保存、恢复原色；跨场景共用的材质先为本场景复制一份。
- 草稿 / 定稿：存物件改动 + 风格 + 物件名；确认定稿后游戏启动时用它（`tm.scene.versions.v1`）。
- 水晶城：main.js 场景表补上 `messenger.landmarks.moebius.group`，接入通用插件（58 个物件、1570 种材质）。
- 物件命名：未命名网格按「颜色 + 形状」自动命名，同款归一类可批量；对象面板可改名，改过名的同名物件被当作一类。
