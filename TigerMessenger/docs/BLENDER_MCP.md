# Blender MCP 配置与验证

更新：2026-09-07。状态：**已安装、已启用，并完成真实 MCP 协议读取测试。**

## 已完成

- 服务端：PyPI `blender-mcp==1.9.1`，使用本机 uvx 启动，版本固定。
- Blender 插件：`/Users/panglaohu/Library/Application Support/Blender/5.2/scripts/addons/blender_mcp.py`。
- Codex：已在 `/Users/panglaohu/.codex/config.toml` 注册 `mcp_servers.blender`；修改前已在同目录备份配置。
- 插件在当前前台 Blender 启用，设置保存到用户偏好；未保存或覆盖当前打开的模型文件。
- 本地连接：`127.0.0.1:9876`。遥测通过环境变量和插件偏好同时关闭。
- MCP 初始化成功，列出 28 个工具；`get_scene_info` 成功读取当前湖沼虎场景，80 个对象、12 个材质。

测试证据：[blender-mcp-check.json](../artifacts/blender-mcp-check.json)。这是真正的 MCP 客户端与服务端握手/工具调用，不只是端口探测，也不是普通 bpy 后台脚本结果。

## 使用与恢复

1. Blender 保持打开。插件启用后自动启动本地服务；必要时在三维视图 N 面板的 MCP for Blender 中启动连接。
2. Codex 新会话加载已保存的 MCP 配置。如果当前会话工具列表尚未刷新，重新进入会话或重启客户端后核对；不要把“已写配置”当作当前会话原生工具已出现。
3. 当前已通过独立 MCP 客户端测试，后续也可用该客户端调用，不必等待界面工具列表刷新才检查连接。
4. 不要重复启动多个 Blender 的同端口插件。连接失败先查当前插件状态和监听进程。

从仓库根目录重新检查：

```sh
rtk proxy /Users/panglaohu/.local/bin/uvx --from blender-mcp==1.9.1 python TigerMessenger/tools/test_blender_mcp.py
```

`tools/setup_blender_mcp.py` 用于当前 Blender 中启用已安装的插件。常规情况下无需重跑，也不需要重装或覆盖配置。`test_blender_mcp.py` 只读取场景，不修改模型。

## 与生成技能的区别

MCP 负责连接 Blender、读取场景和执行建模操作；不会自动提供 Tripo/Gemini 额度或密钥。当前已安装的 Three.js 技能包可被读取使用，但凭据探测显示 Tripo、Gemini、ElevenLabs 均未配置。

二维概念可以用内置图像工具生成；Tripo 图片转 3D 仍需用户在本机配置 `TRIPO_API_KEY`。密钥不写入游戏代码、文档或聊天。若用户选择本地 Blender 重塑，则按真实参考制作并明确其制作方式。

## 配置来源

- [Blender MCP 项目与安装文档](https://github.com/ahujasid/blender-mcp)
- [Codex 官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

这些来源说明连接方式；具体安装成功与当前场景信息以本项目测试报告为证据。
