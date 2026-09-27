# 莫比斯水晶城目标图

状态：待用户审定，非游戏实景。
依据：src/world/moebiusCity.js、crystalCityLayout.js、citySeaLake.js、src/assets/moebiusTower.js；原作三处高地塔群、错层半球花厅、冰蓝晶体与橙粉暖光、绿色丘垫及湖面交通。交通以tramSystem现有S形穿城路线为约束。
生成图仅美术方向，不替代真实球面坐标、桥梁净空和高程验证。未更改游戏或Godot资产。

## v2 水晶与交通（待审定）
图像target-v2.png；独立交通图transport-v2.svg。参考The Crystal Lake：https://bookpalace.com/info_moebiuscrystallake1；Edena图像汇集：https://doorofperception.com/2017/11/moebius-the-world-of-edena/；色彩讨论：https://www.williamstout.com/news/journal/2014/07/17/18-tips-for-comic-book-artists-by-jean-%E2%80%9Cmoebius%E2%80%9D-giraud-14/ 。仅参考，不将作品搬入游戏资产。
A西花厅—B母塔—C东花厅区域贯通线；三港侧湾停泊、主湖道互通；各站港间坡道/升降/步行衔接。不是新授权重做实际轨道。主塔尖仍贴边，概念图未解算模型尺寸、球面高程、水深或净空。下一步先提取现有车船包络、既有线路与湖面高程，再给站台/桥下净空/回转水域定尺寸，不能直接按画面创建穿模交通。

## v3 现状布局重绘（最新候选）
用户指出v2脱离现有模型后，依据current-context-2.png实景重新生成target-v3-existing-layout.png，保留门左、中央山脊、母塔右及约161米弧距。v2仅作晶面和配色参考。生成图不是运行时修改，不构成桥梁、航道、曲率或尺寸验收。详细边界与实施顺序见REDRAW_V3_BRIEF.md。


## 2026-09-23：水晶城 v4 三塔与全球交通布局目标
- 最新目标：assets/concepts/moebius-crystal-city/target-v4-three-towers-global-transit.png；审阅页 #three-towers-v4。
- 母塔保留三层错位花厅，两座原 gold 子塔独立展开，目标尺度约为母塔45%。
- 叹息之门及附属建筑迁往峡谷外围，释放水晶城盆地；旧161米实测间距不作为迁移约束。
- 电车是全球线路，保持区域外连续连接；局部轨顶浅入海水、车身露出。深水航道与浅水轨道避让，交叉需净空校验。
- 状态：已生成并保存新目标图，尚未修改运行时地标、轨道或Godot布局。图像支撑高度与透视不等于工程测量。
- 下一步：在现有布局数据中规划三塔/外围门区坐标，测地形承托与铁路坡度，保留已通过的母塔港口功能，再同步Web/Godot。
- JEV：既有文本分类873输入/91输出；无净节省对照数据。本轮未额外调用分类接口，避免为了展示使用而增加调用。


## 2026-09-23 水晶城目标v5（覆盖v4铁路设计）
用户指出v4铁路过多。已重绘 target-v5-single-corridor.png：区域仅一条连续双向铁路走廊，无新增海上支线/绕塔环线；全球线路浅涉水保留为独立示意。保留三塔独立和外围叹息之门。此为概念图，运行时铁路未改。勿与圣城观光线任务混淆。
