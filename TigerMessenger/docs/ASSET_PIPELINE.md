# 原作资产并发制作管线

本管线把“谁在处理哪项、做到哪一步、证据在哪里、如何中断接续”做成可运行命令。它不生成图片、不自行操作 Blender、不冒充自动游戏验收。负责人或开发模型领取任务后，实际调用内置生图工具、Blender MCP 与 Godot，再登记产物。

当前队列：`assets/pipeline/queue.json`；入口：`tools/pipeline/asset_pipeline.py`。从 Godot 全局库初始化 91 个资产/配置条目，已有原快照、Blender 档案和 Godot 实例化证据分别登记。**91 是库条目数，不是独立设计数量或完成百分比**，其中存在整片场景、父子件、涂装与装备变体。

## 实际制作顺序

1. **source → blend**：核对原工厂、参数、嵌套附属、动作引用与实际用途；原作快照和 Blender 档案不可作为“优化完成”的证据。
2. **concept**：负责人/图片协作者读取原模型和美术参考，实际调用内置图像生成工具制作概念图，保存到项目，再登记。图像生成器调用发生在开发模型工具层，CLI 不会后台假装调用 gpt-image，也不要求为这一步提供 Tripo/Gemini 凭据。
3. **candidate**：模型协作者持有前台建模租约，通过 Blender MCP 在独立副本迭代造型、材质和附属。以固定相机截图对照概念图；记录具体差异及下一次修改。候选必须是与原档案不同路径的 `.blend`。
4. **godotResource → worldPlacement → behaviorEvidence**：引擎协作者将候选导出并导入 Godot，接回原世界里的真实位置、尺度、父节点和交互系统，记录实际行走/驾驶/战斗/动画检查。不能用“GLB 可加载”替代实际系统接入。
5. **visualEvidence**：记录概念图、Blender/引擎同视角截图及比较报告。原作几何保真可用精确数据检查；概念图与三维画面存在透视和渲染差异，像素差异只是定位手段，不能单凭差值宣布美术达标。

前五个制作家族：侦察机 → gatePodCraft 泡机家族 → 重甲兵 → 罗马羽冠兵家族 → 特洛伊木马。bubblePod 已在旧目录，作为现有参考保留。每家族先做代表配置，再检查涂装、枪/剑/弓、麻醉炮口等变体；可明确登记共享概念图，不能把颜色变化算作全新设计。原世界位置和系统接入按优先资产持续推进，全面地形重构放在这些批次之后。

## 并发与租约

| lane | 实际工作 | 并发约束 |
| --- | --- | --- |
| concepts | 原图/概念与视觉比较 | 不同资产家族可并行 |
| modeling，默认 edit | 前台 Blender MCP 迭代 | 全项目最多 1 个编辑租约 |
| modeling，archive | 后台原作归档 | 最多 2 个后台归档租约 |
| integration | Godot 资源与系统接入 | 不同家族可并行；共享世界文件由负责人分配所有权 |

同一资产、同一家族的变体不能同时被不同 worker 领取，即使 lane 不同也冲突。后台归档不能登记优化候选。管线锁是合作式锁：它约束遵循命令的执行者，不能阻止绕过队列直接操作 Blender 或改世界文件。所有协作者仍须遵守文件所有权和前台未保存内容保护。

租约默认 30 分钟，最长 4 小时；执行者在每次实际修改前核对仍持有租约，长任务及时 `renew`。已过期或释放的 token 不能记录证据。过期后下一次命令会恢复队列并记入 failures，保留全部文件、历史记录。接手前核对旧 worker/外部进程是否仍在执行，不能把过期当作外部进程已自动停止。

## 命令

以下从 `/Users/panglaohu/Downloads/TigerInBamboo` 运行，所有 shell 使用 RTK。

```sh
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py status
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py next --lane concepts
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py claim scoutAircraft --lane concepts --worker concept-worker --ttl 1800
```

`next` 只是建议，不会占用任务。`claim` 返回真实 lease.id；后续将下例中的 `实际租约ID` 替换为它。**先实际生成并保存文件**，再运行 record；文件不存在会失败。

```sh
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py record scoutAircraft --lease 实际租约ID --stage concept --artifact assets/concepts/scout-aircraft-v1.png --note '原侦察机轮廓和驾驶舱保留；此文件是本轮实际生成的目标图，尚未变成三维模型'
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py release scoutAircraft --lease 实际租约ID --reason '概念证据已保存，交建模lane'
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py next --lane modeling
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py claim scoutAircraft --lane modeling --worker blender-worker
```

建模实际完成后，记录副本。`--evidence` 可重复附上概念图、检查报告或截图；每个文件都记录 SHA256。

```sh
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py record scoutAircraft --lease 实际租约ID --stage candidate --artifact assets/models/optimized/scout-aircraft-v1.blend --evidence assets/concepts/scout-aircraft-v1.png --note '独立Blender候选副本；描述本轮实际改动与尚未解决差异'
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py renew scoutAircraft --lease 实际租约ID --ttl 1800
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py release scoutAircraft --lease 实际租约ID --reason '候选与检查点已保存'
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py next --lane integration
```

Godot 协作者领取 integration 后，依次登记实际产出的 godotResource、worldPlacement、behaviorEvidence 和 visualEvidence。每一阶段都要求存在的文件和说明；`--sha256` 可传入预期哈希，匹配失败不会升阶。布局证据必须指向真实原世界的布局数据/场景，行为证据应是实际测试报告，视觉证据应包含对照图/报告，而非空文件或一段没有运行的计划。

后台归档模式示例：

```sh
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py claim scoutAircraft --lane modeling --mode archive --worker archive-worker
```

失败或中断时先保存事实，不标成功：

```sh
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py record scoutAircraft --lease 实际租约ID --failure '实际失败原因与可继续的下一步'
rtk proxy python3 TigerMessenger/tools/pipeline/asset_pipeline.py release scoutAircraft --lease 实际租约ID --reason '中断，检查点已保存'
```

缺某个外部服务凭据不阻塞其他资产的本地 Blender、资料核对或 Godot 工作；记录该资产失败/阻塞事实并释放租约。不要在命令或 queue.json 中写密钥。

## 证据和阶段语义

每项保存 source、blend、concept、candidate、godotResource、worldPlacement、behaviorEvidence、visualEvidence 指针，以及各阶段 records、历史哈希、输入哈希、worker、说明和 failures。`evidenced` 表示产物证据已登记，**不自动等于美术满意或玩法验收通过**。脚本检查文件存在、类型后缀、SHA、前置阶段和租约；它不能代替人/AI审阅画面或实际游玩。

上游产物 SHA 改变会把下游阶段退回 pending，并保留旧文件指针与 records。例如概念改版后，旧候选和旧 GLB 需要重新核对；历史“原GLB已导入”的事实仍在记录中，不能把当前版本的 pending 解释为旧资源从未导入。

初始化不根据 `.blend` 存在推断已优化，也不凭全局库的标记自动填写新队列中的概念/候选/行为证据。书店等已经做过的工作保存在 priorWorkHints，`next` 会提示先补录，避免重复生成。新队列中这些阶段为 0 表示尚未在本队列登记，不能对用户称此前工作不存在。

`init` 只新增未登记条目并补齐初始提示，不抹掉现有租约、失败或证据。跨模型接手先读本指南、项目交接文档和 `status`，领取可执行工作后继续。队列不能自行切换模型、提供额度或唤醒其他客户端。

## 持久化与测试

所有命令通过文件锁串行更新 JSON；临时文件写入并 fsync 后原子替换，目录也同步。不会让并发写入产生半份 queue.json。`.lock` 是运行时锁文件，不是另一个任务清单。

```sh
rtk proxy python3 TigerMessenger/tools/pipeline/test_asset_pipeline.py
```

8 项临时目录测试通过：原档案不推断优化、真实同时领取只一方成功、前台1/后台2容量、缺文件/错误SHA拒绝升阶、中断和租约恢复、旧token无效、共享家族/原档案保护、上游改版下游失效与外部源文件变更检查。测试不写真实资产队列，不调用生图、Blender 或 Godot。
