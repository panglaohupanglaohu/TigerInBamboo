# Godot 苔庭伏击顺序修复

Godot伏击门槛本轮验证：`artifacts/pipeline/saihoji-godot-ambush/world.json`，22项实际原场景固定步长检查通过，phase=complete、301次实际投射物命中、重甲完成撤离、reset清空角色，load_error为空。测试等待全员就位10秒再调用真实信号接口，无注入命中/登陆；不称人工自然通关。规则测试 director.json通过，旧核心42项兼容测试通过。场景路径 `godot/scenes/saihoji_battle_world.tscn`，开始任务后等待到位再按R。

未完成：松下实际隐藏姿态、原主线存档接续、自然登船取械与岸面承托、完整实时试听与人工游玩。高山圣城之战保持后置。
