# Godot新城同步审查（只读结论）

当前godot/assets/art-pilots/citadel-west-city-v1.glb仍是09-11版本，不含Claude民居和target主堡节点，不能声称最新Web外观已同步。

## 必须先补的接收缺口

1. tools/world/export_world_glb.js保留citadelSolidExterior；godot/scripts/citadel_collision_context.gd接收该标记，否则新外墙即使可见仍无物理碰撞。
2. godot/scripts/citadel_window_lights.gd纳入Claude与target发光材质；当前只按town-window命名处理，静态导出的亮度不会自动随昼夜变化。
3. 核对tools/pipeline/test_west_city.cjs的旧断言（包括雕像6.88米），按真实认可资产尺寸验证，不能为导出而直接放宽。

## 复用工具与顺序

- test_west_city.cjs：验证并导出完整highland-west-city、主山体、原木马、旧港、旧广场和步道、入口梯；写Godot新城GLB、通路、灯光数据。
- export_old_city_shelves.cjs：单独导出旧城层。适配器依赖12层和历史sourcePath，避免用全世界GLB替换造成引用变化。
- export_citadel_assault_route.mjs：原城攻城锚点导出；新城本轮newCityAssaultRoute须单独纳入，旧文件哈希不能证明它同步。
- export_citadel_ocean.cjs：海面几何改变才需再导出。

导出器不直接输出灯对象、动画和Shader逻辑；发光强度截到1、实例颜色也需检查。GLB导入成功不能证明布光、碰撞或战斗迁移完成。
