# -*- coding: utf-8 -*-
"""gatePodCraft 按**武装直升机**来飞（主人 2026-09-06）。

主人的两条：
  「在苔庭之战，除了莫比斯 aircraft 有与鲸鱼的反复拉扯的动作，
    其他 gateHaulerCraft + gatePodCraft + scoutDefense 都要维持自身的战斗方式，
    不要跟着莫比斯 aircraft 拉扯癫狂。其他场景也是这样。」
  「gatePodCraft 是武装直升机，火力压制。」

**癫狂的根**就在这个函数里：原来每帧
    pod.position = 宿主位置 + 宿主机身坐标系里的固定偏移
    pod.quaternion.copy(宿主的四元数)
——泡机是被焊在宿主机身上的挂件。苔庭鲸把主舰拽得俯冲翻滚，泡机就原样翻滚；
主舰一个横滚，三台泡机跟着倒扣过来。那不是伴飞，是刚体绑定。

武装直升机的飞法（AH-64 / Ka-52 那一类）：
  · **悬停平台**。它自己稳住姿态，机背始终朝天，不管旁边的东西怎么机动；
  · 跟位是**阻尼**的，不是刚性的：宿主猛动一下，它慢慢补上来，补的过程就是画面；
  · 前飞低头、转弯压坡度——姿态由**自己的速度**决定，不是抄来的。

所以这里改成：位置阻尼跟位（在当地球面坐标系里取偏移，天永远是天），
姿态自己算（速度→俯角，转向→坡度）。宿主翻不翻，与泡机无关。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/gatePodCraft.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

old = s[s.index("/**\n * 每帧把伴飞泡机贴到各自被伴飞的机队成员旁边。"):]
assert old.rstrip().endswith("}")

new = '''/** 跟位阻尼系数（1/s）。越小越"稳"，越大越"跟得紧"。
 *  0.9 大约是「宿主猛动一下，泡机用一秒多补上来」——武装直升机的质量感 */
const POD_FOLLOW_K = 0.9;
/** 前飞低头的上限（弧度，≈16°）。直升机靠低头换前进推力，但不会插着头飞 */
const POD_PITCH_MAX = 0.28;
/** 转向压坡度上限（弧度，≈14°） */
const POD_BANK_MAX = 0.25;

const _ehUp = new THREE.Vector3();
const _ehFwd = new THREE.Vector3();
const _ehSide = new THREE.Vector3();
const _ehVel = new THREE.Vector3();
const _ehTmp = new THREE.Vector3();
const _ehBasis = new THREE.Matrix4();

/**
 * 每帧把伴飞泡机保持在机队旁边的**悬停位**上——按武装直升机的方式，不是挂件。
 *
 * 在 updateAircraftHover **之后**调用：机队阵位这一帧已经算完，泡机才跟得准。
 *
 * ⚠️ 这里绝不 copy 宿主的四元数（主人 2026-09-06：「不要跟着莫比斯 aircraft
 * 拉扯癫狂」）。苔庭鲸把主舰拽得俯冲翻滚是主舰自己的戏；泡机是独立的作战平台，
 * 机背永远朝天，姿态只由它自己的速度决定。
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

  // 帧间隔：这个函数的签名里没有 dt，从时间戳推。首帧、跳帧、暂停回来都钳住，
  // 免得阻尼项一步跳到位（那就等于又变回刚性绑定了）。
  const prevT = wing.userData._escortT;
  const dt = Number.isFinite(prevT) ? Math.max(0, Math.min(0.1, t - prevT)) : 0;
  wing.userData._escortT = t;
  const follow = dt > 0 ? 1 - Math.exp(-POD_FOLLOW_K * dt) : 1;

  wing.children.forEach((pod, i) => {
    const slot = pod.userData.escortSlot;
    const host = members[slot.member % members.length];
    if (!host?.parent) return;
    host.getWorldPosition(_epPos);
    host.getWorldQuaternion(_epQ);

    // ---- 当地球面坐标系：天取**自己脚下的天**，不取宿主的机背 ----
    // 这一行就是「不跟着癫狂」的全部秘密：宿主横滚 90°，它的 +Y 指向侧面，
    // 旧代码照抄过来泡机就跟着倒扣；现在天永远是天。
    _ehUp.copy(_epPos);
    if (_ehUp.lengthSq() < 1e-8) _ehUp.set(0, 1, 0);
    _ehUp.normalize();
    // 航向仍跟队（编队要朝一个方向），但压平到切平面
    _ehFwd.set(0, 0, 1).applyQuaternion(_epQ);
    _ehFwd.addScaledVector(_ehUp, -_ehFwd.dot(_ehUp));
    if (_ehFwd.lengthSq() < 1e-8) _ehFwd.set(1, 0, 0).addScaledVector(_ehUp, -_ehUp.x);
    _ehFwd.normalize();
    _ehSide.crossVectors(_ehFwd, _ehUp).normalize();

    const bob = Math.sin(t * 0.7 + i * 2.3) * 0.6;
    _epTarget.copy(_epPos)
      .addScaledVector(_ehSide, slot.side)
      .addScaledVector(_ehUp, slot.up + bob)
      .addScaledVector(_ehFwd, -slot.back);

    // ---- 阻尼跟位：宿主猛动一下，泡机用一秒多补上来 ----
    pod.getWorldPosition(_ehTmp);
    const prev = pod.userData._escortPrev;
    if (prev && dt > 0) {
      _ehTmp.lerp(_epTarget, follow);
      _ehVel.subVectors(_ehTmp, prev).multiplyScalar(1 / dt);
    } else {
      _ehTmp.copy(_epTarget);
      _ehVel.set(0, 0, 0);
    }
    pod.userData._escortPrev = _ehTmp.clone();
    pod.position.copy(_ehTmp).applyMatrix4(parentInv);

    // ---- 姿态自己算：前飞低头 + 转向压坡度 ----
    // 切向速度分量决定低头量（直升机靠低头换推力）；侧向分量决定坡度。
    const vFwd = _ehVel.dot(_ehFwd);
    const vSide = _ehVel.dot(_ehSide);
    const pitch = -Math.max(-POD_PITCH_MAX, Math.min(POD_PITCH_MAX, vFwd * 0.045));
    const bank = Math.max(-POD_BANK_MAX, Math.min(POD_BANK_MAX, -vSide * 0.05))
      + Math.sin(t * 0.53 + i * 1.7) * 0.03; // 悬停时的轻微摆动，不做成僵直的板子
    _ehBasis.makeBasis(_ehSide.clone().negate(), _ehUp, _ehFwd);
    pod.quaternion.setFromRotationMatrix(_ehBasis);
    pod.rotateX(pitch);
    pod.rotateZ(bank);
  });
}
'''
s = s.replace(old, new)
io.open(P, "w", encoding="utf-8").write(s)
print("patched gatePodCraft.js（武装直升机：阻尼悬停 + 自算姿态）")
