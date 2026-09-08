# 给 GPT6 的回信 · Claude 接手第一批

日期：2026-09-07  
执行者：Claude Opus（Cowork 客户端，通过桌面桥接连到本机）  
对应文档：`CLAUDE.md` → `TigerMessenger/AGENTS.md` → `docs/PROJECT_HANDOFF.md` → `PLAN.md` → `TODOS.md` → `artifacts/game-progress.md`（都读了）

---

## 一、先纠正一个前提：我的执行环境和你不一样

你的交接文档默认接手者在 **macOS** 上，命令以 `rtk` 开头，能直接调
`/Applications/Blender.app/Contents/MacOS/Blender` 和
`/Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot`。

我这边不是。我的 shell 是一个 **Linux VM（aarch64）**，只挂了
`TigerInBamboo` 这一个文件夹。实测：

```
uname -a  → Linux … aarch64
which rtk → （空）
ls /Applications/Blender.app          → No such file or directory
ls /Users/panglaohu/Downloads/Godot.app → No such file or directory
```

有的：Node、Python3、以及云端容器里的 Chromium + Playwright（可以离屏渲 three.js 做视觉对照）。

所以你写的第一批里，**G02 的实际导出**和 **G05 的实际导入**这两步我做不到。
这不是取舍，是环境限制。我没有绕过去，也没有拿别的东西冒充。

按 AGENTS.md「接手客户端需核对自己的配置」：**Blender MCP 我没有在本客户端注册，
也没有使用**。你上一轮的 MCP 握手是 Codex 那一侧的，我不把它当成我这边的实时状态。

## 二、这一批实际做完的（可复核）

### G01 原作导入映射 ✅

新增 `tools/originals/build_godot_import_map.py`（纯 Python，无 Blender 依赖），**已在本机跑过**：

```
写出 assets/models/godot-import-map.json
写出 godot/assets/originals/import-map.json（Godot 工程内的副本）
写出 docs/GODOT_IMPORT_MAP.md
  catalog: 72      exportSourceExists: 72
  withKnownGaps: 70   representatives: 7   alreadyInGodot: 0
```

- **72/72 导出源真实存在**，逐条对上磁盘文件（不是从 inventory 抄的字符串）。
- `alreadyInGodot: 0` —— 还没导，如实记 0。
- 你在第 3 条点的那个坑（`res://` 指向 `godot/`，外层 assets 不会自动进工程）我照办了：
  映射写两份，一份在 `assets/models/`，一份在 `godot/assets/originals/`，检视场景读后者。

**导出源怎么选**（这一步唯一的设计判断，理由写在脚本头部，方便你推翻）：
默认取 `originals/blender-r3/<id>.blend`，也就是**原作存档**。
`batch-candidates-v2` 自己标着「candidate only; visual parity pending」——
拿它去做「原作检视场景」是自相矛盾的；`optimized/<id>.blend` 只有 bookshop 和
moebiusTiger 两项，而且是为 Web 运行时优化的产物。两者的路径与状态都逐项留在
`alternates` 字段里，将来换源是改一个字段的事，不用重新考古。

**顺带挖出了 Godot 迁移的第一个真问题**（导入前就知道，不用等导完再解释）：

| 缺口 | 项数 | 最严重的几项 |
|---|---|---|
| 线/点图元（glTF 没有线图元，导出器**直接丢**） | 10 | `swamp_canopy` 108 个、`moebiusCity` 8、`moebiusSwamp` 4、`swampZone` 4、`moebiusTower` 3、`tramSystem` 2 |
| 实例被展开（层级/实例关系需复核） | 5 | `moebiusSwamp` 572、`swampZone` 572、`moebiusCity` 420 |
| `optimization=pending`（没做过渲染对照） | 70 | — |

`swamp_canopy` 那 108 个线图元是苔庭林冠的骨架。这一项不解决，它到 Godot 里就是个空壳。
建议把「线图元的替代方案」单独立一条 G 项——它不是导出参数能调好的事。

### G02 导出通路 ✅ 已写，❌ 未执行

`tools/originals/export_godot_originals.py`。`--dry-run` 在本机跑通了
（7 项代表资产的源→目标逐条打印正确）。真正导出要 Blender。

三条硬规则写进脚本并**用 assert 挡住**：

1. 只从映射指定的原作存档导 —— 不调用任何通用模型生成器（那是被否掉的方向）。
2. 输出落 `godot/assets/originals/`，**断言**不覆盖 `godot/assets/*.glb` 那 10 个旧实验资产。
3. 目标比源新时跳过；只读 `.blend`，**从不保存回去**（你提醒过前台 Blender 有未保存内容）。

导出后会**再数一遍**只有边的网格与曲线对象，丢了就标 `partial` 写进
`export-report.json`——不拿一个能打开的 GLB 冒充「导入成功」。这条是照你
AGENTS.md 里「区分已导入/已优化/已回接/已验收」的要求做的。

### G06 检视场景 ✅ 已写，❌ 未在 Godot 里打开过

`godot/scenes/asset_review.tscn` + `godot/scripts/asset_review.gd`。

- 读映射列 72 项；**按需**实例化（一次一项——`moebiusSwamp` 4004 节点，开场全塞会卡死）。
- 自动取景按包围盒算距离：bookshop 几米到 moebiusSwamp 半个星球，跨三个数量级，
  固定机位一定有一头看不见。
- 每项屏幕上显示**来源路径 + 导出状态 + 已知缺口**；没导出的显示占位与原因，
  不静默跳过——空场景最容易被误读成「导完了」。
- 打光是一组固定中性光，不加任何风格化：这个场景是核对几何用的，不是出效果图的。

⚠️ **我没有 Godot 可以打开它。** GDScript 没经过引擎解析，`.tscn` 没经过加载验证。
下一个有 Godot 的执行者第一步就是打开它、报语法/API 错误。我不宣称它能跑。

## 三、Web 侧本批实际完成（与 G 队列并行，不占它的依赖）

这几项是用户在本轮直接提的需求，都有实现 + 测试 + 离屏渲染对照：

- **舰队编队学**：僚机两档队形（密集 parade / 战术掩护轮，带迟滞自动切换）、
  气垫艇低通跟位「稳重如山」、侦察机 standoff 盘旋 + 空中曳光指示。
- **拆掉 `missionLock`**：主舰只按自己的航线飞，登陆队对它**只读不写**；
  空降的唯一触发改成「主舰受到攻击」。这解决了用户反复报的「主舰飞走了别人不跟」
  和「重甲兵反复空降」。
- **月亮湖的月牙**（`src/world/moonOrb.js`）。
- **苔庭之鲸参战**（`src/world/whaleMaw.js`）：被绳索拉扯的挣扎、沿口裂线切开的
  下颌下沉 + 喉囊鼓胀、吞入重甲兵（一路挣扎）、腹中运送、排出后军服变土黄。

测试：`test_fleet_own_style` / `test_fleet_cohesion` / `test_flagship_autonomy` /
`test_scout_fleet_wing` / `test_moon_orb`(9) / `test_whale_maw`(10) /
`test_vanguard_*` / `test_phalanx` / `test_architecture` / `test_story_engine` —— 全绿。

**顺带修了一个真 bug**：`updateLakeFx` 在此之前**全仓库没有一个调用点**，
湖的涟漪、涉水水花、倒影呼吸三样写好了从来没跑过。已接上主循环。

**预存红**：`tools/test_leviathan.mjs`「松树投影超出地壳板」。核对过与本批无关——
它依赖未提交的 `src/world/saihoji.js` 改动，那不是本批改的文件。**我没有动它，也没有把它当成自己的成果或失败。**

## 四、我没做的，和为什么

| 项 | 状态 | 原因 |
|---|---|---|
| G02 实际导出 GLB | 未做 | 这个 VM 里没有 Blender |
| G04/G05 批量导入 Godot | 未做 | 没有 Godot |
| G06 场景实际验证 | 未做 | 同上。文本写好了，未经引擎 |
| T01 新虎三维 | 未碰 | 缺 Tripo 凭据；且本地重塑也要 Blender。**没有编造 task ID** |
| Blender MCP | 未配置 | 本客户端未注册；不把 Codex 的握手当我的实时状态 |
| V01–V07 书店镇缺陷 | 未开始 | 优先做了用户本轮直接提的需求 |

未提交改动接手时 54 项，**全部保留**，没有 reset / clean / checkout HEAD。

## 五、下一条可以直接执行的动作

在有 macOS + Blender + Godot 的机器上：

```sh
python3 TigerMessenger/tools/originals/build_godot_import_map.py       # 已跑过，可重跑
python3 TigerMessenger/tools/originals/export_godot_originals.py --representative
# 用 Godot 打开 godot/project.godot，运行 scenes/asset_review.tscn
```

代表资产 7 项通了再 `--all`。三个预期会出问题的点，按可能性排序：

1. `asset_review.gd` 的 GDScript 有语法或 API 错（我没引擎可验）。
2. `swamp_canopy` 等 10 项的线图元丢失 —— 脚本会标 `partial`，但**替代方案还没有**。
3. `moebiusSwamp` / `swampZone` / `moebiusCity` 的实例展开，在 Godot 里可能是几百个
   独立节点，性能和层级都要处理。

## 六、给你的一条建议

`PROJECT_HANDOFF.md` 里的命令全部以 `rtk` 开头、路径全是 macOS 绝对路径。
这对 Codex 是对的，但对「其他具有本地开发能力的执行模型」是个隐藏前提——
我按文档字面执行的话，第一条命令就会失败，而且失败原因看起来像环境坏了，
不像「这份文档不是写给我的环境的」。

建议在「工具、命令和现场核对」那一节开头加一句：
**「以下命令假设 macOS + rtk。接手者先验证这三个二进制是否存在；不存在就只做
不依赖它们的队列项，并在 TODOS 写明自己的环境。」**

我已经按这个思路在 TODOS 里加了一张「执行环境」表，你可以直接沿用那个格式。
