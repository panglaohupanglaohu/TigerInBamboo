// tools/test_lighting_k6.mjs — V5 光照 K6 单元验收（TODO 561 共享 uniforms + TODO 564 轮廓实验开关）
// 运行：node tools/test_lighting_k6.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shared = await import(
  new URL("../TigerMessenger/src/render/lighting/sharedStylizedUniforms.js", import.meta.url).href
);
const outline = await import(
  new URL("../TigerMessenger/src/render/lighting/outlineExperiments.js", import.meta.url).href
);
const { getSharedStylizedUniforms, applySharedUniformsToMaterialDesc, STYLIZED_UNIFORM_GROUPS } = shared;
const {
  OUTLINE_EXPERIMENTS,
  OUTLINE_EXPERIMENT_CLASSES,
  OUTLINE_EXPERIMENT_VARIANTS,
  validateOutlineExperiments,
  createOutlineExperimentConfig,
  isOutlineExperimentEnabled,
} = outline;

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

// ---------- TODO 561：共享 stylized lighting uniforms ----------

ok("六组齐备：direct/shadow/skyGround/ao/bounce/emissive", () => {
  assert.deepEqual([...STYLIZED_UNIFORM_GROUPS], ["direct", "shadow", "skyGround", "ao", "bounce", "emissive"]);
  const s = getSharedStylizedUniforms();
  for (const g of STYLIZED_UNIFORM_GROUPS) {
    assert.ok(s.groups[g] && typeof s.groups[g] === "object", `missing group ${g}`);
    assert.ok(Object.keys(s.groups[g]).length > 0, `empty group ${g}`);
  }
});

ok("幂等：两次获取返回同一引用（不是 clone）", () => {
  const a = getSharedStylizedUniforms();
  const b = getSharedStylizedUniforms();
  assert.equal(a, b);
  assert.equal(a.groups.ao, b.groups.ao);
  assert.equal(a.uniforms.uSunColor, b.uniforms.uSunColor);
});

ok("拍平视图与分组视图共享同一批 uniform 记录", () => {
  const s = getSharedStylizedUniforms();
  for (const g of STYLIZED_UNIFORM_GROUPS) {
    for (const [name, rec] of Object.entries(s.groups[g])) {
      assert.equal(s.uniforms[name], rec, `uniforms.${name} 应与 groups.${g}.${name} 同引用`);
    }
  }
});

ok("两个材质 desc 共享同一 uniform 对象（引用合并，非拷贝）", () => {
  const descA = applySharedUniformsToMaterialDesc({ name: "castle-wall" });
  const descB = applySharedUniformsToMaterialDesc({ name: "soldier-body" });
  const s = getSharedStylizedUniforms();
  assert.equal(descA.uniforms.uSunDirection, descB.uniforms.uSunDirection);
  assert.equal(descA.uniforms.uSunDirection, s.uniforms.uSunDirection);
  assert.equal(descA.uniforms.tVoxelAoAtlas, descB.uniforms.tVoxelAoAtlas);
  assert.equal(descA.uniforms.uBounceIntensity, descB.uniforms.uBounceIntensity);
  assert.equal(descA.uniforms.uEmissiveBoost, descB.uniforms.uEmissiveBoost);
});

ok("纯函数：不修改入参 desc，返回新对象", () => {
  const own = { uCustom: { value: 1 } };
  const desc = Object.freeze({ name: "roof", uniforms: Object.freeze(own) });
  const out = applySharedUniformsToMaterialDesc(desc);
  assert.notEqual(out, desc);
  assert.deepEqual(Object.keys(own), ["uCustom"]); // 入参 uniforms 未被并入共享键
  assert.equal(desc.name, "roof");
  assert.equal(out.uniforms.uCustom, own.uCustom); // 自带 uniform 也按引用保留
});

ok("材质自带同名 uniform 优先（刻意覆盖即断开共享）", () => {
  const mine = { value: 9.9 };
  const out = applySharedUniformsToMaterialDesc({ uniforms: { uSunIntensity: mine } });
  assert.equal(out.uniforms.uSunIntensity, mine);
  assert.notEqual(out.uniforms.uSunIntensity, getSharedStylizedUniforms().uniforms.uSunIntensity);
  // 其余组仍共享
  assert.equal(out.uniforms.uSkyColor, getSharedStylizedUniforms().uniforms.uSkyColor);
});

ok("组子集选项 + 非法组名报错", () => {
  const out = applySharedUniformsToMaterialDesc({ name: "x" }, { groups: ["direct"] });
  assert.ok(out.uniforms.uSunDirection);
  assert.equal(out.uniforms.uVoxelAoStrength, undefined);
  assert.throws(() => applySharedUniformsToMaterialDesc({}, { groups: ["nope"] }), /unknown stylized uniform group/);
});

ok("容器冻结防增删键；uniform 记录保持可写（宿主每帧写 .value）", () => {
  const s = getSharedStylizedUniforms();
  assert.ok(Object.isFrozen(s.groups));
  assert.ok(Object.isFrozen(s.groups.direct));
  assert.ok(Object.isFrozen(s.uniforms));
  assert.throws(() => {
    s.groups.direct.uNewKey = { value: 1 };
  }, TypeError);
  // 记录可写：写一次再写回，证明浅引用通路存在
  const rec = s.uniforms.uSunIntensity;
  const prev = rec.value;
  rec.value = 0.42;
  assert.equal(getSharedStylizedUniforms().uniforms.uSunIntensity.value, 0.42);
  rec.value = prev;
});

ok("AO 组命名与 voxelAoRenderer 注入层逐名对齐", () => {
  const src = readFileSync(
    new URL("../TigerMessenger/src/render/ao/voxelAoRenderer.js", import.meta.url),
    "utf8"
  );
  const s = getSharedStylizedUniforms();
  for (const name of Object.keys(s.groups.ao)) {
    assert.ok(src.includes(name), `voxelAoRenderer 未出现共享 AO uniform 名：${name}`);
  }
});

ok("bounce 默认关闭且强度为 0（K5 默认关）", () => {
  const s = getSharedStylizedUniforms();
  assert.equal(s.uniforms.uBounceEnabled.value, 0);
  assert.equal(s.uniforms.uBounceIntensity.value, 0);
  assert.equal(s.uniforms.uBounceMix.value, 0);
});

// ---------- TODO 564：轮廓实验开关 ----------

ok("出厂配置：4 类 × 2 版全部默认关闭", () => {
  assert.deepEqual([...OUTLINE_EXPERIMENT_CLASSES], ["grass", "roof", "steps", "soldier"]);
  assert.deepEqual([...OUTLINE_EXPERIMENT_VARIANTS], ["background-contrast", "depth"]);
  assert.equal(validateOutlineExperiments(OUTLINE_EXPERIMENTS).ok, true);
  for (const cls of OUTLINE_EXPERIMENT_CLASSES) {
    for (const variant of OUTLINE_EXPERIMENT_VARIANTS) {
      assert.equal(OUTLINE_EXPERIMENTS[cls][variant].enabled, false, `${cls}/${variant} 应默认关`);
      assert.ok(OUTLINE_EXPERIMENTS[cls][variant].internalEdge <= OUTLINE_EXPERIMENTS[cls][variant].silhouetteEdge);
    }
  }
});

ok("校验：未知类/版、非布尔 enabled、越界强度、内部强于轮廓 均被拒", () => {
  const base = createOutlineExperimentConfig();
  const bad1 = structuredClone(base);
  bad1.roof.depth.enabled = "yes";
  assert.equal(validateOutlineExperiments(bad1).ok, false);
  const bad2 = structuredClone(base);
  bad2.grass["background-contrast"].internalEdge = 1.2;
  assert.equal(validateOutlineExperiments(bad2).ok, false);
  const bad3 = structuredClone(base);
  bad3.soldier.depth.internalEdge = 0.9;
  bad3.soldier.depth.silhouetteEdge = 0.2;
  assert.equal(validateOutlineExperiments(bad3).ok, false);
  assert.throws(() => createOutlineExperimentConfig({ tree: {} }), /unknown outline experiment class/);
});

ok("override 深合并：只开一个单元格，其余仍关；出厂配置不被污染", () => {
  const cfg = createOutlineExperimentConfig({ roof: { depth: { enabled: true } } });
  assert.equal(isOutlineExperimentEnabled(cfg, "roof", "depth"), true);
  assert.equal(isOutlineExperimentEnabled(cfg, "roof", "background-contrast"), false);
  assert.equal(isOutlineExperimentEnabled(cfg, "grass", "depth"), false);
  assert.equal(isOutlineExperimentEnabled(OUTLINE_EXPERIMENTS, "roof", "depth"), false);
  assert.equal(isOutlineExperimentEnabled(cfg, "nope", "depth"), false);
  assert.ok(Object.isFrozen(cfg.roof.depth));
});

console.log(`✅ V5 K6 shared uniforms / outline experiments assertions groups=${passed}`);

ok("双重遮蔽守卫（K6-562）：aoMap/烘焙遮蔽材质不注入 voxel AO", async () => {
  const { INJECTABLE } = await import(
    new URL("../TigerMessenger/src/render/ao/voxelAoRenderer.js", import.meta.url).href
  );
  const toon = { isMeshToonMaterial: true, userData: {} };
  assert.equal(INJECTABLE(toon), true, "普通 Toon 材质可注入");
  assert.ok(!INJECTABLE({ ...toon, aoMap: {} }), "带 aoMap 的材质跳过（防遮蔽重复相乘）");
  assert.ok(!INJECTABLE({ isMeshToonMaterial: true, userData: { bakedOcclusion: true } }), "显式烘焙遮蔽标记跳过");
  assert.ok(!INJECTABLE({ isMeshBasicMaterial: true, userData: {} }), "非受光材质不注入");
  // 顶点色在本项目是 albedo 手绘色块而非遮蔽：不禁入
  assert.equal(INJECTABLE({ isMeshToonMaterial: true, vertexColors: true, userData: {} }), true);
});
