# Flower craft longer voyages — first completed batch

Source ownership: only the navigation section of `src/world/swampFlowerActivities.js` and its existing verification script. No boat factory, ship, whale, tiger, character identity or material source was changed. Before source is in `source-before/swampFlowerActivities.js`.

The prior algorithm first tried only each raft's radial heading and only considered other headings after complete failure, with those fallback voyages capped at 1.5 inner amplitude. The first new greedy angle-first planner found much longer lanes for several boats but consumed the third boat's lane, leaving it invalid. That candidate was rejected, not shipped. `rejected-angle-greedy.json` preserves its exact chosen centres/headings, invalid route, rejected obstacle/neighbor/solid examples and candidate counts.

The production candidate establishes all five previously verified short lanes first. It then tries longer lanes at deterministic alternative headings, while reserving every other raft's full existing swept lane. Failed search leaves the previously valid lane intact. Acceptance preserves the same .05 residual gap threshold, .8 obstacle margin, .35 neighbor margin, and original whale/longship reservations. Lane candidates are checked at 31 equally spaced poses against the actual raft box envelopes and actual clipped root/wall triangles. The broad spatial rejection avoids testing faraway solid triangles. It searches once at build time, never per frame.

The original double-oar power integral, submerged power/raised recovery, two-second turning rests, 32.8-second continuous out-and-back loop and five/two/ten identities remain. There are still no dedicated underwater flower-craft stems.

## Actual formal CPU

`flower-navigation-cpu.json` is a fresh production seed7711, actual spherical placement and `departure=original` harbor test. All five valid routes preserve the existing identities and ten real oars. World endpoint distances measure 1.0 / 1.5 / 3.0 / 1.5 / 3.0 m, compared with 1.0 / 0.7 / 0.7 / 1.5 / 1.5 m before. Three craft travel farther; the root-constrained first and fourth craft retain their previous routes.

Navigation expansion search: 1199 ms once; total factory plus harbor build: 3580 ms on this CPU. Candidates tested: 42403. Actual path sample minimum conservative craft pair gap: 1.178 inner; new quay gap: 2.466 inner. Forty seconds at .05-second position steps verifies wrap/turn continuity and nonnegative power advancement; 2503 power samples and 944 simultaneous recovery samples pass. Real cliff/root versus craft envelopes are checked every .5 seconds.

No threshold was relaxed or object hidden to make the result pass. This is a small-lake protected rowing lane improvement, not a claim that all rafts now circulate around the entire lake. Geometry reservations remain conservative; longer shared passages would require coordinating traffic rather than removing the accepted safety margins.

## Validation boundary

New formal GPU review remains unavailable because the embedded-browser controller is missing. These are CPU positions and shape checks, not fresh in-game images or visual acceptance. No FPS improvement, 90-point score, commit, publication or external sharing is claimed. Prior optional proxy longboat mode clearance failure is not resolved by this batch; production main uses original ships.
