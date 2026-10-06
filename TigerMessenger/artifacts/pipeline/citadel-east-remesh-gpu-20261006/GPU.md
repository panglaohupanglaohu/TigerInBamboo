# 东岸最终岩面：仅诊断GPU，生产未替换

2026-10-06 16:06:55 临轨崖壁、16:09全景在普通主页后台tab11手动应用createEastCliffRemeshPreview；sourceHash2638422502严格匹配，source局部frame x=-52。新版artifact为remesh-final-surface-geometry.json（136403tri），包含原raw→旧final→新raw→新final加工来源。

候选：candidate-cliff.png/json、candidate-front.png/json。GL0/gpuFailures[]、console errors[]。该操作只挂新的显示山面并隐藏原显示山面，未改轨、结构、导航、植被索引，不是生产或通行验收。玩家仍书店未移动。

看图：外扩岩脚实质退开，清出海侧带；崖面板直深褶很明显，多株旧植物在已削去的支撑位置悬空，当前旧廊仍离崖。新的轨道/上廊仍未换到候选线路，这张图不能证明它们匹配。主楼比例/后山/街群密度/云形等整体目标差异仍明显；不打新分。

reverted-cliff.png/json是撤回后稳定画面的同机位对照（timeOfDay=.49）。最初before-cliff拍于旧启动后立即切机位，灯光/演员尚未稳定，不作为严格同光照差分。候选已撤回；daySpeed已UI恢复.4、恢复玩家镜头、关闭菜单，后台tab11保留。

最终双线表面350姿态0碰、2949承托点保持来自离线有限审计。2个parity异常经实体角与完整有向交点分析确认是审计distance-only合并微米级进出对导致，修正规则有闭盒/薄盒回归，详见FINAL_PARITY_DIAGNOSIS.md；没有据此把最终非索引T接头面宣称全部watertight。真实演员、植被重植、新廊基础、全球接驳承托及动态玩法仍待。
