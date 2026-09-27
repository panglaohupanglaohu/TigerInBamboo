# Godot 圣城事件音乐接入

局部老人曲只在新城锚点30米内播放，外侧5米渐弱。事件必须由剧情状态发出，不由靠近城堡或通路演练自动触发。

## 场景接口

original_world.gd 暴露 citadel_music_event(key, active, source) 与 citadel_music_reset 信号。

- 攻城真正开始：`world.citadel_music_event.emit("siege", true, battle_anchor)`。
- 夜间潜入真正接手：`world.citadel_music_event.emit("infiltration", true, infiltration_anchor)`。
- 对应阶段结束或中止：发出同一key、active=false。
- 重开/撤退/剧情重置：`world.citadel_music_reset.emit()`。
- source是战场中的Node3D，需真实存在；远于70米的事件不覆盖当前区域音乐。
- 优先级：潜入→攻城→老人局部曲。只有一个播放器获准发声，离开范围暂停，事件结束清除意图，剩余事件或区域曲恢复。
- 当前检查场景以camera为listener，后续玩家场景应bind到玩家的听音节点。

## 曲目

沿用Web原曲：攻城 Aoife Ni Fhearraigh-The Best Is Yet To Come；潜入 鬼太鼓座-大太鼓。从项目现有MP3本地转为OGG，资源位于godot/assets/audio/citadel。未生成新音乐。

## 验证与边界

运行godot/tests/test_citadel_event_audio.gd，加载真实original_world，通过场景信号验证事件优先、恢复、30米边界、离场、静音、销毁事件源。结果在artifacts/pipeline/citadel-coastal-tram-target/godot-event-audio-check.json。

圣城完整Godot攻城剧情仍未移植。当前接好的是音乐资源、控制器和原场景接口，不是完整战斗触发链。行军演练不得伪装成攻城事件。Web既有播放逻辑及30米范围本轮未修改。
