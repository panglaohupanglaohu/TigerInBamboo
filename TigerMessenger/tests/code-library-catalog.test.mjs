import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {scanCodeLibrary} from '../tools/refactor/scan-code-library.mjs';
import {buildCodeCatalog} from '../src/system-workshop/code-library-catalog.js';
test('parser reads real exports and imports without executing source or comment examples',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'source-library-'));
 try{const dir=path.join(root,'townscaper-web/REACodeRefactoring/src/core');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(path.join(root,'townscaper-web/REACode/src'),{recursive:true});
 fs.writeFileSync(path.join(dir,'world.js'),`// export function fake() {}\nthrow Error('MUST NOT EXECUTE');\nexport {foo as actual} from './helper.js'; export default 2;`);
 fs.writeFileSync(path.join(dir,'helper.js'),'export const foo=3;');fs.writeFileSync(path.join(root,'townscaper-web/REACode/src/world.js'),'export const legacy=1;');
 const manifest=await scanCodeLibrary({root});assert.equal(manifest.counts.sourceModules,2);const world=manifest.modules.find(m=>m.path.endsWith('/world.js'));assert.deepEqual(world.exports,['actual','default']);assert.equal(world.dependencies[0].path,'src/core/helper.js');assert.equal(world.dependencies[0].exists,true);assert.equal(manifest.alignment[0].status,'requires-parity-review');assert.deepEqual(manifest.alignment[0].unmatchedExports,['legacy']);assert.equal(fs.readFileSync(path.join(root,'townscaper-web/REACode/src/world.js'),'utf8'),'export const legacy=1;');
 const catalog=buildCodeCatalog(manifest);const rows=catalog.workshops.flatMap(w=>w.domains.flatMap(d=>d.nodes));assert.equal(rows.length,2);assert.ok(rows.every(n=>n.exec==='library'&&n.code.length===0));assert.deepEqual(catalog.combinations[0].moduleOrder,['src/core/helper.js','src/core/world.js']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('physical inventory preserves every module once, videos separately and no automatic executable promotion',async()=>{
 const manifest=await scanCodeLibrary();const catalog=buildCodeCatalog(manifest,{learningCatalog:{workshops:[{id:'legacy-video'}]},codeCaps:[{id:'adapter'}]});
 const rows=catalog.workshops.flatMap(w=>w.domains.flatMap(d=>d.nodes));assert.equal(new Set(rows.map(n=>n.id)).size,manifest.modules.length);assert.equal(rows.length,manifest.modules.length);assert.equal(catalog.learningMethods[0].id,'legacy-video');assert.ok(catalog.workshops.find(w=>w.id==='scene').domains.find(d=>d.id==='terrain').nodes.some(n=>n.module.directory==='terrain'));assert.ok(catalog.combinations.every(c=>c.moduleOrder.every(p=>manifest.modules.some(m=>m.path===p))));
 assert.throws(()=>buildCodeCatalog({...manifest,modules:[{...manifest.modules[0],path:'src/../../escape.js'}]}));assert.throws(()=>buildCodeCatalog({...manifest,modules:[manifest.modules[0],manifest.modules[0]]}));
});

test('library dependencies link only explicit implemented adapters, with palette before contrast',async()=>{
 const manifest=await scanCodeLibrary();const {describeGsceneCapabilities}=await import('../src/system-workshop/gscene/capabilities.js');const catalog=buildCodeCatalog(manifest,{executionAdapters:describeGsceneCapabilities()});const style=catalog.combinations.find(c=>c.id==='library-combination:style');assert.deepEqual(style.adapted.map(a=>a.id),['scene.oklab-palette','scene.oklab-contrast']);assert.equal(style.execution,'adapter-required');assert.ok(catalog.modules.find(m=>m.path==='src/core/oklab.js').adapters.length===2);
});
