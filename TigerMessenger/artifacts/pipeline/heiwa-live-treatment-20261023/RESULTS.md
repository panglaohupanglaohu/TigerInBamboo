# Heiwa bedside correction — 2026-10-23

User actual-game screenshot shows patients but no Heiwa. Previous fixture manually interpolated healer position, hiding production ownership problems. Do not reuse that as actual game acceptance.

Changes: original child marked as dynamic agent and mesh subtree excluded from static distance culling; medical controller now moves original child at 2.4 local units/sec and owns limb/standing pose; ambient swim yields during medical ownership. Each patient requires arrival within .35 local units and 24sec at bedside. New normal UI camera “查看黑娃救治” observes actual child; medical snapshot reports original UUID/position/target/visible meshes. No duplicate healer or soldiers.

10 relevant tests pass, including sequential recovery without manually positioning healer. Independent GPU component recovered 2/2 and returned 2/2 using controller only. Formal full-game visual still in progress; not equivalent to component proof.

JEV compact text called in jev.json. No commit or publication.

## Final normal game verification

New exact source at normal entry: all18 original casualties transported by3existing carriers; original Heiwa UUID4280dce8-8e4e-4add-9a94-74167af19dc0 reached new bedside [3.6,25.35,-10.9] exactly,10mesh parts visible. Actual raised-arm child is visible at center beside beds; old warship no longer blocks bedside. Other lake boats may pass through the foreground. First casualty healed; remaining treatment queue ongoing, not a claim all18returned. Snapshot normal-bedside.json and current normal-bedside.png. Error log empty. Observer camera parent-frame up stable in this final run. Normal tab retained at Heiwa view.

Normal shield/gun evidence separately saved under heavy-tactics-20261023: actual rectangular cyan shields visible, counters59blocks47bursts in sweep; this final sortie ended68blocks49bursts. No normal sword hit observed (0); measured blade collision is tested but that full-game visual remains unverified. Final relevant tests10/10.
