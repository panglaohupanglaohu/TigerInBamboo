# 已有执行功能（2026-09-09 更新）

本目录已扩展为可运行作业包。完整使用见 `docs/LOCAL_PIPELINE_RUNBOOK.md`；一键入口 `Check-Local-Pipeline.command`。下方“预检包”说明只适用于 doctor/qwen_probe，不代表 runner 不会启动引擎。

- runner.py：审查目录作业、持久恢复、哈希缓存、资产/家族租约、失败预算。
- mcp_client.py：真实 MCP stdio 客户端。
- qwen_agent.py：受限工具循环和双图输入；真实模型服务未接通。
- jobs.blender.example.json：两个现有候选的新 GLB 导出→Blender/Godot 往返检查。
- jobs.godot.example.json：三个真实世界/姿态回归任务。
- status.py：生成可点击证据状态页。

```sh
python3 -m unittest discover -s tools/pipeline/local -p 'test_*.py'
python3 tools/pipeline/local/runner.py --catalog tools/pipeline/local/jobs.blender.example.json --catalog tools/pipeline/local/jobs.godot.example.json --run
```

所有代码/图像工具输出都不能自动标记美术或玩法验收。当前是验证/导出执行能力，建模修改模板与真实 Qwen/LLaDA 部署仍需完成。

# 本地连接预检包

本包复用 `tools/pipeline/asset_pipeline.py` 的资产队列，不启动服务、不下载模型、不接管 Blender、不执行模型输出。仅使用 Python 标准库。

用户的 Mac Studio M5 Max 64GB 使用 `config.m5max64.example.json`；部署步骤见 `docs/LOCAL_ASSET_FACTORY_MAC.md`。其中资源限制是规划元数据，不由本预检包强制执行。

先复制对应示例为自己的配置。示例 Qwen URL 是本机占位地址，`configured:false` 防止把占位配置当成服务；只有确认自己的服务端点后才设为 true。密钥仅填写环境变量名称 `apiKeyEnv`，不要写明文密钥。示例中的 Godot 和 Blender 路径来自本机实际安装位置，其他机器需调整。

```sh
python3 tools/pipeline/local/doctor.py --config tools/pipeline/local/config.example.json
python3 tools/pipeline/local/test_local.py
```

doctor 只读访问 Qwen `/models`、读取二进制 `--version`，并检查 Blender TCP。模型列出不等于推理通过；9876 端口可达不等于 MCP 调用成功。它不运行 `uvx`，因此不会隐式安装或启动 `blender-mcp==1.9.1`。当前包没有完整链路验收，`pipelineReady` 保持 false；未就绪退出码为 1。

确认本地 Qwen 服务和硬件后，显式运行以下命令，发送两次短请求（一次文本、一次工具 schema）。输出文件必须尚不存在。

```sh
python3 tools/pipeline/local/qwen_probe.py --config tools/pipeline/local/config.json --run --output /tmp/qwen-probe.json
```

默认只允许环回地址，禁止跳转和环境代理。自有非本机端点需显式 `--allow-nonlocal`。工具响应必须包含真实 `tool_calls`、正确函数名和严格参数，正文伪造工具格式不算通过；记录仅保留验证结果，不记录原始模型文本或密钥，也不执行工具。

Mac 首选 MLX + oMLX 候选后端，先从 `/v1/models` 填写实际 ID。Qwen 服务需实际支持工具解析；以下 vLLM 配方只供 CUDA 部署参考：[vLLM 官方配方](https://recipes.vllm.ai/Qwen/Qwen3.8-27B)列出 `qwen3_coder` 工具解析器，[Qwen 模型页](https://huggingface.co/Qwen/Qwen3.8-27B)提供部署说明。

LLaDA 是独立图像 worker。此包没有假定它提供通用 OpenAI 兼容接口；需要基于[官方 LLaDA-Image 工程](https://github.com/inclusionAI/LLaDA-Image)另建、测试 HTTP 包装层。填写 `serviceURL` 不代表模型已安装、权重已加载或出图成功。doctor 对该部分始终报告未验证，不凭一个通用健康响应宣称图片生成可用。

离线测试仅连接临时环回 fake HTTP server，验证模型缺失、HTTP 错误脱敏、未配置、远端阻止、密钥环境变量及真实工具调用格式；不触达模型服务。
