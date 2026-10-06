# 山水生成算法研究 · 2026-09-28

用户提到 Oskar / Townscaper / MCF。本次公开证据确认 WFC + Marching Cubes + 不规则网格；另有三角/四边形组合的岛屿生成器。未发现 MCF 是 Townscaper 山体核心算法的可靠证据。

来源：
- WFC 原作者仓库 https://github.com/mxgmn/WaveFunctionCollapse
- Oskar SGC21 Beyond Townscapers https://www.youtube.com/watch?v=Uxeo9c-PX-w （定位到演讲链接，未声称逐帧观看）
- 曲率流网格平滑论文 https://www.geometry.caltech.edu/pubs/DMSB_SIG99.pdf
- Houdini 水力/热侵蚀 https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_erode
- GPU Gems 水面模型 https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models

针对当前场景的建议（设计推论，尚未实施）：先按目标确定主峰、山脊、鞍部、海岸，再用地形模块邻接约束衔接，局部侵蚀/受约束平滑补充沟壑和坡脚。固定铁路线、城基、港口、步行面作为禁止侵入区域。水面独立采用波形与岸线效果。WFC 不能弥补模块质量不足，MCF 平滑也不能替代地质构形。

## Bad North 补充核实

确认 Oskar 在 Bad North 使用 WFC 组合手工地形模块，并加入偏向扩展可通行区域的选择策略。原作者仓库记录该启发式；Oskar 的原始演讲为 EPC2018 Wave Function Collapse in Bad North：https://www.youtube.com/watch?v=0bcZb-SsnrA 。另有美术演讲 Developing The Bad North Look：https://www.youtube.com/watch?v=6JcFbivo8dQ 。本次未获取演讲完整字幕，不声称逐帧观看。

访谈来源（采访本人）：https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making 。根据模块接口组合地形与平均曲率流平滑是不同层次；未找到 Bad North 使用 MCF 核心生成的可靠证据。

对本场景的后续建议：从人工山脊骨架发展山脊/鞍部/坡面/崖角/坡脚模块库，定义高度、材质和通行接口，再接邻接求解；保护城基与轨道的固定约束。本轮 mountainLandform.js 已实现人工山脊图与受约束平滑，尚未完成这套新模块 WFC 求解器，不能称已复刻 Bad North。
