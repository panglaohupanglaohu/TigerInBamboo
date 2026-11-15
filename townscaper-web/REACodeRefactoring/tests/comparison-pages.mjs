import assert from 'node:assert/strict';import fs from 'node:fs';
import {COMPARISON_PAGES,comparisonSelection,comparisonPage} from '../src/tools/comparison-pages.js';
assert.deepEqual(comparisonSelection('?left=fire&right=perspective'),{left:'fire',right:'perspective'});assert.deepEqual(comparisonSelection('?left=https://invalid.example&right=missing'),{left:'original',right:'fusion'});assert.throws(()=>comparisonPage('missing'));
for(const row of COMPARISON_PAGES){const target=new URL('../'+row.path.split('?')[0],import.meta.url);assert.ok(fs.existsSync(target),row.path);}
console.log('PASS comparison page selection, whitelist, original reference and actual target files');
