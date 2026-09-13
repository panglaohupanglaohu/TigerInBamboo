import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-retaining-contact/',import.meta.url);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');await p.waitForFunction(()=>window.__tm?.scene?.getObjectByName('citadel-plaza-retaining-wall'),null,{timeout:180000});
const data=await p.evaluate(()=>{const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city'),wall=city.getObjectByName('citadel-plaza-retaining-wall');c.updateWorldMatrix(true,true);
const terrain=[];c.traverse(o=>{if(!o.isMesh||!/mountain|cliff|strata|massif|shore|coast/.test(o.name)||o.userData.isOutline)return;let visible=true;for(let n=o;n;n=n.parent)if(!n.visible)visible=false;if(visible)terrain.push(o);});
const ray=new T.Raycaster(),up=new T.Vector3(0,1,0).transformDirection(city.matrixWorld);ray.layers.enableAll();ray.far=300;
const points=[];for(const pier of wall.userData.support.piers)for(const z of [87.85,88.5,89,90.1]){ray.set(city.localToWorld(new T.Vector3(pier.x,50,z)),up.clone().negate());const hits=ray.intersectObjects(terrain,false);points.push({x:pier.x,z,pierBottom:pier.bottom,hits:hits.slice(0,6).map(h=>({name:h.object.name,y:city.worldToLocal(h.point.clone()).y,material:h.object.material.name,side:h.object.material.side}))});}
const source=c.getObjectByName('citadel-oskar-grid-mountain-surface');
return {support:wall.userData.support,source:{visible:source.visible,parents:source.parent.name,material:source.material.name},meshes:terrain.map(o=>o.name),points};});await writeFile(new URL('contact-report.json',out),JSON.stringify(data,null,2));console.log(JSON.stringify(data.points));
}finally{await b.close();}
