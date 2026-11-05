# 学习状态总表（自动生成，勿手改）

生成时间：2026-11-05 23:19　·　由 `tools/report.mjs` 生成

判定规则：`game/both/engine` 且 where 里的文件**真的包含这条帖子 ID** 才算学过；
`partial` 算没学完；`na/ref` 是不用学的；gifs 里有但 data.js 没登记的算「没看过」。

| 口径 | 数量 |
|---|---|
| 视频总数 | 285 |
| 学过（含可追溯校验） | 177（144 代码可追溯 / 29 仅文档 / 4 无痕） |
| 半成品 partial | 23 |
| 有笔记未实现 todo | 22 |
| 未登记（没看过） | 0 |
| 不用学 na+ref | 63 |
| **还剩** | **45** |

## ✅ 学过（可追溯）（144）

| id | 日期 | 主题 | 状态 | 落点 | 原文 |
|---|---|---|---|---|---|
| 1991103578011029507 | 2025-11-19 | water | both | src/scene.js / engine/waves.js | I think it gives a pretty good sense of a dynamic ocean without being too distractive |
| 1991101097818403263 | 2025-11-19 | water | both | src/shore.js / engine/waves.js | It's based on a looping vertex shader. The data is baked at generation-time. Each vert has |
| 1897266928961700215 | 2025-03-05 | build | both | src/doodlewall.js · engine/hallway.html | Yet another hallway design |
| 1890018647655272491 | 2025-02-13 | build | both | src/doodlewall.js · engine/hallway.html | Further iterations on hallway design |
| 1852334860137849222 | 2024-11-01 | life | engine | engine/impostor.js · engine/spritepack.js · engine/world.html | A fluffy cloud shader. It is using the same impostors as the trees, in case that isn't obv |
| 1849732997945110651 | 2024-10-25 | water | both | src/shore.js / engine/waves.js | Here, the shoreline is shown in yellow. A pushed out and smoothed shoreline is shown in bl |
| 1849730611964973481 | 2024-10-25 | water | both | src/shore.js / engine/waves.js | Shoreline waves! This is something I've tackled many times. Although this one is very subt |
| 1849427564034498642 | 2024-10-24 | life | engine | engine/impostor.js · engine/spritepack.js · engine/world.html | Made some octagonal impostors for these trees. Might seem like overkill for such a stylize |
| 1795831296952041691 | 2024-05-29 | terrain | both | src/navgraph.js · src/spheretown.js · engine/world.html | I'm putting together a navigation structure that lets you travel faster along rivers (and  |
| 1791049306213912823 | 2024-05-16 | light | engine | engine/vertexlight.js | Trying out a new lighting solution. This one is just one lookup in the vertex shader of a  |
| 1786014232594485497 | 2024-05-02 | light | engine | src/mountainlight.js · engine/texlab.html | Mountain textures! These have been tricky. Mountains kinda need lighting and normals, but  |
| 1783792917183606829 | 2024-04-26 | texture | engine | engine/worldmap.js · engine/worldmap.html | Texture test! |
| 1781405550061687016 | 2024-04-19 | water | engine | src/patchblend.js · engine/texlab.html | Ok this might not look like much but I've got seamless patch blending! Some of the patches |
| 1769691526924292506 | 2024-03-18 | terrain | engine | engine/rivers.js | Mega river system! I've had trouble making good rivers before. Now I've sort of special ca |
| 1769641473895432220 | 2024-03-18 | grid | engine | engine/relax.js | In cute tile based planets like this you often get a "mushrooming" issue where tall mounta |
| 1765115069837221962 | 2024-03-05 | tools | game | src/rectpack.js | Here, I'm visualizing the recursive tree parsing as it adds new rects. Note that when the  |
| 1765041830461055127 | 2024-03-05 | tools | game | src/rectpack.js | Now supports removing rects too! The bin space gets quite fragmented after a while though. |
| 1764958522398146667 | 2024-03-05 | tools | game | src/rectpack.js | A cute binary tree rect packer. Generating the placement attempts is kinda brute force (to |
| 1758251637280268481 | 2024-02-15 | water | engine | engine/watervol.js | It's simply a stack of planes sampling an SDF I had laying around. Gives a much more fluid |
| 1758250248483278925 | 2024-02-15 | water | both | src/reflstreak.js / src/grasscards.js / src/edgeplant.js / src/texelsnap.js | New water reflection I'm quite happy with |
| 1751945034851570056 | 2024-01-29 | light | engine | engine/backlit.js | Some nice new highlights when the island is backlit. Achieved by simply adding another inv |
| 1714613599035863191 | 2023-10-18 | build | engine | engine/surface.js · engine/world.html | Another strange texturing style. This time trying to look a bit like abstract fields. A ni |
| 1710031224838771027 | 2023-10-05 | texture | game | src/colorvolume.js / colorvolumelab.html | Ok here's a probably horrible way to author color volumes. The idea is to properly define  |
| 1705195380457996629 | 2023-09-22 | light | both | src/surfaceshadow.js（顶视版 + 双旋钮扫描） · engine/surfaceshadow.js（engine 已有） · engine/texlab.html | I tamed the texture based surface shadows a bit, so the shadow casting height is independe |
| 1704246032626762189 | 2023-09-19 | texture | engine | engine/blotch.js · engine/world.html | Ok, I think maybe this is a bit of a sweet spot. It's got a nice variable density texture  |
| 1704218784028905984 | 2023-09-19 | light | engine | engine/surfaceshadow.js | I tried some texture based shadows. Note the shadows on the grass and along the roof edges |
| 1703750394164199473 | 2023-09-18 | texture | engine | engine/blotch.js · engine/world.html | Looking at my procedural stylized ground texturing again. Really like the swirly blobbynes |
| 1699146321318314094 | 2023-09-05 | texture | both | engine/surface.js · sWarp（GLSL，已有） · src/wobbletex.js（CPU 版 + 度量） · engine/texlab.html | Oh! And now I finally figured out how to make non-straight sedimentary lines! Most of the  |
| 1699038611125985317 | 2023-09-05 | terrain | engine | engine/surface.js | Looking att sedimentation lines again. Helps make large cliffs more interesting. Also make |
| 1696896119794479541 | 2023-08-30 | terrain | engine | engine/blotch.js · engine/world.html | On the other hand, I've always wanted to make a game in the Art Nouveau style. This might  |
| 1696864977171189980 | 2023-08-30 | texture | engine | engine/blotch.js | I'm slowly emerging from a huge refactoring... While this here is not exactly the look I'm |
| 1677242779162877952 | 2023-07-07 | grid | engine | engine/meshcheck.js | I am (once again) rewriting my generic triangle graph system to (hopefully) be more robust |
| 1670790425232175108 | 2023-06-19 | grid | game | src/gridmodes.js | I'm prepping for a talk in Cambridge next week, thus all the gifs. I made my generator als |
| 1670720537662836736 | 2023-06-19 | build | both | src/edgesmooth.js / src/surfacedeco.js / src/propanim.js / src/repeatbreak.js | I smooth my mesh according to an edge type hierarchy. Black is hard, red is game-tile-bord |
| 1654401054828638214 | 2023-05-05 | terrain | both | src/triisland.js · engine/triisland.html | An quaint island being procedurally generated |
| 1593215065423245313 | 2022-11-17 | tools | both | src/rectpack.js · engine/spritepack.js | Making a lil dynamic sprite packer, able to add and remove sprite allotments at runtime. I |
| 1584623053061099520 | 2022-10-24 | terrain | both | src/splice.js | I wrote a thing to splice houses into the terrain. Mostly, the houses are part of pre-buil |
| 1582757294672314368 | 2022-10-19 | light | engine | engine/lightvol.js | I'm seeing if my light volume approach can work with point lights too. The low resolution  |
| 1582293326815862786 | 2022-10-18 | grid | both | src/frontier.js · src/navgraph.js · engine/frontier.html | I thought it would be too expensive to properly evaluate each tile placement. But! While t |
| 1580835075629133825 | 2022-10-14 | light | both | src/bouncegi.js | I always write my own lighting solutions. I've had some really naive ad hoc color bleeding |
| 1580162341668237312 | 2022-10-12 | grid | both | src/blobrelax.js · engine/blobs.html | I start with a very basic Marching Cubes mesh from a bunch of spheres. I mark the edges be |
| 1579483114178768898 | 2022-10-10 | grid | game | src/fusion.js · src/tileforce.js | Obviously, it's all tile-based. I went through a major rewrite to combine an irregular gri |
| 1579478470098243584 | 2022-10-10 | terrain | engine | engine/cage.js（C 键，已有） · engine/world.html | To make the cliffs look more organic, I'm doing some pretty radical cage deformation on th |
| 1490068909042642944 | 2022-02-05 | grid | both | src/mandala.js · engine/mandala.html | Late night cryptic graph tweet |
| 1482346496460828674 | 2022-01-15 | texture | game | src/contrasttex.js / contrasttexlab.html | I created a dedicated contrast texture system for the lines: an iterative simulation on th |
| 1482011744843223042 | 2022-01-14 | texture | engine | engine/outline.js · engine/world.html | Ok, I stumbled on a pretty cool art style now. Here, I'm creating pixel thin lines from co |
| 1478114309263839244 | 2022-01-03 | texture | engine | engine/spritepack.js · engine/atlasorder.html | Yeah that's good enough for now. I quite like how the radial (instead of directional) size |
| 1447496205282549761 | 2021-10-11 | grid | both | src/gridmodes.js · engine/gridmodes.html | The base graph is just a humble irregular triangle grid |
| 1447483550257799171 | 2021-10-11 | terrain | both | src/triisland.js · engine/triisland.html | I regret to inform you that I've relapsed into procedural island generation |
| 1384958097542819845 | 2021-04-21 | grid | game | src/trace.js · src/scene.js · src/app.js | I wrote a script to trace topologically straight lines across the Townscaper grid. I think |
| 1338829205157646336 | 2020-12-15 | grid | engine | engine/sphere.js · engine/sphere.html | Apparently, one way to do Delaunay Triangulation on a sphere is to do it on a Stereographi |
| 1338825080844021760 | 2020-12-15 | grid | both | src/spheretown.js · engine/sphere.html · engine/sphere.js | Apropos of nothing, a take on the ancient issue of generating nice triangulated spheres 1. |
| 1313841094069817344 | 2020-10-07 | light | engine | engine/surface.js · engine/world.html | Because I'm quite proud of my lighting (and because Townscaper is basically just a tech de |
| 1313840428685447170 | 2020-10-07 | light | game | src/penumbra.js / penumbralab.html | I added some sunlight (with shadows) and a gizmo to control it |
| 1310503825510367232 | 2020-09-28 | build | engine | engine/mixedpersp.html | Ok, I tried the mixed perspective. Note how houses further away are smaller, yet the verti |
| 1305951750638231552 | 2020-09-15 | light | game | src/penumbra.js / penumbralab.html | To soften it up a bit, I'm trying out a penumbra approach where I draw the shadow thrice,  |
| 1301816247479345152 | 2020-09-04 | grid | game | src/gridpatch.js / gridpatchlab.html | Some are asking for the option to use regular grids. Now, that's (obviously) against the T |
| 1273520600221433857 | 2020-06-18 | life | engine | engine/butterflies.js · engine/world.html | Butterflies fly quite different from birds. Mine loosely orbit a potential landing spot, a |
| 1258005604066627586 | 2020-05-06 | grid | both | src/triisland.js · engine/triisland.html | Here's that but in Townscaper. And Triangular. |
| 1244892370392489989 | 2020-03-31 | water | game | src/birds.js · src/scene.js | Better Birdies: 🐦 More bird shaped 🐦 Only has outlines when sitting 🐦 Shuffle about mor |
| 1242824460325052417 | 2020-03-25 | tools | game | src/uikit.js / uikitlab.html | Finally making some proper UI. Turns out you can make a boring list of buttons playful by  |
| 1241096929490149376 | 2020-03-20 | texture | both | src/texelsnap.js · engine/surface.js | It has been brought to my attention that not all of you are familiar with my every-other-p |
| 1238474550511308800 | 2020-03-13 | build | game | src/townmesh.js | I needed some more greenery, so now if you build an enclosed area it becomes a backyard! |
| 1237305125070426112 | 2020-03-10 | light | game | src/lighting.js · src/townmesh.js #bakeLighting | Obviously, a big benefit of this is that with white finally in my palette, I can properly  |
| 1215644531221311488 | 2020-01-10 | water | both | src/scene.js 倒影 / engine | The technical solution is almost the same as in Bad North. One big difference is that the  |
| 1205422438437273601 | 2019-12-13 | build | engine | engine/props.js · engine/props.html | For doors and windows, I use som stencil buffer shenanigans to punch holes in the zbuffer. |
| 1205420678859632640 | 2019-12-13 | grid | both | src/grasscards.js · engine/impostor.js · engine/world.html | For the plants, I dug up this ol' trick: alpha is view angle modulated by leaf texture map |
| 1197909675443916803 | 2019-11-22 | light | game | src/townmesh.js | Turns out my monitor was too saturated, making me make my colors too dull. This should be  |
| 1190191289922465793 | 2019-11-01 | light | engine | engine/voxelshadow.js · engine/world.html | Trying out some per vertex voxel based shadows. Not great not terrible. Looks better when  |
| 1189908238566903808 | 2019-10-31 | build | game | src/townmesh.js #underside | However, if you are more careful in providing structural support you'll get curvy brick ar |
| 1189902695303458816 | 2019-10-31 | build | game | src/townmesh.js #underside | It was real fun making the steel beam support structures. They have this neat artificial y |
| 1168571866405097472 | 2019-09-02 | light | both | src/lighting.js · src/townmesh.js #bakeLighting | A peek at my ambient occlusion approach. The occlusion lives in a layered mesh that's repr |
| 1147881669350891521 | 2019-07-07 | grid | game | src/quadgrid.js | I present: Fairly even irregular quads grid in a hex Todo: 1. Heuristic to reduce (or elim |
| 1105131621391495176 | 2019-03-11 | tools | game | src/squigglefield.js / src/dfgrow.js | Squiggly distance fields, now with animation! Versatile, flexible, but quite laborious |
| 1104771432440049664 | 2019-03-10 | texture | both | src/dfgrow.js · engine/ornament.html · engine/ornament.js | Squiggly distance fields on mirrored UVs for fast and easy UI decorations. Distance field  |
| 1097458505315946496 | 2019-02-18 | grid | both | src/borderpath.js · engine/border.html | The Viking frontier in @BadNorthGame is dripping with funky math: 1. Triangulate (with som |
| 1078792665980915714 | 2018-12-28 | fx | game | src/campaignmap.js / campaignmaplab.html | friday night campaign map node graffing |
| 1063115611289645057 | 2018-11-15 | light | both | src/terrainmesh.js · engine/surface.js · engine/world.html | Like many of you have suggested, I finally added grass to slopes to make navigability easi |
| 1062374549407350790 | 2018-11-13 | grid | both | src/lighting.js · bakeSoftNormals() | To make Bad North even prettier, I'm adding some extra smoothing to the island using my vo |
| 1061227418961219585 | 2018-11-10 | tools | game | src/repeatbreak.js | Obviously, if you stretch it too far, you will start to notice the repetition |
| 1061221291137605633 | 2018-11-10 | texture | game | src/mirrordecor.js | I'm writing a simple graphic for UI decoration. A single texture can be oriented 8 differe |
| 1056999668486471682 | 2018-10-29 | fx | engine | engine/blendlab.html | Works well in daylight too, largely thanks to the max blend |
| 1056992291108413446 | 2018-10-29 | grid | engine | engine/blendlab.html | Oh no! I made an error! The quads above shrink way more than they are supposed to. This lo |
| 1056990611738451968 | 2018-10-29 | texture | both | src/smokefx.js | New fire effect. For blend mode, I use Max instead of Add to have better control over my c |
| 1042732450730913793 | 2018-09-20 | grid | game | src/campaignmap.js / campaignmaplab.html | The graph generator I ended up using for the Bad North campaign maps: 1. Create nodes of v |
| 1017355723171344385 | 2018-07-12 | light | engine | engine/outline.js | Making some thicker outlines for all you 4k high ballers out there |
| 1016680972610359298 | 2018-07-10 | tools | game | src/uikit.js / uikitlab.html | This is what the confirm popup looks like: |
| 1015151731804721152 | 2018-07-06 | texture | both | src/smokefx.js | I change the mip level of the noise texture throughout the smoke trail. This aids the tran |
| 1007587812462530561 | 2018-06-15 | water | engine | engine/waterfall.js · engine/world.html | Proper games have waterfalls. I'm glad to report that @BadNorthGame is now a proper game. |
| 999191760944418817 | 2018-05-23 | fx | game | src/combatfx.js / combatlab.html | Adding the option of disabling gore made me realized just how much I rely on blood for env |
| 995043346778415104 | 2018-05-11 | fx | game | src/combatfx.js / combatlab.html | The pathfinding in some levels does get a bit convoluted |
| 987267068495003648 | 2018-04-20 | fx | both | src/ballistic.js · engine/ballistic.html | Using inspector expressions, I can live tweak the cost function of my projectile trajector |
| 984813819280191488 | 2018-04-13 | fx | game | src/combatfx.js / combatlab.html | Blood soaking as a health indicator for the big fellas and a proper stun state for the lit |
| 978211952504852480 | 2018-03-26 | texture | engine | engine/surface.js | Pro tip: use fwidth, ddx and ddy to create crisp, pixel perfect, zoom independent, antiali |
| 974579499802202113 | 2018-03-16 | grid | both | src/barycentric.js · engine/barycentric.html | For a given position, Barycentric Coordinates can be calculated with 1 subtraction and 1 d |
| 974564862729838592 | 2018-03-16 | grid | both | src/barycentric.js · engine/barycentric.html | I'm making some pedagogical gizmos for my GDC microtalk, like this illustration of Barycen |
| 974325184525201409 | 2018-03-15 | fx | both | src/boxtest.js · engine/boxtest.html | We were having strange crashes when using Unity's Physics.OverlapBox. We solved it (hopefu |
| 969860566322958336 | 2018-03-03 | fx | game | src/dirsprites.js | My unit sprites have 1 direction, so they need to be directionally ambiguous. They are mos |
| 959752525867036672 | 2018-02-03 | grid | both | src/dual.js · engine/world.html | A great unexpected joy in this project has been writing my own navmesh. It's an oddly rela |
| 958410200146497537 | 2018-01-30 | fx | engine | engine/flags.js | The approach is versatile enough that I can use it for the ingame banners too |
| 958371606350454784 | 2018-01-30 | fx | game | src/portrait.js | The beginnings of a portrait generator. It currently runs on 5 examples (all male and with |
| 946660607008403456 | 2017-12-29 | fx | game | src/combatfx.js / combatlab.html | While @rtm223 is away on holiday I'm taking some time to focus on the important things, li |
| 943230624369868800 | 2017-12-19 | terrain | engine | engine/snow.js | And yeah, obviously the snow flakes are affected by the wind system and thus flow around t |
| 938422757288792064 | 2017-12-06 | fx | game | src/grouping.js | I'm extra happy with how the grouping turned out. It's a sort of cellular automaton where  |
| 938405900573986816 | 2017-12-06 | terrain | game | src/grouping.js | A more legible peek at the campaign generation for @BadNorthGame . Islands get spread apar |
| 931196707236392960 | 2017-11-16 | light | both | src/lighting.js / src/lightingcache.js | My generated levels all keep a virtual voxel space. It is used for light baking, soft norm |
| 929417420921556993 | 2017-11-11 | light | engine | engine/surface.js · engine/normalsmooth.js · engine/world.html | Fun fact: I generate smooth normals for all my meshes and use a blend between smooth and h |
| 926903893866541057 | 2017-11-04 | fx | both | src/wind.js · src/townmesh.js aWind · engine/impostor.js drift | Here is what my wind vectors look like. They can be used by all kinds of systems, includin |
| 926890207298899969 | 2017-11-04 | life | engine | engine/flags.js | Not really. I build a custom mesh for the flag using a bezier curve along virtual wind par |
| 926834721392340992 | 2017-11-04 | fx | engine | engine/flags.js | The banners where due for a makeover. I built a wind system to get them flapping just righ |
| 911913981731885056 | 2017-09-24 | terrain | game | src/snapshot64.js / snapshot64lab.html | I'm looking at the campaign map. Saving island snapshots to 64² textures and then crisping |
| 906425294533394432 | 2017-09-09 | fx | both | src/holenav.js · src/cheesenav.js · src/voxelnav.js · engine/cheese.html | It's like navigating a Swiss cheese |
| 906207980802252801 | 2017-09-08 | fx | engine | engine/fog.js · engine/world.html | I've been working on some new fog (sped up in the gif). For background effects, subtlety i |
| 903647529203634176 | 2017-09-01 | fx | game | src/combatfx.js / combatlab.html | Spears are so weird to implement. I can see why most games don't use them |
| 902069261304287232 | 2017-08-28 | fx | game | src/combatfx.js / combatlab.html | Just for fun: visualization of data inheritance in my flow/distance/influence fields |
| 901842167508992000 | 2017-08-27 | fx | game | src/combatfx.js / combatlab.html | Made my flow/influence fields even smarter: In addition to distance and direction to neare |
| 901469409579061248 | 2017-08-26 | water | game | src/wake.js / wakelab.html | Working on nicer ship wakes |
| 886199305522085890 | 2017-07-15 | nav | both | src/traffic.js | (无原文，仅有视频) |
| 883447205176238083 | 2017-07-07 | nav | both | src/infograph.js | (无原文，仅有视频) |
| 880853661936734211 | 2017-06-30 | fx | both | src/traffic.js · engine/traffic.html | Units got stuck when meeting in narrow passages. I fixed it by introducing left handed tra |
| 870296307889573889 | 2017-06-01 | fx | game | src/combatfx.js / combatlab.html | Units can now get knocked off ledges |
| 865200072685912064 | 2017-05-18 | tools | game | src/slotsolve.js / slotsolvelab.html | (无原文，仅有视频) |
| 863019585162932224 | 2017-05-12 | tools | both | src/coroutine.js | (无原文，仅有视频) |
| 847717312912211970 | 2017-03-31 | build | both | src/partsprites.js | (无原文，仅有视频) |
| 828984794407170048 | 2017-02-07 | combat | game | src/unitsnap.js / unitsnaplab.html | (无原文，仅有视频) |
| 827215002448846848 | 2017-02-02 | grid | game | src/navribbon.js / navribbonlab.html | (无原文，仅有视频) |
| 823848950553780226 | 2017-01-24 | grid | game | src/navribbon.js / navribbonlab.html | (无原文，仅有视频) |
| 821680056514781186 | 2017-01-18 | terrain | game | src/blobshadow.js / blobshadowlab.html | (无原文，仅有视频) |
| 821321422140309504 | 2017-01-17 | terrain | game | src/blobshadow.js / blobshadowlab.html | (无原文，仅有视频) |
| 820977247083528192 | 2017-01-16 | terrain | game | src/blobshadow.js / blobshadowlab.html | (无原文，仅有视频) |
| 816743289500106752 | 2017-01-04 | tools | both | src/triflow.js / flowfield.js / navgrid.js | (无原文，仅有视频) |
| 806856212260278272 | 2016-12-08 | build | game | src/storydatum.js / storydatumlab.html | (无原文，仅有视频) |
| 806904557502464000 | 2016-12-08 | build | game | src/archvoid.js / archvoidlab.html | (无原文，仅有视频) |
| 803190517534248960 | 2016-11-28 | build | game | src/storydatum.js / storydatumlab.html | (无原文，仅有视频) |
| 797119718477991936 | 2016-11-11 | build | both | src/holenav.js / src/voxelnav.js / src/navgrid.js / src/cheesenav.js / src/tileplace.js / src/rayvis.js / src/triflow.js / engine/los.js | (无原文，仅有视频) |
| 795010582239997952 | 2016-11-05 | build | both | src/adjacency.js / src/traffic.js | (无原文，仅有视频) |
| 793806535898136576 | 2016-11-02 | build | both | src/piperepair.js / src/tilerepair.js | (无原文，仅有视频) |
| 793557992931266561 | 2016-11-01 | light | both | src/voxelao.js | (无原文，仅有视频) |
| 787319655648100352 | 2016-10-15 | grid | both | src/tileplace.js | (无原文，仅有视频) |
| 784847588893814785 | 2016-10-08 | grid | both | src/tileplace.js | (无原文，仅有视频) |
| 784847933686575104 | 2016-10-08 | grid | both | src/tileplace.js | (无原文，仅有视频) |
| 784848286272327680 | 2016-10-08 | grid | both | src/tileplace.js | (无原文，仅有视频) |
| 781027725452648448 | 2016-09-28 | build | game | src/housekit.js + housekitlab.html | (无原文，仅有视频) |
| 777596437534240768 | 2016-09-18 | grid | both | src/mipfilter.js | (无原文，仅有视频) |

## ⚠️ 标了已学但查不到痕迹（4）

| id | 日期 | 主题 | 状态 | 落点 | 原文 |
|---|---|---|---|---|---|
| 837027901853810688 | 2017-03-01 | combat | ✗ 文件里没这条 ID | src/shore.js / src/reflstreak.js | (无原文，仅有视频) |
| 832633189277409280 | 2017-02-17 | terrain | ✗ 文件里没这条 ID | src/shore.js / src/reflstreak.js | (无原文，仅有视频) |
| 827561690896162816 | 2017-02-03 | grid | ✗ 文件里没这条 ID | src/combatfx.js | (无原文，仅有视频) |
| 818857408848130048 | 2017-01-10 | terrain | ✗ 文件里没这条 ID | src/shore.js / voxelao.js | (无原文，仅有视频) |

## 🟡 半成品（23）

| id | 日期 | 主题 | 状态 | 落点 | 原文 |
|---|---|---|---|---|---|
| 1768627849529893109 | 2024-03-15 | grid | partial | src/spheretown.js · spherefusion.html | For reasons I will not be explaining at this point I've gone and put this on a sphere |
| 1751932427272909032 | 2024-01-29 | grid | partial | src/tileforce.js · decolab.html ① | I can now force specific modules to appear. To do this I first generate the specific bit o |
| 1671808851895627776 | 2023-06-22 | terrain | partial | src/overhangterrain.js | If your terrain generator supports overhangs you gotta flaunt it. I don't make the rules,  |
| 1670725072540106755 | 2023-06-19 | grid | partial | src/edgesmooth.js | Here's a comparison showing no-, dumb- and hierarchical smoothing. The hierarchical smooth |
| 1669315384619540487 | 2023-06-15 | terrain | partial | src/overhangterrain.js | The generator consistently spits out pretty cool islands now |
| 1481661852887265288 | 2022-01-13 | grid | partial | src/paintnormal.js · bouncelab.html（③） | Yet another light baker. Actually does some ray marching, but still pretty ad hoc. The tex |
| 1458921394855718917 | 2021-11-11 | grid | partial | src/halfedge.js · src/scene.js | I'm exploring the Half Edge data structure. Feels like a really lightweight, powerful and  |
| 1447488323845509121 | 2021-10-11 | terrain | partial | src/overhangterrain.js | I'm able to do a couple of things here I've always wanted to, but never been able to befor |
| 1332410042784641026 | 2020-11-27 | grid | partial | src/quadgrid.js | How the infinite grid is relaxed and kept seamless: The grid is made of Patches. Adjacent  |
| 1313837640366596096 | 2020-10-07 | grid | partial | src/looptown.js · alivelab.html ③ | I just pushed an update to Townscaper. You can now build flying towns (if you find any of  |
| 1258421104756097029 | 2020-05-07 | water | partial | src/shore.js | We were long overdue for some splashier splashes |
| 1205416648397721601 | 2019-12-13 | build | partial | src/rectpack.js | New prop placement system! It tries to place as many props as it can without overlap. I us |
| 1201179450668441600 | 2019-12-01 | tools | partial | - | Icons! |
| 1164926304640229376 | 2019-08-23 | grid | partial | src/gridwfc.js · alivelab.html ② | WFC running at interactive speed on that funky grid. Next up is to make it deterministic |
| 1151770831619534848 | 2019-07-18 | grid | partial | src/quadgrid.js | I figured out how to make do with relaxation clusters of 3 instead of 7, which means I hav |
| 1151137783785771008 | 2019-07-16 | grid | partial | src/quadgrid.js | As promised: an aperiodic infinite deterministic irregular relaxed quadrilateral grid. |
| 1024679338292256769 | 2018-08-01 | tools | partial | - | Some UI flair |
| 1015149712469524480 | 2018-07-06 | grid | partial | src/quadtex.js · decolab.html ③ | I only sample my noise texture once per quad, but I scroll the UVs randomly forward or bac |
| 999185422403055616 | 2018-05-23 | fx | partial | src/quadtex.js · stretchTable() · decolab.html ③ | For my blood splatter UVs, I'm interpolating between sprite-space and skin-space using the |
| 972829402873716737 | 2018-03-11 | fx | partial | src/combatfx.js | If you're heading to GDC, come see my microtalk about the triangular flow fields we use fo |
| 917405214638006273 | 2017-10-09 | grid | partial | src/campaignmap.js · campaignmaplab.html ③ | A somewhat major breakthrough in my procedural generation: a heuristic for deliberately ge |
| 890611046435627008 | 2017-07-27 | nav | partial | src/unitsnap.js / unitsnaplab.html / src/unitbatch.js | (无原文，仅有视频) |
| 802496920790777856 | 2016-11-26 | build | partial | src/archvoid.js | (无原文，仅有视频) |

## ⬜ 有笔记、没代码（22）

| id | 日期 | 主题 | 状态 | 落点 | 原文 |
|---|---|---|---|---|---|
| 1724449858369568780 | 2023-11-14 | tools | todo | - | Ok, here's a small example. The button toggles a ScriptableObject bool. The FloatSelectNod |
| 1707490932017279035 | 2023-09-28 | light | todo | - | They are of course 100% texture, painted onto a fairly low, poly mesh. I keep thinking I'm |
| 1580158269267406849 | 2022-10-12 | grid | todo | - | Can you make good looking foliage from Marching Cubes-blobs? Maybe? |
| 1579474420749725696 | 2022-10-10 | terrain | todo | - | I'm back on the island generation |
| 1480635131614355459 | 2022-01-10 | light | todo | - | More experiments in procedural texturing of procedural islands. Still very early, but I do |
| 1471817524148940807 | 2021-12-17 | grid | todo | - | Some rocky islands. Trying to make the grid natural and readable, yet funky. Square, yet h |
| 1448039167057879048 | 2021-10-12 | terrain | todo | - | Imma talk about my new island generator at Sweden Game Conference (@SwedenGameArena) on Fr |
| 1447494168448753667 | 2021-10-11 | build | todo | src/halfedge.js | Long time fans of the show will not be surprised to learn that this is indeed running on t |
| 1331905048801144836 | 2020-11-26 | build | todo | - | Townscaper now has lighthouses! This pattern required more code rewrite than seems reasona |
| 1270725616430530566 | 2020-06-10 | life | todo | - | You all keep pestering me to release this when I hadn't even added butterflies yet. But do |
| 1259838941299183619 | 2020-05-11 | life | todo | - | In code, these are called "Italian Wires" |
| 1243228419162341379 | 2020-03-26 | life | todo | - | Some moody clouds |
| 1191990107785572352 | 2019-11-06 | life | todo | src/townmesh.js | Ah, the timeless problem of shrubbery that look good from all angles without too much over |
| 1015142746372366336 | 2018-07-06 | light | todo | - | I solve the problems of z-depth and draw order by drawing the effect in 2 passes. The firs |
| 1015140880666300416 | 2018-07-06 | light | todo | - | Smoke effect. A full billowy base tied together by a crisp outline seamlessly transitioned |
| 959530111187013632 | 2018-02-02 | life | todo | - | I've been tweaking the foliage system today. It now supports multiple grass types per leve |
| 906416813810049025 | 2017-09-09 | fx | todo | - | New cave tileset. These levels really challenge your spacial skills #screenshotsaturday #m |
| 827216768783495168 | 2017-02-02 | grid | todo | - | (无原文，仅有视频) |
| 815236105079398400 | 2016-12-31 | build | todo | - | (无原文，仅有视频) |
| 807256278154301441 | 2016-12-09 | build | todo | - | (无原文，仅有视频) |
| 793545297376972801 | 2016-11-01 | terrain | todo | - | (无原文，仅有视频) |
| 781957658597269506 | 2016-09-30 | terrain | todo | - | (无原文，仅有视频) |

## 🕳 有视频、没登记（0）

（无）

## ➖ 不用学（63）

| id | 日期 | 主题 | 状态 | 落点 | 原文 |
|---|---|---|---|---|---|
| 1995813566344011807 | 2025-12-02 | show | na | - | I'm designing a jungle gym / climbable shelf structure for the play area of our home. The  |
| 1798310423554658732 | 2024-06-05 | show | na | - | （帖子无文字说明） |
| 1727324352264474664 | 2023-11-22 | show | na | - | Yeah that actually looks pretty good. I did not expect that. |
| 1727315611959865407 | 2023-11-22 | light | ref | src/smear.js · alivelab.html ⑤ | I've shipped two whole games with orbital cameras and not once have I previously though ab |
| 1712088611934371876 | 2023-10-11 | texture | ref | - | Another take on a palette authoring tool |
| 1708815475801505819 | 2023-10-02 | terrain | ref | - | a cool cliff I came across |
| 1707497006640365880 | 2023-09-28 | show | na | - | And here's a couple more being generated |
| 1671840905957978113 | 2023-06-22 | show | na | - | Hmm.. I thought it was gonna be too wacky but maybe it's kinda cool |
| 1670794261669769217 | 2023-06-19 | terrain | ref | - | Oh, and I finally got this lovely rock feature to show up! When working with WFC, sometime |
| 1670064751181791233 | 2023-06-17 | tools | ref | - | I figured out how to mimic Thread.Sleep() in Burst! Just store time in a static unsafe Nat |
| 1666429884208381953 | 2023-06-07 | water | ref | src/shore.js | I've been banging my head against various shore line rendering options for a good week now |
| 1664565063552847873 | 2023-06-02 | water | ref | src/floatprobe.js · decolab.html ④ | I'm trying out using a shader based fluid simulation. But I'm skeptical. It seems to need  |
| 1590674061092212738 | 2022-11-10 | light | ref | src/contrast.js（对比贴图，已有半条） | In the vertex shader, my grass gets to sample that contrast texture both where they stand, |
| 1580846877855338497 | 2022-10-14 | light | ref | src/lighting.js · diffuseBounce() | Here's the slowed down bounce sequence. You can see how the mega texture and the light vol |
| 1580845127207387137 | 2022-10-14 | light | ref | src/lighting.js · buildSDF / bakeSixDirVolume | 1st texture here is an sdf volume. The distance lives in the alpha, but RG actually refere |
| 1489193847422865410 | 2022-02-03 | show | na | - | （帖子无文字说明） |
| 1466059785703460870 | 2021-12-01 | show | na | - | Oh. What's this? A free Townscaper web demo, playable straight in the browser: http:// osk |
| 1459169210752507904 | 2021-11-12 | show | na | - | And another |
| 1430227487376781317 | 2021-08-24 | texture | ref | - | Plus you can change the in-game textures now! So I guess the game is now (in the most libe |
| 1430224300003545091 | 2021-08-24 | tools | ref | - | If you've been waiting for the Townscaper mesh exporter, you can now try it out in the pub |
| 1427721874490933250 | 2021-08-17 | texture | ref | - | Here's a very quick technical test. Though this one is continuously adding decals, so it l |
| 1410697531424714752 | 2021-07-01 | show | na | - | Townscaper is now on GoG! https:// gog.com/game/townscaper |
| 1371460793032716290 | 2021-03-15 | show | na | - | I got it working within the duration of exactly 1 kid nap |
| 1371191380773629956 | 2021-03-14 | show | na | - | Yeah this is gonna be pretty good |
| 1370772056279805953 | 2021-03-13 | show | na | - | （帖子无文字说明） |
| 1344290848180203523 | 2020-12-30 | show | na | - | A rare look at Townscapers sophisticated QA process |
| 1298689301488775169 | 2020-08-26 | light | ref | bouncelab.html（① 右上四个按钮） | Flat texture, shaded, lighting only, and my AO baking mesh. I'm thinking of adding some li |
| 1279107097108635649 | 2020-07-03 | build | ref | src/townmesh.js | Here's a tour of the puzzle pieces that make up #Townscaper. To date, there are 545 of the |
| 1277554535297236994 | 2020-06-29 | tools | ref | - | Ok I'm gonna try something that probably wont work: if you wanna help me translate Townsca |
| 1275089608758484992 | 2020-06-22 | build | ref | - | It has not escaped some of you that I have yet to release Townscaper. I have an important  |
| 1257213678056857600 | 2020-05-04 | build | ref | - | Alrighty. First 20 people to reply gets a b e t a k e y *steam on windows for now |
| 1239901715266244609 | 2020-03-17 | show | na | - | If you're hunkered down hiding from the virus (as you should be) and need something to do, |
| 1212732478458343424 | 2020-01-02 | life | ref | - | Added some flags. Gotta make it homely and welcoming. |
| 1210969316071477248 | 2019-12-28 | build | ref | - | I've got mom and dad visiting. They've been alternating admiring their new grandchild and  |
| 1209519206233968641 | 2019-12-24 | show | na | - | A very merry Christmas to you all |
| 1195463004919357443 | 2019-11-15 | show | na | - | My brother @mast4461 had a go. Being an engineer he obviously built a nice fractal. Bonus  |
| 1189109278361165825 | 2019-10-29 | build | ref | src/townmesh.js | I'm happy to announce that at a count of 378 I've now built enough modules to cover all po |
| 1174406613031170049 | 2019-09-18 | show | na | - | Today my good friend @podzimcore became the first outsider to take the new project for a s |
| 1163836000688365571 | 2019-08-20 | grid | ref | src/townmesh.js | Basic marching cubes on my funky grid. Next up is turning this into mixed initiative WFC. |
| 1151152046055272449 | 2019-07-16 | show | na | - | Having a look around |
| 1120036868966502401 | 2019-04-21 | grid | ref | src/town.js | It's marching squares on irregular quadrilateral grids |
| 1092709665199345664 | 2019-02-05 | show | na | - | k-pow !! |
| 1022855252574437376 | 2018-07-27 | show | na | - | it's my birthday! |
| 1022573208590057472 | 2018-07-26 | fx | ref | - | The look and feel of the basic meat and potato melee combat is one of the things I'm most  |
| 1010979395719319552 | 2018-06-24 | fx | ref | - | A selection of the many handsome faces you might come across in @BadNorthGame |
| 1007587828992266240 | 2018-06-15 | show | na | - | （帖子无文字说明） |
| 1007587825024425984 | 2018-06-15 | show | na | - | （帖子无文字说明） |
| 1007587821220229120 | 2018-06-15 | show | na | - | （帖子无文字说明） |
| 1007587817021636609 | 2018-06-15 | show | na | - | （帖子无文字说明） |
| 995034777756536833 | 2018-05-11 | show | na | - | （帖子无文字说明） |
| 984703192465330176 | 2018-04-13 | show | na | - | （帖子无文字说明） |
| 978195201901711360 | 2018-03-26 | show | na | - | Some of it will have to wait for some later project |
| 978194866520944641 | 2018-03-26 | show | na | - | Some of it looks very similar |
| 943230620242796544 | 2017-12-19 | show | na | - | I'm heading north for a few days to see the folks. In the meantime, here's some seasonally |
| 938395867215728640 | 2017-12-06 | grid | ref | - | Node graph programming is by far the most delightful programming |
| 913407568730615808 | 2017-09-28 | show | na | - | Ok, I'm proud of this one. Can any of you brainy nerds figure out what we're looking at he |
| 912691357440978945 | 2017-09-26 | fx | ref | - | Long time no combat gifs |
| 902103473365417984 | 2017-08-28 | show | na | - | Ok, one more visualization. Distances this time. I really should get back to proper work n |
| 877995885250138119 | 2017-06-22 | show | na | - | （帖子无文字说明） |
| 870558914345041921 | 2017-06-02 | show | na | - | I think we've all had days like this |
| 794993371261665280 | 2016-11-05 | show | ref | - | (无原文，仅有视频) |
| 777501038274281472 | 2016-09-18 | show | ref | - | (无原文，仅有视频) |
| 768886648625061889 | 2016-08-25 | show | ref | - | (无原文，仅有视频) |
