# 信使 v2（Blender 三视图）— 游戏内候选

- 模型：`courier-v2.glb` / `.blend`，由 `build_courier_v2.py` 在 Blender 5.2 中按用户三视图程序化建模（约 3.4 万三角形）。
- 关节：不是 Blender 骨架，而是与 `src/assets/characters/humanCourier.js` 相同命名的关节节点（body / head / legL / legR / kneeL / kneeR / armL / armR / elbowL / elbowR / handL / handR / letter），静止旋转为单位，游戏原有六个动作代码直接驱动。
- 穿模：`courier-v2-report.json` 记录按游戏六个动作角度做的面片相交检查；手、前臂、腿与身体、背包、背带 0 处，仅骑乘时大腿根与腰带相交（藏在胯部内）。

## 游戏接入
- 2026-10-09 06:15 用户要求并入正式游戏：现在默认就是 v2；`index.html?courier=classic` 回到原信使。
- 代码：`src/assets/characters/courierBlenderV2.js`（加载 GLB、套用原信使的平涂色 + 描边做法、对齐原信使的脚底和身高、替换 userData 关节；`revertCourierBlenderV2` 可不刷新回退）。`src/player/player.js` 只加了按参数动态加载的 6 行，原件在 `source-before/player.js`。
- 新增第三方文件：`vendor/jsm/loaders/GLTFLoader.js`、`vendor/jsm/utils/BufferGeometryUtils.js`（three r172 官方 examples，与 vendor three 同版本）。模型放在 `assets/models/courier-blender-v2/courier-v2.glb`。
- 测试：`tests/world/courierBlenderV2.test.mjs` 3/3（关节契约、脚底/身高对齐、六个动作驱动关节、回退）；原 courierMoebius 与 player 测试 10/10。
- 实机：正式页面加载后换模成功（52 个网格），`ingame-six-poses.png` 为正式页面中由游戏动画函数驱动的六个姿势离屏渲染（湖沼坑缘背景）。

## 限制
- 没有在实时画面里用键盘走动看（浏览器面板隐藏时游戏计时器不走）。
- 颜色用平涂 + 法线明暗两档，和原信使同一套做法，但没有做同机位前后对照评分。
- 三角形数比原信使多，正式替换前应减面；头发后脑仍偏蓬；肩部配色边界在骑乘时有一小块。
