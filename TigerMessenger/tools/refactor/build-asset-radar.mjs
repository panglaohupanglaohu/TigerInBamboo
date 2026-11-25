#!/usr/bin/env node
/**
 * build-asset-radar.mjs — 读取资产表 + system-catalog + capability-maturity + 可选 JEV 研判结果，
 * 生成 TigerMessenger/src/scene-authoring/catalog/asset-capability-radar.json。
 *
 * 运行目录：TigerMessenger/
 *   $NODE tools/refactor/build-asset-radar.mjs [--jev-discovery <file>] [--jev-categories <file>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildAssetCapabilityRadar } from '../../src/system-workshop/asset-capability-scout.js';

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const readJson = (p) => { try { return p && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; } catch { return null; } };

const root = process.cwd();
const inventory = readJson(path.join(root, 'assets/models/inventory.json')) || { sources: [] };
const catalog = readJson(path.join(root, 'src/scene-authoring/catalog/system-catalog.json')) || { alignment: [] };
const maturity = readJson(path.join(root, 'src/scene-authoring/catalog/capability-maturity.json')) || { rows: [] };
const jevDiscovery = readJson(arg('--jev-discovery') || path.join(root, 'artifacts/pipeline/jev/asset-scout-discovery.json'));
const jevCategories = readJson(arg('--jev-categories') || path.join(root, 'artifacts/pipeline/jev/asset-scout-categories.json'));

const radar = buildAssetCapabilityRadar({
  inventory,
  alignment: catalog.alignment || [],
  maturityRows: maturity.rows || [],
  jevDiscovery,
  jevCategories,
  topN: 30,
});

const outPath = path.join(root, 'src/scene-authoring/catalog/asset-capability-radar.json');
fs.writeFileSync(outPath, JSON.stringify(radar, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ out: outPath, summary: radar.summary }, null, 2));
