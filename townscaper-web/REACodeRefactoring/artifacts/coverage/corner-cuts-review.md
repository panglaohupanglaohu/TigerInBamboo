# Square, yet hex：全帧复核与轮廓策略迁移

README 1471817524148940807（2021-12-17）说rocky islands / natural and readable / Square yet hex。556个解码帧，先README再sheet00–05全部逐格查看；原尺寸17/45/100/216/339/554。frames.json保留可变时长PTS（0–68.31s），review-observations.json逐帧记录，不能用平均fps替代实际PTS。

前段多轮清屏→白线框→黑线框/彩色拓扑→着色成品；47–164、216–303、339–412、478–546为不同岛屿旋转。可见连续草面、岩崖、坡面、空口、顶面分区纹理和白色建筑体块。无法据片证明二维切角、切角深度、四邻接或固定几何算法。原版squarehex的策略可用于实验，不把旧注释的解释当原作事实。

本批将Workbuddy cellPolygon“角沿相邻两边内插”的做法适配到共享格pts/xz，新增core/corner-footprint.js；保留原格、半边及邻接数据，不把缝隙塞进可走地面。corner-cuts.html是共享格Canvas绘制对照，切二角/四角、交替对角与深度滑杆；不是主游戏地形接入。四角cut=.5去重为4点，面积比.5；二角为6点、面积比.75。原measure完整角度/共边接口、World几何/碰撞/导航及真正岩岛生成仍缺。

逻辑 tests/corner-footprint.mjs：真实正方与混合网四边格1328组合，源不变、边数/面积有界、正方精确面积、非法cut拒绝。初次测试误用不存在buildGrid导出，已更正buildMixedGrid后通过。

浏览器 tests/corner-footprint-browser.cjs：49格，深度/四角切换、退化去重、源图不变，实际Canvas213926非透明像素，截图corner-cuts.png已查看；无pageerror。不声称Three GPU或World运行通过。

同时静态复核shrubcard：之前1191990107785572352已全316帧并有共享地被中心锚点GPU实验（anchored-plots-review.md），保留复用，不增加视频计数；墙根灌木主体仍球团，原折卡/侧看measure未迁移。因此仅部分映射。


## 第 56 批（C08）

- 1471817524148940807：新增 rock-island-c08.js + rock-island-c08.html：逐层只切区域边界着色顶点的 3D 岩岛。tests/rock-island-c08.mjs；截图 C08-rock-island-still_1(_cut_0).png。判 done。详见 artifacts/coverage/r56-C08-nx-grid.md。
