# 湖沼正式游戏入口

湖沼不是独立验收页模型。正式 `messenger` 场景会通过 `loadMoebius.js` 创建目录资产 `moebiusSwamp`，并由 `moebiusSwamp.js` 工厂调用 `swampV2Art.js`。这里的生产链包含本轮树干/树冠、苔斑岸壁、岸阶与码头、花船/长船划行、鲸鱼和角色生态更新。普通主线仍从书店开始。

## 游戏内直达

打开 `http://localhost:8931/TigerMessenger/?tour=swamp`，点击“开始送信”，即可在正式游戏里从湖沼入口石阶进入。漫游入口只改本次运行的玩家出生位置，不改主线存档或默认出生点；WASD、相机、角色和世界更新仍走普通游戏系统。进入后按右键拖拽或底部“环视”调整视角，W 向下走石阶。

## 改动和回退

- 生产入口改动：`src/main.js` 的 `tour=swamp` 分支，把玩家放到现有第一块虎阶，并朝向下一阶。
- 原文件：`source-before/main.js`。
- 取消本入口：删除 `src/main.js` 中带 `湖沼正式游戏入口` 注释的分支；湖沼正式资产和既有默认场景保持不变。

## 验证和限制

- JavaScript 语法检查通过；`swampEdgeGuard` 16/16、`swampCoralRim` 与 `swampSpatialPlan` 9/9。
- 真实 `localhost:8931/TigerMessenger/` 路由已启动并在正式游戏视口渲染湖沼、角色、岸台和水域；本次可见画面控制台 error 为 0。
- 当前仍有明显视线遮挡：宽阔暗色斜坡、近岸几何及植被挡住部分湖心；截屏读数约 9–15 FPS、7k 左右 draw calls、5.5M 左右 triangles，随视角和场景更新波动。入口证明“来自正式游戏场景并可到达”，不代表构图或性能验收通过。
