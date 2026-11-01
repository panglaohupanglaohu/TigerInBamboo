# 十二门徒 · 珊瑚贝壳岩层色修复

本批仅修改 `src/world/twelveApostlesTarget.js` 的岩层颜色和保持原法线分类所需的内部mask，未改原几何、草台、树、岸浪、铁路或全局光照。原源快照在 `source-before/`，用户夕照原截图另存 `user-before-sunset.png`。

## 实际看的目标与诊断

- `artifacts/pipeline/oskar-coast-targets-20261012/twelve-apostles-target-v1.png`
- `artifacts/pipeline/twelve-apostles-target-20261013/target-sheet.png`
- `artifacts/pipeline/sea-stack-connected-landscape-20261007/target-user.png`：作者模块示例，辅助理解暖冷层次，非最新完整布局目标。
- `artifacts/pipeline/gate-sea-stacks/target.png`：较早偏冷海蚀参考，不能覆盖后来的柔和台地目标。

图像观察：最新目标整体仍以奶油灰、蓝灰石为主，岩壁中下段夹少量奶油桃/贝壳珊瑚色薄层；前景两侧尤其可见。不是把整山刷粉，也不是只把桥梁和远镇暖色当岩体珊瑚。当前用户截图天空橙而山壁仍灰白，因此不能再靠换成夕照冒充材质改色。

生产主路径是 `seaStackTerraces` 默认调用 `buildTwelveApostlesTarget`，不是旧的`seaStackCoastalGeometry`。原`PAL.rock`全为灰/米灰；`strata`只乘亮暗标量，不会生成珊瑚色相。

## 改动

原灰蓝/米灰palette保留，增加项目候选色`#dfb7a3`珊瑚贝壳和`#e8cbb5`浅贝米。它们是本项目选择，不是图像精确取样或Oskar官方RGB。

`rockCol`对干岩施加低频高度连续矿物带：基础波长约5.6m，峰值较宽且软过渡，少数层出现暖色；不是满屏细条。暖带从canonical y>2.4才开始，2.4–3.6软爬升，原湿脚/水下冷暗配方不改。草顶/草唇使用原palette，未被涂粉。

原代码的法线平滑用`G>R*1.06`识别草，但部分冷岩也满足，直接改色会改变法线。首次CPU比较确实发现normal hash变化。修正后在颜色写入前保存原色分类，随同三角绕序交换，原法线流程使用该mask。最终非color属性逐字节完全一致；不是用平均法线掩盖形体改动。

## CPU结果与边界

`compare.mjs`在同一相机无关输入/seed生成改前与改后9岩群，对比positions/index/normals等全部非color属性、矩阵、植被/碎石/浪花/浅滩几何和实例颜色。

- 非color拓扑/法线整体SHA256前后均 `17ce2a5eb7dce9f789e8d14aa2cb93402f7a000ed93115e3841974ebdd827b1d`。
- 41040/248082个岩体顶点颜色改变，约16.54%；207042保持。
- 暖类顶点27603，冷灰类74331，二者共存。分类是CPU色通道判据，不能称渲染画面面积比例。
- 全部岩群摆位及子物件几何、实例颜色保持。
- `cpu-compare.json`、`compare-output.txt`保留逐岩群结果。

正式新材质颜色尚由Root重载GPU看图：应在明亮日光与用户原夕照分别比较。CPU同拓扑不证明颜色已经在画面足够明显。JEV只接紧凑文字证据，不代替目标看图或新GPU验收。源已冻结交Root统一重载，不在后续文档阶段继续修改生产源。
