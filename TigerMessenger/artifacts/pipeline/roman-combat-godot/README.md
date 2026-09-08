# 红蓝短剑兵：Godot 原算法子集接入

本批是可复用战斗适配器与原近战算法子集；不是全球原战场完成回接。当前 original-world-v1.glb 中没有 gladius 根或明确角色拥有者，港口 porter 与木马 tie-soldier 不能按名称改成短剑兵。准确 sourcePath 审计在 original-world-role-audit.json。

适配器直接绑定真实已有红/蓝 gladius 实例的原 parts/equipment 引用，保留根节点及源父子关系，挂载已认可的 Blender v3 盔甲和盾握把。最小接入点是未来原 Godot 运兵/生成器把已部署士兵加到场景后调用 runtime.register_actor(actor)，卸载时 unregister_actor(actor)。sourcePath 有则记录，没有则保留为空并报告实际 scene_file_path，不编造全球位置。

原作规则来自 src/world/saihojiPhalanx.js 的 updateSiege、applySoldierDamage、shieldBlocksArrow 与死亡呈现：红方防守半径平方为1.7²×1.4，蓝方反击为1.7²；冷却1.15×(0.8+rand×0.5)；近战一击倒地、两击阵亡；倒地过渡0.28秒，阵亡留尸/下沉共3.7秒、最后1.1秒沿球面法线以0.55米/秒下沉。蓝方爬梯不反击；被隐藏的运输父节点不会参战。没有添加新战斗玩法。

小场景 godot/scenes/roman_combat_slice.tscn 运行两组真实自主交战，一组红先出手、一组给红方初始冷却让蓝方先反击。它显示认可装备随实际命中、倒地和消失运行，不是定时切换摆拍姿势。它依然是子集验证场景，不是圣城全球战场。

```sh
rtk proxy python3 tools/pipeline/test_roman_combat_godot.py --output artifacts/pipeline/roman-combat-godot/NEW_RUN
```

此命令只在新临时 Godot 工程导入，先进行语法检查再执行有界验证。本次正式报告 final-02/report.json / validation.json：通过24项直接执行原JS伤害函数的对照、红蓝真实SceneTree自动出手、108个原节点身份/父级检查、近距选敌/冷却、隐藏父级与爬梯守卫、破盾和阵亡后切换装备不复活。最大世界握持误差3.32e-5米，适用于半径160附近的浮点坐标。

combat-lifecycle.png 来自实际 Godot 状态/坐标记录，是证据图，不是战场截图。正式结论没有包括全局运输、攻城路线、全身行军/转身、投射物飞行或所有未来战斗姿态的逐三角碰撞。原盔甲252姿态几何验证保存在 armor-regression-01.json。

原世界共享入口、Web源码、球形布局数据、registry及总文档未修改。旧诊断与中间通过结果保留；正式结论以 final-02 为准。
