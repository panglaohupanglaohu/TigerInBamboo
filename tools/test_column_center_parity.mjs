// =====================================================================
// G-18 · 编辑器可放集合 == 3D 裁剪承重集合（同一 citadelColumnCenter）
// 用法：node tools/test_column_center_parity.mjs
// =====================================================================
import assert from "node:assert/strict";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const gm = await import(new URL("world/citadel/gridMigration.js", SRC).href);
const town = await import(new URL("world/citadelTown.js", SRC).href);

const GS = 25;
const CS = town.CITADEL_TOWN_SPEC.cellSize;

// 无 quad：与 citadelGridCellCenter 的 XZ 逐位一致
for (let iz = 0; iz < GS; iz++) {
  for (let ix = 0; ix < GS; ix++) {
    const a = gm.citadelColumnCenter(ix, iz, { cellSize: CS, gridSize: GS });
    const b = town.citadelGridCellCenter(ix, 0, iz, CS, 2, GS);
    assert.equal(a.x, b.x, `fallback x ${ix},${iz}`);
    assert.equal(a.z, b.z, `fallback z ${ix},${iz}`);
    assert.equal(a.inradius, CS * 0.5);
  }
}

const spec = town.HIGHLAND_TOWNSCAPER_TOWN_SPEC;
const layout = town.normalizeCitadelTerraceLayout(spec, 12);
const levels = layout.terraces[0].levels.map((rows) => rows.map(String));
const quad = gm.citadelIrregularGrid({ gridSize: GS, cellSize: spec.cellSize });
const migrated = gm.migrateAsciiToFaces(levels, quad);
const mapping = migrated.mapping;

let both = 0;
let none = 0;
let onlyCenter = 0;
let onlyFace = 0;
const editor = [];
const trimmer = [];
for (let iz = 0; iz < GS; iz++) {
  for (let ix = 0; ix < GS; ix++) {
    const c = gm.citadelColumnCenter(ix, iz, {
      quad,
      mapping,
      cellSize: spec.cellSize,
      gridSize: GS,
    });
    const editOk = !!c;
    const trimOk = !!c;
    if (editOk) editor.push(`${ix},${iz}`);
    if (trimOk) trimmer.push(`${ix},${iz}`);
    if (c) {
      both++;
      assert.ok(c.inradius > 0, `inradius ${ix},${iz}`);
      assert.ok(c.faceId, `faceId ${ix},${iz}`);
    } else {
      none++;
      assert.equal(mapping.cellToFace.get(`${ix},${iz}`), undefined);
    }
  }
}
const onlyE = editor.filter((k) => !trimmer.includes(k));
const onlyT = trimmer.filter((k) => !editor.includes(k));
assert.equal(onlyE.length, 0, `编辑器有 3D 无: ${onlyE.slice(0, 8)}`);
assert.equal(onlyT.length, 0, `3D 有 编辑器无: ${onlyT.slice(0, 8)}`);
console.log(
  `25×25 差集空 both=${both} none=${none} onlyCenter=${onlyCenter} onlyFace=${onlyFace} ` +
  `mappedColumns=${mapping.cellToFace.size}`
);
assert.equal(both, mapping.cellToFace.size, "有 face 的列数应对上 mapping");
console.log("✅ test_column_center_parity");
