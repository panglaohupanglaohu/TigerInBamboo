# 模块整体几何匹配

复用1751932427272909032的552帧及原文，不新增视频帧。原版findPatch只比较边数和诱导邻接；本批在其候选后增加显式模板的整体二维刚体拟合，不把图同构直接当几何可放置。

core/module-fit.js按模板首边枚举宿主首格边，求一个整体旋转/平移；可显式开启均匀缩放，默认禁用。所有格必须在同一变换下逐角匹配，循环起点可变，共享顶点ID对应保持一致且单射。拒绝非法映射、重复ID、同ID不同坐标、非有限值及无效容差。不会逐格独立拉扯来凑结果，也不允许一般非均匀形变。

module-search增加accept谓词，在footprint去重前筛选，避免同一位置先遇到错误朝向后把有效朝向过滤掉。搜索预算仍按候选测试计数，结果分别报告穷尽、限额或预算。页面缓存模板，避免每次候选都重新生成模板网格。

tests/module-fit.mjs通过整体旋转平移、可选uniform scale、非均匀拉伸拒绝、输入校验、宿主只读和谓词先于去重；原module-search测试通过。实际页面新增刚体几何复核与X方向拉伸对照：标准模板1处通过，X拉伸1.3倍后几何0处、拓扑仍1处。浏览器主回归仍通过，errors[]。报告module-fit-browser.json及module-patch-browser.json；截图patch-fit-valid.png、patch-fit-rejected.png和三场景patch-regression-*.png。

限制：只检验二维footprint，未认证prefab/socket、楼层、支撑、碰撞、完整实体或艺术效果。均匀缩放由调用者显式决定，可能不适用于固定尺寸建筑。模板外补网、活跃World接缝及联合WFC仍待续；tileforce保持部分覆盖，游戏副本未同步。
