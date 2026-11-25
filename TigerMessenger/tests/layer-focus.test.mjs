// R21 直达入口：战役 / 山形 / 表现层三个专用管线在系统工坊顶部有自己的页签。
// 纯逻辑（layer-focus.js）+ 静态接线检查（pipeline.html / studio.css / system-tabs.js）。浏览器端到端见 layer-focus-browser.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FOCUS_LAYERS, resolveTab, sceneForFocus } from '../src/system-workshop/layer-focus.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('layer-focus: three focus layers, each bound to a real pane and supported scenes', () => {
  assert.deepEqual(Object.keys(FOCUS_LAYERS).sort(), ['battle', 'fx', 'mountain']);
  for (const [id, f] of Object.entries(FOCUS_LAYERS)) {
    assert.equal(f.pane, id + '-workshop');
    assert.ok(f.scenes.includes(f.prefer), id + ' prefer scene must be supported');
    assert.ok(f.title.endsWith('管线'));
  }
  assert.deepEqual(FOCUS_LAYERS.mountain.scenes, ['citadel']);
});

test('layer-focus: resolveTab maps focus names onto the scene tier', () => {
  assert.deepEqual(resolveTab('battle'), { tier: 'scene', focus: 'battle' });
  assert.deepEqual(resolveTab('mountain'), { tier: 'scene', focus: 'mountain' });
  assert.deepEqual(resolveTab('fx'), { tier: 'scene', focus: 'fx' });
  assert.deepEqual(resolveTab('planet'), { tier: 'planet', focus: null });
  assert.deepEqual(resolveTab('object'), { tier: 'object', focus: null });
  assert.deepEqual(resolveTab('scene'), { tier: 'scene', focus: null });
  assert.deepEqual(resolveTab('learning'), { tier: 'scene', focus: null });
  assert.deepEqual(resolveTab(''), { tier: 'scene', focus: null });
  assert.deepEqual(resolveTab('__proto__'), { tier: 'scene', focus: null });
});

test('layer-focus: sceneForFocus only switches when the current scene cannot run the layer', () => {
  const all = ['morris-lake', 'apostles', 'moss', 'citadel', 'bookshop'];
  assert.equal(sceneForFocus('battle', 'apostles', all), null);
  assert.equal(sceneForFocus('battle', 'citadel', all), null);
  assert.equal(sceneForFocus('battle', 'morris-lake', all), 'apostles');
  assert.equal(sceneForFocus('fx', 'morris-lake', all), 'apostles');
  assert.equal(sceneForFocus('mountain', 'apostles', all), 'citadel');
  assert.equal(sceneForFocus('mountain', 'citadel', all), null);
  // 首选场景不在列表里 → 退到别的支持场景；一个都没有 → undefined（页面给提示，不乱切）
  assert.equal(sceneForFocus('battle', 'morris-lake', ['morris-lake', 'moss']), 'moss');
  assert.equal(sceneForFocus('mountain', 'morris-lake', ['morris-lake', 'apostles']), undefined);
  assert.equal(sceneForFocus('nope', 'morris-lake', all), null);
});

test('layer-focus: pipeline.html has the three direct tabs in the sub-workshop tablist', () => {
  const html = read('pipeline.html');
  const nav = html.slice(html.indexOf('class="pipe-tabs"'), html.indexOf('</nav>', html.indexOf('class="pipe-tabs"')));
  for (const [id, label] of [['battle', '战役管线'], ['mountain', '山形管线'], ['fx', '表现层管线']]) {
    const m = nav.match(new RegExp('<button id="' + id + '-focus-tab"[^>]*role="tab"[^>]*>([^<]*)<'));
    assert.ok(m, id + ' tab missing');
    assert.ok(m[1].includes(label), id + ' tab label');
  }
});

test('layer-focus: focus mode hides the voxel pane and gives the focused pane a readable height', () => {
  const css = read('src/scene-authoring/studio.css');
  assert.match(css, /body\[data-layer-focus\] #scene-pane[^{]*\{[^}]*display:none!important/);
  for (const id of ['battle', 'mountain', 'fx']) {
    const rule = css.match(new RegExp('body\\[data-layer-focus=' + id + '\\] #' + id + '-workshop\\{([^}]*)\\}'));
    assert.ok(rule, id + ' focus rule missing');
    assert.match(rule[1], /display:grid!important/);
    const h = rule[1].match(/min-height:(\d+)vh/);
    assert.ok(h && Number(h[1]) >= 50, id + ' pane must be at least 50vh in focus mode');
  }
  // 非直达模式下面板也不能再是 176 px 的空条
  assert.match(css, /#battle-workshop,#mountain-workshop,#fx-workshop\{min-height:(\d+)px\}/);
  assert.ok(Number(css.match(/#battle-workshop,#mountain-workshop,#fx-workshop\{min-height:(\d+)px\}/)[1]) >= 360);
});

test('layer-focus: system-tabs wires focus tabs and exposes the focus to callers', () => {
  const js = read('src/system-workshop/system-tabs.js');
  assert.match(js, /from '\.\/layer-focus\.js/);
  assert.match(js, /dataset\.layerFocus/);
  assert.match(js, /onFocus/);
  const studio = read('src/scene-authoring/studio.js');
  assert.match(studio, /onFocus:/);
  assert.match(studio, /sceneForFocus\(/);
});
