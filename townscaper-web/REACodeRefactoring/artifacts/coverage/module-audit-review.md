# 特定模块出现条件与有限样本诊断

先读素材README第55行1670794261669769217原文，再看全部247帧（0–7.38秒），sheet-00至02。画面是独立小岛绕视，约0.9秒起旋转，1.4–3.4秒主要看背面岩壁，随后回到可见大拱洞与平台的方向。没有直接展示WFC迭代、突然生成瞬间或统计概率；条件过于具体导致少见来自README原文。所有帧与时间戳在ID目录。

保留现有features岩拱成果。本轮补core/module-audit.js，复用共享grid和已有拓扑搜索，在给定有限样本中记录出现位置下界、完整计数或未知。预算耗尽或达到限额时exactCount为null；零命中且未穷尽不能计为确定不存在。全批次总候选预算与每个样本预算同时约束；样本ID必须唯一。

原版auditRarity的meanHits会混用被截断计数，且只在一张目标图重复试验，不能等同WFC模块出现概率。本轮明确scope为finite-topology-sample-not-wfc-probability；observedHitShare只描述这些输入样本，不当作随机概率或原作者实验数据。

tests/module-audit.mjs通过确定存在/不存在、0预算未知、limit计数下界、总预算、稳定性和重复样本ID拒绝。实际页面按quad/mixed、seed7/19生成4张小网格，共4922次候选测试，拓扑命中数0/0/1/3，均穷尽；只代表当前示例。浏览器验证重复一致、未改预览World、总预算不超限，errors[]；报告module-audit-browser.json。原patch混合/四边形及三个主场景回归通过，报告module-patch-browser.json。

仍未计算WFC权重、传播矛盾、占用或完整prefab几何约束；未实现跨样本统计推断或原版全部k规模曲线。后续优先接真实模块条件，再做周边补网/接缝与联合WFC；tileforce继续部分覆盖。
