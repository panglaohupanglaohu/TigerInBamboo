# Jakub · 蚂蚁厂 v2 回到实际结构

本次用户明确否定第一张蚂蚁厂目标与实景差距，必须回到原体量。本文件唯一编辑所有权，不改生产源。已亲自 view_image 看 bookshop-warm-lighting/after-ant.png 与 base-target-refinement/ant.png；两张为已存实际游戏证据，不称本轮新截图。ant-approved.png 是旧概念图，不作为当前实景。

重新阅读 bookshopFactoryCompounds.js 与 factoryTargetDetail.js。此前指导漏读增量中的中右屋顶卧式大铜压力筒，这是第一版偏离的重要原因。该增量在实际 revision20 被调用，必须保留。

## 真实造型锁定

- 前左低矮小书店，立面普通小拱门/橱窗书架，书店顶部细长钟塔（塔身宽1.8局部单位），小玻璃穹顶，不是高大尖顶塔或豪华宫殿。
- 前右较高钢架门梁/桥吊、坡顶开放工作厅，保留原与小店并排比例，不扩成独立巨院。
- 后3并列纵长厅，屋脊从前向后延伸，紧凑连接，不扇形外扩。
- 六竖压力罐：x=-6/-3.4/-.8，z=-16/-22，两排三只，高位底y8，h6/7.2/8.4；在后厅左半屋顶设备区，而非外右地面罐院。可有遮挡，不强行把六罐平铺在地面展示。
- 单大型卧式铜筒：factoryTargetDetail.js，中心x4.5/y12.1/z-19，长7.8、半径1.5，黑环箍、端帽、仪表、支架、进入左罐组汽管。是显著的中右屋顶设备身份。
- 原右侧窄货运支线/车列，原厂门尺度。局部坐标只用于对照，不直接标米制尺寸。
- 本次只精化石材、铁骨、铆钉、铜氧化、阀表、支架与工作灯；建筑布局、比例、屋脊方向均锁定。排除原图机器人、人物、飞艇、巨大环球外钢弧，厂内桥吊保留。

## 直接生成 prompt

Edit the ACTUAL ant-factory game screenshot as the strict geometry master, preserving its exact three-quarter camera, compact footprint and relative building sizes. This is a material/mechanical refinement of the existing factory, NOT a redesigned factory campus. Upper 70% large faithful model view, lower 30% two detail insets: overhead hoist/workshop section and elevated pressure-vessel supports/pipe connections. Do not use the previous expansive concept factory as reference. Do NOT enlarge the yard or rearrange halls.

Lock the small LOW front-left arched bookshop with book-filled windows and 螞蟻書店 identity, and its NARROW CLOCK TOWER topped by a SMALL GLASS DOME, no stone spire. Lock the HIGHER front-right open steel gantry portal, overhead crane and pitched-roof boiler workshop beside it. Behind them retain THREE tightly packed PARALLEL LONG HALLS with roof ridges extending FRONT TO BACK. SIX vertical copper pressure vessels stay in two rows of three on ELEVATED supports in the LEFT REAR rooftop equipment zone, partially overlapping the left production roof, never an external ground-level right tank yard. Crucially keep the SINGLE LARGE HORIZONTAL riveted copper pressure cylinder above the MIDDLE-RIGHT REAR roof, black ring collars, rounded end caps, a round gauge, real supporting legs and a connected pipe toward the vertical tanks; this is an existing major silhouette, not optional decoration. Preserve the narrow RIGHT-side freight rail spur/loaded wagons and compact entry gate. No extra building wings or new broad avenue.

Improve the existing pale weathered masonry, deep slate roofs, riveted dark steel gantry joints and braces, restrained aged copper tanks and pipes, visible valves/gauges/bolted saddles and readable generic boiler/lathe workbenches. Cold grey/blue base with small amber reading/work lights; steam only at actual outlet pipes, do not obscure shapes. NO robots, robot parts, insect statues, people, airship or giant outside-world overhead rail arcs. Keep the internal factory hoist and narrow freight track. Detail insets must depict the SAME existing assembly and elevated tanks, not invent a separate boiler campus. No unsupported engineering dimensions or fictitious specifications. Precise correspondence to the source silhouette takes priority over ornate steampunk decoration.

## 复审硬门槛

同机位看小低书店/细钟塔玻璃顶、前右钢门架、纵向三后厅、左后高位立罐、中右卧式大罐、右窄货轨七项。任何一项被搬走/扩大或换成宫殿不能称改善。仅材质机械细化不是全厂重构。生成后本代理必须实际看图，不把二维板称工程施工图或正式源实现。

## v2 实际生成后复审

已亲自 view_image 看 ant-construction-target-v2.png，并与本次已实看的 after-ant.png 机位/轮廓对照。

本轮可展示：画面回到紧凑原院落，前左低拱廊书店及细钟塔小玻璃穹顶、前右高钢门梁/吊具和坡顶厅、后部连排屋脊、左后高位立罐、中右大型卧式顶罐、右侧窄货轨与原入口关系都恢复。没有上一版外扩右地面罐院或尖顶宫殿塔。材质铆接铁骨、铜筒黑环箍与支脚、阀管及暖工作灯作了精化，仍能直接识别原厂，图中无机器人、人物或昆虫造型。

保留边界：主图立罐有遮挡，不能直接数清全部六只；下方细图同样不完全证明两排各三只，标签“六座”不等于六个几何实际可见。三后厅部分遮挡，不能凭此二维机位证明所有长度/轴线或支撑承载严格一致。小招牌生成中文字形与原真实招牌并非字形级复刻，不能拿生成文字直接导入游戏纹理。主图末端铜管也应后续核对与实物排口连接，不能因此称动力系统工程核算通过。

结论：此 v2 可作为“依据实际蚂蚁厂的材质与构造优化目标”交用户，相比 v1 已纠正最主要体量/设备位置偏离；不称精确施工图、所有六罐已核验或正式模型已完成。下一步若进入实施，保留真实六罐源节点及原尺寸，按本图精化表面/连接细节，禁止依遮挡猜删罐。
