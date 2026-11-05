import {test} from 'node:test';
import assert from 'node:assert/strict';

test('CAPTURE_HIDE_SELECTORS covers play HUD + story harness + dock', async () => {
  const oldLocation = globalThis.location;
  const oldStorage = globalThis.localStorage;
  try {
    globalThis.localStorage = { getItem: () => '{}', setItem() {} };
    globalThis.location = {
      hostname: 'localhost',
      pathname: '/TigerMessenger/',
      search: '',
    };
    const ui = await import('../src/ui/uiLayers.js?capture-clean-selectors=1');
    for (const sel of [
      '#hud',
      '#quest-panel',
      '#minimap-panel',
      '#controls-dock',
      '#shot-harness-panel',
      '#storyboard-panel',
      '#tm-ui-dock',
      '#npc-hint',
      '#bubble',
      '#tm-perf-probe',
      '#touch-toggle',
      '#touch-toggle-slot',
      '#touch-controls',
      '#tram-hint',
      '#airship-hint',
      '#scout-hint',
      '#elder-hint',
      '#fox-hint',
      '#bubble-hint',
      '#boat-hint',
      '#bubble-crosshair',
      '#dive-tint',
      '#minimap-panel',
      '#quest-panel',
      '#hint-panel',
      '#rescue-campaign',
    ]) {
      assert.ok(
        ui.CAPTURE_HIDE_SELECTORS.includes(sel),
        `missing ${sel} in CAPTURE_HIDE_SELECTORS`
      );
    }
    for (const sel of ui.PLAY_SELECTORS) {
      assert.ok(
        ui.CAPTURE_HIDE_SELECTORS.includes(sel),
        `PLAY selector ${sel} must be in CAPTURE_HIDE_SELECTORS`
      );
    }
  } finally {
    globalThis.location = oldLocation;
    globalThis.localStorage = oldStorage;
  }
});

test('?cartonCapture=1 arms captureMode; setCaptureMode toggles tm-capture-clean', async () => {
  const oldLocation = globalThis.location;
  const oldStorage = globalThis.localStorage;
  const oldDocument = globalThis.document;
  try {
    globalThis.localStorage = { getItem: () => '{}', setItem() {} };
    globalThis.location = {
      hostname: '127.0.0.1',
      pathname: '/TigerMessenger/',
      search: '?cartonCapture=1&autostart=1',
    };
    const classList = {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, on) {
        if (on === false) this._set.delete(c);
        else if (on === true) this._set.add(c);
        else if (this._set.has(c)) this._set.delete(c);
        else this._set.add(c);
        return this._set.has(c);
      },
      contains(c) { return this._set.has(c); },
    };
    const root = {
      classList,
      dataset: {},
      style: {},
    };
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
    };
    globalThis.document = {
      documentElement: root,
      head: { append() {} },
      body: {
        append() {},
        nodeType: 1,
        matches() { return false; },
        querySelectorAll() { return []; },
      },
      createElement(tag) {
        return {
          tagName: tag.toUpperCase(),
          id: '',
          className: '',
          style: {},
          hidden: false,
          textContent: '',
          innerHTML: '',
          title: '',
          type: '',
          append(...nodes) { this._kids = nodes; },
          addEventListener() {},
          querySelector() { return null; },
          querySelectorAll() { return []; },
          classList: {
            toggle() {},
          },
        };
      },
      addEventListener() {},
    };
    const ui = await import('../src/ui/uiLayers.js?capture-clean-flag=1');
    assert.equal(ui.isCaptureMode(), true);
    assert.equal(ui.uiLayersState().captureMode, true);
    // Minimal DOM install so class toggle runs
    ui.installUiLayers();
    assert.ok(root.classList.contains('tm-capture-clean'));
    const off = ui.setCaptureMode(false);
    assert.equal(off.captureMode, false);
    assert.ok(!root.classList.contains('tm-capture-clean'));
    const on = ui.setCaptureMode(true);
    assert.equal(on.captureMode, true);
    assert.ok(Array.isArray(on.hiddenSelectors) && on.hiddenSelectors.length > 10);
    assert.ok(root.classList.contains('tm-capture-clean'));
  } finally {
    globalThis.location = oldLocation;
    globalThis.localStorage = oldStorage;
    globalThis.document = oldDocument;
  }
});
