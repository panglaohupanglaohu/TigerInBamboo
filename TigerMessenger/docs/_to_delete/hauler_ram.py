# -*- coding: utf-8 -*-
"""I：gateHaulerCraft 的撞击 —— 只在离场时用、带伤害、带动画。

主人 2026-09-06：
  「gateHaulerCraft 添加撞击损伤能力，但只是离开战场时使用」
  「gateHaulerCraft 离开战场前将敌人撞飞，要有动画」

改之前：insert / combat / withdraw 三个阶段都在撞，而且是纯击倒——没有伤害。
现在：
  · 只在 **extract**（贴海离场那一段）撞。撞击是「走人时顺手把挡道的掀翻」，
    不是一门整场都在用的武器；打仗归重甲兵和麻醉弹。
  · 有伤害：按 saihojiPhalanx 的口径记 2 点近战（= KILL_MELEE），一撞即毙。
  · 有动画：艇体侧倾+俯冲的撞击姿态、目标三轴翻滚、撞点冲击波环。
"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/vanguardAssault.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    assert s.count(old) == 1, "多处匹配：" + why
    s = s.replace(old, new, 1)

# ---------------- 参数 ----------------
rep("  ramCooldown: 3.0,",
"""  ramCooldown: 3.0,
  /** 一次撞击记几点近战伤害。saihojiPhalanx 的 KILL_MELEE = 2 → 一撞即毙。
   *  艇是靠体重撞的，不是刀砍，给满 */
  ramMelee: 2,
  /** 艇体撞击姿态的持续时间（秒）：侧倾 + 俯冲，然后改平 */
  ramPoseTime: 0.7,
  /** 撞点冲击波环的存活时间（秒） */
  ramRingTime: 0.55,""",
    "参数")

# ---------------- 只在 extract 撞 + 伤害 + 动画 ----------------
rep("""    const active = st.phase === "insert" || st.phase === "combat" || st.phase === "withdraw";
    if (active && st.haulers.length) {""",
"""    // 主人 2026-09-06：「**但只是离开战场时使用**」。
    // extract 就是贴海离场那一段——艇满载着人往外开，谁挡道谁被掀翻。
    // 原来 insert/combat/withdraw 三段都在撞，那等于给登陆艇配了一门主炮，
    // 地面的仗就不用重甲兵打了，编成的意义就没了。
    const active = st.phase === "extract";
    if (active && st.haulers.length) {""",
    "只在 extract")

rep("""          u.ramCd = st.clock + VANGUARD_ASSAULT.ramCooldown;
          u.rammedAir = true;
          st.rammed.push({
            obj: s,
            dir: _a3.clone(),
            up: _a4.clone(),
            t: 0,
            r0: _a2.length(),
          });
          const smoke = typeof getSpawnSmoke === "function" ? getSpawnSmoke() : null;
          if (smoke) smoke(_a2.clone()); // 撞击尘""",
"""          u.ramCd = st.clock + VANGUARD_ASSAULT.ramCooldown;
          u.rammedAir = true;
          // ---- 伤害（主人 2026-09-06：「添加撞击损伤能力」）----
          // 口径对齐 saihojiPhalanx.applySoldierDamage：近战 ≥ KILL_MELEE(2) 即死。
          // 这里不去调那个函数（它是 phalanx 的内部实现，登陆队够不着），
          // 而是往同一批 userData 字段上记——两边读的是同一份账。
          u.meleeHits = (u.meleeHits || 0) + VANGUARD_ASSAULT.ramMelee;
          if ((u.meleeHits || 0) >= 2) {
            u.dead = true;
            u._dieT = 3.7;
          }
          u.downed = true;
          u._fallT = 0;
          // ---- 动画①：艇体撞击姿态（侧倾 + 俯冲，0.7s 内改平）----
          // 撞的那一侧压下去——「用体重撞」这四个字要在画面上看得见，
          // 光把人弹开、艇纹丝不动，读起来像是人自己蹦走的。
          h.ramPose = { t: 0, side: Math.sign(_a3.dot(_a4.clone().cross(UP_Y))) || 1 };
          const smoke = typeof getSpawnSmoke === "function" ? getSpawnSmoke() : null;
          if (smoke) smoke(_a2.clone()); // 撞击尘
          // ---- 动画②：撞点冲击波环 ----
          spawnRamRing(_a2, _a4);""",
    "伤害 + 姿态")

rep("""      if (k >= 1) {
        u.rammedAir = false;
        u.downed = true;
        u.paralyzed = true;
        u.tranqGrounded = true; // 躺在地上，进重甲兵的打击池
        u._fallT = 0;
        st.rammed.splice(i, 1);
      }
    }
  }""",
"""      if (k >= 1) {
        u.rammedAir = false;
        u.downed = true;
        u.paralyzed = true;
        u.tranqGrounded = true; // 躺在地上（撞死的也要有尸体停在那儿）
        u._fallT = 0;
        st.rammed.splice(i, 1);
      }
    }
    updateRamPose(dt);
    updateRamRings(dt);
  }

  /**
   * 撞击动画①：艇体姿态。
   *
   * 撞上的一瞬间把艇往撞击侧压下去（roll）并略微低头（pitch），
   * 然后在 ramPoseTime 内平滑改平。曲线用 sin(πk) —— 起手快、收得干净，
   * 读起来是「顶了一下」，不是「翻了个跟头」。
   */
  function updateRamPose(dt) {
    for (const h of st.haulers) {
      const pose = h.ramPose;
      if (!pose || !h.craft) continue;
      pose.t += dt;
      const k = Math.min(1, pose.t / VANGUARD_ASSAULT.ramPoseTime);
      const amp = Math.sin(k * Math.PI);
      const body = h.craft.userData?.hullPivot || h.craft;
      body.rotation.z = pose.side * amp * 0.34; // 撞击侧压下去
      body.rotation.x = -amp * 0.16;            // 略微低头（把体重压上去）
      if (k >= 1) {
        body.rotation.z = 0;
        body.rotation.x = 0;
        h.ramPose = null;
      }
    }
  }

  /**
   * 撞击动画②：撞点冲击波环。
   *
   * 一圈贴地的环，0.55s 内从 0.6 张到 5.2 并淡出。用 RingGeometry 而不是粒子：
   * 一次撞击只多一个 draw call，撞五个人也只有五个——这条线上性能是有前科的
   * （城堡构建那次崩溃）。环随用随建、用完 dispose，不进对象池。
   */
  function spawnRamRing(atPos, upDir) {
    const geo = new THREE.RingGeometry(0.55, 0.78, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbfe6ff, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.name = "vanguard-ram-ring";
    ring.position.copy(atPos);
    // 环平面要贴着地面：默认 RingGeometry 在 XY 平面，法线是 +Z，
    // 把 +Z 转到当地的「天」方向即可
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), upDir.clone().normalize());
    root.add(ring);
    st.ramRings.push({ mesh: ring, t: 0 });
  }

  function updateRamRings(dt) {
    for (let i = st.ramRings.length - 1; i >= 0; i--) {
      const r = st.ramRings[i];
      r.t += dt;
      const k = Math.min(1, r.t / VANGUARD_ASSAULT.ramRingTime);
      const scale = 0.6 + k * 4.6;
      r.mesh.scale.set(scale, scale, scale);
      r.mesh.material.opacity = 0.85 * (1 - k) * (1 - k);
      if (k >= 1) {
        root.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        st.ramRings.splice(i, 1);
      }
    }
  }""",
    "动画")

# ---------------- 状态位 ----------------
rep("    rammed: [],", "    rammed: [],\n    ramRings: [],", "st.ramRings")

io.open(P, "w", encoding="utf-8").write(s)
print("patched vanguardAssault.js（撞击：只在离场 · 有伤害 · 有动画）")
