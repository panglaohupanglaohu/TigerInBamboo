# Mac Studio 64GB：本地资产生产线部署档案

更新：2026-09-09。用户指定 **Mac Studio M5 Max、64GB 统一内存**。这是目标机器的用户报告，尚未远程核验；当前工具连接到的是 **Apple M2、16 GiB**。不要在当前机器自动下载目标机的大模型。目标机地址/服务端点待补充，硬件无需重复询问。

## 当前结论

Qwen 使用 Apple Silicon 的 MLX 4 位版本作为首选部署候选。LLaDA-Image 的官方 CUDA 路径不能直接作为 Mac 安装教程；将其适配列为单独里程碑。先复用已认可的虎、士兵、圣城图，让建模与引擎链路继续。

配置模板：`tools/pipeline/local/config.m5max64.example.json`。`configured:false`、`targetAccessVerified:false` 均为真实状态。该文件中的内存/并发是待实现的调度策略，预检工具不会自动执行这些限制；目前已有可恢复的单轮 runner，但没有常驻生产调度或已上线的本地模型服务；见 `LOCAL_PIPELINE_RUNBOOK.md`。

## Qwen：MLX + 支持图像和工具调用的服务

- 起点：`mlx-community/Qwen3.8-27B-4bit`，模型卡显示文件约 **16.1 GB**，采用 mlx-vlm 转换。下载大小不是运行峰值；还需视觉编码、上下文缓存和执行临时内存。[模型与图像输入示例](https://huggingface.co/mlx-community/Qwen3.8-27B-4bit)
- 后端候选：oMLX，提供 Apple Silicon 推理、视觉输入、工具调用与兼容 API。安装后首先验证这个具体模型组合，不能由“支持 MLX”推断全部特性成功。[oMLX 官方仓库](https://github.com/jundot/omlx)
- 从 `/v1/models` 读取真实模型 ID；服务端目录名/别名可能不同于 Hugging Face 仓库 ID。模板故意使用待填写 ID，不能直接开启 `configured`。
- 首次采用一个推理请求、最多 32K 上下文；只提供当前资产及依赖片段，长期记忆保存在任务档案。先不启用实验性 ANE、投机解码或大批并行。
- 看图检查要实测两张本地参考/渲染输入。只成功文字聊天或文字版服务不算通过。

目标机上的安装步骤（尚未执行）：

1. 核对芯片、内存、macOS、可用磁盘；从 oMLX 官方发行页安装 macOS 应用，记录发行版本。
2. 下载并记录上述 MLX 模型 revision 与文件哈希。通过 oMLX 的模型目录加载，先绑定本机地址。
3. 核对 API 地址和 `/v1/models`，填入配置；API 密钥只引用环境变量。
4. 运行现有 doctor 和 qwen_probe：确认文本、结构化 tool_calls。再补工具结果续答、双图理解测试；现有 probe 尚未覆盖这两项。
5. 成功后接资产队列执行者，而不是让模型自己宣称“已经调用 Blender”。

如果模型与 Blender/Godot 全在 Studio，全部保持本机调用。若制作仍在当前 Mac，Qwen 通过局域网服务或已有 SSH 隧道提供推理；Blender MCP 仍在制作机本机监听。访问方式和目标机端点确认后再实际配置。

## 64GB 的起始调度

统一内存由系统、模型、Blender 和 Godot 共享，不是 64GB 独立显存。以下为保守的启动策略，**不是峰值实测或已生效的服务器限制**：

| 阶段 | 策略 |
| --- | --- |
| Qwen 决策/编码/看图 | 一个推理请求；为系统和制作软件预留至少约 24GB 的规划空间；观察实际内存压力与 swap |
| Blender 建模 | 一个前台 MCP 写入者；最多一个后台模板作业；先以小资产测量 |
| 大场景渲染 | 暂停新增推理，必要时卸载 Qwen，确认内存释放再渲染 |
| LLaDA 生图（适配通过后） | 与 Qwen、大场景渲染共用互斥资源锁；先卸载其他大模型，再加载图像模型 |
| Godot 导入 | 一个提交者，在隔离工作副本导入；不争用活动编辑器缓存 |

文件检查、任务准备可以并发；重型 GPU 阶段按队列串行。不要让每个资产启动一个 27B 实例。压力上升先缩短上下文、减少图像分辨率/数量或卸载闲置模型，不以持续 swap 当正常生产。吞吐率必须由目标机的 5–10 件小批实测决定。

## LLaDA-Image：先做 Mac 兼容性验证

核查官方源码 revision：`e7c861b0aaa00d2f7ed49600a3a6f170e02a9d59`。

- 官方 README 的加载和随机数生成器使用 CUDA；requirements 固定 PyTorch 2.8.0、Transformers 4.57.6、Diffusers 0.39.0、flash-attn 2.8.3。[官方安装与示例](https://github.com/inclusionAI/LLaDA-Image/tree/e7c861b0aaa00d2f7ed49600a3a6f170e02a9d59)
- 主 Transformer 使用 Diffusers 的 attention dispatch，且 RoPE 路径包含复数张量和 view_as_complex/view_as_real。这些是需对所选 MPS/PyTorch 版本实测的具体位置；不是已证实全部不支持，也不能只把 cuda 改成 mps 就宣布兼容。[Transformer 源码](https://github.com/inclusionAI/LLaDA-Image/blob/e7c861b0aaa00d2f7ed49600a3a6f170e02a9d59/src/models/transformer_llada_image.py)
- 尚未验证可直接部署的官方 MLX/MPS 全流程。6B 是扩散模型规模，额外模块和临时张量也占内存，不能直接按 12GB 总占用计算。

适配验收顺序：

1. 独立 Python 环境；在源码副本中审查 flash-attn 的实际调用，选择可用的标准注意力路径，不能原样执行 CUDA 依赖安装。
2. 不加载全部权重，先验证注意力、RoPE、dtype、调度器和随机数路径；数值与 CPU 参考对照，记录任何 CPU fallback。
3. 确认模块加载次序与内存后，运行一张小尺寸 Turbo 文本图，再运行一张参考图编辑。以官方要求的尺寸倍数执行。
4. 记录实际后端、峰值内存、总时间、输出图和失败原因。只有完整输出通过才实现 HTTP image worker 并开启队列生图阶段。
5. 若适配不通过，现有参考图继续承担美术目标；新生图任务明确排队。是否换生图模型或另用 CUDA 机器是独立方案选择，不悄悄替换用户指定模型。

## Blender / Godot 的接口不随推理芯片改变

Qwen HTTP → 项目 runner → MCP stdio 客户端 → Blender 插件。已有 MCP 服务可复用；MCP 客户端与受限 Qwen 工具循环已实现并通过本地模拟测试；真实 Qwen 联调待 Studio 连接。Godot 由 runner 调用官方 CLI 和项目内验证脚本，实际渲染另行执行。保留资产 ID、家族锁、原作副本和验收证据，接续现有 92 条队列。

下一条动作：取得目标机连接入口，验证 Qwen 文本/工具/看图；已有工具执行循环可接线，继续补家族建模修改模板。LLaDA 兼容性工作独立推进，不能阻塞已有参考资产的建模与引擎验证。完整职责、批次和验收见 `LOCAL_ASSET_FACTORY.md`。
