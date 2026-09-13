# 广场台基与岩面支撑（2026-09-13）

上一批孤立树冠替换为进展。本轮回到主体结构，补上前侧广场台基。

## 已合入

src/world/citadel/plazaRetainingWall.js 在最终海岸地形/Blender变形后读取实际山面。新城作者坐标x45.2..80.62、前缘z88.5，23段连续台基与五处外凸扶壁，顶部低于广场地面4米；底部按实际岩面高差计算。66个采样点，扶壁4个底角最小埋深0.299米。没有移动新旧城、雕像、木马或上城通路。

Blender资源：assets/models/optimized/citadel-plaza-retaining/plaza-retaining-r01.blend，场景 TigerMessenger_Plaza_Retaining_Review；0.018米窄倒角，2个合并材质面1232三角形。同步运行时 plazaRetainingR01.js，源摘要防止未来地形变化后误用旧版。export_plaza_retaining.mjs 与 bake_plaza_retaining_blender.py 可复现。

默认8931真实场景 → test_west_city.cjs --common-frame --current-runtime → 同一Godot主资产。网页1406广场支撑点及3255相关通路采样通过。Godot几何核对2面/1232三角形，原装备短剑兵前港202段通过。仅一次序运行Godot，无常驻多开。

## 待完成

前缘台基支撑是局部进展，不代表完整滨水建筑设计或结构力学校核。主堡层次/屋顶比例、山体轮廓、下层港口物流、战斗流程和整体画面仍需推进。

证据：artifacts/pipeline/citadel-plaza-retaining/index.html，包含同机位真实前后及Godot截图。
