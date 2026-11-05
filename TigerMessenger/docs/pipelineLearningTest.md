# pipelineLearningTest：学习更新接入验收

配套pipelineLearningGuide。本文是完整测试契约，不代表全部已实现。状态采用PASS/FAIL/BLOCKED/NOT_RUN；每轮记录唯一证据目录和源snapshot/hash，不能只报“同步完成”。

## 当前可执行测试

`python3 TigerMessenger/tools/scene-authoring/test_workshops.py`：运行现有单元/代理/watchdog与隔离浏览器。浏览器L06检查进度updatedAt/批次标题与原库一致，模拟503后刷新恢复。原库扫描/来源视频/学习到场景往返见L01–L05。现有手工核对证据：artifacts/pipeline/scene-authoring-20261103/learning-progress-sync.json及learning-progress.png。后三视图全目录热刷新不在当前实现范围。

## 分阶段测试矩阵

| ID | 输入/操作 | 预期结果 | 实施阶段 |
|---|---|---|---|
| LP01 | 同时读原库index/pipeline与新学习页进度 | 同一源snapshot时counts/updatedAt/latest相同；游戏就绪另列 | P0浏览器 |
| LP02 | progress请求503/404/格式错误，再恢复 | 标读失败、可重试、不显示为最新；不能清配方 | P0/P1 |
| LS01 | 同样七源连续读取两次，fetchedAt不同 | snapshotId/record revision相同，无重复能力 | P1纯函数 |
| LS02 | 仅修改某记录或引用模块 | snapshot变化，准确列受影响record，无关记录revision稳定 | P1 |
| LS03 | 聚合读取途中写pipeline/progress | 有限重试或409，不激活跨批次快照 | P1服务集成 |
| LS04 | 缺核心文件/损坏JSON/脚本有可执行表达式 | 明确失败、绝不eval，旧成功snapshot保留 | P1安全解析 |
| LS05 | 请求任意path、../、绝对路径、日志/密钥 | 路径参数不支持/拒绝，响应无敏感数据 | P1服务 |
| LS06 | ETag一致/变化，服务离线 | 304/新200；离线旧数据标签与最后成功时间正确 | P1网络 |
| LS07 | 页面检查更新后切系统/管线/笔记 | 三视图和进度同一snapshot，iframe与未保存配方保持 | P1浏览器 |
| LD01 | 新增、修改、删除、重排、重名/重号 | diff准确；重排不改身份；删除只标撤回，冲突不自动合并 | P2 |
| LD02 | 旧v1 recipe含discovered，目录更新或来源删除 | 仍能加载/查看/导出，显式升级前字节和节点不变 | P2迁移 |
| LD03 | 点两次加入同能力、同批次重复刷新 | 幂等，定位已有节点，撤销链一致 | P2浏览器 |
| LD04 | 两页同时编辑、缓存配额不足、进程中断 | 提示外部新版本/持久化失败，保留当前编辑；引用快照不淘汰 | P2持久化 |
| LA01 | status done但无adapter/缺依赖 | 只能recipe，不能预览执行或宣称通过 | P3 |
| LA02 | adapter参数类型/范围/版本不兼容 | 本地拒绝，列明确缺口，不调用场景 | P3 |
| LA03 | adapter返回错误或实际场景不满足检查 | readiness不提升，保留失败证据 | P3 |
| LU01 | 升级候选时scene/参数/recipe已有手工修改 | baseHash冲突拒绝，无覆盖用户版本 | P4 |
| LU02 | 候选改锁区、改未允许几何、文件hash篡改 | 拒绝，无副作用，整场几何锁直到局部锁真实实现 | P4 |
| LU03 | 预览/拒绝/采用/撤销/恢复失败 | 未采用不改草稿，采用先备份，失败完整回滚 | P4浏览器 |
| LU04 | 模型服务离线/无模型/超时 | Source收件与执行状态区分，游戏编辑可继续，不假报AI完成 | P4 |
| LF01 | A定稿后库/adapter升级B，再开A固定链接 | 仍加载A数据+参数+配方+代码资源manifest，不能漂到B | P5 |
| LF02 | 新环境缺A资源/版本 | 明确失败，不悄悄加载最新版冒充A | P5 |
| LF03 | 用户一次局部改动vs重复多场景实验 | 前者仅场景决定；可复用规则需实验及失败证据 | P5 |

## 真实测试环境和证据

纯函数测试用小型脱敏fixture覆盖新增/撤回/重排/冲突，不测试代码字符串本身。服务测试在临时目录模拟并发更新，不写真实REA学习记录。浏览器使用独立context，同源8931，不碰用户profile，不自动提交模型任务或用户定稿。

进度同步验证既要断言数据，也要实际看图：标题、更新时刻、缺口和来源链接可见；离线不误导。相同批次比较才要求相同内容，源正在更新应记录SOURCE_CHANGING，不能为让测试绿而冻结/覆盖原库。

完整验收前必须测试桌面/窄屏、键盘操作、重试、去重、撤销恢复、固定版本、游戏手动修改保护以及性能。数据传输/解析耗时、更新记录量和内存增长保存数值；性能阈值由实际基线确定，不虚构FPS达标。

## 测试记录模板

时间及LLM执行者：
阶段/关联需求/变更文件：
来源snapshotId、adapter版本、scene baseHash：
测试ID、命令/操作、预期、实际、PASS/FAIL/BLOCKED/NOT_RUN：
证据（JSON/log/截图/原始失败+重测）：
场景保护检查/未验证项：
下一阶段第一条动作：

每轮追加WORKSHOP_LOG并更新WORKSHOP_TEST覆盖矩阵。只有实际执行的测试记PASS；P1–P5未实现前逐项记NOT_RUN或BLOCKED，不将这份规范本身视作测试已完成。
