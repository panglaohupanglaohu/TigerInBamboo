# 球团树冠：155帧、闭合曲面与接缝松弛

## 素材
先读1580162341668237312的README。原文明确说从球堆的Marching Cubes网格开始，标记最近球不同的三角形间边，硬边像橡皮筋，其余像气球松弛。全部155帧已查看，两张联系表及原尺寸帧、时间戳在同ID目录（0–154，0–15.270秒）。前段线框球团叠有红色接缝，67帧左右切换到绿色成片树冠，后段可见凹槽/圆钝团块的明暗和轮廓。不能据此推断具体刚度或压力数值。

## 原版对照与实现
原版blobrelax已有surface nets和松弛，bncanopy把它接入烘焙；本目录树冠之前仍是多个二十面球叠加、修改法线的近似。保留落点、灌木、树干、风、描边和现有impostor管线；新增core/canopy.js，三种实际树冠改为共享顶点的闭合球并集曲面，按三角形中心最近球标记接缝，软邻域平滑/向外压力与硬接缝弹簧分别处理。

使用surface nets代替原文的Marching Cubes，属于本地选择。对比原版还修正两点：绕向直接由格边内外符号确定为朝外（球体有符号体积验证），接缝标签用相邻三角形而不是端点顶点。检测每条边两面且方向相反，以及每顶点链接为单环；松弛后拒绝退化/翻折三角形。API buildCanopy(blobs,{resolution,passes,hardStiff,softStiff})返回positions/triangles/normals/hardEdges/stats，输入不改写，分辨率6–48、迭代0–30、球数1–32受限。

## 运行验收
canopy.mjs验证确定性、输入不变、闭合绕向、法线、硬边平均长度收缩及球体朝外体积（约4.038，对照4π/3）。一个复杂模板在14分辨率出现非流形，测试要求明确拒绝；实际三个模板统一16分辨率通过，而非把异常网格送到渲染器。不能声称所有球排列都自动可用。

canopy-browser.cjs在terrain/town/fusion/badnorth四个真实场景，三种树冠均为新索引网格且aTip/normal齐备，闭合与硬边收缩通过；同一几何经现有ImpostorBaker生成三套烘焙输入，terrain切impostor模式显示通过，errors[]。报告canopy-browser.json，截图canopy-{terrain,town,fusion,badnorth}.png及canopy-impostor.png，已查看terrain和烘焙对照。原始第3模板异常已修正并重新完整回归通过。

## 边界
松弛是本地球并集/弹簧/压力近似，尚未证明全局无自交，也没有原作参数、完整树冠美术及自动处理全部低分辨率歧义。严格预算及无效几何拒绝属于API约束。灌木仍保留旧球团；没有替换游戏副本或认证TigerMessenger实景。原版模块映射按本轮已实现并运行验收的树冠/烘焙能力记迁移增强，边界继续保留。
