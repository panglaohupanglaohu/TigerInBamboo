# Godot 退场/归档方案（草案，待用户 review 后执行）

## 背景

- 用户 2026-11-25 确认：项目方向已定型为**纯 HTML/Three.js 游戏 + pipeline 编辑**，Godot 不再作为目标平台。
- 历史包袱：Web 侧大量优化（圣城 50 轮、湖沼多层、软坡等）长期标注「未同步 Godot/Blender」；`docs/GODOT_IMPORT_MAP.md` 记录的 72 项原作导入映射从未执行导出（需在装有 Blender 的机器上跑）。
- 现状：Godot 相关内容约 **1.2GB 已入库**（2026-11-25 推送），继续保留会持续拖大仓库且无消费者。

## 现状盘点

| 对象 | 体积 | git 文件数 | 性质 |
|---|---|---|---|
| `godot/`（工程本体） | 884MB | 1250 | project.godot + assets/scenes/scripts/fonts/export_templates |
| `godot-web/`（Web 导出构建） | 304MB | 8 | index.html/js/wasm；index.pck（>100MB）本就被 gitignore，无法从仓库重建 |
| `Open-Godot.command` | 小 | 1 | 指向本机 Godot.app 的启动器 |
| `tools/` Godot 工具 | 小 | ~6 | export_godot_data.mjs、godot-templates/、build_godot_asset_registry.py、originals/export_godot_originals.py 等 |
| `docs/GODOT_*.md` | 小 | ~5 | IMPORT_MAP / WORLD_GAP / TEST_ENTRY / WARSHIP_V6 等 |
| `artifacts/pipeline/*/project/` | 计入 artifacts | 多 | 各轮迭代评审用 review 工程（属证据，不动） |
| `src/`、`tools/pipeline/` 内 Godot 引用 | — | ~15 文件 | 多为「按名识别碰撞」「导出给 Godot 的数据桥」类注释与导出脚本 |

注意：`godot/assets/` 下 10 个旧实验 GLB 本就按 IMPORT_MAP 规则「不碰、不计入成果」。

## 处置原则

1. **可再生的删，不可再生的归档**：godot-web 是导出产物可重建（只要有工程）；godot/ 工程本体是唯一副本 → 先外移归档再删。
2. **命名契约不动**：运行时里「Godot 碰撞按名识别」之类的命名约定保留原样——它们只是字符串约定，删了反而引入风险。
3. **证据不动**：artifacts 里的历史评审工程、GODOT_*.md 文档保留，加「历史参考」标记。
4. **分阶段可回滚**：每阶段独立提交，任一步可单独 revert。

## 分阶段计划

### Phase 0 · 文档冻结（无文件删除）

- [ ] `docs/GODOT_IMPORT_MAP.md` 顶部加「已终止：方向改为纯 HTML/Three.js，72 项映射不再执行」
- [ ] `docs/TODOS.md`、`docs/PLAN.md`：Godot 导入/同步相关未完项标记 `（已终止：Godot 退场，见 GODOT_RETIREMENT_PLAN.md）`，不删原文
- [ ] `CLAUDE.md` / `AGENTS.md`：更新「Godot 原作导入仍待执行」表述为已终止；主线描述改为 Web+pipeline 唯一
- [ ] `Open-Godot.command` 顶部注释加停用说明（文件先留）
- **验证**：grep `待执行\|仍待` 相关条目确认标记到位；unit 测试不涉
- **回滚**：git revert 该提交即可

### Phase 1 · godot-web 移出仓库（低风险，可先行）

- [ ] `TigerMessenger-Archive/godot-web-20261125/` 外移 304MB（原子：先 rsync 校验再删）
- [ ] `git rm -r godot-web/`（index.pck 本来就没入库，不受影响）
- [ ] `.gitignore` 增补 `godot-web/`（防误回填）
- **验证**：`git status` 干净；工作区根 `node --test` 官方清单抽测不受影响
- **回滚**：归档目录原样 `mv` 回 + revert

### Phase 2 · godot/ 工程外移归档（核心减重）

- [ ] `TigerMessenger-Archive/godot-project-20261125/` 外移 884MB（含 .godot 导入缓存则一并带走）
- [ ] `git rm -r godot/`；`.gitignore` 增补 `godot/`
- [ ] `tools/export_godot_data.mjs` 等导出脚本：**保留源码**但入口加「已停用：Godot 退场」提示后退出（不静默失败，也不删代码——工具里还有数据导出逻辑可能可复用）
- [ ] `Open-Godot.command` 移入归档（与工程同放，保持可启动性）
- **验证**：`grep -rn "godot/" src/` 剩余引用仅为注释级；跑官方 unit 清单确认无断链
- **回滚**：归档目录 `mv` 回 + revert

### Phase 3 · 收尾（可选，做完再定）

- [ ] `tools/godot-templates/`、`build_godot_asset_registry.py`、`export_godot_originals.py`：决定「停用保留」还是「移入 tools/_retired/」
- [ ] `docs/` 里 Godot 相关文档统一加「历史参考」页眉
- [ ] git 历史中的 1.2GB 不处理（重写历史代价大于收益）；仓库体积增量到此为止

## 不做的事

- 不重写 git 历史（filter-repo）——破坏性太大，且已推送到 GitHub 会分叉所有人的 clone
- 不动 artifacts 里的历史评审工程与截图——那是真实证据链
- 不删 `src/` 里任何为 Godot 命名契约服务的字符串/约定
- 不删本地 Godot.app

## 决策点（review 时定）

1. Phase 2 里 `godot/` 是否连本机一起删，还是仅移出仓库保留在 Archive（**建议后者**）
2. Phase 3 的工具脚本：停用保留 or 移 `tools/_retired/`（**建议停用保留**）
3. 是否保留 `godot-web/` 一份最新构建在 Archive 供留念对比（**建议保留**）
4. 执行时机：建议等当前 50 轮优化批次收口后单独一轮执行，避免与 pipeline 改动混在一起
