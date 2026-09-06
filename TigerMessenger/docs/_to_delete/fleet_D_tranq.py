# -*- coding: utf-8 -*-
"""D：麻醉弹加萤火光芒；空中生物麻醉满额后**坠地**，再由重甲兵解决。

主人 2026-09-06：
  「麻醉弹攻击（麻醉弹添加萤火光芒）」
  「空中生物让 gatePodCraft 麻醉后坠地解决」

改之前：
  · 麻醉弹是一颗 0.16 的素蓝球，纯色 MeshBasicMaterial，没有任何光晕；
  · 命中 5 发只写了 downed/paralyzed 两个标志。地面红盔靠 saihojiPhalanx 的
    _fallT 会倒下去，**飞行生物没有任何东西让它掉下来**——它会带着 downed
    标志继续飞。而 downed 又把它从目标池里摘掉了，于是既不掉也没人管。
"""
import io, os
R = os.path.expanduser("~/mnt/TigerInBamboo/")

def edit(rel, pairs):
    p = R + rel
    s = io.open(p, encoding="utf-8").read()
    for old, new, why in pairs:
        assert old in s, "%s 未匹配：%s" % (rel, why)
        assert s.count(old) == 1, "%s 多处匹配：%s" % (rel, why)
        s = s.replace(old, new, 1)
    io.open(p, "w", encoding="utf-8").write(s)
    print("patched", rel)

# ---------------- 萤火贴图导出 ----------------
edit("TigerMessenger/src/world/vanguardTrooper.js", [
("function fireflyTexture() {",
 """/**
 * 萤火光点贴图（径向渐变，加色混合用）。
 * 2026-09-06 导出：泡机的麻醉弹也要这层光晕，两处必须是同一个视觉语汇——
 * 各画各的迟早会漂成两种萤火。
 */
export function fireflyTexture() {""",
 "导出 fireflyTexture"),
])

# ---------------- vanguardAssault ----------------
edit("TigerMessenger/src/world/vanguardAssault.js", [
# import
("""  updateVanguardAdvance,""",
 """  updateVanguardAdvance,
  fireflyTexture,""",
 "import fireflyTexture"),

# 弹丸外观
("""  // 麻醉弹池：小蓝发光球（低频发射，8 发够用）
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.95, depthWrite: false })
    );
    m.name = `tranq-dart-${i}`; // 命名不是装饰：测试与调试要认得出在飞的弹丸
    m.visible = false;
    m.frustumCulled = false;
    root.add(m);
    st.tranq.pool.push(m);
  }""",
 """  // 麻醉弹池：弹芯 + 萤火光晕（主人 2026-09-06：「麻醉弹添加萤火光芒」）。
  //
  // 光晕用的是重甲兵闪电枪那套萤火贴图（vanguardTrooper.fireflyTexture），
  // 加色混合、不写深度——两处共用同一个视觉语汇，各画各的迟早漂成两种萤火。
  // Sprite 永远面向镜头，弹丸怎么翻滚光晕都是圆的。
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.95, depthWrite: false })
    );
    m.name = `tranq-dart-${i}`; // 命名不是装饰：测试与调试要认得出在飞的弹丸
    m.visible = false;
    m.frustumCulled = false;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fireflyTexture(),
      color: 0x9fe9ff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    halo.name = `tranq-dart-glow-${i}`;
    halo.scale.setScalar(1.15);
    halo.userData.transientFx = true; // 不进静态合并块
    m.add(halo);
    m.userData.halo = halo;
    root.add(m);
    st.tranq.pool.push(m);
  }""",
 "弹丸萤火"),

# 命中：飞行目标进入坠落
("""        if (u.tranqHits >= 5 && !u.downed) {
          u.downed = true; u._fallT = 0; u.paralyzed = true; // 倒地不动（非致命）
        }""",
 """        if (u.tranqHits >= 5 && !u.downed) {
          u.downed = true; u._fallT = 0; u.paralyzed = true; // 倒地不动（非致命）
          // 空中生物：麻醉满额 → **坠地**（主人 2026-09-06：「麻醉后坠地解决」）。
          // 地面红盔靠 saihojiPhalanx 的 _fallT 自己倒下去；飞行生物没有那套动画，
          // 不推它一把它会带着 downed 标志继续飞——而 downed 又把它从目标池里
          // 摘掉了，结果既不掉、也没人管，等于白麻醉。
          s.target.getWorldPosition(_a3);
          const dir = _a3.clone().normalize();
          if (_a3.length() > gh(dir) + 1.2) {
            u.tranqFalling = true;
            u.tranqFallV = 0;
            if (!st.tranqFall.includes(s.target)) st.tranqFall.push(s.target);
          } else {
            u.tranqGrounded = true; // 本来就在地上
          }
        }""",
 "坠落触发"),

# st 字段
("""    tranq: { shots: [], cd: 2.5, pool: [] },""",
 """    tranq: { shots: [], cd: 2.5, pool: [] },
    /** 被麻醉打下来、正在坠落的飞行生物（落地后交给重甲兵解决） */
    tranqFall: [],""",
 "tranqFall 字段"),

# 弹丸推进时驱动光晕 + 坠落推进
("""      _a2.normalize();
      s.mesh.position.addScaledVector(_a2, s.speed * dt);
      if (s.t > 3.5) { s.mesh.visible = false; t.shots.splice(i, 1); }
    }
  }""",
 """      _a2.normalize();
      s.mesh.position.addScaledVector(_a2, s.speed * dt);
      // 萤火呼吸：飞行途中光晕明灭，命中前那一下最亮
      const halo = s.mesh.userData?.halo;
      if (halo) {
        const puls = 0.9 + 0.28 * Math.sin(s.t * 13.0);
        halo.scale.setScalar(1.15 * puls);
        halo.material.opacity = 0.62 + 0.3 * puls;
      }
      if (s.t > 3.5) { s.mesh.visible = false; t.shots.splice(i, 1); }
    }

    updateTranqFall(dt);
  }

  /**
   * 麻醉坠落：被打满 5 发的飞行生物沉下来，落地后标记 tranqGrounded，
   * 由重甲兵近身解决（见 tourTargets：瘫在地上的目标仍在打击池里）。
   *
   * 用「每帧往下压」而不是接管它的运动控制器：生物各自的 update 还在跑，
   * 抢控制权会打架。这里只保证**高度**单调下降，落地即停。
   */
  function updateTranqFall(dt) {
    if (!st.tranqFall.length) return;
    for (let i = st.tranqFall.length - 1; i >= 0; i--) {
      const o = st.tranqFall[i];
      const u = o?.userData;
      if (!o?.parent || !u || u.dead) { st.tranqFall.splice(i, 1); continue; }
      o.getWorldPosition(_a1);
      const dir = _a2.copy(_a1).normalize();
      const ground = gh(dir);
      u.tranqFallV = Math.min(26, (u.tranqFallV || 0) + 18 * dt); // 加速下坠，封顶
      const next = Math.max(ground + 0.1, _a1.length() - u.tranqFallV * dt);
      // 世界坐标 → 父级局部（生物可能挂在某个 group 下）
      _a3.copy(dir).multiplyScalar(next);
      if (o.parent) o.parent.worldToLocal(_a3);
      o.position.copy(_a3);
      // 翻滚：坠落的姿态不该还是平飞
      o.rotation.z += dt * 2.6;
      if (next <= ground + 0.12) {
        u.tranqFalling = false;
        u.tranqGrounded = true;
        st.tranqFall.splice(i, 1);
      }
    }
  }""",
 "坠落推进 + 光晕"),

# tourTargets：把瘫在地上的也交给重甲兵
("""  function tourTargets() {
    return liveTargets();
  }""",
 """  /**
   * 交给重甲兵的打击池（saihojiPhalanx 喂给 updateVanguardCombat 的 soldiers）。
   *
   * 与 liveTargets() 的差别只有一条：**被麻醉打趴在地上的也算数**。
   * liveTargets 要把 downed 摘掉——不然泡机会对着一个已经躺平的目标继续倾泻麻醉弹；
   * 但主人的设定是「空中生物让泡机麻醉后坠地**解决**」，解决的是重甲兵。
   * 两个池子口径不同是有意的，不是漏筛。
   */
  function tourTargets() {""",
 "tourTargets 注释"),
])
print("D 完成")
