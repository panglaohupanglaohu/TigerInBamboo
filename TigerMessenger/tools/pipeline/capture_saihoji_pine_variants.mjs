// Capture each original garden seed; never replace the whole grove with one tree.
import { register } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
const threeUrl = new URL('vendor/three.module.js', root).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,next){if(s==='three')return {url:${JSON.stringify(threeUrl)},shortCircuit:true};return next(s,c);}`), import.meta.url);
const { createAncientPineTree } = await import('../../src/assets/ancient.js');
const { captureObject } = await import('../originals/capture.js');
const sha = x => createHash('sha256').update(x).digest('hex');
const layoutSource = readFileSync(new URL('src/world/saihoji.js', root), 'utf8');
const factorySource = readFileSync(new URL('src/assets/ancient.js', root), 'utf8');
const marker = 'const PINE_LAYOUTS = Object.freeze(';
const start = layoutSource.indexOf(marker);
const end = layoutSource.indexOf('\n});', start);
if(start < 0 || end < 0) throw Error('Original layout boundary changed; inspect source before capture');
// Evaluate only the bounded, locally authored object literal, without imports or globals.
const layouts = vm.runInNewContext('(' + layoutSource.slice(start + marker.length, end + 2) + ')', {}, {timeout:1000});
const specs = Object.entries(layouts).flatMap(([zone, entries]) => entries.map((spec, index) => ({zone,index,...spec})));
if(specs.length !== 25 || new Set(specs.map(s => s.seed)).size !== 25) throw Error('Unexpected original seed inventory');
const out = new URL('assets/models/originals/saihoji-pines-r1/', root);
mkdirSync(out, {recursive:true});
const files = specs.map(spec => {
  const tree = createAncientPineTree(spec.seed);
  const provenance = {label:`苔庭古松 · ${spec.zone} · ${spec.seed}`,factory:'src/assets/ancient.js#createAncientPineTree',factory_sha256:sha(factorySource),layout:'src/world/saihoji.js#PINE_LAYOUTS',layout_sha256:sha(layoutSource),seed:spec.seed,placement:spec,scope:'Unscaled original factory geometry; original world applies scale, surface position, yaw and lift'};
  const snapshot = captureObject(tree, provenance);
  const name = `ancient-pine-${spec.seed}.source.json`;
  const path = new URL(name,out);
  if(existsSync(path)) {
    const existing = JSON.parse(readFileSync(path,'utf8'));
    if(JSON.stringify(existing.provenance)!==JSON.stringify(provenance)) throw Error('Immutable archive differs; create a new revision: '+name);
  } else writeFileSync(path, JSON.stringify(snapshot));
  const saved = readFileSync(path);
  return {seed:spec.seed,zone:spec.zone,placement:spec,file:name,sha256:sha(saved),nodes:snapshot.nodes.length,geometries:Object.keys(snapshot.geometries).length,stage:'source_archived',optimized:false,godot_runtime_replaced:false};
});
const manifest = {scope:'25 original seed-specific source snapshots, not optimized assets',factory_sha256:sha(factorySource),layout_sha256:sha(layoutSource),placement_contract:{size:6,spread:2,lift:'spec.lift + 0.14 + 0.06 * (6 - 1)',surface:'Original placeAtLocal on each source garden; do not bake shared world placement into candidate mesh'},files};
const manifestPath = new URL('manifest.json',out);
const text = JSON.stringify(manifest,null,2);
if(existsSync(manifestPath) && readFileSync(manifestPath,'utf8') !== text) throw Error('Immutable manifest differs');
if(!existsSync(manifestPath)) writeFileSync(manifestPath,text);
console.log(JSON.stringify({archived:files.length,zones:Object.keys(layouts),nodes:files.map(f=>f.nodes),manifest:manifestPath.pathname,optimized:false}));
