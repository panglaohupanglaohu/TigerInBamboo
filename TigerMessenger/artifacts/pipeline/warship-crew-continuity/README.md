# 战船与岸上同一拨士兵：身份与显示接线

本批 Web 生命周期接入 `src/world/warshipCrewContinuity.js`，由真实 `saihojiPhalanx.js` 的 spawnWave、苔庭下岸、返航登船、广场下岸调用。

- 两艘原作主线船各 25 个战斗 UID，按座位 0–24 绑定既有地面 actor；第 26 座为非战斗留守者，不加入原 5×5 战阵或 50 个伏击位置。
- 航行中对应座位人物可见，武器归属船中央；下岸隐藏对应座位、取走对应武器，显示原 actor；返航复用相同 UID 和 actor。
- 不再整船消失或整批清空桨手。死亡、倒地不会因返航与进入圣城阶段被复活或重新变成健康划桨手。
- `boat.userData.crewManifest` 可检查 UID、角色、座位、登船和武器归属。工厂接口为 bindCrewIdentity / setCrewEmbarked / setCrewWeaponStored。

验证：`node tools/pipeline/test_warship_crew_continuity.mjs` 已通过两船 50 UID 唯一性、座位/武器双向切换、对象与生命值保留、留守者、伤亡不复活；phalanx 语法检查通过。

这是绑定实际生命周期的独立接口契约测试，未把模拟接口称为实际 WebGL 画面验收。真实 v9 模型工厂画面验证由集成任务独立完成；本批没有宣称解决登离船走路、跳板碰撞、浅水穿地和旧泊位跳变，也没有修改这些路径。
