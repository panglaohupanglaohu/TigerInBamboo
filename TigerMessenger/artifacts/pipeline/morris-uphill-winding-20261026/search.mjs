import fs from 'node:fs';import {createMorrisTerrain}from'../../../src/world/morrisLandscape.js';import{createMorrisMountainRoute}from'./candidate-route.mjs';
const t=createMorrisTerrain(160,()=>58),valid=[];
for(const x of[0,2,4,6,8,10])for(const z of[9,11,13,15,17,19])for(const a of[-.6,0,.6,1.2]){
 const r=createMorrisMountainRoute({stream:t.stream,naturalElevation:t.naturalElevation,climbWaypoint:[x,z,a],plateauProtected:(x,z)=>(x>=7&&x<=21&&z>=0&&z<=10)||Math.hypot((x-24)/8,(z-11)/7)<1});let other=Infinity,river=Infinity,finite=true;
 const p=r.points.filter((q,i)=>i%3===0);for(let j=0;j<p.length;j++){const b=p[j];if(!Number.isFinite(b.h))finite=false;if(Math.abs(b.s-r.bridge.s)>7)river=Math.min(river,...t.stream.map(q=>Math.hypot(q.x-b.x,q.z-b.z)));for(let k=j+1;k<p.length;k++)if(p[k].s-b.s>14)other=Math.min(other,Math.hypot(b.x-p[k].x,b.z-p[k].z));}
 if(finite&&other>3.5&&river>2.75&&r.length<190)valid.push({x,z,a,length:r.length,other,river});
}valid.sort((a,b)=>b.length-a.length);fs.writeFileSync(new URL('candidates.json',import.meta.url),JSON.stringify(valid,null,2));console.log(JSON.stringify(valid.slice(0,10),null,2));
