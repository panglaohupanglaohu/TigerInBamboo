# East final terrain transaction — default off

`src/world/citadel/targetEastCliffTerrainTransaction.js` owns only its candidate geometry. It preserves the actual terrain Mesh identity, original geometry and material. Strict source hash/frame validation uses the existing preview helper; artifact origin is transformed back into the real source frame. An index is built against candidate geometry plus all supplied surfaces before source mutation.

Call `prepareEastCliffTerrainTransaction({enabled:true,castle,sourceMesh,surfaces,artifact})`. Supply all actual mountain surfaces. `apply({consumers})` requires named navigation, vegetation, foundations and clouds functions. Each prepares synchronously using `{sourceMesh,geometry,surfaceIndex}` and returns synchronous `commit()` and `rollback()`. Missing participants, changed sources, asynchronous handles or failed commits reject the swap and roll back prepared consumers. Real participant adapters still need implementation; no no-op bindings should be used to claim installation.

`dispose()` reverses a committed swap and disposes only owned geometry. Snapshot ray hits and accept filters retain the actual source Mesh identity. Other indexed surface edits invalidate the snapshot. Consumers must still rebuild after other unsupported mutations such as material-side or draw-range changes; this is not a general live index observer.

Five lifecycle/atomic rollback tests passed via `node --test tests/world/targetEastCliffTerrainTransaction.test.mjs`. No production caller or GPU test yet. Route, bridge support, vegetation readiness and real navigation/actors remain separate prerequisites. Never interpret report.indexRebuilt as gameplay acceptance.
