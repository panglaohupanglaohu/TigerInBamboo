# 木马真实关节与形态调整

已读并查看本轮目标与实景；保留木材而非将目标金属照搬。源快照在source-before。仅修改资产工厂及新增专项测试，不改演员、地形、士兵、夜袭或浏览器。

脸部两侧颊肌/下颌加厚，长脸从额部向下收至鼻吻；后腿上段增粗，髋轴与髋部木质圆轴对齐。四条腿使用真实父子Group，每一刚性段独立合批：后腿hip→knee→hock→hoof，前腿shoulder→elbow→wrist→hoof。保持默认前腿悬起、后腿弓起、四轮底座、材质与外部.72 actor scale；腹舱setBellyOpen和local y2.46四绳锚契约保持。

接口：`horse.userData.articulation.setJoint('hindLeft','hip',.3)`，`reset()`；chain名hindLeft/hindRight/foreLeft/foreRight，单位弧度，X轴，保守限±.65。不包含IK、行走、碰撞联动、骑控玩法；大角度姿态尚待碰撞验证。`ridingAnchors.seat/leftRein/rightRein`为Object3D，可取world位置；implementedGameplay=false。

4专项测试通过，覆盖16个关节带动实际网格、下游链/反侧隔离、复位、腹舱、骑乘锚与factory scale。6项既有夜袭迁移回归通过。这不是完整夜袭剧情重新实玩。

浏览器崩溃安全限制保持，未启动替代浏览器或headless。外观与动作GPU待用户恢复后复核；未给视觉分。源新增关节不可再整组静态合批，否则会重新焊死。
