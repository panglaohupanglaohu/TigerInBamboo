// 1593215065423245313：ImpostorBaker 自动扩容/重排（REACode SpriteAtlas.insert「满了翻倍、全部重插」语义，
// atlas.repack 同序）+ GPU 侧 rt/rt.texture 原位放大、逐槽像素搬运、存活 frames 就地改写、注册 Field
// syncFrames、两类失败回滚（maxSize 封顶 / 搬运中途 GPU 异常）。
// Node 侧用 mock renderer：UV/槽位/调用序列全测；真实像素逐位一致由 tests/atlas-live-browser.cjs
// 在真 GPU 上验收（512→1024 扩容后存活槽像素 hash 不变）。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const el = () => ({ style: {}, appendChild() {}, remove() {}, addEventListener() {}, getContext: () => null, width: 0, height: 0 });
globalThis.document = new Proxy({ createElement: el, body: el(), createElementNS: el, getElementById: () => el() }, { get: (t, k) => k in t ? t[k] : () => el() });
const THREE = await import('three');
const { ImpostorBaker, ImpostorField } = await import('../src/life/impostor.js');

const calls = [];
let curTarget = null, failBlitWidth = 0;   // 下一个打到该宽度 target 的 blit render 抛一次
const renderer = {
  setRenderTarget(t) { curTarget = t; }, getRenderTarget: () => curTarget,
  getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
  getClearColor: (c) => c, getClearAlpha: () => 1, setClearColor() {},
  clear() { calls.push({ clear: curTarget && curTarget.width }); },
  render(scene, cam) {
    if (scene?.userData?.atlasBlit) {
      calls.push({ blit: true, tw: curTarget && curTarget.width });
      if (failBlitWidth === curTarget.width) { failBlitWidth = 0; throw new Error('GPU copy failed'); }
    }
  },
};
const geo = new THREE.IcosahedronGeometry(.5, 1);
const rectsOf = (b, S) => { const o = []; for (let i = 0; i < b.frames.length; i += 4) o.push({ x: b.frames[i] * S, y: b.frames[i + 1] * S, w: b.frames[i + 2] * S, h: b.frames[i + 3] * S }); return o; };
const disjoint = (a, b) => a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9;

// ── 1. 扩容触发 + rt/texture 身份不变 + 逐槽搬运 ─────────────────────────────
const baker = new ImpostorBaker(renderer, 256, { maxSize: 1024 });
assert.throws(() => new ImpostorBaker(renderer, 256, { maxSize: 128 }), /maxSize/);
const rt0 = baker.rt, tex0 = baker.rt.texture;
// 72² extent（CELL 56 + 16 padding）：256² 放得下 8 个放不下 16 个
const one = baker.bake(geo, 56);
assert.equal(baker.size, 256); assert.equal(baker.growths, 0);
const field = new ImpostorField(baker.rt.texture, one, 4, { baker });   // 注册消费方
const framesBefore = [...one.frames];
calls.length = 0;
const two = baker.bake(geo, 56);                                        // 触发 256→512
assert.equal(baker.size, 512); assert.equal(baker.growths, 1);
assert.equal(baker.rt, rt0, 'rt 对象原位放大'); assert.equal(baker.rt.texture, tex0, 'texture 对象不变→uTex/map 不用重绑');
assert.equal(baker.rt.width, 512);
// GPU 调用序列：1 次整页备份到 256 scratch + 8 次逐槽拷进 512
assert.equal(calls.filter(c => c.blit && c.tw === 256).length, 1, '旧页整页备份');
assert.equal(calls.filter(c => c.blit && c.tw === 512).length, 8, '8 个存活槽逐槽搬运');
// 存活 UV：就地改写、全部落在 56² 新位置、与第二批互不重叠
assert.notDeepEqual([...one.frames], framesBefore, '重排后 frames 已更新');
const R = [...rectsOf(one, 512), ...rectsOf(two, 512)];
for (const r of R) { assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 512 && r.y + r.h <= 512); assert.ok(Math.abs(r.w - 56) < 1e-6 && Math.abs(r.h - 56) < 1e-6); }
for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) assert.ok(disjoint(R[i], R[j]), 'frames overlap');
// frames ↔ 图集真实槽位一一对应（frame 内缩 8px pad，槽 = extent 72²）
const atlasRects = baker.atlas.rects();
for (const r of R) assert.ok(atlasRects.some(s => s.x === r.x - 8 && s.y === r.y - 8 && s.w === 72 && s.h === 72), 'frame misses its atlas slot');
// 注册 Field 的 uFrames 已同步到新 UV；uTex 仍指向同一张纹理
for (let i = 0; i < 8; i++) assert.deepEqual(field.material.uniforms.uFrames.value[i].toArray(), [...one.frames.slice(i * 4, i * 4 + 4)]);
assert.equal(field.material.uniforms.uTex.value, tex0);
// 扩容后再扩容 + 释放走新槽位
let extra = 0; while (baker.size === 512 && extra++ < 40) baker.bake(geo, 56);
assert.equal(baker.size, 1024, '512 满后继续翻倍'); assert.ok(baker.growths >= 2);
for (let i = 0; i < 8; i++) assert.deepEqual(field.material.uniforms.uFrames.value[i].toArray(), [...one.frames.slice(i * 4, i * 4 + 4)]);
const liveRects = baker.atlas.rects().length;
assert.ok(baker.release(one)); assert.equal(baker.atlas.rects().length, liveRects - 8, '重排后的新槽位被正确释放');
assert.equal(baker.release(one), false);
for (let i = 0; i < baker.atlas.rects().length; i++) for (let j = i + 1; j < baker.atlas.rects().length; j++) assert.ok(disjoint(baker.atlas.rects()[i], baker.atlas.rects()[j]));

// ── 2. 回滚 A：maxSize 封顶 → 抛错且状态=扩容前 ────────────────────────────
const capped = new ImpostorBaker(renderer, 256, { maxSize: 512 });
const first = capped.bake(geo, 56);                   // 第 1 组成功（8 槽）
let threw = null, ok = 1;                            // ok = 成功组数
try { for (; ; ok++) capped.bake(geo, 56); } catch (e) { threw = e; }
assert.match(threw.message, /图集满了/);
assert.equal(capped.size, 512); assert.equal(capped.growths, 1, '只成功扩过一次');
assert.equal(capped.atlas.rects().length, ok * 8, '槽数=成功组×8，失败组部分预留全数归还');
assert.equal(capped.atlas.report().usedArea, ok * 8 * 72 * 72);
for (let i = 0; i < ok * 8; i++) for (let j = i + 1; j < ok * 8; j++) assert.ok(disjoint(capped.atlas.rects()[i], capped.atlas.rects()[j]));
assert.ok(capped.release(first));

// ── 3. 回滚 B：搬运中途 GPU 异常 → 抛错、bookkeeping 不动、尽力复原旧纹理 ──
const b2 = new ImpostorBaker(renderer, 256, { maxSize: 1024 });
const keep = b2.bake(geo, 56);
const keepFrames = [...keep.frames];
calls.length = 0; failBlitWidth = 512;              // scratch 备份(256)成功后，第一次拷进新页就抛
assert.throws(() => b2.bake(geo, 56), /GPU copy failed/);
assert.equal(b2.size, 256); assert.equal(b2.rt.width, 256, 'rt 尽力缩回原尺寸');
assert.equal(b2.growths, 0); assert.equal(b2.atlas.rects().length, 8, '图集与新组预留均无残留');
assert.deepEqual([...keep.frames], keepFrames, 'frames 未提交');
// 复原路径跑过：整页备份 1 次 + 按旧位置拷回 8 次（全部打 256 目标）
assert.equal(calls.filter(c => c.blit && c.tw === 256).length, 9, '备份+8槽复原拷贝');
assert.ok(b2.release(keep));

// ── 4. 扩容发生在第一组烘焙（空图集放不下整组时跳像素搬运快路径）───────────
calls.length = 0;
const tight = new ImpostorBaker(renderer, 128, { maxSize: 1024 });
tight.bake(geo, 96);                                 // 112²×8：128² 放1个、256² 放4个 → 连扩两级到 512
assert.equal(tight.size, 512); assert.equal(tight.growths, 2, 'REACode 式反复翻倍直到整组放得下');
assert.equal(calls.filter(c => c.blit).length, 0, '无存活精灵时跳过像素搬运');
assert.equal(tight.atlas.rects().length, 8);

console.log('PASS impostor-grow: 256→512→1024 自动扩容（rt/texture 身份不变）、9 次 blit 调用序列、',
  '存活 frames 就地改写+Field 同步、maxSize 封顶回滚、GPU 搬运失败尽力复原回滚（真实像素对拍 NOT_RUN）');
