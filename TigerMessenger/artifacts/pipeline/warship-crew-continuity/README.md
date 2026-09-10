# 战船与岸上同一拨士兵：身份与显示接线

本批 Web 生命周期接入 `src/world/warshipCrewContinuity.js`，由真实 `saihojiPhalanx.js` 的 spawnWave、苔庭下岸、返航登船、广场下岸调用。

- 两艘原作主线船各 25 个战斗 UID，按座位 0–24 绑定既有地面 actor；第 26 座为非战斗留守者，不加入原 5×5 战阵或 50 个伏击位置。
- 航行中对应座位人物可见，武器归属船中央；下岸隐藏对应座位、取走对应武器，显示原 actor；返航复用相同 UID 和 actor。
- 不再整船消失或整批清空桨手。死亡、倒地不会因返航与进入圣城阶段被复活或重新变成健康划桨手。
- `boat.userData.crewManifest` 可检查 UID、角色、座位、登船和武器归属。工厂接口为 bindCrewIdentity / setCrewEmbarked / setCrewWeaponStored。

验证：`node tools/pipeline/test_warship_crew_continuity.mjs` 已通过两船 50 UID 唯一性、座位/武器双向切换、对象与生命值保留、留守者、伤亡不复活；phalanx 语法检查通过。

这是绑定实际生命周期的独立接口契约测试，未把模拟接口称为实际 WebGL 画面验收。真实 v9 模型工厂画面验证由集成任务独立完成；本批没有宣称解决登离船走路、跳板碰撞、浅水穿地和旧泊位跳变，也没有修改这些路径。

## 最终 v11 实际 Web 集成补验

`2026-09-10T00-42-22.085Z/report.json`：10 项全部通过，实际源版本稳定，页面错误 0。按 `assets/models/optimized/warship-runtime.json` 检查实际公共工厂 revision 11 / SHA256 c6b6fc11b98b9b205aad0d7efcdf3645946e377ad58a613ed7f05340b5127932。

实际 8931 原世界恢复 chapter 2，经原航程使 50 人进入隐蔽；对应 25 座人物与中央武器离船，留守者保留。然后显式调用原 `whaleReturned` 回调，验证同对象同 UID 回到原座位、武器回船中且无地面副本。该回调是返航入口诊断，未模拟完成中间战役，未验收登离船路径与碰撞。
