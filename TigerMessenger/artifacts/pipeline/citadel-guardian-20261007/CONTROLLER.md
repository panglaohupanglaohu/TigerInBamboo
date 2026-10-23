## 2026-10-07 复核更正

旧 `production-integration-cpu.json` 对应夹具将木马工厂scale和root.scale各设为0.72，实际citadelRange仅root.scale一次0.72。旧生产净空通过不能用于真实尺寸木马。本轮正按实际工厂参数重跑，保留原证据供追溯；控制器状态单测仍不等于真实净空或GPU验收。

# 圣城守望者控制器（2026-10-07）

状态：代码与CPU真实工厂测试完成，main集成由主代理负责，GPU未验收。

## 实际接口

`createCitadelPlazaGuardian({scene,castle,statue,horse,nightInfiltration,getFleet,getAssault,getPlayerAircraft,getListenerPosition,sampleSupport?,thunder?})`。
返回`update(dt)`、`report`、`stormState`、`dispose()`。

- 输入必须为已安装的原石雕、原木马与真实fleet；不创建替身。石台从未移动，heroRig.bodyRoot离台，2秒过渡到horse.ridingAnchors.seat，座锚精准对齐，mounted/raiseSpear关节生效。
- 对舰队members中的`kind=moebius-aircraft`过滤实际parent/visible、dead/downed/失能、friendly/player标记以及getPlayerAircraft明确返回值。`formationIndex=0`为领头舰优先，其余按距离。只在城周围70m水平/90m高度内触发；战中88m退出滞回。玩家Q飞艇`moebius-airship`绝不匹配。V驾驶状态不在机体userData，main必须传getPlayerAircraft。
- nightInfiltration.requestGuardianLease(owner)必须先等士兵回腹并停止夜袭，持有后才离台；目标离开/销毁/归位都releaseGuardianLease，包括尚在pending的请求。
- 木马只在原落点±0.26/0.14m小弧、偏航±0.035rad。每步全四轮射线承托（默认仅实际广场铺装和木马石铺底）且检查马整包围体与石台/逐实例护栏石缘碰撞；没有真实支持就不复活、不越界运动。缺少支持的状态明确留waiting。未修改路线、地形和港口。
- 战后4秒无有效敌人，1.5秒木马回原位、2秒雕像回石台并解除租约。dispose也准确恢复原变换和关节，移除本控制器的云与雷。
- 每3.2秒一击，1200真实船壳伤害；主舰1800初始船壳两击失能，不累加arrowHits，不意外下沉苔庭鲸。伤害共享`applyFleetHullDamage`，机器人防御已换该helper；沿用原tranqFall快速坠落/贴地/回升，450恢复船壳，不称永久击毁。实际命中才报告雷击和舰队报复。
- `stormState={intensity,flash,active,local:true,globalWeatherModified:false}`供main局部光照覆盖。自身有32个实例滚动乌云和准确矛尖到舰体的闪电、真实sfxThunder。未写P.weather或昼夜时钟；weather.strikeNow是随机玩家中心闪电，不能冒充打舰。

## CPU证据与限制

`tests/world/citadelPlazaGuardian.test.mjs`六项通过，使用实际石雕和木马factory：离台骑乘/主舰优先/1200真实扣血与第二击失能/归位；士兵租约等待及pending取消；玩家驾驶豁免/缺承托不浮移；共享机械伤害与原坠落恢复、arrowHits不变；飞艇/友方/隐藏/远处舰队不触发；大dt限频和mounted时dispose归位。

未在崩溃浏览器中绕过策略，未进行GPU验收。main仍须接入控制器与局部天气光照；若playerSupport缓存原静态雕像/木马，需要动态过滤或适时刷新，以免移动后仍保留旧碰撞代理。动作是程序关节骑乘，木马以轮台在极小已承托范围活动，不是完整步态骨骼动画。未声称连续全场碰撞证明。
