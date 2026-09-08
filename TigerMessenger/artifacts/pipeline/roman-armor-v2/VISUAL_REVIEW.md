# 罗马兵盔甲 v2：真实 Blender MCP 候选

输入：assets/concepts/roman-soldier-target-v2.png；src/assets/harbor.js:848-860 与 1073-1090；实际原始 blue gladius .blend（仅 libraries.load 追加为独立参考场景，未 open_mainfile/覆盖任何已开文件）。source-blender-read.json 记录真实原 mesh 界限并与 .source.json 核对。

套件 .blend 保存时只包含空根与三网格；GLB 最终修正 use_active_scene=True 且 use_selection=True，不含参考人体、其它场景、相机或灯。最终 glb-verification.json 验证单场景、单根、3 mesh / 696 triangles / 3 primitives / 2 原色材质、所有节点 identity。盾把的隔离导出也一并校正，几何保持。模型生成、两轮迭代、导出皆实际 MCP execute_blender_code，完整调用结果在本目录；不是后台过程冒充 MCP。

正面和侧面实际 Cycles 渲染使用归档原头/躯干/四肢/羽冠几何，未创建代替人体。首轮发现羽冠座偏高、腰带偏宽，第二轮缩短羽冠座并把原羽冠统一下降 .018、收腰并把腰带上移到原躯干下缘。round1-* 保留对比。最终 armor-front.png / armor-side.png 已查看：头盔为12角有厚度的分面弧壳，额带不遮面中区，左右短护颊与后颈护分别形成清晰开口；中间面部保留原皮肤；十片裙甲末端互不连成盘，纵向空隙可見，长度到上腿，不盖原腿段中点以下。

装配见 assembly.json：attach n2，hide n5/n9及其outline；n11/n13/n15相对原位统一Y -0.018。root/fig/body/动态四肢/装备和羽冠的几何、配色、身份均保留，红蓝source节点合同已检查。顶座与降低后的羽冠有几何交叠连接。

限制：这是头盔/裙甲可穿戴候选，不是完整士兵复刻验收；盾/握持和游戏动画由引擎适配方联调。原羽冠依旧是原作扇片，并未自行转向或重建为概念图的另一种冠饰。原躯干与四肢仍保持较粗的原始多边轮廓；当前新裙甲是静态分片，尚无独立布料/腿部避让动画。不能据静态两视图声称所有运动无穿模。
