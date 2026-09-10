# Web 场景音乐归属修复

最终实际页面报告：`2026-09-09T21-38-24.362Z/report.json`。11项通过、0页面错误、源哈希稳定；独立异步夹具13项通过。

修复原因：旧苔庭曲没有玩家听距和电车门控，反而会暂停电车；上车暂停名单漏了鲸战/前奏/舰队曲；旧淡化与播放请求没有独立失效标识。现在仅由当前有效音乐归属控制原音频元素，电车优先，远处战斗只保留请求。旧曲先暂停并归零，新曲按原淡入启动；这是防串音切换，不是无缝交叉淡化。

玩家位置取main真实player.position；苔庭锚点取实际鲸根；舰队与攻城调用补战场世界位置。战斗曲进入70米、退出82米，潜入沿用42/52米；声效与WebAudio环境声不纳入音乐互斥。未改曲目、任务/战斗规则或Godot。

测试使用实际8931页面、原MP3、真实HTMLAudio播放时钟、真实KeyF电车上下车回调。暂停世界主循环以控制玩家/车的位置和战斗音乐请求，音频RAF与原生媒体时钟继续运行；不是自然全程乘车或录音试听。覆盖步行苔庭→上车→反复远处战斗请求→远离下车→回苔庭→战斗结束；还检查八音盒计时段结束释放归属。

文件：src/audio/bgmOwnership.js、src/audio/sfx.js、src/main.js；vanguardAssault.js和saihojiPhalanx.js仅此音频批次补source参数。

复验：
- `rtk proxy node tools/pipeline/test_bgm_ownership.mjs`
- `rtk proxy node tools/pipeline/test_bgm_scene_web.mjs`
