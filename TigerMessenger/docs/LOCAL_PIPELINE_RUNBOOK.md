# 本地生产线：执行与接手

更新：2026-09-09。此页记录实际可执行部分，优先于旧文档中“只有预检包”的历史描述。

## 现在能做什么

项目根目录双击 `Check-Local-Pipeline.command`，执行已审查的 Blender / Godot / Web 工程作业，然后打开状态页。会运行制作工具但不请求模型推理、不下载权重。必须在有本项目、Blender、Godot、Python 3 的制作机运行；目标 Studio 的程序路径需按安装位置核对。此启动器不是 Mac 模型安装器。

Web 作业还需要 Node.js、父目录 `tools/shot/node_modules/playwright` 和 Playwright 已安装的 Chromium。迁移到 Studio 时保留此依赖目录布局或调整浏览器检查脚本的导入路径；缺依赖会报告失败，不会假装跳过通过。

状态页：`artifacts/pipeline/local-runs/status.html`。该页是保存的检查点，页面上的时间是生成时间。它显示真实任务状态和报告，不把工程检查通过数写成模型优化百分比。

- `runner.py`：运行一轮明确任务；同输入/同脚本/同报告与产物哈希可复用，修改后失效；失败两次转待检查。持久状态在 `assets/pipeline/local-runs/state.json`，每次产物独立保存。
- `mcp_client.py`：真实 MCP stdio 握手、工具发现和调用；已用现有 Blender 服务完成只读场景查询。超时与子进程组清理有测试。
- `qwen_agent.py`：最多 6 轮/12 个工具调用，读取所选资产、查询 Blender 场景、执行审查过的任务，并将结果送回模型。支持最多两张目录内的 PNG/JPEG 参考/渲染图；只记录实际提交，不自动宣布视觉通过。
- `blender_jobs.py` / `blender_export_check.py`：在后台打开已有候选的指定场景，输出新文件并做结构检查。红蓝士兵盔甲文件包含其他上下文场景，必须用指定 v3 场景，不能全文件混出。
- `web_jobs.py`：临时本地服务 + 无头浏览器，验证实际虎工厂/世界回调的 36 项检查并保存同镜头对比图；它不是完整游戏救援验收。
- `godot_jobs.py`：在全新隔离工程执行虎、罗马兵、城堡检查；不抢活动编辑器的导入缓存。

这是一套可执行的验证/导出管线与模型桥接，尚不是可以自己重塑所有资产的完整美术生产线。新造型与材质的参数化修改模板、跨阶段部署策略仍需加入。Qwen 真实推理和 LLaDA 出图未接通；不能把本地模拟接口测试说成目标机器推理通过。

## 单轮与恢复

在项目根目录：

```sh
python3 tools/pipeline/local/runner.py \
  --catalog tools/pipeline/local/jobs.blender.example.json \
  --catalog tools/pipeline/local/jobs.godot.example.json \
  --catalog tools/pipeline/local/jobs.web.example.json --run
```

重复执行会重新计算输入与已存报告/产物哈希；一致的已通过任务返回 `cached_pass`，不重新开引擎。`--job <id>` 可只跑一项。两个执行器争用时，后者报告忙；不同目录的独立制作仍不能绕过资产/家族锁。

资产检查通过现有队列的 `validation` 租约运行，遵循同资产/同家族互斥，但不能直接写入美术或玩法完成阶段。城堡是原世界部署对象，不冒充独立资产登记，使用 `castleContainer` 世界身份和引擎资源锁。

停止执行时保存中断状态并清理子进程。意外强杀后，如果旧进程组仍存在，执行器报告阻塞并继续其他工作，不猜测 PID 身份并杀掉未知进程。旧租约只能凭自己的 token 释放；输入修正后才重新获得可重试预算。不要删除队列来“恢复”。

若两次失败，需要读该任务的 `execution.json`、日志和原始报告，修复脚本/输入再重试；不反复发送“继续”消耗算力。任务报告路径必须属于本轮新目录，不能把旧报告复制成新运行证据。

## 连接 Studio 后

先依据 `LOCAL_ASSET_FACTORY_MAC.md` 部署 Qwen，复制并修改 `config.m5max64.example.json`。读取 `/v1/models` 填真实模型 ID，然后将 configured 设为 true。模型未配置时，程序明确返回 `not_configured`，零次推理/工具执行。

```sh
python3 tools/pipeline/local/qwen_agent.py \
  --config tools/pipeline/local/config.json \
  --catalog tools/pipeline/local/jobs.blender.example.json \
  --catalog tools/pipeline/local/jobs.godot.example.json \
  --job godot-tiger-world \
  --output artifacts/pipeline/local-runs/qwen-first-live.json --run
```

输出路径须未存在。自有局域网服务可使用 `--allow-nonlocal`；密钥引用环境变量名。模型只能选择所选任务同一资产/世界范围内的审查任务，不能通过工具参数执行任意代码。CLI 只有模型轮次正常完成且所选工程任务真实通过才返回成功；模型文字“完成”不算验收。

`jobs.godot.example.json` 中虎任务使用既有认可图和旧的 v3 检视截图作为视觉上下文，并明确注明不是本轮无头检查新截图。需要新画面对照时，另执行真实渲染作业，保留相机、画面与哈希，再更新 visual_inputs。Qwen 收到图片仍不等于它判断正确，要对实际差异做标定。

## 后续优先级

1. 取得 Studio 的连接入口，真实核验文本、工具续答和双图理解；硬件型号已由用户给出，不再重复询问。
2. 扩充经过验证的家族建模修改模板及输出挂接，允许 Qwen 调参数并比较渲染，而不只重复导出同一资产。
3. 将每次新候选进入隔离 Godot 的检查与真实区域的可回退部署连起来。美术、动画接触、碰撞与剧情验收仍分开记录。
4. 独立解决 LLaDA MPS 兼容性；已有认可图的任务继续执行。不得静默替换用户指定生图模型。
5. 完成 5–10 件包含真实修改的资产小批标定，再扩大吞吐；目前的六个工程作业不是“六个新优化资产”。

用户已要求持续推进，并已有每 2.5 小时检查/续作任务（以应用内最新配置为准）。本执行器运行一轮后退出，状态页不会自己工作；续作调度、应用是否运行与本地模型服务是不同层次，文档不能代替它们。
