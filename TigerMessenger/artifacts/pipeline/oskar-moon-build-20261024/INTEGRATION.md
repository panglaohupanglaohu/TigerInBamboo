# 月湖四松实施模块

本批按用户最新明确选用 `exec-20631986-22ca-4f65-b197-97bccf665f23.png`，而非已被取代的三松研究图。三松旧图和已运行生图收尾只归档在独立redesign目录，不用于本次实施。

## 已实现 / 未接回边界

顾问新增两个生产模块，未改`lake.js`、主入口或原主古松源。Root负责安装、实际最终地面绑定、主场景碰撞与GPU验收。

```js
import {createMoonLakeGarden} from './moonLakeGarden.js';
const garden = createMoonLakeGarden(lakeGroup, {planetRadius:160});
// Full scene ground has been built; return Y in lakeGroup LOCAL frame.
const result = garden.reseat((x,z) => actualLocalGroundHeightOrNull(x,z));
sceneColliders.push(...garden.colliders);
```

返回`{group,trees,plantings,colliders,report,reseat,syncColliders,dispose}`。

`surfaceHeightAt(x,z)`也可在创建时传入；数字或`{height}`均可，null拒绝。raycaster承托列表须排除本garden/树/原古松/湖水/月体/角色，避免自命中新叶面。实际世界地面命中点应转换为`lakeGroup.worldToLocal(hit.point).y`。

`reseat(fn)`重新检查每株中心与根盘4外点：缺地、1.2/1.05半径内高差超过.65则保留上一位置并报告rejected；不会用无地假值瞬移。成功则更新根高，自然地被按已保存相对地表offset重贴，并更新同一碰撞对象的世界position/radius，父变换改变后可`syncColliders()`。每轮采样缓存重置，重复reseat不累积抬升。

## 形体和边界

- 原1古松、原小湖水面shape、deep圆片、环路、悬浮月牙全部不归本模块所有，零写入。
- 2中斜疏冠：独立斜升曲干及左右错落横枝，根XZ(-13,5)、yaw.68。
- 4中后横展：独立反曲主干及宽展双侧枝，根(0,-11.5)、yaw−1.05。
- 5低风斜：低弯干+长侧扫主枝，根(-16,-10)、yaw1.12。
- 没有直立3，也不是对同一原古松作三次缩放。每株独立分枝/冠片数据在model.report。
- 10块不规则自然地被、零散低叶簇和少量草片，3颗小石。没有花坛/盆器、另一个湖、桥、城、地形平板、新灯或每帧更新。

根盘到环路4.7外沿的保守平面余量分别8.028/5.6/13.118。它们只证明根盘不占原环路，不证明整冠、枝条和玩家相机全包络已验收。

## 性能与所有权

CPU统计新增16个静态材质批次、12753三角；没有FPS宣称。每株4材质批次，地被4批次。所有新增几何/材质由新增模块持有，dispose只释放自己，幂等；不释放任何原古松/湖/月材质。调用方需要在dispose前从场景碰撞数组移除已注册collider引用。

## 验证

`probe.mjs`及`probe.txt`：语法/构建、三姿态trunk数据不同、根盘避路、最终高度+2m重新承托、重复承托不抬升、空地采样拒绝/保留姿态、碰撞world位置及引用稳定、原对象保留、二次dispose通过。不能替代正常游戏GPU或导航验收。

本批实际JEV紧凑文字调用在`evidence-r1.json`/`jev-r1.json`；不发送图像、完整聊天或密钥，不把分类输出当视觉验收。

## 用户最新纠正：四棵均为新增（覆盖前文原1+3）

原古松和全部原森林另算保留，garden现在新增2/4/5/6四株。6号为独立探枝拱干，主干先外探、两条不等高回升支枝，非直立3或缩放副本；根(-8,-7)、yaw−.35。根盘1.2，离环路外沿4.730，和其余新增根盘分离。原1不加入本模块碰撞、不移动、不删原森林。Root负责撤销此前原森林过滤。

更新CPU probe-r2.txt：4sites/4colliders、4独立trunk数据、全部reseat及null拒绝/同引用碰撞/dispose通过；20材质批次、16499三角、11地被。这里只是CPU，新增6的实际地面承托/镜头/全包络由Root待验。JEV实际新调用evidence-r2/jev-r2。

## 可读性r3：本轮冻结源

实际查看normal-game-four-added.png/normal-game-low-view.png后确认：四株虽存在却混于原林、暗色且冠片过平，未达到可读目标。因此只调整新增内容，原森林/古松/湖/月/轨道不动。2到(-9,-4) yaw3.14、4到(0,-8.5) yaw.3、5到(-9,7.5) yaw.1、6到(7.5,8) yaw2.3。四独立姿态相对自身尺度1.2/1.25/1.45/1.3，厚叶团错高5簇替代平盘，4号主干增大反曲。色改暖灰棕#897a65和中青绿三阶#476d53/#678b5c/#88a268，无新光源/发光。原源快照source-before/readability-r3。

CPU完整包围尺寸见sizes-r3.json：2最高7.64、4最高8.40、5最高5.53、6最高6.45（相对根Y上方，不是FPS）；均低于原古松约12。四根盘至环路净距3.709/2.3/5.493/4.706。20批次、18419三角、11地被，根位旁自然地被同步移动。probe-r3.txt通过；r3源已冻结给Root重载GPU，本顾问不再以visible计数当视觉通过。
