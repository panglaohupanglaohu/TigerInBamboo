// REACode/terraceladder.js (781957658597269506 wooden ladders across terraces, 1669315384619540487 islands):
// shared stair anchors on the live cage, end-point voxel contact against World (foot on lower top, column
// clear, lip on upper top/axis, thin-platform support depth), climb sampling, and NavLayer diagnostics parity.
import assert from'node:assert/strict';import{register}from'node:module';import{pathToFileURL,fileURLToPath}from'node:url';import{dirname,join}from'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root,'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE=await import('three');
const{World}=await import('../src/core/world.js');const{buildMixedGrid,buildQuadGrid}=await import('../src/core/grid.js');const{decorateCells}=await import('../src/core/spatial.js');
const{generateTerrain}=await import('../src/terrain/generate.js');const{shapeTerrain}=await import('../src/terrain/shape.js');const{buildNav}=await import('../src/world/navgraph.js');
const{ladderProfile,ladderAnchors,ladderContact,ladderClimb}=await import('../src/core/ladder-profile.js');const{NavLayer}=await import('../src/world/navlayer.js');
// Synthetic thin platform: low cell level 2, high cell has rock only at level 4 (floating slab) vs full column.
function block(nx,nz){return Array.from({length:nx*nz},(_,id)=>{const x=id%nx,z=(id/nx)|0;return{id,n:4,cx:x,cz:z,pts:[{x:x-.5,z:z-.5},{x:x+.5,z:z-.5},{x:x+.5,z:z+.5},{x:x-.5,z:z+.5}],edgeNeighbors:[z?id-nx:-1,x+1<nx?id+1:-1,z+1<nz?id+nx:-1,x?id-1:-1]}})}
{const w=new World({cells:block(2,1)}),[lo,hi]=w.cells;w.fill(lo,2,{rock:true});w.fill(hi,4,{rock:true});
 const st={low:lo,high:hi,edge:1,rise:2},an=ladderAnchors(st,2,{L:.5}),p=ladderProfile(an.foot,an.lip,{side:an.side,width:an.width});let c=ladderContact(w,st,an,p,{L:.5});
 assert.ok(c.footOnTop&&c.footInside&&c.columnClear&&c.lipOnTop&&c.lipDist<1e-9);assert.equal(c.supportDepth,4);assert.equal(c.thinPlatform,false);assert.ok(Math.abs(c.shortGap-(p.length-1))<1e-12&&c.shortGap>0);
 w.setSolid(hi,3,false);w.setSolid(hi,2,false);w.setSolid(hi,1,false);c=ladderContact(w,st,an,p,{L:.5});assert.equal(c.supportDepth,1);assert.equal(c.thinPlatform,true);
 w.setSolid(lo,3,true);c=ladderContact(w,st,an,p,{L:.5});assert.equal(c.columnClear,false);assert.equal(c.footOnTop,false);
 const a=ladderClimb(p,0),b=ladderClimb(p,.5),e=ladderClimb(p,1);assert.deepEqual(a.position,{...an.foot});assert.ok(Math.abs(e.position.y-an.lip.y)<1e-12&&e.onTop);assert.ok(b.footRung>a.footRung&&b.handRung>b.footRung);assert.throws(()=>ladderClimb(p,1.2));}
const out={};
for(const[name,grid]of[['mixed',buildMixedGrid({radius:9,seed:7})],['quad',buildQuadGrid({radius:9,seed:7})]]){decorateCells(grid);for(const seed of[1,7,19]){
 const w=new World(grid);generateTerrain(w,{seed});const snap=JSON.stringify(w.snapshot()),shape=shapeTerrain(w),at=(p,s)=>shape.at(p,s),L=.5,nav=buildNav(w);
 let n=0,thin=0;
 for(const s of nav.stairs){const h=nav.hgt[s.low.id],an=ladderAnchors(s,h,{at,L});if(!an)continue;const p=ladderProfile(an.foot,an.lip,{side:an.side,width:an.width}),c=ladderContact(w,s,an,p,{at,L});n++;
  assert.ok(c.footOnTop,'foot on lower terrace top');assert.ok(c.columnClear,'no rock inside the lower column over the rise');assert.ok(c.lipOnTop,'lip on upper top');assert.ok(c.lipDist<1e-9);assert.ok(c.shortGap>0,'rail longer than the rise');assert.ok(c.footInside,'foot inside the deformed lower polygon');if(c.thinPlatform)thin++;}
 // NavLayer draws through the same anchors and records the same contact.
 const layer=new NavLayer({scene:new THREE.Scene(),levelHeight:L});layer.woodLadders=true;layer.refresh(w,shape);
 assert.equal(layer.ladderDiagnostics.length,n);for(const d of layer.ladderDiagnostics)assert.ok(d.contact.footOnTop&&d.contact.columnClear&&d.contact.lipOnTop&&d.contact.footInside);
 layer.woodLadders=false;layer.refresh(w,shape);assert.equal(layer.ladderDiagnostics.length,0);
 assert.equal(JSON.stringify(w.snapshot()),snap);out[name+seed]={ladders:n,thin};}}
console.log('PASS ladder anchors/contact on live cage, thin platform + blocked column detection, climb sampling, NavLayer parity',JSON.stringify(out));
