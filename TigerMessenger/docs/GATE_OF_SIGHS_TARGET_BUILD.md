## 2026-09-22 前后目标认可后两轮构建

用户认可target-v3-front-back。双塔宽度改19/17/15/13米，各侧退台1米；底层25米，总高42米。第二轮延展双塔纵深包住前后拱墙，补背面旗帜、扶壁、砖缝。门体29574三角面，11网格。轨道采样扩至±140米，桥只在地形允许处开孔；桥墩随球面径向与实际切线构建、共用重复站位。场地4868三角面。Web默认与Godot GLB同步。

检查：30台阶、直线轨道、280米范围5040段轨道射线、Godot绑定均通过。但新背面实景明确显示部分原轨道低于海面、局部桥被水遮住，地形采样负净高；这不是合格的连续后桥，不能只凭射线通过称完成。下一轮必须联合核验真实海面/轨道高度，修正桥后路段高程与两端平滑衔接，不能仅复制桥墩。旧rail-full-span仅建筑阻挡，不测水面。证据site-frontback-r2-rear.png、bridge-span.png。Jev已记录未通过项。

## 2026-09-21 墙面遗迹感纠偏
用户否定规整新墙与贴片感。删除门体28片孤立浅色面；Blender装饰改为16处连片不规则剥落、浅断边、100条裂隙，风化层用灰褐色。第一版连续竖带已再次打散高度和宽度。新装饰5044三角面/3 Web网格，门体22206三角面。Web默认回接，Godot同源GLB。实景site-weathered-final-front.png；浅层风化不是实体墙破洞，未称完整美术验收。

## 2026-09-21 叹息之门三轮迭代

用户要求以目标图迭代3次，已通过Blender MCP依次执行并保存同机位实景：site-iteration-r1/r2/r3。第一轮双塔前移8米、拱墙外缘收至±6.3米，保留原开口；第二轮塔脚砌石、扶壁、会面台背景墙；第三轮降低砖缝对比、补风化色面。风化装饰同步前移以贴合立面。

当前门体11网格22262三角面，8931默认回接与Godot GLB重新导入完成。30台阶支撑、直线轨道净空、真实曲线2880段射线、Godot同位绑定检查通过。完整桥侧通行见site-ground-check.json最新结果。Jev已用本轮文本观察调用，置信度0.32→review，未自动决定修改；报告artifacts/pipeline/jev/gate-decision.json。

尚存：全球天空偏橙、岩层简单、鸟群过密、英雄细节与目标有差距；未宣称整体复刻或手动通关。本轮未改全局天空、灯池或故事触发。

# 叹息之门：目标图驱动的当前实现与接入指南

## 当前交付（2026-09-21）

正常 8931 原游戏已默认接入，不需要候选开关。快捷验收：`/?autostart=1&gateReview=1`。该参数只放置本次角色起点，不改主线存档。

- 门体：原作三重圆拱、双塔与泡机体系，Blender 重构建筑；开口 10.2 米，塔高 42 米。旧门体隐藏，原轨道曲线未改。
- 落位：实际峡谷入口沿轨后 24 米；位置约 (23.1349, -71.7402, -141.4267)，门正面面向峡谷。以轨面下 0.8 米为建筑基准，避免按深谷地面把门沉到轨道下。
- 峡谷和桥：独立 Blender 场景 TM_Gate_Site；两侧折面岩体按原地形收边，约 160 米长石桥按真实轨道采样，深谷段有贯通拱孔、落地桥墩。新增 5 网格、3812 三角面。
- 通路：高架侧边 → 5 段宽踏步支路 → 转折平台 → 原 30 级台阶 → 会面台。弃用首轮伸入水边的下山支路；最终方案未把水底当陆地。
- 英雄：奥德休斯与阿克琉斯为 Blender 首版，合计3312三角面；原 pact 主线成功后触发接信、读信、回应。未跳过救援剧情。
- Web 布光：跟随原共享昼夜时钟；黎明/黄昏局部暖色反射光，夜晚两盏会面灯。纳入现有点光池，不增加灯池容量，不额外开启阴影贴图，不强制修改游戏时间。
- Godot：同门体、英雄、峡谷和桥 GLB 与同一世界变换已接入；支持绑定、解绑恢复。灯位及 `set_phase()` 接口同步。原生接信/阅读/确认动作已经移植。大厅“叹息之门 · 密信盟约测试”从已携书店密信开始；WASD 在实际会面台面步行，靠近后按 R 或交付按钮。原作总览目前没有统一昼夜时钟，章节提供灯光阶段接口，不宣称完整主线或两引擎全部玩法一致。

- 风化与环境：独立 Blender 场景 `TM_Gate_Dressing`，112片低色差风化、12处细裂纹、6组远景岩台、4棵树、41组灌木，4324三角面。Web新增3网格；Godot按材质有多个表面，不把网格数等同绘制次数。

## 验证证据

记录位于 `artifacts/pipeline/gate-of-sighs-build/`：

- `focused-check.json`：原30级台阶脚底支撑、迁移后支撑、直线车体空间。
- `site-ground-check.json`：支路脚底检查；原移动/碰撞求解器从桥侧走到会面台通过，约21.87秒。使用合成路点输入，并非手动完整通关。
- `rail-full-span-check.json`：实际弯曲轨道前后80米，2880段车体包络射线；建筑、岩体和桥合并检查通过。每段使用球面径向和轨道横向，修复远端两处桥边偏高。不是完整三角网格连续碰撞扫掠。
- `hero-story-check.json`：独立浏览器从书店接信推进到结盟，依次验证接信/读信/回应/待机。
- `godot-site-check.json`：最终 GLB 导入、精确绑定、位姿同步、泡机保留与解绑恢复通过。另在同一测试里验证昼/暮/夜灯光参数。
- `godot-pact-check.json`：原生动作、R/按钮交付、超距/重复拒绝、重置、实际台面支撑、装饰加载与解绑通过。
- `site-dressing-final-*.png`、`site-night-*.png`：原游戏实际场景；摄影检查设置对应时刻，正式游戏仍按自己的时钟运行。截图没有隐藏原场景的飞艇或鸟群。

不把截图绘制次数当 FPS 提升，不宣称完成全部游戏游玩验收。

## 资产与代码入口

- 建筑：`tools/pipeline/build_gate_target_blender.py` → `assets/models/optimized/gate-of-sighs/gate-of-sighs-v1.blend` / `gateTargetData.js` / Godot `gate-of-sighs-v1.glb`。
- 岩体、桥、支路：`tools/pipeline/capture_gate_site.mjs` 采集实际轨道与地形 → `build_gate_site_blender.py` 在 Blender 构建 → `gate-site-v1.blend` / `gateSiteData.js` / Godot `gate-site-v1.glb`。
- 英雄：`build_gate_heroes_blender.py` → `assets/models/optimized/gate-heroes/` 与 Godot 两个角色 GLB。
- Web：`src/world/abandonedGate.js` 控制默认落位；`gateSite.js` 安装固定地貌与近脚支撑；`gateTarget.js` 安装建筑/英雄/碰撞；`gateLighting.js` 管理局部灯；`src/story/rescueCampaign.js` 管理结盟动作。
- 装饰：`build_gate_dressing_blender.py` → `gate-dressing-v1.blend` / `gateDressingData.js` / Godot GLB；Web `gateDressing.js`。
- Godot：`scripts/gate_target_adapter.gd`、`scripts/gate_lighting.gd`、`data/gate-site-placement.json`、`scripts/gate_pact.gd`、`scenes/gate_pact_chapter.tscn`。
- 原生回归按单进程顺序运行 `tests/test_gate_pact.gd`、`tests/test_gate_pact_chapter.gd`、`tests/test_gate_target_adapter.gd`；参数 `--headless --path TigerMessenger/godot --script res://tests/<文件>`。

## 后续修改顺序

1. 锁定认可图 `assets/concepts/gate-of-sighs/target-v2.png`；先比较整体门桥关系，不另换目标。
2. 轨道或落位改变时，重新采集实际曲线、原地形，不能仅拖移烘焙拱桥。环境保留在采样轨道段，编辑器单独搬门不会把桥拖离轨道。
3. 在命名 Blender 场景里改造，保留其他场景；导出必须使用活动场景限制，检查法线及各面材质。
4. 同时输出 Web 几何和 Godot GLB。将 site-manifest 的 origin/quaternion/matrix 同步至 Godot placement JSON。
5. 先跑桥侧到会面台完整路线、实际曲线车体射线，再跑主线结盟。失败先修，不用摆拍代替。
6. 昼、暮、夜用相同机位比较；保持点光池预算。Godot 用 set_phase 同时核验灯光，不假定总览已有游戏时钟。
7. 更新实景对照页与交接文件，注明已接入和未验收内容。

本轮将门的位置缓存升级到 `tm.gateAnchorU.v2`，防止旧实验落位覆盖新默认；旧 v1 值仍保留，未删除其他存档。

## 尚存美术差距

目前是可验收的整景第一版，不能称为目标图的1:1复刻。已补齐远景、风化、稀疏植被这一层；目标图的细腻岩层、云霞纹理仍更丰富；当前沿用原全球天空和原飞行器/鸟群。英雄近景细节也仍是首版。后续应围绕这些可见差距收敛，不再重新搬迁整个世界。
