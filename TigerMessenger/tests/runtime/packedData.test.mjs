import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {loadPackedData} from '../../runtime/packedData.js';
test('release model payloads roundtrip without changing numeric JSON',async()=>{
 const root=new URL('../../runtime/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('build.json',root)));
 assert.ok(manifest.packedData.length>0);
 for(const p of manifest.packedData){const raw=gunzipSync(await fs.readFile(new URL(p.file,root)));assert.equal(createHash('sha256').update(raw).digest('hex'),p.sha256);JSON.parse(raw);}
});
test('packed model downloads use at most four slots and preserve content',async()=>{
 const original=globalThis.fetch;let active=0,peak=0;const body=gzipSync(Buffer.from('{"coordinates":[-0,1.23456789012345]}'));
 globalThis.fetch=async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,15));active--;return new Response(body);};
 try{const results=await Promise.all(Array.from({length:11},()=>loadPackedData('test.bin')));assert.equal(peak,4);for(const p of results){assert.ok(Object.is(p.coordinates[0],-0));assert.equal(p.coordinates[1],1.23456789012345);}}finally{globalThis.fetch=original;}
});
test('temporary server failure retries before returning model data',async()=>{
 const original=globalThis.fetch;let calls=0;const body=gzipSync(Buffer.from('{"ok":true}'));
 globalThis.fetch=async()=>++calls===1?new Response('',{status:503}):new Response(body);
 try{assert.deepEqual(await loadPackedData('retry.bin'),{ok:true});assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
