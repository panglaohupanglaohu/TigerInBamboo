# -*- coding: utf-8 -*-
"""gatePodCraft 按**僚机**来飞（主人 2026-09-06 第二次纠正）。

  「泡机是僚机，不是挂件，业界有僚机的做法，你来参考。
    主舰拉扯，僚机需要保持飞行姿态来进行保护」

上一版我矫枉过正了：为了不跟着主舰癫狂，把泡机做成了各飞各的悬停平台——
那走到了另一个极端，看起来像三架不认识主舰的无人机。主人说得准确：
**它是僚机**。僚机跟长机的关系，业界分得很清楚，是两套队形：

  ① **密集队形（parade / fingertip）**——巡航、通场时用。僚机贴在长机翼侧，
     长机压坡度转弯，僚机**跟着一起压**——编队转弯本来就是这样，
     整个编队像一块板。所以「跟着主舰倾斜」在这一档里是对的，不是 bug。

  ② **战术队形（combat spread / fighting wing / 掩护轮）**——长机进入剧烈机动、
     或者被缠住动不了的时候用。僚机**主动拉开**到一个宽松、能看清全局的位置，
     **保持自己的飞行姿态**（机翼接近水平、只做协调转弯），绕着长机飞掩护圈。
     这就是主人那句「主舰拉扯，僚机需要保持飞行姿态来进行保护」——
     保持姿态是为了**能打**；贴着长机一起翻，是打不了的。

苔庭鲸把主舰拽得天翻地覆，正是第②档的教科书场景：长机被咬住了，
僚机要做的不是陪着翻跟头（挂件），也不是自己飞自己的（无人机），
而是**拉开、稳住、绕着它转、护着它**。

所以这一版：两档队形 + 自动切换 + 迟滞。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/gatePodCraft.js")
s = io.open(P, encoding="utf-8").read()

marker = "/** 跟位阻尼系数（1/s）"
assert marker in s, "找不到上一版僚机代码的起点"
head = s[:s.index(marker)]

body = '''// ---- 僚机参数（业界两档队形：密集 / 战术掩护）----------------------------
/** 密集队形的跟位阻尼（1/s）。僚机贴翼飞，位置要跟得紧 */
const WING_PARADE_K = 3.4;
/** 掩护轮的跟位阻尼（1/s）。拉开之后不必贴那么死，留出机动余量 */
const WING_COVER_K = 1.1;
/** 队形切换的过渡时间（秒） */
const WING_MODE_BLEND = 1.2;
/** 掩护轮的站位放大：横向 ×2.3、抬高 +7、后拖 +9（看得见长机的全貌） */
const WING_COVER_SIDE = 2.3;
const WING_COVER_UP = 7;
const WING_COVER_BACK = 9;
/** 掩护轮的绕飞角速度（弧度/秒）——绕着长机转，不是钉在一个点上 */
const WING_COVER_ORBIT = 0.5;
/** 掩护轮的绕飞半径（米） */
const WING_COVER_RADIUS = 7.5;

/** 拉开的门槛：长机机背偏离天顶超过这个角，或姿态角速度超过下面那个 */
const WING_BREAK_TILT = 0.70;   // ≈40°
const WING_BREAK_RATE = 1.20;   // rad/s
/** 归队门槛（迟滞）：长机安静满 WING_REJOIN_HOLD 秒才回密集队形 */
const WING_REJOIN_HOLD = 1.5;

/** 僚机自己的飞行包线：坡度 ≤ 40°、俯仰 ≤ 20°。
 *  「保持飞行姿态」的具体数字——超出这个范围就不是在飞，是在被甩 */
const WING_BANK_MAX = 0.70;
const WING_PITCH_MAX = 0.35;

const _ewUp = new THREE.Vector3();
const _ewFwd = new THREE.Vector3();
const _ewSide = new THREE.Vector3();
const _ewVel = new THREE.Vector3();
const _ewTmp = new THREE.Vector3();
const _ewBack = new THREE.Vector3();
const _ewParade = new THREE.Vector3();
const _ewCover = new THREE.Vector3();
const _ewBasis = new THREE.Matrix4();
const _ewQd = new THREE.Quaternion();

const clampAbs = (v, lim) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

/**
 * 每帧把僚机保持在长机旁边的队形位上（两档队形，自动切换）。
 *
 * 在 updateAircraftHover **之后**调用：长机阵位这一帧已经算完，僚机才跟得准；
 * 反过来会慢一帧，转弯时看得出拖影。
 *
 * @param {THREE.Object3D} squad
 * @param {number} [t] 场景时间（秒）。帧间隔从两次调用的时间差推出
 */
export function updateGatePodEscort(squad, t = 0) {
  const wing = squad?.userData?.gatePodEscort;
  if (!wing) return;
  const members = squad.userData.members || [];
  if (!members.length) return;
  squad.updateWorldMatrix(true, false);
  const parentInv = squad.matrixWorld.clone().invert();

  // 帧间隔：这个函数签名里没有 dt，从时间戳推。首帧、跳帧、暂停回来都钳住，
  // 免得阻尼项一步跳到位（那就等于又变回刚性绑定了）。
  const prevT = wing.userData._escortT;
  const dt = Number.isFinite(prevT) ? Math.max(0, Math.min(0.1, t - prevT)) : 0;
  wing.userData._escortT = t;

  // 长机被鲸咬住这件事，squad 上有明牌（saihojiGarden 每帧写 whaleLock）。
  // 有明牌就直接进掩护轮，不等姿态门槛——鲸起的那一瞬间僚机就该拉开。
  const whaleOn = !!(squad.userData?.whaleLock?.active
    || members.some((m) => m?.userData?.whaleLock?.active));

  wing.children.forEach((pod, i) => {
    const slot = pod.userData.escortSlot;
    const host = members[slot.member % members.length];
    if (!host?.parent) return;
    host.getWorldPosition(_epPos);
    host.getWorldQuaternion(_epQ);

    // ---- 当地的天。切换队形、限幅飞行包线，都以它为基准 ----
    _ewUp.copy(_epPos);
    if (_ewUp.lengthSq() < 1e-8) _ewUp.set(0, 1, 0);
    _ewUp.normalize();

    // ---- 长机稳不稳：机背偏离天顶多少 + 姿态角速度多大 ----
    _ewBack.set(0, 1, 0).applyQuaternion(_epQ);
    const hostTilt = Math.acos(Math.max(-1, Math.min(1, _ewBack.dot(_ewUp))));
    const st = (pod.userData._wing ||= { cover: 0, calm: 0, prevQ: null, prevPos: null });
    let rate = 0;
    if (st.prevQ && dt > 0) {
      _ewQd.copy(st.prevQ).invert().multiply(_epQ);
      rate = 2 * Math.acos(Math.max(-1, Math.min(1, Math.abs(_ewQd.w)))) / dt;
    }
    st.prevQ = _epQ.clone();

    // ---- 队形切换（迟滞）：掉进掩护轮很快，归队要等长机真的安静一阵子 ----
    const breaking = whaleOn || hostTilt > WING_BREAK_TILT || rate > WING_BREAK_RATE;
    st.calm = breaking ? 0 : st.calm + dt;
    const want = breaking ? 1 : (st.calm >= WING_REJOIN_HOLD ? 0 : st.cover);
    const step = dt > 0 ? dt / WING_MODE_BLEND : 1;
    st.cover += clampAbs(want - st.cover, step);
    st.cover = Math.max(0, Math.min(1, st.cover));
    const cover = st.cover;

    // ---- ① 密集队形位：长机的**机身坐标系**里的固定偏置 ----
    // 编队转弯时长机压坡度，这个位子跟着一起转——那正是僚机该有的样子。
    _epUp.set(0, 1, 0).applyQuaternion(_epQ).normalize();
    _epFwd.set(0, 0, 1).applyQuaternion(_epQ).normalize();
    _epSide.crossVectors(_epFwd, _epUp).normalize();
    const bob = Math.sin(t * 0.7 + i * 2.3) * 0.35;
    _ewParade.copy(_epPos)
      .addScaledVector(_epSide, slot.side)
      .addScaledVector(_epUp, slot.up + bob)
      .addScaledVector(_epFwd, -slot.back);

    // ---- ② 掩护轮位：拉开到外侧，在**当地水平面**里绕着长机转 ----
    // 关键在于这里用的是当地的天，不是长机的机背：长机翻成什么样，
    // 掩护圈都还在水平面上，僚机也就还在正常飞行。
    _ewFwd.copy(_epFwd).addScaledVector(_ewUp, -_epFwd.dot(_ewUp));
    if (_ewFwd.lengthSq() < 1e-8) {
      _ewFwd.set(1, 0, 0).addScaledVector(_ewUp, -_ewUp.x);
      if (_ewFwd.lengthSq() < 1e-8) _ewFwd.set(0, 0, 1).addScaledVector(_ewUp, -_ewUp.z);
    }
    _ewFwd.normalize();
    _ewSide.crossVectors(_ewFwd, _ewUp).normalize();
    const az = t * WING_COVER_ORBIT + (i / Math.max(1, wing.children.length)) * Math.PI * 2;
    _ewCover.copy(_epPos)
      .addScaledVector(_ewSide, slot.side * WING_COVER_SIDE + Math.cos(az) * WING_COVER_RADIUS)
      .addScaledVector(_ewUp, WING_COVER_UP + bob)
      .addScaledVector(_ewFwd, -slot.back - WING_COVER_BACK + Math.sin(az) * WING_COVER_RADIUS);

    _epTarget.copy(_ewParade).lerp(_ewCover, cover);

    // ---- 跟位：密集档跟得紧，掩护档松一些 ----
    const k = WING_PARADE_K + (WING_COVER_K - WING_PARADE_K) * cover;
    const follow = dt > 0 ? 1 - Math.exp(-k * dt) : 1;
    pod.getWorldPosition(_ewTmp);
    if (st.prevPos && dt > 0) {
      _ewTmp.lerp(_epTarget, follow);
      _ewVel.subVectors(_ewTmp, st.prevPos).multiplyScalar(1 / dt);
    } else {
      _ewTmp.copy(_epTarget);
      _ewVel.set(0, 0, 0);
    }
    st.prevPos = _ewTmp.clone();
    pod.position.copy(_ewTmp).applyMatrix4(parentInv);

    // ---- 姿态 ----
    // 密集档：跟长机一起压坡度（编队转弯），但限幅在自己的飞行包线里；
    // 掩护档：机翼自己摆平，坡度只由**自己的转向**决定——
    //         「保持飞行姿态来进行保护」就是这一句。
    const hostRoll = Math.atan2(_ewBack.dot(_ewSide), Math.max(1e-6, _ewBack.dot(_ewUp)));
    const vSide = _ewVel.dot(_ewSide);
    const vFwd = _ewVel.dot(_ewFwd);
    const vUp = _ewVel.dot(_ewUp);
    const ownBank = -vSide * 0.05;
    const bank = clampAbs(hostRoll * (1 - cover) + ownBank * cover, WING_BANK_MAX)
      + Math.sin(t * 0.53 + i * 1.7) * 0.03;
    // 俯仰：跟着自己的航迹（爬升抬头 / 下降低头），限幅
    const pitch = clampAbs(Math.atan2(vUp, Math.max(0.5, Math.abs(vFwd))), WING_PITCH_MAX);
    _ewBasis.makeBasis(_ewSide.clone().negate(), _ewUp, _ewFwd);
    pod.quaternion.setFromRotationMatrix(_ewBasis);
    pod.rotateX(pitch);
    pod.rotateZ(bank);
  });
}
'''
io.open(P, "w", encoding="utf-8").write(head + body)
print("patched gatePodCraft.js（僚机：密集队形 / 战术掩护轮）")
