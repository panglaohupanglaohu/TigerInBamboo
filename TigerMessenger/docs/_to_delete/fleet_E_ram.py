# -*- coding: utf-8 -*-
"""E：gateHaulerCraft 用体重撞飞攻击者。

主人 2026-09-06 的设定里登陆艇有两个动作：后舱门放/收兵，以及「用体重撞飞
攻击者」。第二个动作在代码里**一行都没有**——gateHaulerCraft.js 里连 ram
这个词都搜不到。

气垫艇是全队最重的东西，贴着海面和滩头开，红盔要冲上来抢滩就得从它前面过。
所以撞击不是额外的技能，是它本来就该有的物理存在感。

口径与舰队的整体设定一致：**非致命**。撞飞 = 击倒（downed），倒地之后由重甲兵
解决——和麻醉弹打下来的空中生物走同一条收尾路径。
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
rep("""  /** 折损撤离线：参战兵（24 名）掉到这个数以下就收队 */
  withdrawFighters: 12,""",
"""  /** 折损撤离线：参战兵（24 名）掉到这个数以下就收队 */
  withdrawFighters: 12,
  /** 登陆艇撞击（主人 2026-09-06「用体重撞飞攻击者」）：艇体外缘判定半径（米） */
  ramRadius: 3.4,
  /** 撞飞初速（米/秒）与滞空（秒）——重艇撞轻兵，飞得远、落得沉 */
  ramLaunch: 15,
  ramAirTime: 0.95,
  /** 同一个目标的撞击冷却（秒）：防止贴着艇边被反复弹起，读起来像抽搐 */
  ramCooldown: 3.0,""",
    "撞击参数")

# ---------------- st 字段 ----------------
rep("""    /** 被麻醉打下来、正在坠落的飞行生物（落地后交给重甲兵解决） */
    tranqFall: [],""",
"""    /** 被麻醉打下来、正在坠落的飞行生物（落地后交给重甲兵解决） */
    tranqFall: [],
    /** 被登陆艇撞飞、正在空中划弧的攻击者（落地即击倒，同样交给重甲兵） */
    rammed: [],""",
    "rammed 字段")

# ---------------- 撞击实现（挂在 updateTranqFall 后面） ----------------
rep("""      if (next <= ground + 0.12) {
        u.tranqFalling = false;
        u.tranqGrounded = true;
        st.tranqFall.splice(i, 1);
      }
    }
  }""",
"""      if (next <= ground + 0.12) {
        u.tranqFalling = false;
        u.tranqGrounded = true;
        st.tranqFall.splice(i, 1);
      }
    }
  }

  /**
   * 登陆艇撞击（主人 2026-09-06：「用体重撞飞攻击者」）。
   *
   * 判定很朴素：谁贴到艇体外缘（ramRadius）以内，就被沿「艇 → 人」的**切向**
   * 甩出去，同时给一个径向的抬升——切向决定往哪飞，径向决定飞得起来。
   * 球面世界里这两个方向必须分开算，直接拿世界向量当水平方向会把人甩进地里。
   *
   * 非致命：落地记 downed + tranqGrounded，和麻醉弹打下来的空中生物走同一条
   * 收尾路径（躺在地上，由重甲兵解决）。舰队整体是麻醉/击倒的路数，
   * 不在这儿单开一套致命判定。
   */
  function updateHaulerRam(dt) {
    const active = st.phase === "insert" || st.phase === "combat" || st.phase === "withdraw";
    if (active && st.haulers.length) {
      const pool = liveTargets();
      for (const h of st.haulers) {
        const craft = h.craft;
        if (!craft?.parent || !craft.visible) continue;
        craft.getWorldPosition(_a1);
        for (const s of pool) {
          const u = s.userData;
          if (!u || u.dead || u.rammedAir) continue;
          if (u.ramCd != null && st.clock < u.ramCd) continue;
          s.getWorldPosition(_a2);
          if (_a2.distanceTo(_a1) > VANGUARD_ASSAULT.ramRadius) continue;
          // 切向 = （艇→人）剥掉径向分量。球面上「水平」只能这么求。
          _a3.copy(_a2).sub(_a1);
          _a4.copy(_a2).normalize();               // 目标处的径向（天）
          _a3.addScaledVector(_a4, -_a3.dot(_a4));
          if (_a3.lengthSq() < 1e-6) _a3.copy(_a4).cross(UP_Y); // 正对着艇心：随便挑个切向
          _a3.normalize();
          u.ramCd = st.clock + VANGUARD_ASSAULT.ramCooldown;
          u.rammedAir = true;
          st.rammed.push({
            obj: s,
            dir: _a3.clone(),
            up: _a4.clone(),
            t: 0,
            r0: _a2.length(),
          });
          const smoke = typeof getSpawnSmoke === "function" ? getSpawnSmoke() : null;
          if (smoke) smoke(_a2.clone()); // 撞击尘
        }
      }
    }
    // 空中划弧 → 落地击倒
    for (let i = st.rammed.length - 1; i >= 0; i--) {
      const r = st.rammed[i];
      const o = r.obj;
      const u = o?.userData;
      if (!o?.parent || !u || u.dead) { st.rammed.splice(i, 1); continue; }
      r.t += dt;
      const T = VANGUARD_ASSAULT.ramAirTime;
      const k = Math.min(1, r.t / T);
      o.getWorldPosition(_a1);
      const dir = _a2.copy(_a1).normalize();
      const ground = gh(dir);
      // 抛物线：切向匀速远离，径向先上后下
      const along = VANGUARD_ASSAULT.ramLaunch * dt;
      const rise = Math.sin(k * Math.PI) * 2.6;
      _a3.copy(_a1).addScaledVector(r.dir, along);
      _a3.normalize().multiplyScalar(Math.max(ground + 0.05, ground + rise));
      if (o.parent) o.parent.worldToLocal(_a3);
      o.position.copy(_a3);
      o.rotation.x += dt * 5.2; // 翻滚
      if (k >= 1) {
        u.rammedAir = false;
        u.downed = true;
        u.paralyzed = true;
        u.tranqGrounded = true; // 躺在地上，进重甲兵的打击池
        u._fallT = 0;
        st.rammed.splice(i, 1);
      }
    }
  }""",
    "撞击实现")

# ---------------- 接到 update 主循环 ----------------
rep("""    updateScanStrike(dt);
    updateTranq(dt);""",
"""    updateScanStrike(dt);
    updateTranq(dt);
    updateHaulerRam(dt);""",
    "接主循环")

io.open(P, "w", encoding="utf-8").write(s)
print("patched vanguardAssault.js（E）")
