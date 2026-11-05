# 候选/跨叶碰撞与运行时网格烘焙 / 2026-11-05

## 文字、全帧与图像边界

1764958522398146667先读素材README第29行：候选生成较暴力，树用于快速碰撞查询，两者职责分开。296帧0–295、PTS 0–22.150秒；sheet-00至02全部逐格看过，原尺寸6、18、54、85、222、276。由满板预览切到从底部逐步填充，中段镜头展开为多层分区树，末段回正满板；画面本身不揭示候选概率/精确切分算法，不保证最优。

1593215065423245313先读README第65行：运行时增删精灵分配区，精灵由网格现场烘焙。164帧0–163、PTS 0–28.200秒；sheet-00至01全部逐格看过，原尺寸13、37、44、68、97、145。球/方块/胶囊/花团等尺寸不一，黄框及编号随活跃分配变化，版面增大；释放阶段背景仍留暗淡旧图案，不能说原作立即清成透明。本地清透明是资源隔离选择，未复现这种调试残影。

本批460帧，每帧PTS/范围观察/nativeRevisit在各ID目录review-observations.json，保留原帧与联系表。前批805帧不重复计数。

## 源码对照及共享实现

原版src/rectpack.js的RectBin已有候选/跨叶查询思路；原版engine/spritepack.js的SpriteAtlas实际insert和free都调用_pack重建并按面积重排全部存活区，不足时grow翻倍；它不是逐槽原地合并。原版均只读。

保留共享Atlas.allocate的first-fit稳定行为，补canPlace/allocateAt/place/remove：整数像素AABB树查询只访问相关枝，候选由板角、现有矩形边角与有界随机点组成。成功放置可跨多个空叶，多个叶属于同一受保护句柄，rects返回逻辑分配区，free清所有片段并以祖先闭包后序合并空兄弟；key拒绝重复、坏RNG在提交前拒绝。不移动存活槽；非最优搜索、不旋转、不自动压缩/扩容，不承诺与原RectBin所有签名兼容。grids.html可在first-fit与候选/跨叶间切换，轨迹来自实际查询。

共享ImpostorBaker（主场树/云同一类）改为先完整预留8个视角槽再绘制，满板回滚全部新槽；渲染异常时释放新槽、清局部并在finally恢复RT/clearColor/alpha及自己的viewport/scissor，移除临时Mesh。新增release(baked)清整槽含padding后释放，拒绝过期/外来记录，空场景render刷新mip链。存活UV不改变，调用者须先解绑消费者。有限padding仍不能隔离所有mip级，整页512²示例无自动扩容/重打包。

新增atlas-live.html直接调用共享Baker，真实GPU纹理显示8视角球/盒/扭结，支持加组/删除；保留原有树云烘焙及首页场景。原作单视角素材、编号UI、3D树展开、完整SpriteAtlas/RectBin接口、原材质与多用途消费者尚未齐全，模块继续部分覆盖，未同步游戏vendor。

## 验收证据

- tests/atlas-crossleaf.mjs：旧切线横跨的10×5空带first-fit失败，allocateAt/候选成功；存活两块坐标不变，删除所有片段、key所有权、拒绝坏RNG；9000候选增删面积守恒且不重叠。
- 既有tests/atlas.mjs：24000增删、6000层、过期/伪造/外来句柄、守恒/坐标继续通过。
- tests/atlas-live-browser.cjs / atlas-live-browser.json：真实GPU烘焙/释放后alpha全0，存活UV与像素hash不变；满板与第3次render注入异常都回滚占用并恢复调用方RT/clear状态；真实候选页。截图atlas-live-gpu.png、atlas-live-mobile.png、atlas-candidates.png。
- tests/atlas-browser.cjs：三主场共享24个144²树槽+8个272²云槽、实际渲染与菜单/手机/计时器回归。

静态清单补录：并行会话新增原版src/housekit.js，已读其职责/导出并对照共享World房屋与北境小屋，列部分覆盖。原层高/坡度池/屋面烟囱约束及makeHouse/verify接口、781027725452648448逐帧尚未验；未改原版、未计新视频。范围142模块33增强/55静态/54部分。

收口：460条逐帧观察连续并匹配PTS；GPU图集/手机/候选页及三主场截图已目视，测试均通过。index/pipeline实际读取120/285、剩165（atlas-pages.json），新增运行时GPU入口来自同一共享进度；完整285视频/README匹配、管线缺0、空白检查通过。实测速率2.51段/小时，目标4段/小时单列；下一批树impostor/蓬松云未计学习。映射142模块33增强/55静态/54部分，原版与游戏副本未改动。
