# 每层植被：素材复核与共享管线迁移

README 959530111187013632：2018-02-02，"I've been tweaking the foliage system today. It now supports multiple grass types per level." 原版levelflora注释日期2017-11-16、6帧与实际不符。实际203帧，全部sheet00/01/02逐格查看，0/70/108/109/170/202原尺寸回看；PTS和逐帧观察见同ID目录。

0–108帧：绿色岛，最低台地白花，其他台地灌木/草与树，小队循阶下行。109帧硬切另一紫色雨景：紫树冠、灰白直立地被、小舟和单位。不能把这一突切当成同岛按层换色动画，也不能证明“仅凭草型100%反推层高”是原作规则。

原版levelflora的局部工程策略：按level选择palette、丛内单一类型、独立演示地形和测量。本批复用“先按层选择色组”的策略，适配共享World.ground(c)及现有变形地被，未复制其独立地形/Canvas。原版levelAt键计算疑似忽略n，本批未复制也未修改原版。

src/core/level-flora.js给出本地四组色，两色/层，四层以上循环。src/life/vegetation.js新增可选levelFlora分支：真实草实例取对应颜色；不增加随机数调用，保留落点/实例数/花/树/灌木/风与默认。level-flora.html在真实terrain场景提供双网格和开关。只是颜色策略，不声称已还原原物种、形态、分布密度和两套生态。

验收：tests/level-flora.mjs通过层号边界、冻结色组与重复策略。tests/level-flora-browser.cjs真实GPU双网格，4682/3712草实例，矩阵完全不变、颜色关闭恢复，26129/26603像素改变，无pageerror；截图level-flora-quad/mixed.png。tests/sprites-browser.cjs复验旧精灵/三主场景；截图另存并查看。

视频学习新增1段203帧。实现通过仅分层色组局部；完整草型几何、生态切换、原buildFlora/measure兼容仍待补。未同步TigerMessenger副本。
