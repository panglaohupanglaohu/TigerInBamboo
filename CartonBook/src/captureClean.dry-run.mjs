#!/usr/bin/env node
/**
 * Dry-run / unit check for capture-clean + crop (no browser, no T2I).
 * node src/captureClean.dry-run.mjs
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_CROP_INSET,
  resolveCropRect,
  resolvePlaywright,
} from './captureShots.mjs';

const vp = { width: 1280, height: 800 };
const crop = resolveCropRect(vp, null, DEFAULT_CROP_INSET);
assert.equal(crop.x, Math.round(1280 * 0.04));
assert.equal(crop.y, Math.round(800 * 0.06));
assert.ok(crop.width < vp.width && crop.height < vp.height);

const custom = resolveCropRect(vp, { x: 100, y: 80, width: 900, height: 600 }, null);
assert.deepEqual(custom, { x: 100, y: 80, width: 900, height: 600 });

const pw = await resolvePlaywright();
console.log('[dry-run] DEFAULT_CROP_INSET', DEFAULT_CROP_INSET);
console.log('[dry-run] safe crop @1280x800', crop);
console.log('[dry-run] playwright', pw?.chromium ? 'available' : 'missing (live capture skipped)');
console.log('[dry-run] API: ?cartonCapture=1 | __tm.setCaptureMode(true)');
console.log('[dry-run] prefer strategy 1 (capture-clean); strategy 2 = --crop / CARTONBOOK_CROP=1');
console.log('[dry-run] OK');
