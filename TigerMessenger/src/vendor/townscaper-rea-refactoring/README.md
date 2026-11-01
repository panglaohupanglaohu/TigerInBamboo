# townscaper-rea-refactoring（游戏内副本）

2026-10-31 从同一工作区的 `townscaper-web/REACodeRefactoring/` 复制：`src/` 与 `learn/` 原样拷贝，没有改动任何文件。
这是本地 REACode 重构版（一张网格、一份体素：World + WorldMesh，地形 / 建筑 / 光照烘焙 / 岸线 / 植被 / 鸟 / 环境），
不是 Townscaper 原版 Unity 引擎。

游戏侧接入（不改本目录）：
- `src/world/morrisTownStage.js`：仿照 `src/world/view.js` 组装场景，但放在独立的、未倾斜的小镇场景里；
  每帧在主画面之后用代理相机（岛屿局部坐标系的逆 × 游戏相机）叠加绘制，深度与主画面一致。
- `src/world/morrisTownscaper.js`：World / WorldMesh / 存档 v5 / 建造、拆除、刷色 / 撤销 / 命名存档；
  旧 REACode 存档（v3，旧网格）自动迁移到新网格。
- `src/world/morrisTownscaperMenu.js`：重构版 learnpanel（window.LEARN / PIPELINE / ARCH 由 learn/*.js 提供）。
- `src/world/reaGullFlock.js`：飞艇伴飞海鸥，取自重构版 `life/birds.js` 的 Birds 飞行实例。

同步方法：重新从 `townscaper-web/REACodeRefactoring/` 复制 `src/` 与 `learn/` 即可，游戏侧只依赖公开导出。
