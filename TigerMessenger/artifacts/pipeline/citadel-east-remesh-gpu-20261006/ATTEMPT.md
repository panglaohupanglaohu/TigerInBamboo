# 15:50 实际GPU预览拒绝，不是切崖实机成功

正常主页后台tab11固定临轨崖壁机位/timeOfDay=.49/daySpeed=0，已保存before-cliff.png/json，GL0/gpuFailures[]。手动点击“预览东岸切崖（仅外观）”，原source几何epoch校验拒绝：`source terrain geometry epoch differs; do not apply stale candidate`。没有挂候选、没有隐藏原山、没有改轨车或碰撞。不可把before当after。

顾问继续诊断fixture与真实原几何差异，将补实际hash/顶点/bounds错误信息；严禁去掉hash直接安装。包装器default-off仍在独立实现。root UI的预览只替换外观，未更新碰撞/植被ray缓存，哪怕下一次GPU成功也不是玩法验收。

失败后已通过UI恢复daySpeed=.4并恢复玩家镜头/关闭检查，书店信使未移动，后台页保留。新主程序重载启动耗时约71秒；点击未生效改键盘Enter后实际成功。
