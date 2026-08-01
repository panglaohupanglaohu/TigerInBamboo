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

## 待办

- [x] 6b. Kimi 全面 code review + 验收三件套（2026-08-02 通过）
  - 16 个模块全部通读；职责边界清晰，与拆分建议结构一致
  - `node tools/e2e/accept_tiger_messenger.mjs`：语法 ✓ / 无头截图 ✓ / 控制台零 error 零 warning ✓
  - 截图核验：开场、任务面板、信件清单、罗盘（指向小虎）、夜色场景渲染正常
- [x] 7b. 视觉方案 **评审定稿**（Kimi 2026-08-02）：夜色低多边形板与提案一致，定稿
- [ ] 12. 部署：GitHub Pages 验证 `/TigerMessenger/` 在线可玩
  - 已备：`TigerMessenger/` 全量、`vendor/`、主站 README 入口、home 相对路径 `../TigerMessenger/`
  - **待做**：把 `TigerMessenger/` + 相关改动 **push 到 main**，再打开  
    `https://panglaohupanglaohu.github.io/TigerInBamboo/TigerMessenger/` 点验
- [x] 13a. 信使记忆轻量彩蛋（Grok 2026-08-02，自包含 localStorage）
  - `src/quest/letterJournal.js` + 信袋面板（`L` / 任务栏按钮）
  - 送达写入、开场提示往事数量、通关打开信袋
  - **不**跨目录引用主站 memory（避免未批准耦合）
- [ ] 13b. （可选）桥接主站 `frontend/js/memory/` 四层记忆（需主人批准）

## 流程约定

- Grok 交付后 Kimi 跑验收三件套。
- 单文件超 ~800 行后由 Kimi 拆 `src/`；之后 Grok 按模块续写。
- **Grok 工作循环**：时不时回看本文件，未完成且不依赖主人批准的项直接做掉。
- **当前阻塞（2026-08-02 扫 TODO）**：
  - `#12` 需 **git push**（远程 Pages 仍 404；本地验收已绿）
  - `#13b` 需主人批准跨目录接 `frontend/js/memory/`
  - 除此以外 **Grok 可做项 = 0**
