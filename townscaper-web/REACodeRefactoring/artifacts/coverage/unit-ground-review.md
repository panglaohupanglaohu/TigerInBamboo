# 坡地战斗与逐人脚高缓动

828984794407170048，README日期2017-02-07，配文“PRO TIP: Protect your real estate investments by keeping vikings off your homelands”，不是原unitsnap注释的无文字。387帧，先README再sheet00–03全部逐格核验，原尺寸20/80/150/240/300/386。沿坡接敌、血/倒地、屋旁燃烧、大火球/碎片、焦黑屋顶和幸存单位移动都可见。不能据画面证明取整采样、具体层高或缓动常数。

Workbuddy unitsnap独立台地示例比较整队均高与每人格高。重构版已有真实BattleNavigation逐人navFloor，且能洞内/屋顶分层，直接替换为原独立heightAt会丢失已完成能力。本批保留导航/坐标/攻防/落水逻辑，仅修高度追随旧dt*10线性权重的帧率依赖：用1-exp(-10dt)，速率10是既有本地常数，非原参数。目标仍每人navFloor*L，不用整队均高。

tests/unit-ground-height.mjs验证30/60/120Hz一步组合与解析一致、不同目标楼层、dt0/速率0冻结、长步与坏输入。tests/unit-ground-height-browser.cjs控制真实Battle两名守军在实际4/6层，三帧率同步1秒，与 floor*L-.1*exp(-10)误差<1e-10；双网格31绘制调用，无pageerror，截图unit-ground-quad/mixed.png查看。sprites-browser.cjs旧精灵开关/停止和三主场景回归截图查看。

只在既有移动路径的层高更新点改公式；攻击/眩晕/落水等分支未改，真实坡面插值、身体动画/脚底约束和原火球仍缺。不是完整unitsnap或原战斗复现。890611046435627008配文生日gif，当前仅解码666帧，尚未看完，不记学习。原版只读、游戏副本不动。

截图限制：四边网格高平台单位受建筑/机位遮挡，截图不作为脚底无穿插证明；高度结论来自真实Battle数值和实例更新，混合网格可见分层单位。

本批复核（承接队列「先核现有落点」）：落点核实——每人 navFloor + BattleNavigation.footHeight 踏面目标 + 1-exp(-10dt) 帧率无关指数缓动已在（不是跳格），但缓动只写在走路分支末尾：近战缠斗、横扫、刺击、眩晕、无目标待命都先 continue，单位层高变化时会冻在半空，这正是「每人层高缓动」的残留断口。本批把同一次缓动上移到单位循环前段（坠落/船上/跃起仍各有自己的 y，不写两遍以免等效速率翻倍），寻路/碰撞只读 navFloor/x/z 不受影响。新增 tests/unit-ground-height-battle.mjs：真 Battle + 真分层导航双楼层、待命分支 30/60/120Hz 一秒收敛到 foot-.1·exp(-10)（<1e-10）；缠斗分支 x/z 全程不动 y 仍按曲线收敛；眩晕中段 y 已走到解析位置；整队 300 帧 24 个接地单位 floating/buried=0、坐标有限、navFloor 不被缓动改写；同种子两跑 y 序列逐位一致。残差如实记：原片火球特效、单位身体动作与坡面脚底采样方式未复现，且不能据画面证明原取整/插值与缓动常数——属原片美术资产/未公开算法（卡点·B/C），本批后无可执行残差。
