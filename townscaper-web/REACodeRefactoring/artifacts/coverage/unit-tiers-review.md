# 单位等级与早期战斗复核

先按 README 第259/257行阅读821680056514781186（2017-01-18，Revenge of the Blues）与827215002448846848（2017-02-02，Looking at unit tiers）。分别763帧0–762、524帧0–523；全部联系表已逐格复核。原尺寸回看前者40/240/470/720，后者40/180/260/430；各目录frames.json含解码PTS，review-observations.json含逐帧观察与回看标记。

前片是蓝橙两队从下行、接敌、血与倒地、分离再战到蓝队幸存的连续展示。后片是三队在曲道依次入场：蓝灰装束、银白头盔/盾、金色边饰盾与盔饰，配不同旗徽；随后依次离场。点线与目标格可见，不能据此证明等弧长采样。原版navribbon注释把827215说成无文字走廊教程，823848也实际是尘粒AO配文；保留原版只读，将误归因写入映射缺口。

## 本地改进与边界

新增src/core/unit-tier.js纯外观配置，setUnitAppearanceTier只写appearanceTier，不调用会重置HP/伤势的configureCombatUnit。实际Battle的3D头盔和盾实例读取该色阶，默认无字段时保留原渲染。unit-tiers.html提供原样/三级/两网格对照。具体色值是本地解释，不宣称原参数。没有恢复原片雕饰盾、旗徽、盔形、升级经济或战斗数值；不影响精灵模式，未接TigerMessenger副本。

## 验收

- tests/unit-tier.mjs：色阶往返不回血/不重置伤势、眩晕、体型、兵种和导航；非法输入拒绝且不变更状态。
- tests/unit-tier-browser.cjs：真实Battle两网格各24单位，原样恢复；GPU像素改变quad123/mixed308，关键状态完全不变，无pageerror。截图unit-tiers-quad.png与unit-tiers-mixed.png。
- tests/sprites-browser.cjs：旧精灵开关/停止及town/terrain/fusion三主场景回归，结果见sprites-browser.json；截图另存。

视频学习2段；实现验收仅等级外观局部1段，早期战斗片仅学习。未把整段展示的所有功能标成复现。
