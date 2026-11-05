# WFC局部修复 · 2026-11-02

先读README中793806535898136576原文："I gave it an extra difficult tileset to work with to make sure it can repair itself when it has screwed up"，再完整解码并查看65帧（同ID目录frame-0000…0064、frames.json、sheet-00）。

画面是复杂管道结构，局部红黄线框变化与多轮整片清空/重建都存在。原版tilerepair.js注释所称“其余部分始终纹丝不动”不能用于描述整段视频。原文支持测试困难tile集合的自修复目标；锁边界、逐圈扩大的方法是我们的工程实现选择，不宣称作者内部算法如此。

在原版规则方格修复思路上，重构core/wfc.js新增findWFCConflicts / repairWFC：通过真实半边找冲突，锁定范围外已知结果，在范围内优先原值重求解，无解才逐圈扩大。用户指定的编辑保持硬约束；预算共享于各次尝试，失败不提交候选结果。solveWFC新增preferred供局部修复使用。

这保证成功结果在返回region之外不变，不保证全局最小修改数量。每次尝试仍调用全图约束传播，并非增量计算性能优化；独立socket能力已补，实际建筑/多格tile接入仍待后续。

tests/wfc-repair.mjs：混合5/69格、四边形4/120格改动，范围外完全一致，邻边无冲突；验证倒序一致、无解后扩区、固定编辑、预算失败及回滚。

浏览器wfc.html新增“改中间一格并局部修复”：混合2/147格、四边形3/206格改动，范围外一致，反向输入一致。三个主场景回归、无未捕获异常。证据wfc-repair-browser.json与wfc-repair-*.png。
