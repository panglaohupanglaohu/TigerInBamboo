import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {migrateOldCityShelves, isOldCityShelves, OLD_CITY_SHELF_BASE_YS, oldCityShelfIndex} from '../../src/world/citadel/oldCityShelves.js';
import {resolveTownSelection} from '../../src/world/citadel/wfcTownWiring.js';
import {createFaceLayerGraph,createLegacyFaceLayout} from '../../src/world/citadel/faceLayerGraph.js';
const source=fs.readFileSync(new URL('../../src/world/citadelTown.js',import.meta.url),'utf8');
const seedFunction=source.slice(source.indexOf('function makeHighlandTownscaperLevels()'),source.indexOf('export const HIGHLAND_TOWNSCAPER_TOWN_SPEC'));
const levels=vm.runInNewContext(`${seedFunction};makeHighlandTownscaperLevels()`,{CITADEL_GRID_SIZE:25,CITADEL_GATE_CHAR:'G'});
const empty=levels.map(rows=>rows.map(()=>'.'.repeat(25)));
const base={version:2,gridSize:25,terraces:[{terraceIndex:0,levels},...Array.from({length:4},(_,i)=>({terraceIndex:i+1,levels:empty}))]};
const saved=JSON.stringify(base), result=migrateOldCityShelves(base);
assert.equal(JSON.stringify(base),saved); assert(isOldCityShelves(result));assert.equal(migrateOldCityShelves(result),result);
const reports=[];
for(let t=0;t<5;t++) {
 const grid=new Map();result.terraces[t].levels.forEach((rows,y)=>rows.forEach((row,z)=>[...row].forEach((c,x)=>{if(c!=='.'){grid.set(`${x},${y},${z}`,c);assert.equal(oldCityShelfIndex((x-12)*2,(z-12)*2),t);assert(!(Math.abs(x-12)<=2&&Math.abs(z-12)<=2));}})));
 if(!grid.size)continue;
 const r=resolveTownSelection(grid,{seed:20260808,graph:createFaceLayerGraph(createLegacyFaceLayout(grid))});assert(r.ok,JSON.stringify(r.unresolved));
 reports.push({terraceIndex:t,baseY:OLD_CITY_SHELF_BASE_YS[t],cells:grid.size,wfcOk:r.ok,hash:r.hash});
}
assert.equal(reports.length,3);assert(result.shelfMigration.removedCells>0);
const report={...result.shelfMigration,reports,sourceUnchanged:true,idempotent:true,protectedCoreEmpty:true};
fs.mkdirSync(new URL('../../artifacts/pipeline/citadel-old-city-shelves/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../../artifacts/pipeline/citadel-old-city-shelves/migration.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
