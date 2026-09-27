import * as T from '../../vendor/three.module.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const vendor=new URL('../../vendor/three.module.js',import.meta.url).href;
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const toon=url((await readFile(new URL('../../src/assets/toon.js',import.meta.url),'utf8')).replace('"three"',JSON.stringify(vendor)));
const code=(await readFile(new URL('../../src/assets/warshipV6.js',import.meta.url),'utf8')).replace("'three'",JSON.stringify(vendor)).replace("'./toon.js'",JSON.stringify(toon)).replace("'./warshipV6Data.js'",JSON.stringify(new URL('../../src/assets/warshipV6Data.js',import.meta.url).href));
const {createWarshipV6}=await import(url(code));
const boat=createWarshipV6(),rig=boat.userData.warshipV6,mat=new T.Matrix4(),p=new T.Vector3();let checked=0,poses=0;
function check(){poses++;boat.traverse(o=>{if(!o.isInstancedMesh)return;assert.equal(o.frustumCulled,true);assert.ok(o.boundingSphere&&Number.isFinite(o.boundingSphere.radius));const a=o.geometry.attributes.position;for(let i=0;i<o.count;i++){o.getMatrixAt(i,mat);for(let v=0;v<a.count;v++){p.fromBufferAttribute(a,v).applyMatrix4(mat);assert.ok(p.distanceTo(o.boundingSphere.center)<=o.boundingSphere.radius+1e-5,`${o.name} pose=${poses} instance=${i} vertex=${v}`);checked++;}}});}
check();for(let n=0;n<30;n++){rig.update(.05,1);check();}
for(const pitch of [-.4,0,.4]){rig.setBoardingPitch(pitch);for(const amount of [0,.25,.5,.75,1]){rig.setBoarding(amount);rig.update(.05,0);check();}}
for(let i=0;i<26;i++)rig.setCrewEmbarked(i,false);check();
for(let i=0;i<26;i++)rig.setCrewEmbarked(i,true);check();
const report={passed:true,poses,verticesChecked:checked,scope:'Every instance vertex inside current boat-local sphere: rowing, boarding, +/- pitch, crew hide/reboard; rigid world transforms handled by Three frustum sphere transform'};
const out=new URL('../../artifacts/pipeline/saihoji-runtime-performance/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('warship-bounds.json',out),JSON.stringify(report,null,2));console.log(report);
