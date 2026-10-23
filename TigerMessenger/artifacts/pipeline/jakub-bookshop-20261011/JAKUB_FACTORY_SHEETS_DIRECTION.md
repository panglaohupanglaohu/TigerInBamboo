# Jakub · 三工厂独立构造目标板

用户最新要求：仿 Duke 构造目标板方式，以当前实际场景分别出三张工厂图；只针对工厂，不出现机器人。Jakub 智能体负责造型、结构与复审，主代理执行 imagegen。仅此文件所有权，不改生产源。

## 已核实真实源码依据

`src/world/bookshopRobotBase.js` 正式构建调用 `createBookshopFactoryCompound(['locust','ant','beetle'][i])`，缩放 1.25，围广场后弧布置，门朝广场；并执行球面贴地变形。独立构造板可把球面坡度简化为轻微起伏底台，但不能悬空或将分院拼作宫殿。

`src/assets/bookshopFactoryCompounds.js` revision 20：各厂前左公共书店 sx=-3.1、z=-.6；前右开放工作厅 hallX=3.4、z=-7.8；后方三长生产厅 x=-5/3/11、z=-21；右侧货运通道 x≈12 向后连接装卸。此为源码局部坐标，不直接拿它标未经验证的米制尺寸。公共书店门与生产大门要分别可辨。

身份：蝗虫 LOCUST BOOKSHOP、ASSEMBLY / REPAIR / PARTS；蚂蚁 螞蟻書店、BOILERS / POWER / FOUNDRY；甲壳虫 BEETLE BOOKSHOP、PRECISION / ASSEMBLY WORKS。本批严格无机器人、人形机器、昆虫雕像、昆虫形构件、机器人肢体或甲壳零件；亦不放人物，用门、栏杆、楼梯、工作台建立尺度。

构造板：每张上半大主三分之四模型，下半左为真实关系的俯视平面，下半右为纵剖或关键设备细节。冷灰石/石板蓝/深铁大体量，铜局限机械与管件；青灰玻璃，局部暖炉窗灯。不是模仿雪城，也不是用巨齿轮、铜烟囱或温室替代车间。平面与主图须同建筑数量、同入口。

## Prompt 1 · 蝗虫工厂独立板

Create ONE standalone production construction target sheet for the existing LOCUST BOOKSHOP + HEAVY ASSEMBLY FACTORY, matching the supplied actual project reference, not a city overview. Upper half: large clear three-quarter architectural model on a simple pale-grey base. Lower left: orthographic roof/site plan. Lower right: cutaway through the tall assembly workshop and an overhead travelling crane detail. NO robots, humanoid machines, insect statues, insect-shaped components, robotic legs or limbs, robot parts, or people anywhere, including diagrams.

Preserve the real compound plan: small public bookshop at FRONT LEFT with LOCUST BOOKSHOP sign, arched entrance and visible bookshelves; a genuinely open tall workshop FRONT RIGHT; a two-storey reading/archive wing behind the bookshop; THREE parallel elongated production halls behind both, extending toward the rear; a separate freight service lane along the RIGHT side linking the three rear halls to a small unloading yard. Do not merge all functions into one symmetric palace. Preserve high pointed/slate-blue roofs and taller high-bay workshop identity. Riveted dark iron columns on stone foundations, diagonal braces, narrow clerestories, roof monitors, travelling crane rails seated on column heads, suspended hoist with a plain rectangular industrial steel stock load, visible metalwork lathes/workbenches and nonfigurative material racks. Show a compact steam engine cylinder/flywheel driving a nearby machine through a guarded local shaft. Two slender rear chimneys and supported branch steam pipes with identifiable endpoints; no decorative giant facade gears. Cold limestone piers, dark iron and slate dominate, brass/copper limited to machinery connections, blue-grey glazing and restrained warm task lights. Site-plan public entry/industrial door/freight entry must match hero. Small bilingual labels are useful, no invented precise dimensions, loads or certification. Factory only: no town plaza, no rail ring, no ship, no skyline scenery.

## Prompt 2 · 蚂蚁工厂独立板

Create ONE standalone construction concept sheet for the existing ANT BOOKSHOP + STEAM POWER AND FOUNDRY FACTORY. Upper half: large three-quarter compound model. Lower left: consistent roof/site plan. Lower right: boiler-house cutaway and pressure vessel saddle/manifold detail. NO robots, humanoid machines, insect statues, insect-shaped parts, robot components or people, even as silhouettes.

Keep its actual asymmetric compound: public bookstore FRONT LEFT, with 螞蟻書店 sign and human-scale arched doors/bookshelves; one tall narrow stone CLOCK TOWER above this front bookstore, not a new independent middle palace; open boiler assembly workshop FRONT RIGHT; two-storey reading/archive wing behind bookstore; THREE elongated production halls in a rear row; independent RIGHT-side freight lane and unloading yard. The rear power area contains SIX copper pressure vessels in two rows of three, visibly connected to the boiler room by supported manifolds, with real saddles/footings, ring collars, gauges, safety valves, maintenance ladders and a short operator platform. A lower foundry shed shows furnace mouth, crucibles/ladles, boiler benches and guarded steam engine/flywheel transmission, not giant ornamental gears. The cutaway traces boiler outlet to pressure vessels and a workshop branch, with legible grounded pipe supports; white steam only at real safety/exhaust mouths. Dominant cool stone and dark iron, restrained aged copper power equipment, grey-blue glass, warm amber only at working furnace/windows/lamps. The clock tower is the one dominant vertical landmark, vessels secondary, rear halls remain readable separate bays. All three views use the same number of halls, tanks, doors and same placement. No fictitious engineering numbers. Factory only, no adjacent town/plaza/rail ring/ship, calm neutral backdrop.

## Prompt 3 · 甲壳虫工厂独立板

Create ONE standalone architectural and mechanical construction target sheet for the existing BEETLE BOOKSHOP + PRECISION ASSEMBLY FACTORY. Upper half: large clean three-quarter compound model. Lower left: corresponding orthographic roof/site plan. Lower right: precision-workshop section and instrument bench / compact hoist construction details. Absolutely NO robots, insect statues, humanoid machines, robot shells/limbs/parts, insect-shaped objects, or human characters in any panel.

Respect the original asymmetric footprint: public bookshop FRONT LEFT with BEETLE BOOKSHOP sign and arched entrance/bookshelves; exactly THREE MAIN GLASS DOMES over this front reading block, one large central and two smaller side domes. FRONT RIGHT is a separate low wide genuinely open precision workshop. A two-storey reading/archive wing lies behind the bookstore. THREE parallel elongated rear production halls have small secondary instrument skylights—one SMALL dome/skylight per rear hall, clearly subordinate to the front three main domes, not three more grand domes or a fourth central dome. A separate freight lane runs on the RIGHT side to the rear unloading yard. Glazing is transparent cool blue-grey in fine riveted dark-iron ribs, sparse warm reading/task lights, not an all-golden greenhouse. Visible generic lathe, simple axle/spindle stock, measuring gauges, plain plate/sheet material racks, wooden/braced workbenches, and a small supported jib hoist, all nonfigurative industrial equipment. Compact steam branches enter workshop machines with pressure instruments and grounded supports; do not copy the Ant factory giant pressure-vessel forest. Low/wide precision workshop silhouette, stone plinths, slate roofs and modest copper joints. Section illustrates roof-rib-to-wall support and real workbench aisle clearance. Plan and hero must match dome hierarchy, hall count and doors. Small bilingual functional labels only, no unsupported precise dimensions. Factory only, no town, plaza, ship or rail ring.

## 生成后的复审

逐张实际看图核对：零机器人/昆虫造型/人物；前左书店/前右主厅/后排三厅/右货运布局；三厂功能差异；蚂蚁书店钟塔非移到另一个宫殿；甲壳虫前3主顶和后3小采光顶分层；平面/主图/剖面一致；暖光非全墙；支撑和汽源真实可辨。失败项如实记录，目标板不等于正式模型已落地或工程净空验收。

## 三张 v1 本代理实际复审

已逐张实际 view_image：locust-construction-target-v1.png、ant-construction-target-v1.png、beetle-construction-target-v1.png。

可展示的完成项：三张均为独立工厂板，完整包含主模型、平面及剖面/机械细节，没有可辨机器人、昆虫雕像、机器人零件或人物。蝗虫高跨钢铁框架/桥吊/加工工作台；蚂蚁单钟塔/六压力罐/锅炉炉口/阀表与支架；甲壳虫前三主穹顶/后三小采光顶的层级、精密工作台与小吊具明确。公共书店入口/书架与生产工作区有区分，颜色大体冷灰石板蓝青玻璃、局部暖作业光，比 v6b 大片金玻璃表现更节制。没有凭空强推机器人造型，符合本次只做厂房要求。

不能称严格按源码坐标复刻的偏差：
- 蝗虫与甲壳虫平面把后三厅描为横向长条，相对源码三列生产厅沿纵向向后延伸，朝向未严格对应；右物流存在且相互分开，但不能据此直接改真实货运入口。
- 甲壳虫主图前三穹顶横向一大中两小侧，俯视图却近似沿前左侧纵向排布，跨视图有约 90 度的关系差异；后二层阅读翼的形状也不完全一致。三主顶+三弱后顶数量层级可用，平面需校正。
- 蚂蚁六罐在生成图被放在后右地面外院；源码罐组在后厅左半 x=-6..-.8、z=-16/-22，罐底标高为局部 y=8，不是图中外右院地面标高。生成图独立槽架/维护台造型可用，位置与承载楼体需按真实源恢复。
- 部分中文生成文字有字形误写；小标签与建筑标注只作图例，不能作为真实招牌纹理直接导入。

结论：三张工厂“建模造型与构造方向目标”本轮可完整交用户；不是工程施工图、不是精确尺寸图、不是当前三维模型已实施。模型造型指导已形成，布局迁移必须再以真实源的轴线、侧道、标高和负载支撑核验，不能凭概念图重排工厂或轨道。下一轮仅修各张平面朝向与蚂蚁罐位，保持已接受的厂房风格/无机器人范围。
