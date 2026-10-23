# 环境生态续作：目标图主导（2026-10-11）

## 证据分开记账
- 作者陈述：实际阅读 Fallon 2020 访谈正文（Edena 影响、宁静探索、给玩家观察和决策时间）。[访谈](https://indiegamepicks.wordpress.com/2020/03/11/aquamarine-interview/)。不声称玩法/生态是科学事实。
- 实际阅读：Moebial devlog 索引及 2022-11-22 Explorer’s Edition 正文；该文记录环境美术、动画、探索模式和可访问性迭代，没有公布本项目使用的 shader。[正文](https://moebial.itch.io/aquamarine/devlog/454898/aquamarine-explorers-edition-is-finally-here)。本次未看任何相关视频，也未运行 Aquamarine。
- 画面观察：实际查看认可 target-v3-current-courier.png。水面可辨树根、根间植物；细瀑落水局部环纹；粉褐古树与蓝灰紫石壁、珊瑚岩顶、青绿叶群形成大色块，动物位置留白。
- 本项目推断：浅岸水更浅/透、中心偏蓝；根间低草有共同着床点和不同高度；空白水道、既有植物路径约束、树冠高度沿用，不铺满湖面。
- 待验证：此批正式 GPU 近中远、实际当前曝光下根可见程度，由 root 验收。CPU 不代替新截图或90分评分。

## 已接入正常默认
1. `src/world/swampPaintWater.js` v4：修复最后一次 paint 把统一 palette 覆成旧亮橙/全绿顶的问题。岩壁、窄暖色唇边引用 `GREG_LAKE_PALETTE`，**保留真实 coralRim 工厂顶点斑块/珊瑚顶色**，外侧土皮不再猜颜色识别覆涂。
2. 水面浅绿青到蓝青的顶点色依赖真实 floor/wall 射线深度，不是 invented depth buffer；保留水面原 geometry、shore boundary、material 身份。`swampWaterMarks` onBeforeCompile 和 cache key **严格不替换**，花船/鲸/黑娃原动态涟漪仍处理相同 shader。水面 opacity .36，水体 .13；薄覆盖让底和根透出。无新增水面绘制、无 shader wrapper。
3. `src/world/swampTreeRoots.js` v3：保留既有10粗根、粗细分叉；新增最多36个着床低草丛（9个不均等空隙 habitat、每处4个根基、每基5弯曲窄叶），统一成一网格。所有顶点低于innerY22，水面25、worldScale .5；不改游泳层、角色位置、船道、碰撞或剧情。根本体1draw，草丛新增1draw，不能把总数说成1。
4. `src/world/swampWaterfalls.js` v4：保留细瀑宽和 .46低亮透明度，把目标模式落水环片尺度3→1.65，雾片半宽1.7→.8、高1.8→.85；环纹仍动画，入口和原步道拒绝逻辑不变，依然1draw。
5. understory/weathering 源仅备份读取：已有真实附着、曲面高低植被、灰紫矿物斑驳可继续，本批未重复造叶和改墙 shader，不虚称新实施。

## 验证和回退
`environment-cpu.txt` 初次两断言失败保留：旧专测硬规定高饱和水和全绿顶，与当前目标图冲突。专测改为中饱和青绿、顶色原值保存、真实浅深采样，同时严格保留原 ripple hook/key 恢复断言。不是忽略 shader 失败。
`environment-final-cpu.txt`：8/8通过，含 root meadow 高度、idempotence/dispose、波纹身份/实际发射器、水深、材质串联、入口步道净空。没有全剧情/浏览器性能结论。
源码原件 `source-before/environment/`，只恢复本代理拥有的 paint/root/falls 单文件可回退，不覆盖其他成员。`?swampPaintWater=0` / `?swampTreeRoots=0` / `?swampWaterfalls=0` 为现有各模块关闭开关，不是整场景回退。三模块正常 main.js 既有调用已接，不需新主入口。

## GPU建议机位
概览确认珊瑚顶及灰紫壁不被最终paint覆绿/旧橙；middle向树基看根和草高度；underwater确认根分叉与草共同基点；落水近景确认环纹未变成满水亮盘。主体动物/5花船双桨/10孩子/2m通路保持，无本批几何参与物理。

## 实景首次反馈后的修正（v5 paint / v4 roots）
主代理middle-first.jpg已实际查看：根仍深沉、不清楚，乳浊水面未达到目标；不能把v4第一批称美术通过。原链查到水面+开口体积两层，月光柱动画alpha约.006–.009，未发现另一个完整白膜。因此本次重点修正原粗根起始高度：从floor+3.2–6.4（约14–17）提高为近水线22.55中心，保守顶界24.2，水面25，下降长度由前32%延长为48%，粗肩从树基向外可读，再接贴底分叉。根间草保持同一着床点/数量，将叶高改为3.2–5.8并限制top21.6，不能用加数量替代可见性。
水面数值opacity .28、体积 .10，色板不变。曾试写camera-angle wrapper，但在主代理要求保留shader函数身份后，仅撤销本次临时wrapper；最终source**没有angle shader或新增compile wrapper**，marks函数/key严格保持。不会称已做角度折射或深度buffer水模拟。
`environment-shallow-roots-final-cpu.txt` 8/8通过，包含真实波纹uniform对象同一断言。中间实验日志亦保留，最终源码以final日志为准。v4阶段恢复源额外在source-before/environment-v4。等待主代理新GPU验证根肩/水透明度，尚未美术验收。


## 实景继续批：浅根、水色、细瀑
实际查看 overview-latest-continued.jpg 与 target-v4-opposite-steps.png。实景是全环境青灰雾、树根不明显、水面深浅不足；目标浅根沿水线放射可读，浅岸青绿而深心蓝青，细瀑与落点有层次。整图灰雾可能还涉及root拥有的正式环境/相机链，本三源不冒称已解决。

仅 swampPaintWater/swampTreeRoots/swampWaterfalls：主根浅肩前12%保留，下降延到70%，顶点实际均低24.5（水25），浅层>20.5根肩延伸>8inner；顶面粉褐亮/侧面深紫对比增强，没有新增草/物种。水面透明度.22、体.08，浅岸91cbb7/深心287e94拉开蓝青深浅，床面稍降绿；水纹hook/key未替换。细瀑原宽度、位置、避路保留，流芯破碎亮细条与较暗半透明水帘分开，opacity.58，避免整条白板。

source-before/environment-continued保留本批三原源。environment-continued-cpu.txt **8/8通过**，实际geometry低水面和浅肩长度专项新增，hook identity、波纹身份、恢复/关闭、瀑流避路均通过。正式固定机位GPU前后由root验收；未称90分、FPS改善或性能达标。


## 粗根色面GPU反馈再修
实际查看 environment-after-continued.jpg 和 environment-middle-after-continued.jpg：肩部已有外伸形状，但仍像浅灰紫团，与树干/水面融合。目标v4的水下粗根是深青轮廓和局部浅青 ridge。本次只修改 swampTreeRoots.js：侧面315d68、顶面78a5a0，按扫掠实际法向只让向上面进入亮色，底面再降18%；不变几何、水色、草数量或shader。颜色专项从旧粉褐树干相同色相改为目标水下青色/真实色面明暗差，非保留旧视觉要求。
source-before/root-colour存原源；root-colour-cpu.txt **7/7通过**，根几何水面净空/放射数量/1draw/浅肩长度不变，实际色面lum差>.20，暗侧lum<.10；水纹hook及身份通过。GPU下一次反馈待root，本代理不称实际图已达标。


## 最新四项中的自然聚散与珊瑚岩（实际模块）
范围仅 swampCoralUnderstory.js / swampNaturalCliff.js / swampCoralRim.js；根、水、main、navigation、共用色板和haze未改。实际参考target-v4及最新两张continued固定机位。

绿植先保留已接受的同一461株（fern91/fan46/pendant324）与5批draw，然后将241株墙体挂植重新射线附着到三个不等密度catchment，空白窗与孤株交错；候选若碰保护净空就保留原点，模板几何与包络保护不放松。16/18墙面colony产生明显非等距间隔，rim投影约51%留空域继续保持，未增加物种/数量。叶色改用共用foliageShade/foliage/foliageLight，根部深色与叶端明色，保留小幅同截面7%色差。

石体不是只改窄rim：已有天然岸肩cap顶面改珊瑚暖色，侧面灰紫，地质条带受光面较暖；已有实际低矮rim rock按法向分暖顶冷侧。主rim内沿降低旧冷色混入，整片原有露石渐变能看到珊瑚色；没有改岩/步道几何、高度或轨道净空。

备份 source-before/natural-habitats。natural-habitats-current-cpu.txt **3/3通过**：同一个当前实际工厂与本批前源进行严格物种数量对比、相同route/5draw/所有包络净空、真实挂附、241安全迁移、16非等距群落；当前天然石体2190暖面顶点/4755冷面顶点，实际低岩16暖24冷；仅主rim顶部三角形均满足暖色范围。
旧4文件22项全套为12过10失败，保留 natural-habitats-cpu.txt：5旧rim重建测试及1rim色geometry fixture在关闭rim后当前工厂拿不到report.walkMeshes；旧固定bark色、旧叶色范围与明暗比、20261008v6肩点snapshot（旧10/11肩当前受新保护净空过滤）、旧band每带>150三角形数。未为展示全过修改这些历史fixtures，亦不称这份旧suite通过。新的当前工厂测试明确保留最新场景真实安全约束。CPU不代替固定机位GPU自然度或颜色验收，待root。
