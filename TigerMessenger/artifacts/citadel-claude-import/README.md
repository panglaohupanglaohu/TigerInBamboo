# Claude 候选民居 → 实际 Web 场景

## 来源与接入范围

用户提供 `citadel-battle-v2-gate-water.png`，要求将 Claude 建模接入游戏。
源工程为 `artifacts/pipeline/citadel-battle-blender/citadel-battle-v1.blend`，文件名仍为 v1，但内容包含 v2 城门修改。此前 GLB 没有被运行时引用。

本批使用源脚本的原随机序列拆开 OldCity 合并民居，在独立后台 Blender 中与已保存工程核对 1592/1592 顶点（允许浮点存储误差），导出 12 种原民居，共 2480 三角形。原工程未覆盖。

- `tools/pipeline/export_claude_houses.py`：可复现拆分、源顶点核验、朝外法线修复及 Y-up 导出。
- `src/assets/claudeCitadelHousesData.js`：实际运行时导入的同步几何数据，并非仅存放未加载的 GLB。
- `src/world/citadel/claudeHouses.js`：在现有台地安置 16 栋（港口层 4、中层 12），按地块缩放，按材质合并；使用原配色，窗光接游戏昼夜。
- `westCity.js`：替换上述两层的旧 WFC 民居外观；保留主堡塔楼、内部、台阶与通路。添加 `citadelClaudeHouses=0` 查询参数可恢复原民居工厂。
- `playerWalls.js`：新外墙同时进入行走阻挡与相机遮挡集合。

源箱体面绕序朝内；Blender 双面渲染掩盖了问题，第一次游戏截图出现黑色花斑。导出阶段按独立实体重新计算朝外面方向，顶点位置不变。初次截图 `claude-import-*` 是失败视觉迭代，不作为完成证据。

## 明确没有整包导入

没有导入候选的平面 Water、湖盆、独立山体、台阶、封闭主堡实体、静态士兵、静态船只及木马。当前全球球面海水、可进入主堡、真实士兵/船只/木马逻辑保持原有实现。候选主堡的后方实体和发光挡板会封住运行时路线，不能只改格式就替换。

本批是分区资产接入，不是整张候选图或最初目标图的 1:1 复刻。尚需继续适配主堡外部、旧城密度、山岸结构、天空及兵船外观。Godot 未同步。

## 验证入口

`tools/pipeline/capture_citadel_reference.mjs`：实际浏览器、五个相同夜景机位及白天总览；检查 273 个海高点、1646 个主路线采样；另查 16 栋外墙阻挡、相机候选与窗光昼夜值。

导入前：`../citadel-reference-pass/pre-claude-import-*.png`。
最终轮：`../citadel-reference-pass/claude-import-accepted-*.png` 与同名前缀的 report.json。
最终结果：控制台错误 0；16/16 外墙阻挡探针命中、16/16 相机候选存在；窗光白天 .04 / 夜间 1.59；273 海高检查通过、1646 通路采样缺支撑与阻挡均为 0。总览绘制调用 3329 → 3209，三角形 923838 → 885714（动态对象可能少量波动）。

另两次失败迭代 `claude-import-final-*`、`claude-import-verified-*` 保留作审计：前者城区二次合并丢失碰撞标记，后者旧城通用清理移除默认 mergedGeometry=true 的新网格。最终改用独立 `claude-houses` 合并标记并跳过 WFC 二次合并，已重新截图与探针验证。
通路采样不是完整操控流程或全世界穿模验收。
