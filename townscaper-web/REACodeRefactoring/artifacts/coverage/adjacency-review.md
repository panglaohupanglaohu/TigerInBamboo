# 795010582239997952 · 几何邻接与候选边

先按素材 README.md 第279行读原文："I extract my adjacency data from the mesh (no tedious naming conventions needed) Plus I wrote a little tool to show which ones fit"。随后解码并查看全部151帧（0–19.399秒），原尺寸帧、时间戳在同ID目录，联系表sheet-00/01覆盖全部帧，无跳帧。

画面观察：0–2.4秒为灰色建筑转角、窗口和落水管，选择框及黄绿线逐步切换；2.9–9.8秒沿檐口/栏板往上切换并转动观察；10–15.8秒转到下部底板；16–19.399秒回到窗洞及竖向构件。能看到几何选择及候选标示，无法由画面得出其精确容差、签名格式或所有匹配算法。旧原版注释写24帧且断言长度/方向足以保证装配，均不作为本轮证据。

工程实现：src/core/adjacency.js迁移meshEdges、edgeSignature、buildFitTable、whichFits、gridEdgeSlots、selfCheck。空间桶检查相邻桶并按欧氏距离焊接，代表点固定（不做链式传递合并）；报告退化三角、非流形边及绕序冲突。候选仅取网格边界，排除三角化内部对角线；以绝对点积判平行、真实长度容差判等长，避免原版逐分量abs把正反斜边混为同轴。edgeSignature返回度量描述，移除旧lenKey/dirKey近似桶，无现有调用者依赖它们。

共享管线：格子半边从已有World的多边形坐标派生，逐条对比edgeNeighbors，边界错误也报告；不另建可编辑格子/体素。wfc.html求解前调用几何核验。adjacency.html提供边选择、绿色候选、灰色内部边及两种网格审核。用于展示的三角网格样本是只读模块库，不是第二份World。

测试：tests/adjacency.mjs覆盖内部边排除、平移匹配、镜像斜边不误配、跨桶焊接、非流形/退化/绕序、无效输入、长度容差及混合147格510半边/四边形206格824半边。两种网格初始声明不符均0，注入错误边界均准确检出1。

运行：tests/adjacency-browser.cjs通过点击选边、候选查询、两种网格错误注入，以及WFC几何守卫/局部修复；报告adjacency-browser.json，无未捕获异常。截图adjacency-{mixed,quad}.png；三个主场景adjacency-regression-{town,terrain,fusion}.png已目视复核，主体、岸浪、地形和房屋正常。

限制：边候选只允许平移，不自动旋转；平行等长不保证完整面轮廓、法线及实体碰撞正确。非流形输入返回诊断，调用方仍须选择拒绝策略。没有声称复现视频作者内部算法，也未将独立样例当作实际建筑多格tile库已经接入。下一步1579483114178768898：先读原文、全帧观察，再将跨三角/方格的真实tile占用与约束接入共享World。
