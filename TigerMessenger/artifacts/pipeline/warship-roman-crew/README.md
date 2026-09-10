# 传统战船：认可罗马士兵回接与甲板布置

冻结交付：assets/models/optimized/warship-battle-v10/warship-battle-v10.{blend,glb,assembly.json}。
GLB SHA256：0568f590f32383a96c7dd8728a4643a0f98be8442da8f71714cd97bb9bbb98d5。

- 26座位使用 roman-family-v1/romanSoldier_gladius_blue.blend 的雕刻脸、胸甲、Galea、缨、十片分离裙甲和腰带。来源见 assembly 的 romanCrew.mapping。桨手不持战斗兵器；手与划桨前臂沿用经校验的握桨构造。
- 船体横向扩大1.75倍，26人及桨、双手、附着点左右整体外移0.35，人体尺寸不变；全部301帧同步。
- 第0–24座对应原5×5编队：16长矛、4短剑、5弓；中架存25主武器及20盾。每件GLB节点有独立 warship_crew_index、warship_weapon_role，可按本人上下船切换。第25座不自动新增战斗兵。
- 武器与支架总横向占宽0.228；计入头缨、裙甲、腿、手臂的301帧最窄两侧净宽均0.314333。
- 四货箱退到最后一排后，原船尾舱棚改低货台，消除后排只露头缨的遮挡。栏柱保持原粗细，仅外移位置。

验证：v10-layout-audit.json、v10-weapon-clearance.json。审核边界：姿态采样的三角表面交叉与保守横向净宽，不等同于完整人物沿地形行走、登船、靠岸或连续扫掠体通行认证。Web/Godot接入由主线程负责。

复现顺序（tools/pipeline，Blender后台执行）：
1. build_warship_roman_crew_v9.py
2. build_warship_roman_weapons_v9.py
3. build_warship_wide_deck_v10.py

原v8和认可士兵源文件不修改。
