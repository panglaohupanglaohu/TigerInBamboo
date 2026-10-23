import assert from 'node:assert/strict';
import * as T from 'three';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,GlobalFonts}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Songti.ttc','Songti SC');
const element=name=>{const c=createCanvas(1024,1024);c.style={};c.addEventListener=()=>{};c.removeEventListener=()=>{};return c;};
globalThis.document={createElement:element,createElementNS:element,getElementById:()=>null,querySelector:()=>null};globalThis.location={search:''};globalThis.window={location,addEventListener(){}};
const {createBookshopFreighterHull,createLeeBaiNameTexture}=await import('../../src/world/bookshopFreighterHull.js');
const {buildBookshopFactoryBase}=await import('../../src/world/bookshopFactoryBase.js');
const {bookshopTownPose}=await import('../../src/world/bookshopTownSite.js');
const {compileOfficialOcean,officialOceanLevelAt}=await import('../../src/world/waterV8/officialOcean.js');
const root=new T.Group(),pose=bookshopTownPose(160);root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);buildBookshopFactoryBase({root,districts:[],R:160,colliders:[]});root.userData.update(.1,0);
const ship=root.getObjectByName('bookshop-steam-parts-freighter');ship.updateWorldMatrix(true,true);
const compiled=compileOfficialOcean({radius:160}),op=compiled.ocean.positions,W=72,H=48,row=W+1,ray=new T.Ray(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3();
const seaAt=dir=>{const phi=(Math.atan2(dir.z,-dir.x)+Math.PI*2)%(Math.PI*2),theta=Math.acos(T.MathUtils.clamp(dir.y,-1,1)),x=Math.min(W-1,Math.floor(phi/(Math.PI*2)*W)),y=Math.min(H-1,Math.floor(theta/Math.PI*H));ray.set(dir.clone().multiplyScalar(220),dir.clone().negate());const ids=[[y*row+x+1,y*row+x,(y+1)*row+x+1],[y*row+x,(y+1)*row+x,(y+1)*row+x+1]];
 for(const dy of[0,-1,1])for(const dx of[0,-1,1]){const yy=Math.min(H-1,Math.max(0,y+dy)),xx=(x+dx+W)%W,ts=[[yy*row+xx+1,yy*row+xx,(yy+1)*row+xx+1],[yy*row+xx,(yy+1)*row+xx,(yy+1)*row+xx+1]];for(const t of ts){a.fromArray(op,t[0]*3);b.fromArray(op,t[1]*3);c.fromArray(op,t[2]*3);if(ray.intersectTriangle(a,b,c,false,hit))return hit.length();}}throw new Error('radial ocean cell missed');};
const names=[ship.getObjectByName('freighter-name-port'),ship.getObjectByName('freighter-name-starboard')],reports=[];
for(const name of names){const image=name.material.map.image,pixels=image.getContext('2d').getImageData(0,0,1024,1024).data,p=name.geometry.attributes.position,nu=24,nv=12,report={side:name.userData.side,chinese:{pixels:0,alpha:0,aboveAuthority:0,aboveMesh:0,minAuthority:Infinity,minMesh:Infinity},english:{pixels:0,alpha:0,aboveAuthority:0,aboveMesh:0,minAuthority:Infinity,minMesh:Infinity}};
 for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const alpha=pixels[(y*1024+x)*4+3]/255;if(!alpha)continue;const u=(x+.5)/1024,v=(y+.5)/1024,i=Math.min(nu-1,Math.floor(u*nu)),j=Math.min(nv-1,Math.floor(v*nv)),fu=u*nu-i,fv=v*nv-j,aa=j*(nu+1)+i,bb=aa+1,cc=aa+nu+1,dd=cc+1;
  const get=k=>new T.Vector3().fromBufferAttribute(p,k),local=fu+fv<=1?get(aa).multiplyScalar(1-fu-fv).addScaledVector(get(bb),fu).addScaledVector(get(cc),fv):get(bb).multiplyScalar(1-fv).addScaledVector(get(cc),1-fu).addScaledVector(get(dd),fu+fv-1);
  const world=local.applyMatrix4(name.matrixWorld),r=world.length(),dir=world.clone().normalize(),authority=r-(160+officialOceanLevelAt(dir)),mesh=r-seaAt(dir),kind=y<700?'chinese':'english',s=report[kind];s.pixels++;s.alpha+=alpha;s.aboveAuthority+=authority>0?alpha:0;s.aboveMesh+=mesh>0?alpha:0;s.minAuthority=Math.min(s.minAuthority,authority);s.minMesh=Math.min(s.minMesh,mesh);
 }
 for(const s of[report.chinese,report.english]){s.aboveAuthorityRatio=s.aboveAuthority/s.alpha;s.aboveMeshRatio=s.aboveMesh/s.alpha;}reports.push(report);
}
for(const r of reports)for(const s of[r.chinese,r.english]){assert.equal(s.aboveAuthorityRatio,1);assert.equal(s.aboveMeshRatio,1);assert.ok(s.minAuthority>.067+.275,'all glyph pixels above wave plus bob bound');}
console.log(JSON.stringify({source:'actual native canvas alpha, actual name UV triangles, production matrixWorld at time0; authority officialOceanLevelAt and exact radial intersection of compiled ocean triangle cell',textureSize:[1024,1024],worldScale:5,reports,waveBoundWorld:.067,GPU:'not checked; does not measure camera occlusion or readability'},null,2));
