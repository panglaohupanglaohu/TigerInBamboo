# 圣城旧护城河修复接续验收

本轮接续已有Web修复，补齐Godot圣城入口，未重建整个圣城。

- [8931重建后实际截图](after-rebuild.png)
- [Web结果](web-report.json)：启动、三次重建、恢复原参数；31个桥/步道/帆/桅杆对象保留，无页面异常。
- [Godot结果](godot-report.json)：真实citadel_world入口三套旧水盖停用，重复绑定，全局海实例复用，31个桥/帆/桅杆对象保留。

复验：仓库根执行 `rtk proxy node TigerMessenger/tools/pipeline/test_citadel_moat_retirement.mjs`；Godot执行 `rtk proxy /Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot --headless --path TigerMessenger/godot --script res://tests/test_citadel_retired_water.gd`。

尚未完成：截图中的褐色折线路段、突兀岩块和整体岸线重排；真实港外航路和攻城接入；最新整城外观向Godot的完整同步。该报告不证明这些内容完成。
