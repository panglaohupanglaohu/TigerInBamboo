# 滨水门墙右侧岸台连接

2026-09-13，本批将原独立水门右侧与转折平台的外侧护墙连接。使用认可城门至广场目标图；不更换目标。

作者坐标：原门右缘x38，新增石墙从x37.9连续至44.5，z92.45，墙厚0.75；墙顶随转角台阶分为3.328、2.728、2.178米三个层次。基础至解析海面下1.5米，末端扶壁接原转折护墙。4米阶梯仍保留，门洞/原商铺/广场雕像及原木马未移动。

Blender MCP执行 bake_harbor_curtain_blender.py，单独场景TigerMessenger_Harbor_Curtain_Review，保留其他场景；合并重合顶点、校正法线、石块0.018米边角处理。source保存在assets/models/optimized/citadel-harbor-curtain/harbor-curtain-r01.blend；回接harborCurtainR01.js（两材质、8184三角形）。源几何签名变化会拒绝旧副本。

Web test_harbor_curtain.mjs：侧院双向带宽度372点、阶梯96点、广场1406点通过；完整现有路线另经test_west_city检查后导出同一Godot GLB。

当前只是右侧岸台连续性推进。左侧商铺体量、目标中更高更宽的门后平台、整体岩坡/台基贴合、主堡尺度、暖光过曝与植被仍未完成。不要将石墙导出数或通路通过等同目标达成。

Godot最终验证：test_front_harbor_march.gd、test_side_court_march.gd 均退出0；原蓝色短剑兵完成主路及侧院往返。capture_harbor_curtain.gd在同一原场景录得日/夜截图，所有进程顺序执行且退出。证据artifacts/pipeline/citadel-harbor-curtain/，未另开常驻编辑器。
