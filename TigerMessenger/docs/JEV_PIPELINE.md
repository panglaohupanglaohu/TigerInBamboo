## 2026-09-24 用户指定接口已真实验证可用（最新）

使用用户提供的 `https://jevtypesafeai.com/api/v1/decide`，Bearer认证，请求体仅state/questions；不传model。环境变量JEV_API_KEY，或读取原仓库外私有文件（0600）。这是用户指定服务，不能称为已验证的TypeSafe官方直连。缓存键包含端点，避免与历史官方请求混用。

水晶城真实调用成功：返回model=jev-1.13.0；input1159/output91；服务报告cost_usd=0.000487；耗时1741ms。第二次相同输入命中本地缓存，不发送网络请求。Jev建议geometry但confidence=0.5，需Astra复核；本地硬检查仍标出完整步行/剧情回归未测，不能据此通过验收。证据和决策位于artifacts/pipeline/jev/crystal-v7-*.json。之前的401源于接口与密钥服务不匹配。

## 2026-09-24 本机恢复状态

已恢复仓库外密钥文件（0600），新增水晶城入口 `python3 TigerMessenger/tools/jev/review_crystal_v7.py`。目标图与实景观察绑定SHA256，压缩证据已生成。首次真实调用返回HTTP 401，未自动重试、未验证缓存，当前不能称为可用。已对照官方文档确认端点和Bearer认证格式，需有效凭据后继续。没有保存密钥到项目文件。

# Jev System One：迭代决策辅助

2026-09-21 已实接官方 API，模型固定 jev-1.13.0。不是 Codex 内置工具，也不会自动替换当前模型。

## 职责与流程

目标图/当前渲染 → Astra观察一次并记录具体差异 → 本地碰撞、通路、WFC检查 → 压缩成文本JSON → Jev一次批量判断 → 本地规则校验 → Astra执行Blender/关卡修改 → 重跑受影响检查。

Jev只有文本输入，不能直接看图片、画图、写模型或调用Blender/Godot。不要把传入图片路径说成Jev看过图。美术观察必须标明来源与版本。不要将Jev置信度视为美术验收概率。

关卡生成时只用于已生成候选的分类与下一步选择；WFC约束、几何碰撞和连通性仍由确定性检查负责。失败/缺少必需检查会覆盖模型建议；不允许其直接发布、改写资产或通过验收。低于0.85置信度交给Astra复核，此阈值是初始配置，尚未经项目样本校准。

## 已接入口

在仓库根运行：

```sh
rtk proxy python3 TigerMessenger/tools/jev/review_junction.py
```

此适配器读取交汇古堡现有步行与港池报告，保存紧凑证据与决策到 `artifacts/pipeline/jev/`。画面对比的文字目前来自Astra人工观察，场景变化后必须同步更新 junction-visual-observations.json 中的观察及图像哈希；适配器会拒绝与新渲染不符的旧观察；不能沿用旧描述冒充新看图。它不是后台服务，不会在每一帧或每次打开游戏时调用。

其他资产/关卡使用通用入口：

```sh
rtk proxy python3 TigerMessenger/tools/jev/evaluate.py evidence.json --output decision.json
```

证据格式参见 `artifacts/pipeline/jev/junction-evidence.json`：目标、来源明确的视觉观察、checks数组（name/required/passed）、约束和版本。passed=null表示未测，绝不能写true。建议每个候选使用独立证据；不传完整聊天或源代码目录。

## 本机配置与省量

- 密钥位于 `~/.config/tigermessenger/typesafe.key`，权限0600，仓库外；也支持 JEV_API_KEY 环境变量。
- 当前认证接收端是用户于2026-09-24明确提供的 `https://jevtypesafeai.com/api/v1/decide`，不要与历史 TypeSafe 官方地址混用。密钥不放网页、日志或Godot资源。
- 内容、模型及问题共同做SHA256缓存，位于 `~/.cache/tigermessenger/jev/`。相同输入0次网络请求。
- 请求最大24KB，25秒超时，不自动重试付费请求。接口异常转人工复核，不能当通过。
- 输出记录用量和耗时；缓存命中时usage代表首次调用，不能累计成新增消耗。
- 仅生成下一步建议，不自动修改项目。尚无与原流程的对照节省率，不能承诺百分比。

## 本次验证

真实交汇处报告：模型jev-1.13.0，输入920/output91，749ms，选择navigation置信度0.94。第二次相同调用命中缓存。模型指出缺少实际动态航行/上下船验证，本地硬性检查也阻止越过该项。

官方依据：
- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/models
- https://docs.typesafe.ai/concepts/state
