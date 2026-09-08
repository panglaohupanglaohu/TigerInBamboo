# 原作遗漏资产实际导入与导出

最新：Godot 实际导入已完成，合并清单 91/91 原作配置实例化通过；检视器行为回归通过。证据 `godot-registry-verification.json`、`registry-checks.json`。全局库 `godot/data/asset-registry.json` 可供后续按稳定ID替换资源，尚待真实世界布置与玩法接入。

19/19 补充配置的 Blender 档案与 GLB 已实际生成。所有可见三角面数量与原始 source 快照一致；导出前后 Blender 档案及快照 SHA 不变。后台最多两进程，未操作前台 Blender，未启动 Godot。

- 源与可编辑档案：`assets/models/originals/supplemental/`、其 `blender-r3/`。
- Godot 资源及追加映射：`godot/assets/supplemental/`。
- 每项导入/导出日志和计数在本目录；`validation.json` 记录容器及三角面对照。
- 可复现命令：`rtk proxy python3 TigerMessenger/tools/originals/build_supplemental_assets.py`。

所有19项目前为 partial。这是原作档案整理，不代表新造型或完整原世界接入。隐藏装备保持隐藏，未强行显示；它们的完整节点和userData保留在快照及Blender中，但可见性过滤会使部分隐藏节点不出现在GLB，后续动作适配需从档案恢复。灯光、墨线、程序动画与场景中的位置/尺度、角色控制与战争状态机仍需引擎验证。

下一步由主代理统一运行 Godot 导入，加载新增 import-map 并实际实例化与查看。此文档不代替该验证。

统计：

```json
{
  "blenderArchives": 19,
  "glbFiles": 19,
  "visibleTriangles": 23090,
  "glbBytes": 4824840,
  "maxLocalVertexError": 0,
  "zeroVisibleMeshes": []
}
```
