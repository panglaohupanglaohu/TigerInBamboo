# Greg 团队湖沼目标图构图稿

日期：2026-10-10  
用途：正式湖沼环境的莫比斯风格美术目标图；不是游戏截图，不替代生产场景。

## 构图决定

16:10 横向全景，从入口一侧的坑缘以中高位三分之四角度斜看进湖盆。湖盆占据画面主体，入口石阶和环湖步道形成入湖视线；画面同时辨认中央苍老大树、水下根系、风化岩壁、维修泊位、花舟、鲸和虎。树冠高出画框但在湖心上方留出视线，不让大叶片盖住水面主体。

前景沿现有向内下行的饮水阶放置成年虎：虎头朝湖心低头饮水，宽肩胸和金赭底深虎纹、白胸腹清楚可读。阶梯接到连续、约两米宽的环湖通路，不被根系或植物截断。

中景左侧沿现有岸边维修泊位放置长船与木浮台。两只长尾猴正在协作维护船体/桅杆，绳索、备用木料和吊具组成简洁、可信的工作关系；另一艘长船在水面划行，桨叶接触水面并留短尾波。

湖心一株粗老大树从水下扎根并穿出水面，根系在浅水和深水层里展开。环形自然岩壁有断层、裂口、湿痕和苔藓；岸缘植物从石缝里簇生成片。水面从浅青过渡到湖蓝、深青，能看见鱼、水草、根系和气泡。成年白鲸与幼鲸沿树根附近游动，身体轴线近水平，尾部摆动、转向涟漪表现巡游。

黑娃总数严格为10：8名分布在花舟、1名在岸边、1名在水中游向鲸并伸手喂食/换气。每艘载人的花舟保持两名孩子、每艘花舟两支船桨；不要把岸边和水中的孩子再复制到船上。花舟保留叶片内凹船体造型。

## 风格与限制

莫比斯式清晰、克制的墨线，宽阔平涂色块，近处结构线清楚、远处线条轻淡；保留细致的树皮纵裂、岩层断面和叶脉，但不用密集颗粒贴图或柔焦渐变。色彩承接当前湖沼：青绿水、灰青叶、暖珊瑚花、冷灰紫岩、暖米色步道。画面气质古老、繁茂、安静，有异星生态感；动作关系必须一眼可读。

不要加入 HUD、标题、装饰边框、城市/晶体塔、额外角色、额外动物或新湖岸建筑。保留当前生产湖沼的碗形地貌、树心位置、入口侧饮水阶、环湖通路、泊位与湖心水域的空间关系。

## 可直接用于图像生成的提示文本

Use case: stylized-concept  
Asset type: 16:10 landscape environment target art for the existing TigerMessenger swamp scene  
Primary request: Create one cohesive Moebius-inspired swamp-bowl concept illustration faithful to the current production scene layout, designed as a visual target for environment and animation review.  
Input images: use `assets/concepts/moebius-swamp/target-v2-existing-layout.png` only for the established ink-and-color sensibility; use the five current production screenshots in `artifacts/pipeline/swamp-target-20261010/r8/` for actual geometry, camera, shoreline, and object placement. Do not copy the older target's bridges or towers.  
Scene/backdrop: a deep, circular natural swamp basin with weathered layered rock walls, an ancient central tree rooted underwater, the existing inner-facing drinking stairs, continuous rim path, and the existing repair dock.  
Subject: one adult tiger drinking at the inward steps; two beluga whales swimming around the tree roots; lotus-leaf boats, a moving longboat, and two long-tailed monkeys repairing a moored ship.  
Composition/framing: elevated three-quarter view from the entrance-side rim, wide 16:10 panorama; lake basin fills frame; keep the canopy high and open enough to see the water, boats, tiger, dock, and underwater roots in one coherent view.  
Lighting/mood: quiet moonlit atmosphere with clear depth through the water, delicate highlights, no harsh bloom.  
Color palette: the current swamp palette—teal/cyan layered water, gray-green vegetation, coral flowers, cool gray-violet stone, warm cream walkway, ochre tiger with black stripes and white chest/belly.  
Materials/textures: broad flat color fields and controlled ink contours; aged bark fissures, broken rock strata, wet patches, moss, layered leaves, small water ripples and bubbles.  
Text (verbatim): none.  
Constraints: exactly ten Black boys total: eight distributed in occupied flower boats, one on shore, one swimming near the whale to feed it and surface for air. Two boys per occupied flower boat. Exactly two oars per flower boat. Keep the existing basin, tree, stair, path, dock, and lake placement.  
Avoid: HUD, labels, captions, border, city ruins, crystal towers, extra people, duplicate boys, extra boats, canopy blocking the lake, static vertical whale poses, glossy photorealism, dense noisy texture, unrelated fantasy architecture.

## 依据与精度边界

构图依据 `docs/PROJECT_HANDOFF.md`、`artifacts/pipeline/swamp-target-20261010/TARGET_SPEC.md`、`artifacts/pipeline/swamp-target-20261010/RESULTS.md`、当前正式场景 `src/world/moebiusSwamp.js`，以及其现有 Moebius 湖沼概念图。生产局部锚点仅供检查相对关系，不要当作全局坐标；细节以实际机位图为准。这个文件是 Greg 团队构图决定与后续生成提示，不是假称已生成的目标图。
