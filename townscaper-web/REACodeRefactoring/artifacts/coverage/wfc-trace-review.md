# SLOTS与WFC候选过程

README 865200072685912064（2017-05-18）有原文：作者做浏览器demo解释WFC。无需访问文中旧站，当前使用本地视频。908帧，全部10张联系表逐格核验，原尺寸0/18/120/360/616/795/907。初始80槽同图，随后候选碎片收缩为完整蓝天/棕地/白塔，右侧反复红色冲突与连线，尾部多次重置/快速求解不同结果。原slotsolve“无文字6帧全静态”不符。

原版局部槽候选/传播思想已存在共享半边WFC，不重新复制它的独立二维格与递归搜索。新增solveWFC可选traceLimit（0默认、最大256），记录真实传播后的initial/decision/contradiction/结束原因和候选tile ID；每份对象/数组冻结。满额显式traceTruncated，不冒充全过程。默认不返回trace、不改变解；页wfc-trace.html用共享方格和原求解器25槽展示27份快照，滑杆/重置。是结束后记录回看，不是异步求解动画，未画原图块或红色依赖链。

tests/wfc-trace.mjs：初始16候选/最终1、不可变/有界/截断/默认解一致。wfc.mjs、wfc-repair.mjs、tri-subtiles.mjs回归通过。实际trace浏览器25格滑杆初末/重置、两张Canvas截图查看；wfc-browser双网格原求解/固定/倒序/换种子回归通过。完整建筑模块与游戏实景接入仍缺。890生日片仅已解码未复核，不计本批。


## 第 56 批（C04）

865200072685912064：r55 G5 slots.html（SLOTS 10×8 槽位、27 变体缩略、真实 trace 播放、红链、冲突）已覆盖片子；本批截 shots-r56/865200072685912064-slots-mid.png / -slots-conflict.png 核实。判定 done（缩略图程序化替代）。 详见 [r56-C04-bn-world.md](r56-C04-bn-world.md)。
