# 书店镇漫画 · 可拍物件清单

实景源仅为 `http://localhost:8931/TigerMessenger/`。本章采用《四盏灯，一封信》剧本；物件按当前 TigerMessenger 源码与运行时场景核对。组内子 id 同属一个可拍系统，正式镜头不依赖文字生成或额外模型。

## 一、书店、镇区与人物

| id / 物件 | 视觉与叙事用途 | 入场 |
|---|---|---|
| `bookshop-steampunk-robots` / 镇区总根 | 圆形镇区、三院、港口与战斗关系；建立尺度和舰队压境 | 封面、s05、s10、s13、s15、s20 |
| `bookshop-spherical-ground` / 海堤台地 | 球面海岸与小镇基座；人物小于地方 | 封面、s01、s15 |
| `bookshop-base-circular-plaza` / 环形广场 | 四店共同选择发生地；联藏约穿场与居民防御 | s05、s10、s22 |
| `hard-to-find-bookshop` / 独立书店 | 信使抵达、取出联藏约、回望广场 | s01、s09、s16、s18 |
| `bookshop-sign-text` / HARD TO FIND 招牌 | 联藏约起点与“书仍属于读者”的细节证据 | s16 |
| `locust-bookshop-court` | 第一枚联藏印；重型机器人离店守路 | s02、s06、s19 |
| `locust-bookshop-factory-compound` | 书架与重型装配并存；说明藏书不是抽象道具 | s02、s06 |
| `ant-bookshop-court` | 第二枚联藏印；蚂蚁放下茶杯加入防御 | s03、s07、s14、 s17 |
| `ant-bookshop-factory-compound` | 钟楼、锅炉、蒸汽与阅览室；蒸汽掩护送信路 | s03、s07、s13 |
| `beetle-bookshop-court` | 第三枚联藏印；车灯与扫描引导信使 | s04、s08 |
| `beetle-bookshop-factory-compound` | 玻璃穹顶与精密装配；校准港灯和航路 | s04、s08 |
| `player-courier-root` / 信使 | 取信、携信穿场、抵达港口交付的动作主角 | s01、s09、s18、s11 |
| `letter` + `player-hold-aura` | 联藏约的实际持信视觉；取信后显示、到港交付后隐藏 | s09、s18、s11 |
| `bookshopPedestrians` / 镇民与工人 | 日常阅读、撤离、共同守路；不作为前景遮挡 | s02–s10、s22 |

## 二、三台机器人与工业细节

| id / 物件 | 视觉与叙事用途 | 入场 |
|---|---|---|
| `bookshop-robot-locust-articulated` | 高绿双足与维护长枪；从修架转为守门 | s02、s06、s19 |
| `robot-rifle` / `robot-muzzle` | 防御方向与舰队仰视关系 | s06、s10、s19 |
| `bookshop-robot-ant-articulated` | 锈红锅炉机体；以机体和排汽挡住廊口 | s03、s07、s14、s17 |
| `robot-cup` | 战前日常与战后缺损的安静回扣 | s03、s17、s14 |
| `robot-pressure-cannon` | 排汽屏障与共同防御 | s07、s13 |
| `bookshop-robot-beetle-articulated` | 低矮四轮与大光学镜头；扫描通路 | s04、s08 |
| `robot-cabin-front-lamps` / `robot-turret` | 为信使和居民照路、指向空降方向 | s08、s10 |
| `robot-live-units` / `robot-unit-<id>` | 若有已生产单位，作为远景增援；不伪造数量 | 战斗环境镜 |

## 三、廊灯、坡道与招牌系统

| id / 物件 | 视觉与叙事用途 | 入场 |
|---|---|---|
| `hard-to-find-terrace` / 高架露台 | 门廊向外看、人物与海天的前后层次 | s01、s09、s18 |
| `htf-arcade-arch` / `htf-arcade-lantern` | 前景拱框与暖灯；避难通路 | s18、s21 |
| `htf-ramp-deck` / `htf-ramp-lantern` | 送信路线的引导线 | s01、s18、s21 |
| `bookshop-jakub-pass` / Jakub 附加层 | 镇区灯、树木、木箱与海岸细部 | s11、s13、s21 |
| `jakub-viaduct-arches` / `jakub-viaduct-arch-lanterns` | 连续拱廊与“四盏灯彼此回答”的视觉母题 | s21、s23 |
| `jakub-lamp-posts` / `jakub-lamp-lanterns` | 战斗中的可读路径；不是 HUD | s13、s21 |
| `factory-sign` / 三店及货运招牌 | 证明三家店各自身份；只在所属店内可读 | s02–s04、s06–s08 |
| `BOOKS` / `货运入口` | 书箱与工业后勤同框，强化“要交出的不是货物” | s02–s04、s11 |

## 四、港口、船只与飞艇

| id / 物件 | 视觉与叙事用途 | 入场 |
|---|---|---|
| `bookshop-parts-quayside` / 零件港 | 信使抵达交付点；生产与阅读共享同一港口 | s11 |
| `harbor-unloading-crane` / `harbor-suspended-cargo` | 近处吊架框住远景；战时停止装卸 | s11 |
| `bookshop-steam-parts-freighter` / NORTHWARD | 港口尺度与拒绝把藏书当货物的对照 | s11 |
| `NORTHWARD` / `PARTS RECEIVING · CARGO HANDLING` | 交付地点的空间证据 | s11 |
| `jakub-wharf-deck` / `jakub-stair-steps` | 信使下到海岸交付联藏约 | s23 |
| `duke-coastal-steam-freighter` / DUKE | 把联藏约带往潮气边境；不是运走藏书 | s23 |
| `duke-gangway` / `duke-mooring` | 人与船之间的交付方向、离港前的静场 | s23 |
| `bookshop-airship-mooring-mast` | 高耸系留塔与货艇；保留一条备用空中航路 | s12 |
| `bookshop-moored-cargo-airship` | 战时不装书撤离，而等待真正需要离境的信 | s12 |
| `moebius-airship` | 远景航空交通与潮气方向的视觉提示 | s01、s12、s15 |

## 五、霸天舰队、空降与潮气边境

| id / 物件 | 视觉与叙事用途 | 入场 |
|---|---|---|
| `crystal-city-colossus` / 霸天旗舰 | 索书与封锁的权力尺度；越过海堤压向广场 | s05、s19、s20 |
| `batian-faceted-shield` | 防御攻击的可见反馈 | s10、s13 |
| `moebius-aircraft-squad` | 同一机队由巡航转为封锁，保证战斗连续性 | s05、s20 |
| `vanguard-hauler-0/1/2` / SOCCO | 运输艇逼近与索降来源 | s22 |
| `vanguard-trooper` / `bookshop-heavy-trooper-rope` | 空降兵切断送信路；机器人和居民共同应对 | s22、s10 |
| `batian-arsenal-live` / 炮击、离子与爆炸 | 危机逐步升级；不伪造建筑废墟 | s05、s10、s13 |
| `batian-bookshop-ground-operation` | 压制、索降、推进、撤离的真实战斗阶段 | s22、s10 |
| `bookshopAtmosphere` / 海岸薄雾 | 书店镇近景的潮气与距离 | 封面、s01、s15 |
| `equatorialClouds` / `megaCloudWall` | 联藏约最终要越过的潮气边境；只作远景语义映射 | s12、s15 |
| `storm-rain` / 云墙雨线 | 远方仍有下一座镇需要被提醒 | s12、s15 |

## 覆盖验收

- 四家书店均有独立建立镜和选择镜：Hard To Find 取信，蝗虫、蚂蚁、甲壳虫依次联署。
- 三台机器人均有日常与战时状态；杯子、车灯、长枪不是无意义特写。
- 信使动作闭合：s09 取信 → s18 带信离店 → s06–s08 联署 → s21–s22 穿场 → s23 港口交付。
- 港口、双货船、系留飞艇、廊灯、招牌、云墙均进入叙事，不只出现在资产表。
- 正式画面只用 8931 canvas；世界内招牌保留，所有 DOM HUD 禁止入画。
