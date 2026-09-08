  function applySoldierDamage(s, kind) {
    if (!s || s.userData.dead) return;
    if (kind === "arrow") s.userData.arrowHits = (s.userData.arrowHits || 0) + 1;
    // vanguardBolt：先锋兵闪电枪光圈（主人 2026-09-05：2 枪毙命口径——
    // strikeLands 2 枪才报 1 次 wound，此处一次 wound 记 2 点近战 ≥ KILL_MELEE 即死）
    else s.userData.meleeHits = (s.userData.meleeHits || 0) + (kind === "pike" || kind === "vanguardBolt" ? 2 : 1);
    const ah = s.userData.arrowHits || 0;
    const mh = s.userData.meleeHits || 0;
    if (ah >= KILL_ARROW || mh >= KILL_MELEE) {
      s.userData.dead = true;
      s.userData.downed = true;
      s.userData._dieT = 3.7; // 躺 2.6s + 沉地 1.1s
      s.userData._fallT = 0; // 重新触发倒平动画（瘫倒→击杀会再倒到底）
    } else if (!s.userData.downed && (ah >= STAGGER_ARROW || mh >= STAGGER_MELEE)) {
      s.userData.downed = true; // 瘫倒
      s.userData._fallT = 0;
    }
    logEvent("hit", {
      uid: s.userData.uid ?? 0,
      side: s.userData.helmSide || (redSoldiers.includes(s) ? "red" : "blue"),
      kind,
      ah,
      mh,
      downed: !!s.userData.downed,
      dead: !!s.userData.dead,
    });
  }

