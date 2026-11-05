# pipelineLearningGuide：学习更新接入场景管线

2026-11-04；配套 `pipelineLearningTest.md`。适用于任何接手 LLM。先读 AGENTS、WORKSHOP_GUIDE、WORKSHOP_TEST、WORKSHOP_LOG、PROJECT_HANDOFF 最新段。本文件是设计与分期落地契约，只有“当前实现”章节表示已经存在；其余不得当成已交付。

## 目标与边界

原库不断学习，新学习工坊能发现最新批次、指出学到了什么、有什么证据、是否值得接入哪个场景；通过验证后形成可选能力和升级候选。用户选择采用后进入草稿，人工修改及定稿仍由用户控制。读取进度不是学会算法，登记方法不是接入执行器，模型说通过也不是验收。

权威来源始终是 `townscaper-web/REACodeRefactoring`；原版REACode只读。工坊不另起重复视频学习，不写回或“纠正”并行学习任务的记录。REA库状态、游戏适配状态、当前场景验证状态分栏呈现，不合并成一个完成率。

## 当前实现（真实基线）

- learning-workshop.js读取 learn/architecture.js、pipeline.js、data.js，展示模块、管线、笔记与来源视频；方法可加入场景配方，已有节点可定位。
- capability-scanner.js只解析window.PIPELINE声明JSON，登记recipe-only，选中条目随配方保存。不是全源码语义扫描，也不是任意JS执行器。
- learning-progress.js与三资料视图共用经过校验的API七文件快照，刷新按钮更新整份学习资料与进度；失败保留本页最后成功资料并标旧数据，不执行原库脚本。不自动修改场景配方或升级能力执行器。
- 原库index与pipeline页面通过coverage-progress.js共用上面两份进度JSON。工坊当前进度面板与它们使用同一来源，独立页面读取时间不同可能相差一个正在写入的批次。
- 版本保存、实际参数恢复、过期定稿拒绝、不可变候选已有局部能力；DSH模型尚未验证，不能承诺自动Worker已执行。

## 用户流程与前端设计

### 当前P2只读方法登记对照（2026-11-04 22:13上海）

learning-diff.js已为比较建立身份：帖子ID、toggle、规范化来源位置共同生成sourceKey；显示名、分类顺序不参与身份。revision记录条目与原lane/group变化。新增重复帖子不会给旧条目重新编号；精确重复锚点、缺少锚点，以及同帖子/toggle的来源位置变化均列需核对，不猜测迁移。无变化重复读取不产生新增/修改/撤回。比较前后相同冲突合并，避免计数翻倍。

页面在“方法登记更新”折叠区列新增、修改、撤回、需核对，注明本页或最后缓存的比较基线。首次没有可信基线时只建立基线，不把全部方法当新增。只比较管线登记，不覆盖源码依赖变化；不修改现有scanner序号ID、recipe/discovered或定稿，不把比较身份冒充已完成旧能力ID迁移。注册表映射、用户审核回执与完整更新收件箱仍待实施。撤回只展示，不删除场景节点。

学习工坊顶部保留“最新进度”，增加“更新收件箱”；下方保留系统、管线、视频三个视图。

1. 进入工坊自动检查，按钮“检查学习更新”重新检查。显示来源更新时间、检查时间和批次指纹；离线保留上次成功记录并醒目标“离线旧数据”，不能伪称最新。
2. 收件箱按批次显示新增、修改、撤回、来源冲突。每张卡给出原帖子/模块、变化原因、原视频/逐帧/测试证据、涉及场景层、原库状态以及游戏接入状态。
3. “查看证据”只打开来源；“加入场景配方”只加入recipe-only；有兼容执行器时另给“生成升级预览”。无执行器显示待适配与缺失接口，不展示可执行按钮。
4. 场景工坊节点同时显示“来源批次”和“执行器版本”。更新通知只标记可升级，不自动换旧节点。点击查看差异：来源/接口/参数默认/检查条件/资源变化。
5. Worker或本地确定性执行器只生成隔离候选。面板并列原始、当前手工草稿、升级候选；冲突默认保留用户版本，可放弃候选。
6. 采用候选先备份当前草稿，再应用允许变更；验证后用户定稿。固定版本不跟学习更新自动变更。

词语必须准确：库“代码确认/逐帧学习/运行验证”沿用原字段；工坊“已登记/待适配/可参数预览/候选已验证/本场景已采用”单独标记。不能把上游status done映射成游戏可执行。

## 数据契约（待新增，不修改现有v1存储形状）

### LearningSnapshot v1

```json
{
  "schemaVersion": 1,
  "snapshotId": "sha256:canonical-manifest",
  "sourceRoot": "REACodeRefactoring",
  "sourceUpdatedAt": "ISO8601",
  "fetchedAt": "ISO8601",
  "files": [{"path": "learn/pipeline.js", "sha256": "..."}],
  "records": [{"sourceKey": "...", "revision": "sha256:...", "postIds": [], "modulePaths": [], "upstreamStatus": "原文", "evidence": []}],
  "progress": {"counts": {}, "latest": {}, "next": []}
}
```

来源文件范围：learn/{architecture.js,pipeline.js,data.js,coverage.json,coverage-progress.json,refactoring-status.js,coverage-overrides.json}，以及被引用模块的源码hash。缺失可选文件需显式列missing；核心pipeline/coverage/progress缺失则不激活新快照。仅索引必要模块，不遍历整个仓库/私密文件。

### P1 当前新增后端阶段（2026-11-04 06:13上海）
已新增 backend/learning_snapshot.py 与 GET /api/workshop/learning-snapshot，固定七文件白名单、每文件2MiB限制、拒绝目录外symlink、可选文件缺失标记、核心coverage/progress格式检查、有限重读检测观察到的写入变化、内容SHA256清单、ETag/304。返回sources原始文本不执行JS。

这是P1后端基础。前端已消费此API（见下节），生产者事务generation、依赖模块hash与持久化历史版本仍缺。双次稳定读取只能检测观察到的文件变化，不能证明生产者多文件事务完整：若生产任务暂停在半批写入，两次读取仍可能稳定；需要上游显式generation manifest/commit标记才能证明同批次，不得把当前实现称为完全原子批次快照。

### P1 当前新增客户端准备层（2026-11-04 12:14上海）
新增learning-declaration.js纯数据语法解析器，支持原ARCH的注释/单引号/未引号键/尾逗号及JSON声明，拒绝表达式、函数、调用、模板、原型键、重复键、额外程序与超限嵌套；不使用eval/Function或插入script。learning-snapshot.js将七文件全部SHA256、清单身份、缺失与来源时间校验后一次返回解析值，失败不改全局/DOM/配方。真实8931 API到解码器已验证7文件、39模块、243记录、7条lane。

2026-11-04 16:14上海已接入页面：准备值全部校验后先构造进度DOM，再提交三视图和进度。失败保留旧资料并标stale；pending合并请求，手动刷新全部资料，60秒内切页复用，之后进入重检；页签、搜索、配方和iframe保留。L06/L07覆盖API失败恢复和签名fixture更新，不改原库。

2026-11-04 20:15上海新增离线重载：learning-cache.js用独立IndexedDB数据库tm-learning-cache-v1的snapshots/last单槽缓存最后成功原始快照，最多1.5MiB，读写均校验。提交成功后异步缓存；配额或事务失败显示“未保存”，在线资料仍可用且旧槽保持。API失败且本页尚无资料时才读缓存，重新校验hash/版本后显示离线旧资料和保存时间；已有本页资料时优先保留。在线恢复后刷新替换缓存。请求15秒上限、IDB操作3秒上限；不使用场景localStorage、不清理其他数据库，也不请求持久化权限。L09/L10覆盖整页重载与真实浏览器模拟配额失败。这个单槽是可丢失的读取加速，不是被定稿引用的历史快照；历史固定版本、生产者事务、依赖hash仍待实现。

### 能力状态与版本

- `sourceKey`稳定标识原库方法；不能只用可变显示名称。原库缺少唯一ID时首批生成来源映射表并保留，不因分组排序变化重编号。当前扫描器重号序号不具备这种保证，须迁移映射；冲突交人工审核，不能猜测合并。
- `revision`是规范化记录/模块/证据hash；`snapshotId`按排序后的文件清单hash，排除fetchedAt，确保重复检查幂等。
- `adapterId/adapterVersion`由游戏显式注册，白名单输入输出/参数/资源/检查，不能由库toggle推导调用路径。
- `readiness`由本地检查生成：indexed → evidence-reviewed → adapter-ready → candidate-validated。每项证据记录时间、环境、结果和路径，失败/未测不得跳级。
- 配方节点未来附sourceKey/sourceRevision/snapshotId/adapterVersion；旧v1配方不写入新必填字段。旧条目保留自身discovered声明，来源消失仍能查看和导出，不删除用户节点。
- 场景实验记录使用的学习快照和执行器版本，定稿额外固定代码/资源hash。当前只是浏览器不可变快照，不是已经完整冻结代码与资源；要单独实施发布清单。

### 更新与候选

`LearningDiff`：from/to snapshot，added/changed/removed/conflicted，影响的能力ID和场景，说明字段变化。来源撤回只打警告，不删除配方/定稿。

`UpgradeProposal`：proposalId、baseSceneHash、from/to学习快照、配方diff、adapter版本、allowlist变更范围、锁、检查结果、候选文件hash。复用candidates.mjs的baseHash/不可覆盖写入/防篡改；对象区域锁未实现前整场几何只读，不能提供局部几何升级。

## 一致性、缓存和失败

推荐由8931后端新增只读 `/api/workshop/learning-snapshot` 聚合器，路径全部固定白名单。后台学习任务不必适配新API。聚合器读取前后各核对核心文件指纹/mtime，变化则有限重试；仍不一致返回409 SOURCE_CHANGING，不把跨批次组合激活为新版本。文件更新正在发生与真实损坏分开报错。

经典脚本不能eval。复用纯声明解析并新增ARCH/LEARN安全JSON适配；格式不符保留旧快照且标错。禁止从请求参数接收任意文件路径，禁止返回key/logs/用户存档。响应含ETag，前端If-None-Match支持304；no-store检查更新与按hash缓存版本数据分开。

缓存使用新key（如tm.learning.snapshots.v1），容量有界，只淘汰未被草稿/定稿引用的缓存；引用清单不能丢。原始证据仍在库，不复制大视频进localStorage。写缓存配额失败时可内存展示，但显式报告未持久化。多个页通过storage事件提示外部更新，不静默替换编辑中的配方。

## 落地顺序、文件与完成条件

| 阶段 | 工作与拟新增文件 | 完成条件 |
|---|---|---|
| P0 已完成共享读取 | learning-progress.js共享进度面板；Guide/Test | 实际同源进度匹配；刷新同时更新三资料，场景执行升级另做 |
| P1 下一优先 | backend/learning_snapshot.py；learning-snapshot.js；后端只读路由 | 固定白名单、统一hash、并发写入拒绝、304；前端一次刷新三视图及进度，不重建iframe |
| P2 | learning-diff.js、更新收件箱UI、stable sourceKey迁移表 | 新增/修改/撤回可解释、重复刷新不重复登记、旧配方不变、来源冲突不自动合并 |
| P3 | adapter registry版本与contract checks；能力就绪状态UI | 显式接口/依赖/参数/版本验证，未知能力完整执行拒绝，不运行任意库代码 |
| P4 | learning-upgrade.js接隔离candidate与工坊比较采用 | 手工漂移/锁冲突拒绝、采用前备份、失败回滚；验证器真实结果可见 |
| P5 | 固定版本代码资源manifest、场景验收与经验回流 | 固定版本不随库更新；只有重复实验支持的方法才提炼回pipeline，用户一次调整不全局推广 |

每阶段先跑配套测试，再提交下一阶段实现。没有可路由模型时P1–P3及确定性候选检查可独立推进，不能拿模型阻塞停止全部工程。

## 接手第一条具体动作

运行双工坊统一测试，读最新失败；先核对方法对照与缓存回归，继续P2的持久身份映射/旧ID兼容迁移设计与审核回执，保留生产者generation/依赖hash缺口。不要把只读登记差异或单槽缓存当场景能力升级。保持scanner接口兼容，禁止重置用户recipe/catalog/version。每轮追加WORKSHOP_LOG与下一动作；周期任务automation-2继续，其他学习任务生产原库资料，不重复视频学习。
