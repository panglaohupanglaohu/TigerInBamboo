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

## 2026-11-12 需求驱动学习与系统工坊回接

用户要求系统归类 REACode、明确重构目标并打通学习/系统工坊。本批保留所有已有未提交修改与用户资产；没有改原版或上游学习记录。

实际交付：learning-roadmap.js 统一定义四条需求契约，复用 capability-sets.js 现有组合，不新增第二份步骤清单。学习工坊默认“需求与能力组合”，每条显示步骤接口状态、原模块/重构落点/来源证据/剩余差距、下一动作与验收要求；“源码归类与差距”覆盖当前快照全部170模块，按目标目录职责归组，跨域不丢失。来源帖子关联仅为相关性，路径匹配仅为需求筛选，均不冒称语义依赖。刷新复用现有校验快照/离线缓存。能力库入口可回学习路线，组合加入对应球/场景/物件管线，带入目标与验收文字；仍由用户执行候选，不自动改游戏。

可复跑源码盘点：`python3 TigerMessenger/tools/scene-authoring/audit_learning_sources.py --output <报告路径>`。原版src/engine实际170份JS、170已映射、未映射0、缺失目标0，记录源/目标SHA256、静态import、职责。只说明映射文件存在，不能说明行为等价；vendor/HTML内联不在范围。

验证证据 `artifacts/workshop-tests/learning-roadmap-20261112/`：隔离Chrome+真实snapshot API，4条需求/170模块，物件组合跨页保存三个节点、返回学习入口，errors=[]，roadmap.png实际查看。游戏iframe在此专项测试中隔离，未执行真实世界几何。统一--skip-browser回归 `20261112T004916471601Z` 四组PASS；首次sandbox绑定端口失败保存在`20261111T215607096845Z`，后续提权重测通过。JEV真实jev-1.14.0文本复核结果要求继续导航/组合验收，不代替看图或批准。没有提交/发布。

下一步：把组合级承托/净空、通路、全局预算变成机器可执行的门槛并绑定候选报告；继续补缺少接口的原算法。当前四组是已有能力的需求化入口，不能称170模块全部完成执行适配或动态自动代码重构。新增源模块必须先更新上游coverage映射，再刷新学习；盘点工具可发现漏登。

## 2026-11-12 113条待办逐项核销/分类；补首项实际物件能力

完整审阅coverage-progress.next的113条。合并7条同交付历史记录（灌木83/85、流场83/85、拖抹调色、浮凸双高度、点光DDA、实例身份/socket、拥挤压力）；106组中核销6项旧排期：网格层序原文明示不再排期，软影/走廊、Wake、色体/对比纹理、housekit的旧“未覆盖”基线已有后续coverage/证据，道具生命周期已在r55接World。核销仅针对旧排期，不等于完整原作/当前游戏验收。剩余100组首要动作：待学习8、待实现81、待验证8、待核对3。跨主题混合记录保留全部原文，不因同帖子直接合并；3个截断/旧调度/基线冲突项暂不猜结论。

新增catalog/learning-backlog-review.json（人工审阅账本）、learning-backlog.js（快照对账与分组UI）、tools/scene-authoring/reconcile_learning_backlog.py（受原清单SHA256保护的生成器）。原始next与上游文件保持只读。按标题+clips指纹匹配，新增/改文/改来源不能继承核销；核销依据的模块status/gap/evidence/frameReview变化则重新待核对。账本读取失败保留全部原始记录并待核对。学习进度内替换113长列表为100待办与6核销，保留原文/视频/证据。手机长路径换行，展开待办独占一行。能力库计数从笼统“占位”改为“可执行/待适配”，没有靠改标签提升能力状态。

用户进一步问为何不完成占位：已开始实际补接口。object.path-spacing直接import REACodeRefactoring/src/core/path-samples.js，沿当前同类物件折线等弧长调整，端点/手工锁定锚点保留，范围外/隐藏物件不动，超预算或新增重叠的段保持原状。接已有对象Worker/验证/预览/写入流程。学习库存模块路径可追到该接口。没有用navribbon帖子（其中视频实际是单位等级/尘AO）冒充来源，也没有将整个导航方法标完成；这是物件布局适配，不是新道路或导航保证。完整占位执行适配仍未完成。

证据：artifacts/workshop-tests/backlog-reconciliation-20261112/{browser.json,reconciliation-report.json,final-review.json,backlog-desktop.png,backlog-mobile.png}。7项对账测试、4项新能力测试+7项system-workshop回归均过；隔离Chrome真实API/物件Worker实际返回interior dx=.6，零pageerror。桌面/390px手机实际看图，无横向溢出；首次测试折叠链接的可见性定位错误已修测试，第二次暴露手机长内容溢出已修产品CSS。基础四组回归20261112T010043918623Z全PASS。新测试加入统一单元入口。未做真实游戏预览/写入或全量玩法测试，未触用户存档。

JEV早期实际文字调用在jev.json；新增能力后的额外外发复核被自动审批拒绝（内部实现/验证信息外发），未重试绕行，最终使用本地测试/截图核验。保留全部未提交并行修改，无提交发布。

## 2026-11-12 继续补场景执行接口：感知色板与层次

新增gscene/perceptual-capabilities.js：scene.oklab-contrast、scene.oklab-palette，直接import上游src/core/oklab.js；前者按材质使用权重的L中心调层次，后者确定性OKLab聚类归并色度、保留每种材质L。实测最终8位输出（含色域裁剪）ΔE受每步预算限制。明确是通用场景材质表适配，不冒称完整三角面contrast texture或World八角点色体。

两项接已有改造/验证Worker及gscene.style预览/比较/放弃/写入。新增“感知色板与层次”集合，整组加入通用场景管线；原库方法卡按related提供“加入已适配部分”按钮，保留完整方法待适配状态。scene sidebar保留gscene元数据供相关接口追溯；学习源码视图也能显示关联。

保护加强：generic scene state输出已保存材质locked；全部通用材质能力默认保护人工调色，只有明确bool开关才允许；参数拒绝NaN和字符串开关。验证Worker独立检查人工颜色及累计ΔE预算。修复style.save吞存储异常：先持久化成功再提交内存，失败保留候选、不得误报保存。

验证：6项新增单元（含色域极值/量化预算、重排确定性、锁定/伪造结果拒绝/参数拒绝）通过；与7项系统、7项账本合跑20/20。统一四组基础回归artifacts/workshop-tests/20261112T011147026892Z全PASS，新单元已加入统一入口。真实Chrome在artifacts/workshop-tests/perceptual-adapters-20261112/runtime.html加载真实GenericScene及transform/verify Worker，实际渲染before/candidate，人工m0不变、场景外共材质对象不变且本场景克隆、几何变换及geometry ID不变；比较/放弃/存储拒绝/成功保存/恢复全过。parent实际pipeline页面显示两个新执行条目，来源卡局部执行入口通过。errors=[]。before/candidate实际看图，后者色度更收敛；未称达到任何场景美术目标。

首次测试已通过runtime但测试误用searchbox角色；第二次同名搜索框定位歧义；两份失败报告保留，限定#capability-sidebar后最终PASS。review.html用于复核。未进入正式书店镇/湖沼大场景执行，不能以隔离样例代替正式玩法/性能验收；未修改用户存档或上游源码。遵守前次外发自动审批拒绝，不重试JEV披露，使用本地证据。

下一项：将这组接口在正式已注册通用场景的新测试上下文完成候选与恢复，并继续接余下地形/水/动态能力；完整待适配清单没有因这两个局部接口虚假核销。

### 同批正式入口验证补齐：书店镇25材质／水层遮挡修复

正常pipeline+未替换游戏iframe、新非持久Chrome上下文实际启动后，选择书店镇，整组双击“感知色板与层次”，通过真实父工坊改造/验证Worker预览25种材质，再UI对照两次及放弃；gscene.style.get证明25色逐项恢复、saved前后相同、previewing=false，pageerror=[]。未写入场景存档。正式日志formal.json、formal-before/candidate.png根实际看图；相机固定，但鸟/船/飞行器动态推进，不作像素差异归因或美术目标验收。

首次API链通过但两张正式截图只有平湖水，未当视觉通过；报告已改apiPassed=true/visualAccepted=false/passed=false，保存在formal-first-api-pass-visual-fail.json及first图片。原因：morrisTownscaper.townOverlayActive只用1400距离覆盖了整颗星球的其他工坊镜头，仍绘制莫西斯湖局部场景；updateInLake也会将其判进湖光照。修为明确planetCamera.scene/object外部工坊视图不叠湖层/湖区灯光，普通湖上编辑/玩家及全星球原逻辑保留。新鲜正式重测实景建筑可见，25材质候选/对照/恢复通过。

新增renderedContent截图内容门槛纳入正式脚本，拒绝单一平面覆盖，不能作为美术质量评分。已保存真实截图验证：旧图主色占97.72%被拒，正式before14.08%/182色箱、candidate15.52%/205色箱通过。相关入口/存储/感知能力10项回归通过，diff --check无错。正式修复后源码manifest已更新。此前“未进入正式场景”由本节覆盖；其他场景、长时间性能与完整玩法仍未测。

## 2026-11-12 用户纠正全目录范围：290文件清单与三模块实际重构

用户明确要REACode目录280多个代码文件的完成列表，并继续完成未重构项。全量只读盘点为290代码文件：175 JS、11 MJS、104 HTML（含内联控制器），不是只有170个src/engine模块。新增build_reacode_file_status.py生成catalog/reacode-file-status.json与docs/REACODE_REFACTOR_STATUS.md；每文件唯一原路径/SHA256、类别、状态、候选落点/SHA256、代码范围、证据和剩余差距。HTML的依赖模块落点不等于页面内联已重构。第三方Three.js及历史tmp也列入但不冒称生产能力。学习工坊新增全目录状态页签和搜索/筛选，入口`pipeline.html?learningView=files#learning`。

实际代码交付（原版只读）：
1. src/mipfilter.js缺失消费者→REACodeRefactoring/src/light/mip-ground.js、mip-ground.html：复用mip-chain，透视铺地、真实二维导数/LOD/各向异性、Canvas绘制、A/B高频与四分之一texel闪烁度量、均值漂移。保留原版测试纹理seed图案（3seed逐像素对照），采用RGB浮点/IEC sRGB/重复寻址，明确与旧RGBA/gamma2.2接口非数值等价。修正旧shimmer报告实际挪1/4 UV周期而非texel的口径。
2. engine/outline.js→outline-painted-normal.js接已有paint-normal生成器到ScreenOutlinePass主World法线缓冲。保留几何模式和默认关，新增?fx=outlinepaint/outline-painted.html；只给指定源mesh换笔触法线材质，不动体素/位置，其他法线仍几何模式。阈值可调；异常时恢复原材质/可见性/RT，外部纹理所有权清楚，关开关释放自有map。原片精确UV/美术与远景混叠仍有差距。
3. engine/spritepack.js→core/sprite-atlas.js及sprite-atlas.html：复用共享Atlas的插入/更新/释放/重排/有界增长，失败事务不污染状态；径向算法用共享树碰撞查询替代size²mask，15seed径向位置/占用/跳过数与原版差分一致。内部树及重排坐标不作为序列化契约；三角UV页填充率和主View烘焙仍独立待补。

最终9组源库测试通过（mip-chain、mip-ground、outline-pass、outline-painted、paint-normal、view-post-extras、sprite-atlas、atlas、atlas-crossleaf）；3项全目录索引测试通过。真实Chrome双网格normalRT改动60922/73825像素，World/vertex/material引用不变；map关闭释放一次，正常动画造成其他normal像素推进，不作全屏像素相等断言。mip/图集页面真实交互、290行清单/本轮4项（3模块+1配套页）筛选均通过；GLSL errors=[]。实际查看mip/quad前后，原网格调试线仍在，不宣称原片美术完整复现。

清单“本轮代码验证通过”必须匹配browser.json.passed和逐目标源码哈希；源码改变/缺目标自动退到待复验（重建清单时）。其余迁移、静态确认、页面/工具待核验、动作美术、跨GPU、性能默认策略、形状约束分别列，绝不把163个既有局部迁移或101个页面候选算全量完成。当前上游进度锁先BUSY后IDLE；本批没有覆写并行任务learn/data/coverage/progress等账本，视频数未增加。

证据：artifacts/workshop-tests/source-refactor-20261112/{browser.json,unit.json,file-status.png,mip-ground.png,outline-*-*.png,sprite-atlas.png}；browser回执含源码hash，source-before有描边两文件改前副本。首次测试漏传render(dt)后修；再发现MeshNormal fragment没有common include，导致新增varying/uniform未声明，修为显式声明后真实GLSL通过，失败报告保留。统一入口增加refactor-code组。初次统一回归发现并行学习已将113旧排期改为111，历史测试错误依赖活动数组下标；改用不可变审阅账本重建原113样本，加当前源变动不丢记录测试。最终20261112T043611354424Z五组全PASS；此前失败20261112T043508611086Z保留。runner新增测试组的一次缩进错误也已修复。

完整290文件重构/验收尚未全部完成，特别是页面内联交互、工具契约与剩余形状/动作/跨GPU/默认性能取舍；本批没有假称清零。源码原件和用户资产/存档未改，无提交发布。遵守既有外发审批拒绝，本轮本地复核，无JEV重试。


## 2026-11-12 菜单接通、六条学习复核与实际代码补齐

用户最新要求把菜单已有实现接进来，并完成待学习/待实现。此次交付不宣称全部待实现或290文件清零。

实际代码：
- REACodeRefactoring/src/ui/scene-capability-panel.js：新增48个已有场景开关、11个post开关、45个既有北境扩展开关；统一读取真实对象状态，北境项只在badnorth可用，点光依赖GI，异步开关pending期间不被轮询复位。原17个天气/环境与着色组保留，未改变默认开关。environment-panel增加节点编辑器/mip/图集/笔触实验入口。
- 新core/trajectory-trace.js + world/trajectory-preview.js：RK4线性/二次阻力、有界逐段碰撞、实际World网格Raycaster截断；主菜单可启闭与调参，更新释放旧GPU几何。二次模型明确为可选，不冒称原作者模型；未替换战斗箭矢和定点射表。
- 新core/nav-diagnostic-geometry.js + world/nav-diagnostic-overlay.js：共享World可走格角红点、实际背景网格、贴各侧真实高度的三维格型/过渡边；复用classifyWireframe与shape.at，保留原格型、不伪造六边形背景。
- 新core/node-graph-editor.js + ui/node-graph-editor.js + node-editor.html：实际拖节点/拖端口接线/点线删除/增删节点、分组参数与实时sink预览，图+状态+布局JSON、50步撤销重做。复用原NodeGraph/NODE_REGISTRY，错类型/重复输入/环路/非法状态和过预算输入事务拒绝。原node-graph页新增进入编辑器链接，原只读对照保留。
- 组合回归发现C01默认houseChar与C03houseFx分别保存同一顶点色，停战后9顶点仍黑。house-char.js新增按颜色attribute/顶点/owner共享原色保管，两控制器分别释放，最后一位退出才恢复最早原色；不改焦黑颜色/默认档。纯逻辑双释放顺序、真实双网格（均有变色分量，最终剩余0，以browser.json实际数值为准）验证恢复。

学习与排期：学习工坊新增独立learning-backlog-deliveries.json补充层，不覆盖并行上游learn/data/coverage/progress账本。六条原待学习均核到已有全帧记录；飞岛“只看第一张表”旧队列核销，节点编辑器本轮实际实现核销；弹道/血材质/格心后续继续实现队列，拆建时序和精确削台口径进入待补来源。每卡列本轮交付、剩余要求、原记录、审阅来源和实际入口。不增加观看帧数、不把来源不明写成实现完成。新层使用原记录指纹+学习记录+逐文件源码/审阅文档/浏览器回执SHA校验，变化退回原待办。并行上游更新导致待实现78→77、待核对9→10，说明新文字没有继承旧审核。最终真实页面快照显示学习0/实现77/验证8/核对10/来源2/核销7，仍有97项活动待办；数量是当时快照，之后以实时页面为准。

验证：最终五组统一回归artifacts/workshop-tests/20261112T131240915856Z全PASS（66个父工坊单元、19组源库文件及快照/桥/Watchdog）。首次普通沙箱禁止临时回环端口，source-bridge失败目录20261112T130500652283Z保留；获得工具自动批准的隔离测试权限后复测通过。C03旧恢复失败与改前3文件保留在environment-menu-20261112/char-first-failure.json、char-before/。

真实隔离Chrome：environment-menu-20261112/browser.json双网格逐项11post+45北境开关、7类普通抽样、实际碰撞弹道/3层导航、外部状态同步、移动边界、焦黑组合恢复均通过；GLSL/pageerrors=[]，回执绑定实际源码。初次第二次页面导航出现本地HTTP连接reset/socket失败，失败回执保留，改每种网格独立context后通过，不改产品超时掩盖。node-editor-20261112/browser.json验证真实鼠标拖节点/连线/删线、数值40到compose、增删、撤销重做、JSON状态布局往返与非法导入保全；editor.png/invalid-import.png已查看。learning-browser.json为真实8931父工坊，无游戏替身；backlog-live-1794488743807另验证动态分类刷新、保留记录和真实object Worker。

全目录清单已重建到当前目标hash，仍290文件、4项此前指定范围代码验收；本轮新增消费者/编辑器不冒称额外原目录文件全量完成。证据总览environment-menu-20261112/review.html。原REACode未写，用户存档未写，无提交发布。沿用已知JEV外发审批限制，仅本地证据复核，没有重试披露。

仍未完成：77待实现及来源不足项没有清零；弹道定点射表/真实战斗箭矢衔接、血材质响应、格心/极坐标后续、其余页面/工具契约与原作动作资产等继续按证据完成，不能仅改标签。完整正式游戏组合及长时性能未在本批验收。


## 2026-11-13 编辑视口操控修复与组合引擎实码核对

用户明确优先：进入编辑后能旋转/平移/缩放；然后接已有能力库组合执行引擎。用户比较十二门徒与上游index融合画面，要求解释执行器还是能力适配的差距。

本批：新scene-authoring/viewport-orbit.js共享相机rig；scene/object对焦接入右键环绕、中键屏幕平面平移、滚轮有界缩放。morrisTownscaperMenu.view.updateCamera接管局部镜头时清理前一planetCamera/orbitInput，解决拖动仍送旧/空控制器。generic-scene.focusObject把orbit与apply一同交给游戏，保留投影/上方向。frameScene用共享rig；同场景进入构建可保留已对焦视口，通用编辑回退focus接受preserveCamera。pipeline视口显示操控提示；morrisLake/menu/generic导入更新viewport-r1。没有改十二门徒World/建筑/地理或存档。

实际证据：artifacts/workshop-tests/viewport-engine-20261113/browser.json正常8931→真实游戏iframe→十二门徒→进入编辑，真实鼠标三种手势全部改变camera，当前加载6个岩体的全部World编码与场景存储完全不变，errors=[]；before/after.png已看。前述9座来自旧注释，本次按6座运行对象修正。初次测试误等隐藏小地图canvas；第二次三种手势均通过但启动性能遥测异步写入tm.startup.profile.v1使全Storage断言误报。两份失败保留；最终只排除这一个独立遥测键，其他存储严格相等，并新增全岩体World编码不变检查。input-browser.json用真实menu事件与generic-scene的隔离GPU fixture验证局部→物件→局部切换，所有手势/对象不变；不能将该fixture说成完整游戏。viewport-orbit两个纯单元、感知/入口相关9项及游玩场景检查通过。

引擎源码确认及差距：见CAPABILITY_ENGINE_AUDIT.md。实际runPlan→改造/验证Worker→cap.preview/show/commit已存在，通用三层tier-agent亦存在；当前体素/显示9项、通用材质5项、物件4项。十二门徒已经复用vendor WorldMesh/烘焙/岸浪/植被，但使用旧副本、独立石灰岩主题/主光照和精简植被，无整套View shader挂钩。10个选定核心模块与最新源库均不同（library-drift.json）；该哈希比较不能替代逐项视觉行为对照。体素cap执行接口仍绑定莫西斯湖，并非十二门徒的多World批量执行器；菜单入口不等于Worker能力适配。没有盲目复制整个最新View/覆盖vendor或自动改用户认可布局。

统一回归首次目录20261112T232339483569Z：仅旧交付证据单元失败，因为上游并行修改view.js，旧哈希回执按设计失效。测试错误要求活动源码永久匹配旧成功回执。改为稳定的已验证字节fixture测试正常/篡改路径，另加真实当前文件漂移应撤销旧证明的测试；没有刷新旧成功证明、没有放宽产品校验。当前旧菜单/学习交付补充可能显示证据变化，需针对上游最新版本重验，不冒称它们仍有效。最终统一回归结果见本批后续记录。

当前未完成：十二门徒多World能力执行适配、共享渲染扩展的候选/对照/应用，以及所有77等动态待实现项，不能因本次镜头通过宣称完成。下一阶段以已有引擎补正确sceneId/目标快照/网格身份、候选恢复和执行证据，再逐项共享渲染/显示能力。无源REACode写入、无用户存档修改/提交发布；本地复核，未重试受限JEV外发。

同批最终回归：20261112T232449868791Z五组全部PASS（本地日期2026-11-13），含新的视口单元、证据固定fixture/真实漂移分离及19组源库测试。真实十二门徒camera报告确认当前6个World；没有将历史未重验交付重新标为有效。

## 2026-11-13 实际源码能力目录与源库首页

用户纠正能力库定义并要求重扫/组合/拉齐。已从学习记录主导改为物理代码主导：只读esbuild解析、导出/依赖/SHA、稳定性检查、290原版文件关联和命名接口差异。原学习目录单独保留，9注册入口不再充当全部能力库。359模块、7源码依赖组合；实时API和生成快照同一工具生成，旧v1缓存不覆新schema。导出在注释里的示例不计入、源模块不会被扫描器执行。依赖图不能直接运行；明确适配的OKLab/路径接口单列。

真实源库index新增能力库窗口、源码检索、组合与双工坊/测量/比较页入口；3种当前View组合可试用和恢复，实际融合场景全部标志及完整World编码恢复，errors=[]。新源代码模块及CLI/消费者均写入REACodeRefactoring；原件只读。7初扫问题补齐后仍10无落点：4个旧页面是漏映射（非新迁移），实际补测量2文件和比较页1文件；不靠复制快照或生成联系表凑完成。

联动：真实学习源码组合→已适配部分→书店镇通用场景管线→PipeLineEngine Worker→25种材质修改→对照/放弃逐色恢复，saved不变，errors=[]。修复通用材质组合的目标误写莫西斯湖配方；上下文不具备时保留学习页并显示不能加入。所有已有Worker仍按目标/参数/验证门槛执行，不把源码节点拖入后跳过伪称完成。

视频学习：此次实际查看1991101097818403263既有sheet-00共0–3秒100帧，原片14.4秒另外均匀解码120时间样本测量；不追加全帧学习计数。纯指标算法known1Hz/1s、静态无假周期、非法值和预算测试；真实视频Worker与portable CLI皆通过，完整曲线无周期极小值。固定区域DFT受镜头移动影响，2.42秒不是已证实海浪周期。

失败保留：首次扫描与学习refresh竞态修复；测试在新模块已进入生成快照后误以其存在当扫描完成，改看实际DOM来源状态。正式链路曾重复定位隐藏侧栏摘要，另未进入编辑时纯水图失败；最终正常点击进入编辑后完成全链路，彩色箱208/166、主色占比0.144/0.157，未放宽门槛。首页首次测试误用view.world，实码为view.town；修正后完整编码检查通过。源库新按钮首次换行过窄，CSS已给64px并重验。具体失败与成功均在code-library-rebuild-20261113。

统一五组20261113T143756823974Z全部PASS，包含3个目录单元、PipeLineEngine及22组源库文件；真实索引页、双工坊、视频页与正式游戏证据不混成替身。目录/差异文档REACODE_REFACTORING_LIBRARY_INVENTORY、REACODE_LIBRARY_ALIGNMENT；实际架构PIPELINE_ENGINE_ARCHITECTURE，说明描述签名与源码签名仍未完整绑定。

苔庭松树同批参考优化另存pines-reference-20261113：6树、50槽、2mesh/树、固定三机位calls不变；正面三角26275→51697，未作主游戏长时性能验收。旧第一候选46槽失败保留。代码直接复用源库path-samples，未把松树工厂登记为完整Worker能力。

下一步：10个辅助/历史文件逐个处置与行为差距、十二门徒多World、共享渲染/源字节签名和跨GPU/长时性能。没有声称全部290完成；无提交发布、无用户存档写入。JEV沿用此前外发审批拒绝仅本地复核，未重试披露；缺失threejs入口未谎称使用。保留其他模型修改。

## 2026-11-13 首页场景直接应用能力
用户认为折叠菜单能力少，并明确要求把适合能力加入index场景。已新增6项默认显示组合，调用已有云影/纹理阴影/局部风旗/折卡灌木/草丛背景反差线/崖高灌木带代码；对照恢复全部自有开关及灌木四参数/颜色，不改World。已有true状态不重复写入，避免重置已有自定义着色；队列防交错、失败回滚可恢复重试。北境不强加此组合，URL enhance=0可看原效果。新增5个C11真实控制入口。
菜单改成142个开关可搜索并按分组计数，融合91当前可操作/51受限，不把控制数量叫算法数量。第一版橙色带过宽过亮，实际看图后压窄减淡；前版图/回执保留。最终before/enhanced图已看，实际World编码/主体几何SHA/相机全等，样式恢复全等，GLSL/pageerrors=[]。
index-scene-enhancement-20261113/browser.json及review.html；原菜单回归复制到该新目录并补等组合就绪，未覆盖旧历史证明。quad/mixed 11post+45北境、导航/弹道/焦黑恢复和移动边界PASS。统一20261113T145408433032Z五组PASS（23源库文件，含新组合单元）；未作长时或跨GPU性能结论。目录重扫361模块；旧的10文件/行为差距不因本批显示接入提升完成。原版/用户存档未改，无提交发布，JEV沿用既有外发限制未重试。

## 2026-11-13 恢复主游戏编辑入口
恢复localhost默认主游戏右下原编辑dock；dev=0/release与公共默认纯游玩规则不变。统一5处uiLayers实例，补captureMode通知避免截图隐藏工具时退出原建造镜头。编辑菜单新增直达原MapEditor入口；关闭构建组停地图拾取，原6个触控动作未动。
真实主游戏隔离浏览器无dev参数可见编辑并打开真实map-editor，desktop/mobile图已看，errors=[]。触控fixture复用实际模块/样式验证390px不重叠与tap、菜单在界内，不能冒充正式主游戏。首次发现只开构建组时无默认展开的编辑器，故补直达地图；首个触屏定位误假设纠正、失败保留。restore-edit-button-20261113保存回执/截图/源码指纹。
入口与截图清理3单元及统一五组20261113T152416957729Z PASS。末尾地图关闭拾取监听与capture通知保护经语法/单元检查，正式浏览器记录针对打开入口，不作长时玩法通过声明。未修改用户存档或部署。

## 2026-11-14 原菜单“构建”现场编辑闭环
用户连续明确“构建→场景选择→鼠标编辑”，在原编辑菜单内弹出场景编辑菜单并保存。已修正前批路径偏差：独立游戏workbench强制隐藏HUD是根因，现恢复原浮动场景HUD。构建自动打开场景选择和对应编辑器，保持原湖/十二门徒体素鼠标逻辑与城堡/水晶原生编辑面板，统一保存调用各自原存储。
切换关闭其他编辑器并定位；native场景不显示Morris专用控件；编辑只接主renderer.canvas，避免2D面板误触湖体素；关闭构建归还玩家镜头。保存结果布尔化，失败不假报成功，城堡多键非事务限制保留。
隔离实际主游戏测试通过：五选项、湖真实鼠标修改/保存/reload复原读取、各场景入口/镜头归属/保存、关闭编辑释放镜头、errors=[]。证据build-scene-editor-20261114/review.html。其他场景仅本批入口/保存验证，原有全面编辑矩阵没有重跑。统一五组UTC20261113T233011541067Z PASS，上海日期11月14日。无用户存档改写、无发布；前次JEV限制继续适用，仅本地核对。

## 2026-11-14 作者演进时间线与部分实现批注

用户要求按作者设计发展过程重新对齐8769与8931，并明确先整理源库页面，再同步学习工坊；最新要求在每项部分实现旁标高/中/低优先级与补全批注。

实现：权威记录仍在 REACodeRefactoring；learn/pipeline.js.evolution 新增28主题/85有来源的关系、177条源状态绑定的补全批注、sphere导航归属。src/core/capability-evolution.js 统一构建，src/ui/capability-evolution.js/css 两页面共享。285来源按字符串ID/BigInt解析的发布时间UTC排序，原date保留。4处日期冲突、14个2016早期实验标签单独列出；next 是未确认正式名称的后续实验，2016球面与2024球面不能硬连单一继承。3处局部替代（内线反差图、表面阴影修正、火焰quad缩放），其余扩展/改进/解释/复用/组合/再次探索/分支分别标出，后者不冒称代码继承已证明。

来源覆盖：268管线行，263有帖子锚点，249唯一帖子；另36学习来源未登管线、5方法行没有帖子锚点。285全部进入主题和时间线；124帖子进入85关系，161条包含独立能力/参考/不足以推断传承的记录，不是161待学习。28主题含38条作品展示/发布/来源不足记录，没有按时间强行连边。177条partial高31/中119/低27是工程优先级建议，不是177独立开发任务。高优先级补明确下一步，涉及多格prefab/socket、生成/导航互连、球面多格约束、纹理接口和浪带碰撞。节点编辑器、轨迹碰撞等旧缺口先核后续交付，不重复造待办。

原完整泳道图保留折叠，189个重复来源行旁显示同一补全批注；主页面先显示阶段和时间线。共享组件支持阶段/主题/优先级/日期源码搜索、精确帖子前后跳转、跨页面同筛选和主题状态恢复。原实现流程明确不是作者时间顺序。来源摘要使用textContent，有限本地路径链接。父工坊新增默认“时间线与能力演进”页签，方法接入状态另列。物理扫描与系统目录、源index能力窗口带来源日期/主题；无来源模块不再用generatedAt假作作者发布日期。既有七文件校验快照和离线缓存兼容，演进/批注内容变化纳入资料SHA，作者记录变化使相应关系/优先级失效；这不等于所有模块字节已绑定Worker回执。

测试：5新单元覆盖全量顺序/时间冲突/关系语义/证据漂移/全部partial优先级/扫描与浏览器同指纹，加入统一入口。8769先专项交互通过，再真实8931和实时code-library API比对指纹；桌面/390px无横向溢出，partial177/原泳道189批注数量核对。初次“查看前身”搜索同时命中引用该ID的后继，专项失败保留；修成已知ID精确匹配后通过。截图已实际查看，折叠重复里程碑、隐藏父页重复搜索和空白说明条后复验。证据 artifacts/capability-evolution-20261114；最终目录见该处 review.html。

没有新增视频观看、没有完成上述177项代码，不提升partial/原验收状态，不改变场景配方/用户存档/执行器，不写原REACode。学习记录旧note中被截断或历史已完成的部分仍需对账，不能把优先级评审当全代码重验。10个原版辅助文件无目标和其他原作行为差距仍保留。

JEV本轮使用无项目数据的通用设计规则（不含路径、原文、私有记录或图片），实际调用成功，jev-1.14.0建议review；仅通用文字规则辅助，不能充当项目分类或视觉验收。未重试以前被拒的项目证据外发。输出 jev-generic-decision.json。无提交发布。

最终同批证据：both-1794636671982/browser.json PASS，source/system/live-scan 指纹均为3f9b3af104359c78b8393e97d40b00f7b3411c0fee76304e814277f69e6897bb；跨页保留sphere+高、页签来回保持筛选、errors[]。统一20261114T061119631356Z五组全部PASS。最终截图已查看，源before与初次失败保留，review.html/source-manifest.json供接手核对。

## 2026-11-14 学习工坊 ⇄ 能力库闭环：能力谱系

用户要求：按时间上的思维发展（A → A+）重新梳理能力库，让学习工坊与系统工坊打通，补上组合概念与「系统需要的能力及时补充」，先在 TigerMessenger 写规划，再按架构图优化架构与页面，并把 8769 / 8931 两条学习管线对应起来。

基线核对：时间线（285 来源 / 28 主题 / 85 关系 / 177 partial 批注）已在两页共用，但系统工坊左栏仍按目录正则分区、组合只有 7 组手写 import 闭包、执行经验与不可执行节点不回学习工坊、没有「到了哪一代 / 下一步」。

实现：
- REACodeRefactoring/src/core/capability-lineage.js：能力线 → 代际（有依据的扩展/改进/替代/适配/再次探索，或进入新阶段开新一代）→ 层级 → 代码到达 → 方向（先向前、后回补，被替代的不排）→ 模块归线（来源记录 + import 推断）→ 原版文件归线 → 组合前置（import 方向 + 跨线关系，装配入口不计）→ 补学队列（公式与理由公开）→ 适配队列 → 闭环统计。
- src/ui/capability-lineage.js/.css：闭环图、能力成长图、代际阶梯、组合、队列、适配与管线需求、执行经验；8769 pipeline.html 与 8931 学习工坊共用。
- learning-workshop.js 新默认页签；studio.js 接入可执行能力、四个经验存储、场景配方里不能执行的节点、加入管线。
- capability-sidebar.js 新默认视图「能力线 · 时间」，保留「工坊分区」；能力集合两视图都显示。
- tools/refactor/build-capability-lineage.mjs → docs/CAPABILITY_LINEAGE.md；规划 docs/WORKSHOP_LOOP_PLAN.md。

当前数字（CLI，不含本机经验）：27 条能力线 / 104 代；未补缺口 166（高 30）；可执行 40 项，32 项排进 17 条线；源码 275/365 归线（109 推断）；原版 250/290 归线；6 条线代码已有而不能执行（网格、界面装饰、战役、火焰、工具、水的消费者）。页面在系统侧另计入场景现有能力，为 50 项可执行、3 条待封装。队首：建筑 A+6、网格 A+4、导航 A+、模块约束 A+9、导航 A+4。

上游变化：learn/data.js 在 18:32 被学习任务更新，4 条 partial（837027901853810688、912691357440978945、1707490932017279035、1707497006640365880）的记录变化使原批注失效、capability-evolution 单元失败。已按新记录逐条重评并写回 completionReviews（均为中；后三条改为「校准与证据补全」），不是只同步证据字段。CAPABILITY_EVOLUTION.md 与其 artifacts 摘要未重跑，仍是 14:10 的指纹。

顺带：tests/system-workshop.test.mjs 的执行状态白名单缺 11-13 引入的 library，已补（该文件不在统一入口）。

验证：capability-lineage 5 单元通过；TigerMessenger/tests/*.test.mjs 101/101；统一入口非浏览器五组 PASS。capability-lineage-browser.mjs PASS（artifacts/capability-lineage-20261114/run-1794657507482，截图已实际查看：两页闭环图/成长图/阶梯、左栏能力线、390px）。统一入口的 workshops-browser 11/25 失败，见 WORKSHOP_TEST.md，属 11-05 后未同步的旧套件，本轮未修、也未取得改版前基线。

没有做：没有新增视频观看；没有新增或验收任何能力代码，177 partial 不变；经验未统一回写、队列未落盘；球系统 / 物件管线的待完成节点未进需求；Worker 回执未带能力线；未改 PipeLineEngine / 验证 / 采纳；未触用户场景存档；未提交发布。JEV 本轮未调用（改动是确定性计算与界面，无分类筛选批次）。

下一动作：WORKSHOP_LOOP_PLAN.md §6，先经验统一回写，再按适配队列封装网格线。

## 2026-11-15 能力网、场景诊断、网格线第一项能力、十二门徒地形对照

用户要求：继续落地；能力库要构成一张能力网，差在哪里、怎么补都给出引导；并指出十二门徒下方地形不美观、与原片柔和边缘不一致、配色与 Townscaper 不同，「地形没有学到位」。本轮读取了 oskar-world-advisor 技能说明（未派生子代理，由主代理直接处理）。

实现：
- 能力网：capability-lineage.js 增加 net（能力线节点、前置边、按主要前置的最长链分层）与 consumers 场景诊断；界面新增「能力网」段，可选对照场景，给出 ① 对照后同步 ② 接入 ③ 补学 三组引导。
- tools/refactor/scan-scene-consumers.mjs → catalog/scene-consumers.json（静态 import + 字节比较，不执行代码）；scene-consumer-notes.json 记录人工对照结论；CAPABILITY_LINEAGE.md 增「场景诊断」。
- 网格线第一项可执行能力 grid.contours（REACodeRefactoring/src/capabilities/layers-meta.js、layers.js）：复用 world/contour-overlay.js，在没有 top() 的宿主 World 上按体素位图取顶层；tests/capability-grid-contours.mjs 通过（659 段、10 个高度层、体素变化后刷新、dispose）。网格线退出适配队列（剩 5 条）。
- 十二门徒：apostlesReacode.js / apostlesTerrain.js 的库来源可切换（src/world/apostlesLook.js，默认关闭）；tests/apostles-look-browser.mjs 同机位对照。

十二门徒对照结果（run-1794746305986，截图已实际查看）：
- approved（改动后的默认路径）正常渲染、无页面错误。
- latest：崖壁折面更硬，崖顶出现橙色灌木带——不如现状柔和。
- soft：与 latest 几乎相同，台地顶面无可见缓坡，右侧出现半透明破面，远景山体外观也变了，原因未查。
- soft+palette：两次均为空白画面、无报错，原因未查；该选项已从代码删除。
- 结论与补全顺序见 APOSTLES_TERRAIN_DIAGNOSIS.md。这是一次失败的候选：没有得到更柔和的地形，默认画面未改。

验证：TigerMessenger/tests/*.test.mjs 102/102；capability-lineage-browser.mjs PASS（artifacts/capability-lineage-20261115/run-1794746860287，含能力网与十二门徒诊断截图）；统一入口非浏览器五组见本条之后的运行。

没有做 / 未验证：grid.contours 没有在真实游戏里生成候选验收；对照只有一块岩体一个机位，且是无存档生成岩体（不含用户建筑）；「高度场是主因」「色系来源不同」来自读代码，未做单独对照；经验统一回写、队列落盘、球系统 / 物件需求回流、回执带能力线仍未做；workshops-browser 旧套件未更新。未触用户存档，未提交发布。JEV 未调用。

下一动作：库里先做对地形 A+++ 软坡（队列 #20）并修软坡破面 → 十二门徒缓坡高度场候选给用户看 → 配色单独候选。

## 2026-11-15（续）能力地图：学习工坊清爽化；库软坡第一步

用户反馈：没有看到创新、对知识能力的组织，以及开发界面上的清爽。核对：页面无缓存问题（no-cache），问题在界面本身——九个页签、一页长滚动、文字密。

改动：
- 新默认页「能力地图」（REACodeRefactoring/src/ui/capability-map.js/.css，8769 与 8931 共用）：一句话目标栏「我想改善 [场景] 的 [能力线]」；左侧能力网（节点 = 能力线，节点里一串圆点 = 各代，箭头 = 前置，独立能力线单排）；右侧抽屉——未选时三个数字 + 已做过的对照结论 +「先做这三件事」，选中后是竖排代际、下一步、该场景在这条线上的旧副本 / 未接代际、可执行能力、相邻能力。
- 学习工坊头部收成一行；常用页签三个（能力地图 / 队列与闭环 / 时间线），其余六个进「更多资料」下拉；地图页隐藏缓存提示、统计行和进度卡。原长页面保留为「队列与闭环」。左栏「下一步 → 学习工坊」改为落到地图并选中该线。
- 8769 pipeline.html 顶部同一张地图，原明细折叠。
- 库：terrain/generate.js 增 limitSoftSlopes / softRelax（缓坡省相邻格 ≤1 层，只降不升，海岸与陡崖省不动，塔柱保持陡崖），terrain-r55.html 加开关，tests/soft-continuous.mjs 通过并入统一入口。

如实记录：软坡第一步的目标「演示岛出现可见的连续坡面」**没有达到**。坡度上限成立（缓坡省 ≥2 层小崖从 37/9/25/3 处降为 0），但 soft-tops 连成坡面的格角数几乎不变（54→77、23→29、38→37、12→12），成面条件（格角周围全是裸岩顶、不临地图边等）仍然太窄；软坡破面也还没定位。十二门徒缓坡候选与配色候选未开始。

验证：capability-lineage-browser.mjs PASS（artifacts/capability-lineage-20261115/run-1794818841988，地图总览 / 十二门徒 / 十二门徒×地形截图已实际查看）；单元与统一入口见下。8769 页面 390px 下旧的 #latest-progress、#lanes 两个区块本身横向溢出（与本轮无关），测试改为只判定地图 / 明细 / 时间线三段。

下一动作：放宽并修正 soft-tops 成面条件（连同破面），用 terrain-r55 同机位截图确认可见后，再做十二门徒缓坡候选。
- 上游 learn/data.js 在 11-16 又更新，4 条批注失效（837027901853810688、1151137783785771008、1201179450668441600、1205422438437273601）；已按新记录重评写回，partial 总数现为 167。
  capability-evolution.test.mjs 里写死的 177/31/119/27 改为一致性断言（数量随上游变化）。

## 2026-11-16 夜半球纯黑修复 + 十二门徒 Bad North 战场跑通

用户反馈：星球夜半球纯黑（截图确认：右半整块黑只剩窗户灯点）；并要求拿十二门徒跑一遍流程，直到 Bad North 在十二门徒实现。

发现与实现（光照）：
- 根因：`src/world/dayNight.js` 的 KEYS 深夜帧 `ambientI=0.08`、`sunI=0.14`，背光半球只剩 3% 环境光；`hemi` 与 `fill` 都按 ambientI 衰减，Toon 色块直接掉成纯黑。不是 V5 专属问题，默认旧四灯同样。
- 修复：`environment.js` 新增月光补光 `moon`（0x8fa8d8，初始 0）；`dayNight.update` 按夜晚权重 `1 - ambientI/0.9` 点亮，强度上限 0.42，位置放在太阳反向斜上方并保持抬升。V5（publishOnly）与非 V5 都写这盏灯，白天权重为 0、`visible=false`，日景不变。
- 证据：`artifacts/apostles-battle-20261116/lighting-night-after.png` 与 `lighting-noon-after.png`（同机位，`?timeOfDay=0.9` / `0.5`，本地 8931）。

发现与实现（十二门徒 × Bad North）：
- 新入口 `src/world/rea/sceneBattle.js`：复用 `reaBattleStage.js`，`?battleAt=<场景id>` 起战场，`?tour=<场景id>-battle` 接管俯视机位，`?battleScale` / `?battleRadius` 调尺度。`main.js` 只在带参数时触发，零副作用。
- `reaBattleStage.js`：`bnHouses` 在场景没有可识别建筑时退回最高台地。十二门徒是纯海蚀岩群，之前 `bnHouses` 恒空，HUD 一直「小屋 0/0」，Bad North 的防守目标根本不存在。
- 实测（`?autostart=1&battleAt=apostles&tour=apostles-battle&timeOfDay=0.5`）：
  - 舞台：4170 格、陆地 239 格、最高 8 层、4 个小屋、采样 9 ms、0 报错；
  - 第 1 波 t=12.4：`landing=reserved`、长船 1、维京人 8、守军 24；
  - 第 2 波 t=45.4：守军 24 → 16（接战产生伤亡）、小屋 4/4、长船靠岸。
- 证据：`artifacts/apostles-battle-20261116/battle-wave1-landing.png`、`battle-wave2-melee.png`（台地上可见红色维京人与蓝色守军对峙）。
- 测试环境注意：headless + swiftshader 在本场景约 0.5 fps，`dt` 被 `min(dt,0.1)` 截断，45 秒真实时间只推进 2.4 秒战斗时间（第一次误判为「波次不触发」）。验证时用 `battle.update(0.05)` × 900 直接推进逻辑；GPU 浏览器不受影响。

未做（如实记录）：
- 工坊配方执行器仍未接 `combat.encounter`：`pipeline-execution.js` 只有 16 行，仅支持 morris-lake 参数预览。本轮只把 `pipeline-model.js` 里该节点的描述改成真实状态，没有加 UI 按钮，不能算「管线内可执行」。
- 十二门徒场景里的玩家指挥（选小队 / 移动 / 驻守）未验证；胜负条件、小屋失守判定未实测。
- 未触用户存档，未提交/发布。

验证：仓库根 `node --test TigerMessenger/tests/*.test.mjs` 102/102 通过。注意在 `TigerMessenger/` 目录下跑会有 12 项因相对路径 `TigerMessenger/src/...` 变成 ENOENT 而失败，属既有用法问题，不是回归。

下一动作：给 `combat.encounter` 加配方执行器与工坊入口（先做「选中十二门徒 → 起战场 → 看实景 → 记经验」这一条）；再做守军指挥与胜负条件。

## 2026-11-17 发布版学习工坊：证据与源码必须一起上站

- 症状：线上 `TigerMessenger/pipeline#scene` 弹「资源加载失败 · Failed to fetch dynamically imported module …/src/main.js?v=authoring-entry-r1」。
- 根因一（缓存）：`studio.js` 给实景 iframe 拼的地址恒定（`?dev=1&authoringEmbed=1&authoringRevision=edit-r1…`），
  Pages 的 HTML 有缓存窗口，浏览器会继续用部署前的 `index.html`；旧副本里发布版仍走 `src/main.js`，而站点按设计不发布 137 MiB 的 optimized 源码图。
  修法：`authoringRevision` 提升到 `edit-r2`，`pipeline.html`/`studio.js` 导入版本提到 `lineage-r4`，凡是改 `index.html` 必须同步 bump。
- 根因二（缺文件）：学习工坊会在浏览器里 `fetch` 交付回执做 sha256 校验，并把「查看源码」链到 `tests/`、`artifacts/coverage/`。
  这些目录默认在 `exclude_any` 里（`artifacts` 本体 6 GiB 不可整棵发布），线上于是出现 404 与「证据或代码已变化」。
  修法：`tools/build_pages.py` 增加 `evidence_subtrees` 精确放行
  （`workshop-tests/**/browser.json`、`REACodeRefactoring/tests/**`、`REACodeRefactoring/artifacts/coverage/**` 的 md/json），
  并在构建期把 `learning-backlog-deliveries.json` 里的回执路径当作发布契约：缺一个就构建失败。
- 实测：站点 825.7 MiB / 6028 文件 / 1600 个证据文件（22.2 MiB）；`node --test TigerMessenger/tests/*.test.mjs` 102/102。
