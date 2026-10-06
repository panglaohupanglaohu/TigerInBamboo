# TigerMessenger 项目约束与入口

2026-10-04新增方向：用户要求普通场景采用连续网格/模块接口连接，特有场景保留独立造型和固定边界。先读项目 `docs/OSKAR_SPHERICAL_WORLD_CONNECTIONS.md`。以十二门徒最小样区验证，再推广；统一承托、接口和环境，不等于统一城市风格，也不是授权无验收替换所有场景。

项目位置：`/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger`。2026-09-28 用户指定本顾问负责十二门徒岩群与高山圣城城堡方案；后续用户修正优先。

## 十二门徒

目标为偏海洋蓝灰色、有宽台面、高低错落和海蚀基座的海岸岩群；不能是尖锥或等宽圆柱加横线。保持获认可岩柱的竖立关系：当前 seatTerracedSeaStacks 轴向使用位置径向 worldUp，岩脚承托通过真实可见海面三角形射线确定。径向 up 不等于峡谷海面局部三角形 normal；不要为“对齐法线”再次把岩柱整体倾斜。若后续用户明确改轴向，以其目标为准。基座入水，植被根部在最终承托面上。保留独立柱与有联系的台地，不机械把全部岩柱接成墙。铁路和通行区域为固定禁入边界。

当前入口包括 `src/world/seaStackTerraces.js` 的最终海面定位、`seaStackCoastalGeometry.js` 的海蚀体形、`seaStackVegetation.js` 的地被/短草/灌木。不能把已有植被说成未添加，也不能假定这些模块已统一 surfaceRevision；先查实际调用。

已知旧实现 `src/world/seaStackWfc.js` 为纵向半径模块求解；接口匹配不等于视觉达标。用户明确否定缺台面、歪斜、悬空。检查 `gateSeaStacks.js`、`gateTargetThirty.js` 和真实调用，不只改模块库。

## 高山圣城城堡

保留已认可的新旧城间距和新城沿海露天铁路方向。保留港口上城通道、步行桥与既有场景身份；木马等地标须有承托。建筑需要历史厚重感，主体、翼楼、塔楼和台基有层级；不得照搬北欧白房子覆盖既有城堡。配色依据用户认可的伊斯坦布尔色彩研究与实际目标图，不能把单张夕阳照片直接烘焙成所有时间的紫橙材质。

方案先检查城墙是否堵路、台基是否贴山、建筑是否扎实；旧城/新城差异通过密度、尺度、材料风化表达，不是只换颜色。

## 复用入口

- `src/procgen/wfc/solver.js`：通用求解、传播、限界回溯，优先复用。
- `src/procgen/wfc/moduleSchema.js`：连接与承托/净空语义，几何边界仍需核验。
- `src/procgen/planet/terrainTiles.js`：语义目录，不等于已完成美术模块。
- `src/procgen/planet/vegetationCompilerV9.js`：生态、禁入、LOD。
- `src/render/clouds/impostorAtlasBuilder.js`、`cloudImpostorMaterial.js`：共享表示候选；并非已证实复制作者实现。

每次先读项目 AGENTS.md 与 docs/PROJECT_HANDOFF.md、PLAN.md、TODOS.md、artifacts/game-progress.md 的最新相关记录。几何更改按项目要求留下快照和同机位对照；此技能不替代现有 Three.js 专长和 Jev 流程。
