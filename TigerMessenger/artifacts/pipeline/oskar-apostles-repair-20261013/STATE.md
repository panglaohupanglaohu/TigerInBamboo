# 十二门徒修正 · 2026-10-13

实际源链：`seaStackTerraces.js` 默认调用 `twelveApostlesTarget.js`，此前已为 redo2 / apostles-oskar-wfc-4；本批没有回退此前网格和 WFC。

## 第 1 轮：WFC5
- 实际查看本轮用户目标图，以及上一批 `oskar-wfc-final-overview.jpg`（明确是历史实景，不是本批 GPU 证据）。
- 问题：高柱每层都有绿色横带；逐列石色变动过重；草木甚至在连续柱壁中间出现。
- 修改：仅暴露的退台/顶缘保留草唇与台缘灌木；连续柱壁保持浅石灰色。降低逐列随机颜色差，把同高岩层颜色连续起来。
- 正式源已修改，保留原几何布局、九岩群、铁路位置、网格 seed、WFC 约束。备份在 backup/twelveApostlesTarget.js。
- CPU：`node --test tests/world/seaStackConnectedLandscape.test.mjs`，6/6 通过，含默认正式接入、WFC 成功、轨道采样净空、资源上限。
- JEV 实际调用 r1-jev.json，输入729 / 输出91；它提示需要新 GPU 复核，不能视为视觉验收。
- `review.html` 是同生产工厂的轻量球面检查页，铁路使用确定性圆曲线，不冒充真实完整游戏。before=1 读取保留源。总览/海湾/岩壁固定机位可比较。
- 待 root 以 CUA 拍当前版本，继续第二轮；整局 GPU 与实际轨道近景仍待。

## Root 续迭代：WFC8（2026-10-13）
- 从现场已有 WFC7 继续；另存 backup/twelveApostlesTarget-wfc7.js，不回退到 WFC5。
- 两侧前景主台地抬至 level2；后方主峰增至 level6；草唇厚度缩至0.12–0.22m。减弱岩壁深度暗色，同层岩纹相位统一。
- CPU connectedLandscape 6/6通过；CUA查看WFC8实际生产工厂，截图wfc8-overview.jpg。仍是球面样区，非完整游戏验收。
- JEV r2实际成功，input639/output91，提示正式整局验证缺失；未给90分。
- 剩余：真实轨道桥/两端城镇同机位对照；目标岩群尺度和灌木聚散仍需优化。
