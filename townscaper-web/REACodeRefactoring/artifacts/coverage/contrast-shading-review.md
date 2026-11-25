# 1482346496460828674 反差纹理 · 实景接入与整片运行验收（本轮补）

原残差：「原作彩色图集/贴花和实景接入未完成，未计整片代码运行验收。」核验结论：实景接入早已落码（旧 note 过期），本轮补的是这条自己的整片浏览器验收。

## 现状落点（消费链已真实存在）

- `src/core/contrast-field.js`：标量求解 `solveContrastField`（确定性、硬约束投影、如实报违例）+ OKLab 彩色移植 `worldContrastMesh / solveContrastColors / cellContrastColors`。
- 实景消费 ① `src/world/view-shading.js#contrasttex`：World 三角扇 → 220 轮松弛 → `uShCTMap`（512² 世界 XZ 图）→ `shContrast` 片元只在地形顶面（vField.z∈(0.5,1.5)、法线朝上）取色，`fwidth` 色差处压暗出像素细线。`?shade=contrasttex` / `setDebug('contrasttex')` 开关。
- 实景消费 ② `src/core/c11-maps.js#bakeContrastHeightMap`：同一套解 + 顶高打包 → 草地描边（1590674061092212738）。
- 实景消费 ③ `src/core/uv-radial-atlas.js`：复用 `initContrastColors / relaxContrastColors / measureContrastColors` 解算器。

## 整片运行验收（tests/contrast-shading-browser.cjs，真 Chrome + index.html?scene=fusion）

| 项 | 实测 |
|---|---|
| World 三角扇 | 10064 三角 / 15012 边 |
| 非对比边平均 ΔE | 13.755 → 0.103（趋同成立） |
| 对比边最小 ΔE | 14.28（拉开成立） |
| 上传纹理 vs 页内同参重解 | 9919/9919 抽样 texel 完全一致（GPU 拿到的就是解出来的图） |
| 图内形态 | 39568 对相邻陆地 texel，897 处跳变（2.3%）—— 跳变集中在特征交界（线的来源），内部平滑（connectivity 渐变副产品） |
| 屏上 A/B（同 RT off/on） | 8.18% 像素改色（顶面取色生效）；墨线像素 2946（fwidth 压暗）；同状态两帧噪声 0；关掉完全还原 |
| 着色器接线 | 编译后 program 源码含 `uShCTMap` 采样 |
| console error | 0 |

证据：artifacts/coverage/contrast-shading-off.png / -on.png / contrast-shading-browser.json。

## 仍缺（如实记）

- 原作本人的贴花形状、特征种子划分与 atlas 文件未公开 —— 卡点·B（原资产不可得），`worldContrastMesh` 的 cell 扇面 + 四类特征（water/river/ground/built + level）是本仓等价实现，不冒充原物。
- 原片 517 帧逐帧核验记录沿用 artifacts/coverage/color-lab-review.md。
