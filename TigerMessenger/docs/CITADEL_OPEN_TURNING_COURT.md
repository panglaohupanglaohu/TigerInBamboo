# 两段式通路恢复与回接（2026-09-13）

用户已明确“恢复”。8931本地服务已重新启动。

关机前两处WEST_WALK阻挡已反查：同属citadel-terrace-garden中的旧出口柏树与灌木，不是楼梯踏步。将作者位置[48,4,80]整组移至[48,4,84]，保留模型、数量、尺寸及碰撞规则。

两段L形阶梯每段16阶、宽4米，转角宽5.4米；中间商铺侧院8×7米，商铺仍低于广场。已完成Web路线检查和当前Godot主资产导出/导入。test_front_harbor_march.gd使用原短剑兵实际模型碰撞控制器到达广场，结果passed=true。

证据 artifacts/pipeline/citadel-open-turning-court/：report.json、godot-march.json、approach.png、godot-after-night.png。对照页index.html。

当前只完成主要上行路线与单兵检查，侧院完整通行边界、多兵列队、战争与船只靠泊没有宣称验收。仍以认可目标图继续台基、城墙、商铺与主堡整体设计。

## 恢复后的侧院专项检查

主通路通过不代表商铺侧院已通过。audit_side_court_entry.mjs 在默认8931检查从转折平台到商铺前的93个采样点，发现12个缺少支撑点和3次护墙命中（同一处边界）。报告另存 artifacts/pipeline/citadel-side-court-audit/report.json；此检查预期失败，未修改碰撞规则掩盖问题。下一批应一起调整侧院门槛、第一段阶梯末端护墙及第二段阶梯起点净空，再验证双向带角色宽度通行，并同步Godot。

## 侧院入口已修复并同步（2026-09-13）

上一节为修复前审计。现将上段起点从z87.5后移至85.5，终点80不变；16阶、宽4米，踏步深0.34375米。中间转折台由5.4×5.2展开为5.4×7.2米；侧院增加3.2×2米平层连接。原商铺位置不变，入口避开既有雨棚立柱。未取消护墙或放宽碰撞规则。

默认8931的audit_side_court_entry.mjs：双向、中心与两侧0.35米偏移共372个支路采样，无缺地面/阻挡；另96个阶梯全宽样本与1406个广场样本通过。当前GLB及路线数据已导入同一Godot。test_side_court_march.gd以原蓝色短剑兵携行几何和生产碰撞控制器分别进入/退出侧院，两向均arrived；test_front_harbor_march.gd主路线153段到达广场。检查不覆盖群体避让与最终行走骨骼动画。

查看 artifacts/pipeline/citadel-side-court-audit/index.html 的Web前后截图与Godot实际夜景。与认可目标相比，滨水门墙还偏独立，台基和岩坡衔接较生硬，主堡体量、连续岸边建筑及植被仍未完成；下一批优先合拢门墙与两侧岸台的建筑体量，而非继续累计导出数量。
