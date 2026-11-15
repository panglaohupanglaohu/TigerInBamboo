// 1580835075629133825 2.5D surface form-factor gather + brute-force reference/audit on the shared World.
import assert from 'node:assert/strict';
import {generateModulePatch} from '../src/core/module-patch.js';import {World} from '../src/core/world.js';import {buildCellIndex} from '../src/core/spatial.js';
import {surfaceFieldFromWorld,directLight,bounce,bruteForce,audit,samplePattern,applySurfaceBounce,visible} from '../src/light/surface-bounce.js';
const vertices=[],faces=[];for(let x=0;x<=10;x++)for(let z=0;z<=6;z++)vertices.push([x,z]);for(let x=0;x<10;x++)for(let z=0;z<6;z++){const a=x*7+z;faces.push([a,a+7,a+8,a+1])}
const g=generateModulePatch({vertices,faces}),world=new World(g),index=buildCellIndex(g);
// canyon: orange walls x<3 and x>=7 at 6 levels, valley floor 1 level of green
for(const c of world.cells)world.fill(c,c.cx<3||c.cx>7?6:1,{rock:true});
const orange=[.9,.5,.2],green=[.3,.6,.3];
const albedoOf=(c,t)=>t>1?orange:green;
const f=surfaceFieldFromWorld(world,index,{L:.5,pitch:.5,albedoOf});
assert.equal(f.version,world.version);assert.ok(f.nx>20&&f.nz>10);
const sun=[-.9,.35,.15];
const a=audit(f,{sun,samples:192,maxDist:6});
const legacy=audit(f,{sun,samples:192,maxRad:8,model:'legacy'});
assert.ok(a.shadowCells>5,'valley has sun-shadowed cells '+a.shadowCells);
assert.ok(a.shadowGain1>1.05,'one bounce brightens the shadow '+a.shadowGain1);
assert.ok(a.shadowGain2>=a.shadowGain1,'second bounce adds');
assert.ok(a.secondBounceDeltaPct<a.shadowGain1*100-100,'second bounce adds less than the first');
assert.ok(a.warmthOneBounce>a.warmthNoBounce,'orange walls warm the shadow (real bounce, not colour smear)');
// 第 55 批校准：split 模型（顶面片+崖面片、面积加权采样圈、世界单位半径）、calibration=1（物理值）
assert.equal(a.calibration,1);assert.equal(a.model,'split');
assert.ok(a.correlation>.85,'gather follows the Monte-Carlo reference r='+a.correlation.toFixed(3));
assert.ok(a.correlation>legacy.correlation+.25,'calibrated model beats the r53 legacy one '+legacy.correlation.toFixed(3)+' -> '+a.correlation.toFixed(3));
assert.ok(a.shadowRatioVsBruteForce>.75&&a.shadowRatioVsBruteForce<1.3,'shadowed valley bounce matches brute force in absolute terms without a fudge factor '+a.shadowRatioVsBruteForce);
assert.ok(a.bestFitScale>.75&&a.bestFitScale<1.3,'overall scale ~1 '+a.bestFitScale);
// true bounce: brightness depends on how much lit wall is seen. Valley centre vs. wall foot on the lit side.
const E0=a.E0,lumAt=(arr,x,z)=>{const i=z*f.nx+x;return arr[i*3]+arr[i*3+1]+arr[i*3+2]};
// gather with zero calibration = no bounce
const b0=bounce(f,E0,{bounces:1,calibration:0});assert.ok(b0.added.every(v=>v===0));
// sample pattern lands on near rings (cliff faces are 1-2 cells wide)
const pat=samplePattern({maxRad:3});assert.ok(pat.some(p=>p.rad<=1.5)&&pat.length>20);
// visibility through a wall is blocked
const wallX=Math.floor((8.5-f.minX)/f.pitch),z=Math.floor((3-f.minZ)/f.pitch),vx=Math.floor((5-f.minX)/f.pitch),outX=f.nx-2;
assert.equal(visible(f,vx,z,outX,z),false);
// vertex application on a MeshWriter-like buffer: shadowed valley vertex gets the bounce
const w={pos:[5,.5,3,5,.5,3.1,5.1,.5,3],col:new Array(9).fill(.5)};assert.equal(applySurfaceBounce(w,f,a.b1.added),3);assert.ok(w.col[0]>.5);
// World edit → new field version; removing the walls removes the bounce into the valley
for(const c of world.cells)world.fill(c,1,{rock:true});const flat=surfaceFieldFromWorld(world,index,{L:.5,pitch:.5,albedoOf});assert.ok(flat.version>f.version);
const fb=bounce(flat,directLight(flat,{sun}),{bounces:1});const mid=(Math.floor(flat.nz/2)*flat.nx+Math.floor(flat.nx/2))*3;assert.ok(fb.added[mid]<a.b1.added[(z*f.nx+vx)*3]+1e-9);
// real shared-World island (terrain scene): calibrated gather vs 256-ray reference
{const {buildQuadGrid}=await import('../src/core/grid.js');const {decorateCells}=await import('../src/core/spatial.js');const {buildScene}=await import('../src/world/scenes.js');const {PALETTES}=await import('../src/core/palette.js');
 const gq=decorateCells(buildQuadGrid({radius:14,hexSize:1})),iq=buildCellIndex(gq),wq=new World(gq);wq.palette=PALETTES.town;buildScene(wq,'terrain',7);
 const fq=surfaceFieldFromWorld(wq,iq,{L:.5,pitch:.25,albedoOf:(c,t)=>wq.isRock(c,t)?[.5,.6,.34]:[.85,.8,.7],maxCells:80000}),E=directLight(fq,{sun:[-.42,.7,.58]}),ref=bruteForce(fq,E,{samples:256,seed:7});
 const corr=(x,y)=>{let ca=0,cb=0,cab=0,caa=0,cbb=0;const m=x.length;for(let q=0;q<m;q++){ca+=x[q];cb+=y[q]}ca/=m;cb/=m;for(let q=0;q<m;q++){const u=x[q]-ca,v=y[q]-cb;cab+=u*v;caa+=u*u;cbb+=v*v}return cab/Math.sqrt(caa*cbb)};
 const rs=corr(bounce(fq,E,{bounces:1}).added,ref),rl=corr(bounce(fq,E,{bounces:1,model:'legacy',maxRad:10}).added,ref);
 assert.ok(rs>.75&&rs>rl+.15,'terrain island: split r='+rs.toFixed(3)+' legacy r='+rl.toFixed(3));
 console.log('terrain island r(brute): legacy',rl.toFixed(3),'-> split',rs.toFixed(3));}
console.log('PASS surface bounce on World canyon: gain1',a.shadowGain1.toFixed(3),'gain2',a.shadowGain2.toFixed(3),'warmth',a.warmthNoBounce.toFixed(3),'->',a.warmthOneBounce.toFixed(3),'r(brute)',legacy.correlation.toFixed(3),'->',a.correlation.toFixed(3),'shapeErr%',a.vsBruteForceShapeErrPct.toFixed(1),'fit',a.bestFitScale.toFixed(2),'shadow ratio',a.shadowRatioVsBruteForce.toFixed(2),'ms',a.gatherMs.toFixed(0));
