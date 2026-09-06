# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/test_fleet_cohesion.mjs")
s = io.open(P, encoding="utf-8").read()
if "// ---------------------------------------------------------------- ⑦" in s:
    print("已存在"); raise SystemExit
tail = 'console.log("✅ test_fleet_cohesion'
i = s.index(tail)
add = '''// ---------------------------------------------------------------- ⑦
{
  // 撤离途中挨箭**不许**掉头重装填。红盔会一直朝天上放箭，原来每 3 秒就把
  // 整支登陆队弹回进场起点重来一遍，运输艇一波接一波开进来、永远撤不走
  // （主人 2026-09-05 第二张截屏）。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach"); runWhile(a, "insert"); runWhile(a, "combat");
  assert.equal(a.phase(), "withdraw", "守军已清 → 撤离");
  a.onFleetUnderAttack(w.defendersLive[0], w.hub.clone());
  assert.ok(["withdraw", "extract"].includes(a.phase()),
    `撤离途中受击后应继续撤离，实得 ${a.phase()}`);
  console.log("  ✓ ⑦ 撤离途中挨箭不重装填（不再无限刷运输艇）");
}

// ---------------------------------------------------------------- ⑧
{
  // 任务收尾后三台泡机必须回到僚机翼去伴飞。setupMission 会把它们
  // scene.attach 出来自己开，只还在 extract 末尾那一个出口上——任务一旦
  // 半途夭折就永远留在 scene 下，updateGatePodEscort 遍历 wing.children
  // 看不见它们，于是停在原地一动不动（主人：「别一直停在哪里，也去伴飞吧」）。
  const w = makeWorld({ defenders: 2 });
  const a = buildAssault(w);
  a.begin(w.hub);
  runWhile(a, "approach");
  // 任务中泡机确实被摘出僚机翼自己开
  assert.ok(w.pods.some((p) => p.parent !== w.wing), "任务期泡机应脱离僚机翼");
  runWhile(a, "insert"); runWhile(a, "combat"); runWhile(a, "withdraw"); runWhile(a, "extract");
  assert.equal(a.phase(), "done", "无巡演站 → 收队");
  a.update(0.25, 5000); // 收队后的第一帧兜底
  for (const p of w.pods) {
    assert.equal(p.parent, w.wing, `泡机 ${p.name} 收队后必须挂回僚机翼才会伴飞`);
  }
  console.log("  ✓ ⑧ 收队后泡机挂回僚机翼（恢复伴飞）");
}

'''
s = s[:i] + add + s[i:]
io.open(P, "w", encoding="utf-8").write(s)
print("已追加 ⑦⑧")
