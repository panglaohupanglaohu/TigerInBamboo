# Jakub：书店镇实际布局的蒸汽朋克目标图

此文件是构图 brief，尚未生成目标图片。主代理负责内置 imagegen。研究依据见 `docs/jakub/RESEARCH.md`；全账号 GIF 尚未学习完，不能以目标图暗示已全看。

## 几何参考与证据界限

已实际打开的历史实景：

1. `artifacts/pipeline/bookshop-freighter-repair/after-overview.png`：2026-09-28 巨轮修复后的基地鸟瞰，`PROGRESS.md` 标为实景，保留圆形广场和一侧紧凑泊位；海洋和球面曲率明显。
2. `artifacts/pipeline/bookshop-warm-lighting/after-base.png`：近一些的基地全景，三个厂院面向广场；`capture.json` 留世界目标坐标。历史证据，不是本日新拍GPU。

2026-10-11源码核对仍有：圆形公共广场(局部中心0,32)、三厂按半径48后弧排列、第四临海游客书店保留原模型、海岸球面低地、侧泊位巨轮、后厂货运支线和桁架。主代理当前正式截图应优先取代上面历史图作 imagegen 的第一几何参考；不要拿用户未知来源的铜管镇照片替代真实镇布局。

## 主画面决定

16:10 横幅，从临海广场的对角上空以35–45度俯角向三厂望去，近处能看到开放临海弧、游客小书店；广场占画面中部约25–30%，三个厂院及工作街占中后部45%，左侧港口和铜管/吊装系统约15%，海面与远景约10–15%。保留球面曲率但避免夸张鱼眼；近景能辨人尺度和书店窗里的书。

用码头→零件接收仓→后院加工/装配→机器人服务坪串起可读的生产故事。港口在基地一侧，绝不迁到公共广场中央或增加后港。巨轮靠泊，吊梁承托真实清晰，吊钩举着一箱机械零件；保留平台/轨道净空，不把货箱摆轨上。

三厂轮廓沿用实际场景：蝗虫重型装配厅的高窗、桁架及工作平台；蚂蚁动力厂的高压罐/烟囱和钟楼书店；甲壳虫精密厂的仪表穹顶与玻璃屋面书店。机器人保留对应造型/岗位，绝不由通用巨机甲取代。临海第四小书店 Hard To Find 为独立生活空间，温暖橱窗与旧招牌清晰。

主能源节点放在已有蚂蚁动力厂的工业后院，采用清晰可见锅炉/压力罐组成，不另造侵占广场的巨型Frostpunk发电塔。主管沿既有服务侧巷/后场接到另外厂院，有圆柱支架、斜撑、检修走道和少量阀门；分支短，来源/去向可辨，跨铁路处必须足够高并有独立支持。

## 氛围与可实施美术

冷蓝灰天空和蓝绿海水；低饱和浅石、红褐砖和煤灰屋面是背景，旧铜/黄铜为功能设备强调，暖琥珀窗光是生活与热量焦点。晚午/初暮，不用极夜或漫天暴雪。光晕节制，工业蒸汽乳白、透光、有分层，明确从烟囱口或泄压阀升起、沿一致海风偏移，最高处逐渐稀释，不遮三厂主轮廓或招牌。

用擦损、接缝、煤灰和漏水痕解释年龄，不把每块墙面刷成随机污点。画面显示少量工作中的人、小推车和零件，保留宽街/公共走路空间；在小书店门前有阅读/交流生活。近处细螺栓/格栅，远处省掉零碎机械，整体是一座可游玩的精致海岸工业书店镇。

Frostpunk 2 只提供功能组团、体量等级、工业生活对比的研究方向；用户第二图来源未证实，只能用作管线/材质参考。目标图采用高质量 stylized 3D concept、可信工业支撑与人尺度；不能直接复制原作雪城、人口规模或原作建筑。

## 给 imagegen 的提示词

Create one polished 16:10 panoramic game environment target illustration for TigerMessenger's existing coastal steampunk bookshop town. Use the supplied actual game screenshot as the primary geometry/layout reference, with the other historical game screenshot for corroboration. Preserve the town footprint, its broad open circular public plaza with compass paving, three distinctive bookshop-factory compounds facing the rear arc, and a fourth small original Hard To Find Bookshop on the seaside frontage. Preserve the ocean-facing open promenade, curved spherical terrain, red and blue railway paths, rear industrial freight access, and exactly one compact side berth with the existing large steam freighter and structurally supported loading crane. This is a design target illustration, not a screenshot.

Improve architectural readability with three hierarchy levels: large quiet industrial halls, distinctive pressure vessels and glazed roof/clock/dome silhouettes, then restrained valves, flanges and rivets. Keep the actual three paired insect robots: locust heavy assembly, ant steam power, beetle precision works, with their factory identities. Show a logically connected steam utility system originating in the ant power works, following rear/service lanes with steel braces and real piers; keep the center plaza open and freight off railway tracks. Show a believable unloading workflow at the side harbor. Do not add a central enormous generator, alter the railway geometry, or replace the town with an unrelated dense city.

View: raised seaside diagonal three-quarter perspective, 35–45 degree downward angle, broad landscape framing, no fisheye. Public plaza in middle foreground, three shops/factories clearly distinguishable in middle/back, side freighter/quay on left flank, quiet blue-green sea along front. Pale weathered masonry, muted brick, coal-gray roofs, aged copper functional machines, dark steel structural frames; warm amber shop windows and pressure instruments against cool blue-gray coastal air. White steam must visibly begin at identifiable chimney/valve outlets, rise and drift consistently, and dissolve before blocking shop signs. Enough human workers, reading life and tiny delivery carts to establish real scale. Detailed foreground joins, calmer distant silhouettes. Sophisticated handcrafted stylized 3D environment concept, industrial storytelling, elegant warm/cool composition, crisp clear forms. No snow city, no Frostpunk HUD, no generic gears everywhere, no extra city towers, no canal/swamp elements, no text labels or overlay.

## 图后检查

逐项检查四店、三厂功能、原机器人形象、圆广场、侧港、红蓝铁路与支撑是否保留。目标图出现不合理跨轨管线/新巨塔/密集雪城要修正后再交付。图中装卸动作和新增主管属于改进目标，不宣称生产代码已实现；目标图与当前游戏差距须在后续批次逐项记录。
