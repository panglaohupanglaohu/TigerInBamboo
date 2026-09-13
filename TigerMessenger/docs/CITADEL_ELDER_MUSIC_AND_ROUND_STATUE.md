# 新城区域 BGM 与圆台雕像（2026-09-13）

用户要求：距离新城200米播放弹唱老人 BGM，雕像自身底座改为圆台。

## Web 当前实现

新城广场作者坐标 (60,4,71.5) 经实际场景矩阵转为世界坐标，以玩家世界直线距离判定，200米以内申请 `citadelElder`。最后10米从零渐入至原曲0.5音量，离开范围停止并复位；进入区域后循环原先0–349秒片段。歌曲仍是 music/Balmorhea-Remembrance.mp3。

区域曲优先级45：低于电车、战斗及老人主动互动，高于普通峡谷/湖沼背景。共用已有 BGM 所有权，不允许多个音乐元素同时发声；静音、未开始游戏时不启动。播放被浏览器限制时每3秒重试，不在每帧反复调用play。老人近身E键互动不改为200米触发。

真实8931页面、实际音频文件与媒体时钟验证：201米外不播，190米内播放且时钟推进，电车接管没有叠播，解除接管后恢复，离开范围停止。测试为控制位置并放宽自动播放限制，不代替用户听感验收。

## 模型和 Godot

Blender 独立场景 TigerMessenger_Round_Statue_Review 保留原士兵人物，仅将 pedestal 各层及脚下 plinth 改为64段圆形。高度和外层半径保留，模型来源 r04；原r03文件保留。输出 assets/models/optimized/citadel-statue/citadel-soldier-statue-r04.blend/.glb，运行时 citadelStatueData.js；已重新导出同一Godot主资产。

Godot 全局检视/圣城检视加入同样200米区域曲，以检视相机为音频位置。原MP3在Godot解码失败，转为OGG放入 assets/audio/citadel/elder-remembrance.ogg，原音乐文件不改。此检视实现没有宣称完成未来完整攻城的音乐调度。

证据：artifacts/pipeline/citadel-round-pedestal/。Web广场1406点和原相关通路3255点随新底座再次通过；底座位于既有环砖中央，不改变船、木马和主路。
