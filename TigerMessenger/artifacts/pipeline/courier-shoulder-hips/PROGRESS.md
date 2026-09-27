
## 2026-09-28 信使肩胯/帽色、机器人音效、主视角右键修复
- 信使：实际 courierWasteland builder 肩轴 x±.205→±.163，y .325→.294；收窄夹克肩线、袖帽与腰带，补连续裤装骨盆、后侧臀部和上腿体积。保留单肩甲，改曲面壳覆盖抬臂接缝；帽色从黄色改锈棕 #85452c，帽檐使用同一织物材质，风镜仍在帽上。humanCourier 实际入口直接调用，非独立候选。正背侧、行走、坐姿截图见 courier-shoulder-hips；未声称目标图已达8分或新增虚构迭代轮数。
- 三机原创WebAudio：蝗虫三连发/枪机/退壳，蚂蚁低频压力炮/泄压，甲壳虫五发短脉冲。接 weaponEffects 实际枪口与撞击点，移动/运输共享；真实伤害和失能事件才触发确认脆响。近身破空仅当听点靠近弹道中段；蚂蚁压力弹无超音速裂响。五方向厂墙射线每模型700ms缓存估计反射，带距离延迟/衰减/左右声像，复用既有声部预算与压缩总线；M键同时压低现有SFX总线。不是完整声学仿真，未用COD录音。
- 音频验证：实际三个模型触发枪声3/1/5次，撞击3/1/3次（快速撞击受预算限流）；浏览器无pageerror。试听录制峰值0.433，无削波，远距/静音拒绝新声测试通过，破空和反射均触发。听感需用户试听，不把数值检查当音质验收。robot-combat-audio/review.html 与 preview.webm。
- C主视角：camera.js 第一人称分支原先忽略 camOrbit/camPitch。现在右键拖动应用两角度，松开沿用回正规则，只转相机不改列车方向。红蓝车实鼠标测试yaw/pitch/回正/驾驶室隐藏均通过，零pageerror。first-person-right-look/check.json。
- 37项robotOps测试通过。全战役与长期密集交火混音仍待完整验收。旧Godot/GLB未更新。
- 声音参考：Infinity Ward 官方2019年武器独立声、退壳和环境反射/延迟介绍 https://blog.activision.com/call-of-duty/2019-07/Modern-Warfare-Initial-Intel-Creating-an-Orchestra-of-Incredible-Audio-Effects-Weapon-Sounds-in-Call-of-Duty-Modern-Warfare 。信使依据用户认可目标图及9月28日穿模/帽色截图；没有另造风格目标。
