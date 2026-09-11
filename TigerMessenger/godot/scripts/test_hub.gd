extends Control
const ENTRIES = [
    ["高山圣城 · 当前优化", "res://scenes/citadel_world.tscn", "WFC 城堡、空腔塔身、连续旋梯。右侧选择三种士兵的通行演练；完整攻城仍在接入。"],
    ["苔庭之战 · 战斗测试", "res://scenes/saihoji_battle_world.tscn", "开始任务，等待士兵隐蔽到位，再按 R 发出信号。测试舰队、反击、鲲与撤离；登岸动画仍待完善。"],
    ["原作球体 · 全局检视", "res://scenes/original_world.tscn", "查看原场景布局和已接入的书店、虎、侦察机、城堡；区域列表用于定位，完整跨区玩法尚未迁完。"],
    ["资产库 · 模型检视", "res://scenes/asset_review.tscn", "核对工程中的资产。可查看不代表已优化或已接入战斗。"]
]
func _ready() -> void:
    set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    var bg = ColorRect.new()
    bg.color = Color("142831")
    bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    add_child(bg)
    var margin = MarginContainer.new()
    margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 32)
    add_child(margin)
    var scroll = ScrollContainer.new()
    margin.add_child(scroll)
    var box = VBoxContainer.new()
    box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    box.add_theme_constant_override("separation", 14)
    scroll.add_child(box)
    var title = Label.new()
    title.text = "TigerMessenger · 测试大厅"
    title.add_theme_font_size_override("font_size", 30)
    box.add_child(title)
    var intro = Label.new()
    intro.text = "选择已接入的内容直接测试。右下角返回大厅；切换会重置当前演练。"
    intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    box.add_child(intro)
    for entry in ENTRIES:
        var button = Button.new()
        button.text = entry[0]
        button.custom_minimum_size.y = 46
        button.pressed.connect(get_node("/root/TestNavigation").go.bind(entry[1]))
        box.add_child(button)
        var note = Label.new()
        note.text = entry[2]
        note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        box.add_child(note)
