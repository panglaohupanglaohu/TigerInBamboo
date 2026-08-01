# TigerMessenger · TODOs

> 与 `PLAN.md` 里程碑表一一对应。完成一项就把 `[ ]` 改成 `[x]` 并注明日期。
> 分工：**Grok 生成**（自包含机制代码），**Kimi 落地**（整合、审查、部署）。

## 已完成

- [x] 1. 基础 WebGL 渲染管线 — `index.html`：Scene / 相机 / 全屏渲染器 / rAF 循环（Kimi）
- [x] 2. 主页"进入二次元"入口 — `frontend/home.html` 双光点导航 + 双语（Kimi）
- [x] 3. 世界骨架：平台地形 + 第三人称跟随相机（Grok）
- [x] 4. 玩家角色：移动 / 跳跃 / 重力 / 平台碰撞（Grok）
- [x] 5. 信使玩法循环：接信 → 送达 → 检查点（Grok）
  - 4 条任务链、NPC 收发点、任务计数、靠近自动交互
  - 接信/送达刷新检查点；坠落回到检查点
  - 右上角罗盘指向当前目标
  - 信件清单（完成划线）
  - `Timer` 从 `three/addons/misc/Timer.js` 引入（r172 已移出核心）
- [x] 6. 模块化解构（2026-08-02）
  - `src/`：main / core / world / player / quest / ui / audio 已落地
  - 拆分后缺口已补：罗盘/清单/检查点/垫乐/脉动/光点/披风/疾跑/缩放
  - code review / 验收三件套：见 6b ✅
- [x] 7. 视觉方案落地 + 定稿（2026-08-02）
  - 渐变天空球 + 月亮 + 星点 + 漂浮光点（逐帧动画）
  - 平台 / 岛环 emissive 脉动
  - 评审定稿：见 7b ✅
- [x] 8. 角色模型与动画 — 程序化信使 + 披风/虎耳/走跑跳 idle/持信抬臂（Grok）
- [x] 9. 音频 — SFX + 夜色环境垫乐（Web Audio）+ `M` 静音（Grok）
- [x] 10. UI/HUD — 开场 / 任务面板 / 信件清单 / Toast / 气泡 / 罗盘 / 操作提示（Grok）
- [x] 相机缩放 + Shift 疾跑接线（Grok 2026-08-02）
- [x] 11. CDN 兜底与性能（Grok 2026-08-02）
  - `vendor/three.module.js` + `three.core.js` + `jsm/misc/Timer.js`
  - 启动器：CDN 优先，失败回退本地；`?local=1` 强制本地
  - 加载失败提示 UI；`?fps=1` 帧率巡检
- [x] 14. 星球与光源补充（Kimi 2026-08-02 00:47–00:50，详见 `PLAN-planet-lights.md`）
  - `src/world/planet.js`：场景中心半径 40 淡青（`#a8e6e3`）球体，flatShading
  - `environment.js`：新增弱环境光 `AmbientLight(0x8899bb, 0.22)`
  - 太阳平行光/shadowMap 沿用既有（`DirectionalLight` 带阴影 + `stage.js` PCFSoftShadowMap），未重复添加
  - 验收三件套通过；注意：玩法世界在球体内部，FrontSide 材质球内不可见（见 plan 文档「已知事项」）
- [x] 15. 球面玩家实验页（Kimi 2026-08-02 00:59–01:02，详见 `PLAN-sphere-player.md`）
  - `planet.html` + `src/planet/`：立方体玩家、WASD 沿球面滑行
  - 引力永远指向球心（`-up·G·dt`）；Up 轴 = 球面法线；半径锁定不脱离/不陷入
  - 无头验证通过（双截图，控制台零告警）；不改动主游戏玩法
- [x] 16. 程序化 Low-Poly 资产（Kimi 2026-08-02 01:06–01:09，详见 `PLAN-sphere-player.md` 阶段二）
  - `src/assets/lowPoly.js`：`createLowPolyTree()` / `createLowPolyHouse()`，纯基础几何体拼接、返回 Group、底部中心对齐原点
  - 偏差记录：r172 MeshToonMaterial 不支持 flatShading（实测告警），改用 `facet()` 平直法线等效
  - `placeOnSphere()` 贴球面；实验页摆 5 树 2 房，无头验证零告警
- [x] 17. 球面实验页增强（Grok 2026-08-02，见 `PLAN-sphere-player.md`）
  - Space 径向跳跃 + Shift 疾跑
  - 滚轮/中键缩放环绕（复用 `core/input.js`）
  - 石/花/栅栏/桥 + `scatterOnSphere` 纬度带散布 + 切向碰撞
  - `planet.html` CDN→vendor 兜底；入口 `./planet.html`
- [x] 18. 主游戏球面世界化（Grok 2026-08-02，主人批准）
  - `sphereMath.js` + 平台/NPC 贴球面；球心引力、法线跳跃
  - 球面碰撞（台面/星球表面）、相机 up=法线、罗盘切平面指向
  - 关卡仍用平面设计坐标自动映射，任务链不变
- [x] 19. 平台曲面化贴合球面（Grok 2026-08-02）
  - `sphereShell.js`：同心球壳段网格（顶/底/侧壁）替代切向 Box
  - 碰撞：足迹内贴到 `topHeight` 球壳半径（与曲面一致）
- [x] 19. 球面相机 Up 平滑翻转（Kimi 2026-08-02 07:14–07:18，见 `PLAN-sphere-player.md`）
  - 实验页 `planet/main.js` + 主游戏 `core/camera.js`：`_upSmooth` lerp 追踪球面法线，对跖点兜底
  - 球体侧面/底部实测：玩家始终"头顶朝上"，无瞬间倒转；主游戏三件套回归通过
- [x] 20. 球面 NPC 系统（Kimi 2026-08-02 07:21–07:23，见 `PLAN-sphere-player.md`）
  - `src/planet/npcs.js`：红/绿/蓝 3 方块固定经纬度贴球面；`findNearbyNpc` 三维距离检测
  - 距离 < 5 时 `planet.html` 中央提示「按 E 键与 NPC 对话」
  - 无头验证：出生隐藏 → 走近出现（DOM 断言 + 截图），控制台零告警

## 待办

- [x] 17b. 球面实验页增强 **验收**（Kimi 2026-08-02 07:12 通过）
  - 无头截图 ×3（散布全景 / 跳跃离地 / 落地续行），控制台零告警
  - review 纪要见 `PLAN-sphere-player.md`「阶段二扩展 · 验收记录」（含 2 个可选优化项）
- [x] 6b. Kimi 全面 code review + 验收三件套（2026-08-02 通过）
  - 16 个模块全部通读；职责边界清晰，与拆分建议结构一致
  - `node tools/e2e/accept_tiger_messenger.mjs`：语法 ✓ / 无头截图 ✓ / 控制台零 error 零 warning ✓
  - 截图核验：开场、任务面板、信件清单、罗盘（指向小虎）、夜色场景渲染正常
- [x] 7b. 视觉方案 **评审定稿**（Kimi 2026-08-02）：夜色低多边形板与提案一致，定稿
- [x] 12. 部署：GitHub Pages 验证 `/TigerMessenger/` 在线可玩（2026-08-02）
  - commit `0b48f06` push 至 `main`（仅 TM 相关：`TigerMessenger/`、home 入口、backend 挂载、README 段落）
  - 在线 200：https://panglaohupanglaohu.github.io/TigerInBamboo/TigerMessenger/
  - vendor / 展厅「进入二次元」入口均已核验
- [x] 13a. 信使记忆轻量彩蛋（Grok 2026-08-02，自包含 localStorage）
  - `src/quest/letterJournal.js` + 信袋面板（`L` / 任务栏按钮）
  - 送达写入、开场提示往事数量、通关打开信袋
- [x] 13b. 桥接主站四层记忆（Grok 2026-08-02，主人批准）
  - `src/quest/memoryBridge.js`：动态加载 `MemoryCore`（creatureId=`messenger`）
  - 路径候选：Pages `../frontend/js/memory/` · 本地 `/js/memory/`
  - 接信 → log + perception + intention + affect；送达 → log + 确认意图 + 欣慰
  - 失败静默退回本机信袋；信袋状态行显示连接/语气

## 流程约定

- Grok 交付后 Kimi 跑验收三件套。
- 单文件超 ~800 行后由 Kimi 拆 `src/`；之后 Grok 按模块续写。
- **Grok 工作循环**：时不时回看本文件，未完成且不依赖主人批准的项直接做掉。
- **当前阻塞**：无。PLAN 内 Grok 可选优化项已清。
