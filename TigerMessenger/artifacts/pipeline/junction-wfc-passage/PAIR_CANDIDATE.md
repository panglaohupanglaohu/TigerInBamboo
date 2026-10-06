# Pass 2 — 双层三连拱可审查候选

主代理实际浏览器验收已完成（21:19 UTC）：下半承重格拒删并可见提示；上半格右键删除398→397，撤销/重做/最终恢复398，快照一致。修复面板修订号残留后，重新加载验证3/4/5。GPU最多282程序编译/链接成功，采样GL及页面错误为空；未点击Save。见 `pair-browser-verification.json` 和 `pair-ui-revision-verification.json`。完整玩家路线仍未通过，默认关闭。

**源码冻结；默认关闭；完整玩家路线未通过。** `junctionWfcPassage=2` 在 left-mid-yellow 既有 6 格消费真实求解的双层模块；不是已发布的可通行街道。山体与 release manifest 未修改。原 pass1 仍保留。

预览：`http://localhost:8931/TigerMessenger/artifacts/pipeline/canal-junction-editable/live.html?junctionWfcPassage=2`

## 当前确实实现的部分

`townPassagePairSelection.js` 独立 catalog 增加 X/Z 两组 lower/upper 原型，U/D 专用 archpair.x / archpair.z socket。六格只允许对应上下角色，样区外 27 格 pin 为原 solver 解。原 398 格占用、11 region、楼高1.70、位置与基础不变。相同种子真实 solveWfc 求得三对 X 拱；强制错配 upper Z 导致无解。不是先雕空、再贴 WFC 标签。缓存含 junction-pair-v1。

两层分别生成闭合实体，各保留原 cell owner。下层两侧石墩，上层拱弧/承重冠，外顶3.40；上下旧盒体、干扰装饰与楼板在现消费分支取消。实际原模型其他10 region、地基和本region其它27owner几何哈希保持。全局 catalog 默认仍22原型48变体，未在其它城启用新模块。

## CPU 证据与不能扩大解释的限制

`pair-tests.json` 中 `passed:true` 表示候选检查与预期失败识别均符合断言；**`fullTraversalAccepted:false` 和 `approachSupport.passed:false` 是最终通行结论**。

- 实测9条上射线：三根中心拱高2.30000003 m，横向±.40 m净高仍≥2.10 m。
- 每份实际石体闭合、无退化，432条无向边均双面引用。
- 使用独立线段—三角形最近距离（不是旧射线或metadata）测试 .35 m半径、1.66 m总高胶囊；3条偏移路线、513个姿态，覆盖三连拱和两端各1 m。真实邻近障碍144三角，最小体壳余量.097999997 m。步长.04 m，用距离的1-Lipschitz性质扣除.02 m，连续路径障碍余量至少.077999997 m。脚底以下合法接触面单独处理，不能据此说地面承托通过。
- 初始点在所有9261次实体AABB检查之外，排除整个胶囊从封闭体内部开始的歧义。旧pass1真实低拱胶囊反例和薄楼板反例均发生碰撞。
- 地面承托**失败**：336个脚底探针不符合本候选1 cm平接目标。左端 x=-15.4 的固定 quay 比洞地坪低2.70000002 m；x=-14.25 的既有 seawall-plinth 低.09499999 m；x=-14.5 的seawall低.00500001 m。只认证中心±1.6 m区间的抽样脚底承托，不删除失败数据。基础完全未动。
- 现ground/walls适配器在球面式平移框架下的承托中段双向120步通过。这不是全程玩家行走验收，也不是任意实际世界姿态胶囊证明。GPU/真实浏览器由主代理接手。
- 10次上半删除/undo、20次region重建后几何hash准确恢复，当前保有1157几何/83材质数量稳定；非目标region对象identity不变。没有进行Save动作；CPU假storage测试确认junction-regions-v1存档格式不变。

## 编辑及浏览器复核步骤

初始：398cells、11regions，left-mid-yellow 33cells；其 pairCandidate.active=true、fixedOutsideCells=27、solver hash da496c05。该region passage.selected=6（上下各3份实体），其他region保持原pass1；整个场景仍23个下半/低拱入口。未改watchtower原2.70m承托异常。

预览已有按钮：

- `查看 WFC 贯通拱门`：pass2定向显示左中段候选。
- `左端地基落差` / `右端地基`：只移动相机，展示端口承托。
- `上半删除试验（允许）`：对准 left-mid-yellow/0,1,1 的实体。按钮自身不编辑，随后在画布目标点右键。期望只删除1格，398→397，整组三连pair退出为inactive，旧单格生成接管；Undo恢复398及原解/原几何。
- `下半删除试验（拒绝）`：对准 left-mid-yellow/0,0,1 石墩。按钮不编辑，随后右键。因为上格仍占用而拒绝；revision和snapshot不变。现有编辑面板stats与4秒toast明确显示“上格仍占用，删除下半会失去承托；上格未被自动删除”。没有破坏性级联。

`#results` 的 inspect数据：`snapshot`、`wfcAudit.regions[].pairCandidate/assignment/passage`、`actualRayHit`、`pageClick`、`gpu`、`passageClearance`。两个删除按钮也调整了用于inspect的目标点，使实际射线命中相应石体而不是洞口中心。右键后的UI拒绝理由在游戏编辑面板stats/toast；请保持该面板打开。Undo/Redo按钮只调用原面板操作，harness从不自动保存。

删除上半恢复通用生成并不等于旧系统所有悬挑都取得结构认证；本实验只强制双层候选完整性和下半承托拒绝。不得把其它旧通道/上层悬挑一并标成已验证。

## 回归与修改范围

- `pass1-after-pair-regression.json`：原pass1实几何、旋转、552洞内射线、地基22+1、删除/undo/save等完整套件通过。
- `default-after-pair-tests.json`：无query默认路径3360meshes、398cells、22原型48变体、1572方向兼容边及事务回归通过。
- `pair-tests.json`：以上双层证据和明确承托失败。

源文件：新增 townPassagePairSelection.js；既有 wfcTownWiring.js、townPassageGeometry.js、citadelTown.js、odysseyCitadel.js调用转发、canalJunctionEditable.js候选路由；citadelEditorPanel.js只新增拒绝原因反馈；已有review harness增加pass2和地基/编辑视角。新测试 test_junction_wfc_passage_pair.mjs。未修改山体、玩家碰撞体尺寸、固定基础或默认开关。

下一步若要完成**实际贯通路线**，需单独解决左端高差及对外可达性；本轮明确禁止改基础，故停留在默认关闭的可审查候选，不临时搭浮空坡道、不宣称任务通行部分完成。

## 主线程实际浏览器复核

`pair-browser-verification.json`：初始398；下半拒删保持398和revision1，面板详细说明原因；上半实际右键删除397，undo398/redo397/finalUndo398，快照精确恢复，未Save。最多282GPU程序全部编译/链接成功，GL[]/pageErrors[]。实景拱洞与左端地基落差已查看并截图。另修正面板undo/redo后stats旧revision残留，重新加载后实测3/4/5正确（`pair-ui-revision-verification.json`）。外部接近路径仍失败，默认关闭。
