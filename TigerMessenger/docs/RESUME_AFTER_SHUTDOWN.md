# 关机暂停检查点 · 2026-09-13

用户明确要求暂停、保存并提交，准备关机。不要因旧自动推进计划自行恢复；等用户继续。

## 已保存且完成验证

- 已认可目标：docs/CITADEL_APPROVED_TARGET.md，场景scene-target-r01.png与独立地势terrain-annotation-r03.png。
- 广场圆台、区域200米BGM、广场铺装与台基、Godot夜间山体法线和照明修正。
- 水门尖拱、两面石砌细节；前港Blender watergate-r02.blend，6328三角形。该版此前完成Web及Godot士兵通行验证。
- Blender完整会话另存副本：/Users/panglaohu/Downloads/TigerMessenger-shutdown-session-20260913.blend。

## 当前工作中，尚未交付

src/world/citadel/frontHarborApproach.js 已从三折改为两段L形阶梯（每段16阶，宽4米），商铺移到中间8×7米侧院。原游戏8931加载工作版。

Web test_open_turning_court.mjs：96处楼梯地面采样、1406处广场地面采样通过，原木马位置不变。

但 test_west_city.cjs --common-frame --current-runtime 失败：WEST_WALK共3050采样，两处blocked（未命名mesh），castle-local位置：
- [-7.051698672656817,4.000000000000026,72.62485229580408]
- [-6.744653302224152,4.000000000000027,72.8021250230768]

缺少支撑点为0。完整路线不通过，所以该次没有完成Godot主资产导出。Godot仍为上一版经验证的三折通路/尖拱门。不得宣称两端已同步或两段路线已通过。

## 恢复顺序

1. 查看 artifacts/pipeline/citadel-open-turning-court/approach.png 与认可目标，保留新目标的开敞平台方向。
2. 用上述两个实际阻挡位置反查mesh，核对上层出口与既有主路线交叉。修复真实几何冲突，不放宽碰撞或跳过检查。
3. 重跑当前Web路线检查；通过后再导出当前common-frame资产并单进程导入Godot。
4. Godot原短剑兵整段碰撞通行与真实截图验证，再考虑交付该批。
5. 继续目标图的台基、侧院、主堡比例、港口与全局环境。门洞亮度仍偏高，完整战斗/靠泊未完成。

关机时无Godot或测试进程运行。静态预览服务关机后需重新启动8931；本轮未push远端。
