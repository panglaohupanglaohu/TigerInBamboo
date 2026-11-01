// Twelve Apostles on REACodeRefactoring (src/vendor/townscaper-rea-refactoring, files unchanged).
//
// Keeps the approved composition of twelveApostlesTarget.js (nine masses: s/d along the rail, lobe
// hierarchy, approved footprints, rail / town / protected clearance), and replaces the hand-written
// corner WFC + marching mesh with the refactor's pipelines:
//   grid      core/grid.js buildQuadGrid (Townscaper irregular quads), one grid per mass
//   voxels    core/world.js World (rock columns, MAX_LEVEL 12)
//   terrain   lobe height field + refactor noise -> levels -> de-spike -> terrain/features.js
//             (overhangs / natural arch / sea stacks with notch + mushroom cap)
//   mesh      world/worldmesh.js WorldMesh: terrain/shape.js level smoothing + cage deform, strata
//             lines, grass drape over cliff edges, soft normals, light/bake.js AO + coloured bounce
//   edit      every mass keeps its World: the lake build menu can select it and build / erase / paint /
//             add rock on it (same apply rules as world/app.js); edits are saved per mass in this browser
//   water     water/shore.js buildShore (foam skirt + looping shore waves)
//   life      life/vegetation.js Vegetation (tufts, flowers, shrubs, blob trees)
// Each mass lives in its own tangent frame on the planet (local +Y = sea normal); geometry, waves and
// plants are bent onto the sphere (y -= r^2 / 2R) and wall feet are carried below the waterline.
import * as THREE from 'three';
import {buildQuadGrid} from '../vendor/townscaper-rea-refactoring/src/core/grid.js';
import {decorateCells,buildCellIndex,pointInQuad} from '../vendor/townscaper-rea-refactoring/src/core/spatial.js';
import {World,MAX_LEVEL} from '../vendor/townscaper-rea-refactoring/src/core/world.js';
import {TERRAIN,PALETTES} from '../vendor/townscaper-rea-refactoring/src/core/palette.js';
import {fbm,makeRng} from '../vendor/townscaper-rea-refactoring/src/core/noise.js';
import {addFeatures} from '../vendor/townscaper-rea-refactoring/src/terrain/features.js';
import {encodeWorld,decodeWorld} from '../vendor/townscaper-rea-refactoring/src/world/save.js';
import {generateApostleTerrain} from './apostlesTerrain.js?v=apostles-terrain-r1';
import {WorldMesh} from '../vendor/townscaper-rea-refactoring/src/world/worldmesh.js';
import {buildShore,makeSkirtMaterial,makeWaveMaterial} from '../vendor/townscaper-rea-refactoring/src/water/shore.js';
import {Vegetation} from '../vendor/townscaper-rea-refactoring/src/life/vegetation.js';
import {APOSTLE_MASSES,LEVEL_Y,sampleApostleLobes} from './twelveApostlesTarget.js?v=shell-coral-20261024';

export const APOSTLES_REACODE_REVISION='apostles-reacode-r3';
export const apostlesReacodeEnabled=()=>new URLSearchParams(globalThis.location?.search||'').get('apostlesReacode')!=='0';

// Same level tables as twelveApostlesTarget.js (approved heights in metres).
const SOFT_BANK_LEVEL_Y=[0,3.2,6.5,9.5,12.5,15.5,19,26,34,38],BANK_LEVEL_MAP=[0,2,4,6,7,8,9];
const LEVEL_M=3.2;                 // metres per refactor level (12 levels = 38.4 m)
const FOOT_M=7;                    // wall feet carried this far below the waterline
// Limestone theme for the refactor's terrain palette (target sheet: cream / blue-grey walls, shell
// seams, yellow-green turf). Applied only while the apostles build, then restored.
const APOSTLE_TERRAIN={rock:'#d8d2c2',rockShade:'#c3c8c7',rockPale:'#e7e1d1',rockDark:'#8e99a1',strata:'#d3b4a2',
 sand:'#d9cfb6',sandBright:'#e7ddc6',moss:'#a6bb5c',mossDeep:'#93ad52',grass:'#9fbf55',grassDeep:'#86a84a',lip:'#e6e3a8',river:'#5d9fae',riverBank:'#b9ad8c'};
const WET=new THREE.Color('#4f5961'),WET_DEEP=new THREE.Color('#313b44');
// wall strata of the target sheet: cream limestone with blue-grey and pale shell-coral bands (low frequency, by height)
const BAND_COOL=new THREE.Color('#c4ccd0'),BAND_WARM=new THREE.Color('#e3c6b2'),BAND_PALE=new THREE.Color('#ece6d6');

function strHash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
// Low-poly copy of life/vegetation.js SHRUB (same blobs / puffed normals / aTip, icosahedron detail 0 instead of 1:
// 100 instead of 400 triangles per bush; the shrubs of the nine masses were ~3.5 M triangles with their ink shells).
function lowBlobGeometry(blobs,detail,puff){
 let cx=0,cy=0,cz=0,ws=0;for(const[x,y,z,r]of blobs){cx+=x*r;cy+=y*r;cz+=z*r;ws+=r;}cx/=ws;cy/=ws;cz/=ws;let maxY=0;for(const[,y,,r]of blobs)maxY=Math.max(maxY,y+r);
 const pos=[],nor=[],tip=[];for(const[x,y,z,r]of blobs){const g=new THREE.IcosahedronGeometry(r,detail).toNonIndexed();g.translate(x,y,z);g.computeVertexNormals();const P=g.attributes.position,N=g.attributes.normal;
  for(let i=0;i<P.count;i++){const px=P.getX(i),py=P.getY(i),pz=P.getZ(i),dx=px-cx,dy=(py-cy)*.8,dz=pz-cz,l=Math.hypot(dx,dy,dz)||1;
   const nx=N.getX(i)*(1-puff)+dx/l*puff,ny=N.getY(i)*(1-puff)+dy/l*puff+.15,nz=N.getZ(i)*(1-puff)+dz/l*puff,nl=Math.hypot(nx,ny,nz)||1;pos.push(px,py,pz);nor.push(nx/nl,ny/nl,nz/nl);tip.push(py/maxY);}g.dispose();}
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));out.setAttribute('aTip',new THREE.Float32BufferAttribute(tip,1));return out;}
const SHRUB_LOW=lowBlobGeometry([[0,.032,0,.034],[.03,.024,.014,.027],[-.028,.022,-.01,.027],[.008,.05,-.016,.024],[-.01,.026,.03,.024]],0,.5);
// vegetation.js CROWNS (same blobs) at detail 1 instead of 2: 400 instead of 1600 triangles per tree.
const CROWNS_LOW=[[[0,.30,0,.16],[.11,.25,.04,.12],[-.1,.26,-.03,.12],[.02,.40,-.02,.11],[0,.24,.11,.1]],[[0,.34,0,.13],[.06,.46,.02,.1],[-.07,.28,.05,.1],[.07,.26,-.06,.09]],[[0,.26,0,.19],[.14,.22,.05,.13],[-.13,.22,.03,.13],[.03,.36,.08,.12],[-.04,.38,-.08,.12],[.08,.2,-.12,.11]]].map(b=>lowBlobGeometry(b,1,.65));
function withPalette(fn){const saved={...TERRAIN};Object.assign(TERRAIN,APOSTLE_TERRAIN);try{return fn();}finally{Object.assign(TERRAIN,saved);}}

/** Lobe height (metres) at a point: the highest lobe whose (noisy) ellipse contains it. */
function lobeHeight(lobes,metres,x,z,seed,amp=.34,fq=.09){
 let h=0;
 for(const[cx,cz,rx,rz,lv,rot=0]of lobes){const c=Math.cos(rot),s=Math.sin(rot),u=(x-cx)*c+(z-cz)*s,v=-(x-cx)*s+(z-cz)*c;
  const d=Math.hypot(u/rx,v/rz),edge=1+(fbm(x*fq+cx*.01,z*fq+cz*.01,{octaves:3,freq:1.6,seed})-.5)*amp;
  if(d<edge)h=Math.max(h,metres(lv));}
 return h;
}

export const APOSTLE_MASS_NAMES={'back-left':'后排左台','back-right':'后排主峰','back-tower':'后排塔岩','front-left':'前排左台','front-right':'前排右台','bay-1':'湾心石柱 1','bay-2':'湾心石柱 2','bay-3':'湾心石柱 3','bay-4':'湾心石柱 4'};
const EDIT_KEY=id=>'apostles-reacode-edit-v2:'+id;

/** Generator: yields a progress label after each mass (the startup loader keeps painting), returns {rocks,report,editor}. */
export function* buildTwelveApostlesReacodeSteps({parent,radius=160,railCurves,railPoints,waterAt,protectedBoxes=[],plazaMargin=()=>Infinity,referencePoint,masses=APOSTLE_MASSES,clearance=10}){
 const t0=performance.now();
 let nearest=null;for(const[name,curve]of Object.entries(railCurves||{})){if(!curve?.getPointAt)continue;const length=curve.getLength(),count=Math.ceil(length/2);for(let i=0;i<count;i++){const u=i/count,p=curve.getPointAt(u),dd=p.distanceToSquared(referencePoint);if(!nearest||dd<nearest.dd)nearest={name,curve,length,u,dd};}}
 if(!nearest)throw new Error('twelve apostles need the actual rail curves');
 const report={version:APOSTLES_REACODE_REVISION,pipeline:'REACodeRefactoring grid/World/WorldMesh/features/shore/vegetation (editable)',railSource:nearest.name,levelMetres:LEVEL_M,ink:false,masses:[],railUnchanged:true,triangles:0,drawCalls:0};
 const _sz=new THREE.Vector3();protectedBoxes=protectedBoxes.filter(e=>e.box.getSize(_sz).length()<25);
 parent.updateWorldMatrix(true,false);const parentInv=parent.matrixWorld.clone().invert();
 // shared per-frame state: one clock for waves / plants, distance LOD from the drawing camera
 const uTime={value:0};let lastFrame=-1;
 const rockMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:0});
 const skirtMat=makeSkirtMaterial(new THREE.Color('#9fe0d8'));skirtMat.fragmentShader=skirtMat.fragmentShader.replace('vec4(uFoam, vA * vA)','vec4(uFoam, min(1.0, sqrt(vA) * 1.1))').replace('vec4(uTint, -vA)','vec4(uTint, -vA * 1.4)');
 const waveMat=makeWaveMaterial();waveMat.uniforms.uTime=uTime;waveMat.uniforms.uBend={value:0};
 // waves are positioned in the shader: bend them onto the sphere there (vendor file unchanged)
 waveMat.vertexShader=waveMat.vertexShader.replace('mix(0.07, 0.24, f)','mix(0.16, 0.55, f)').replace('vA = a * (1.0 - aRow) * 0.62;','vA = min(1.0, a * (1.0 - aRow) * 1.15);').replace('uniform float uPeriod;','uniform float uPeriod;\nuniform float uBend;').replace('vec4(p.x, 0.012 + 0.004 * (1.0 - f), p.y, 1.0)','vec4(p.x, 0.03 + 0.004 * (1.0 - f) - uBend * dot(p, p), p.y, 1.0)');
 const hoverMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});
 const states=[],_cam=new THREE.Vector3();
 // distance LOD: grass tufts / flowers only near, bushes and trees until mid range
 const applyLod=camera=>{camera.getWorldPosition(_cam);for(const st of states){const d=_cam.distanceTo(st.center),near=st.editing||d<st.r+70,mid=st.editing||d<st.r+260;
  for(const m of st.lodNear)m.visible=near&&m.count>0;for(const m of st.lodMid)m.visible=mid&&m.count>0;}};
 const tick=(renderer,scene,camera)=>{const f=renderer.info.render.frame;if(f===lastFrame)return;lastFrame=f;uTime.value=performance.now()/1000;applyLod(camera);};

 for(const[mi,sourceMass]of masses.entries()){withPalette(()=>{
  const tm=performance.now(),spire=!!sourceMass.spire,id=sourceMass.id;
  const metres=lv=>spire?LEVEL_Y[Math.min(lv,LEVEL_Y.length-1)]:SOFT_BANK_LEVEL_Y[BANK_LEVEL_MAP[Math.min(lv,BANK_LEVEL_MAP.length-1)]];
  const lobes=[...(sourceMass.lobes||sampleApostleLobes(sourceMass.generated))];
  if(spire&&!lobes.some(l=>l[4]===1)){const r0=makeRng(7305+mi*101),a=r0()*6.28,[,,rx,rz]=lobes[0];lobes.push([Math.cos(a)*rx*1.05,Math.sin(a)*rz*1.05,rx*.42,rz*.42,1,r0()]);}
  const footprint=sourceMass.footprint||lobes,seed=7300+mi*101,edgeNoise=spire?[.62,.2]:[.34,.09];
  // ---- placement: identical to twelveApostlesTarget.js (rail station s, lateral d, rendered water)
  const u=THREE.MathUtils.euclideanModulo(nearest.u+sourceMass.s/nearest.length,1),p=nearest.curve.getPointAt(u),t=nearest.curve.getTangentAt(u).normalize(),up0=p.clone().normalize(),lat=new THREE.Vector3().crossVectors(up0,t).normalize();
  const water=waterAt(p.clone().addScaledVector(lat,sourceMass.d).normalize());if(!water){report.masses.push({id,rejected:'no-water'});return;}
  const Y=water.clone().normalize(),X=lat.clone().addScaledVector(Y,-lat.dot(Y)).normalize(),Z=new THREE.Vector3().crossVectors(X,Y);
  const frame=new THREE.Matrix4().makeBasis(X,Y,Z).setPosition(water),Rw=water.length();
  const S=spire?1.25:2.1,L=LEVEL_M/S;                                  // S: metres per grid unit
  const bendU=(x,z)=>S*(x*x+z*z)/(2*Rw);                                // sphere drop in grid units at grid (x,z)
  const toWorld=(x,y,z)=>new THREE.Vector3(x,y-(x*x+z*z)/(2*Rw),z).applyMatrix4(frame);
  const nearRail=railPoints.filter(q=>q.distanceTo(water)<140);
  const reach0=clearance+1.2+.7*(spire?2.4:6);
  const blockedAt=(x,z,h)=>{for(const y of[0,h*.5,h]){const w=toWorld(x,y,z);for(const q of nearRail)if(q.distanceToSquared(w)<reach0*reach0)return'rail';if(protectedBoxes.some(e=>e.box.distanceToPoint(w)<2.5))return'protected';if(plazaMargin(w.clone().normalize())<6)return'town';}return null;};
  // ---- grid + world (deterministic per mass: the same grid comes back for saved edits)
  const ext=Math.max(...footprint.map(([cx,cz,rx,rz])=>Math.hypot(cx,cz)+Math.max(rx,rz)*1.25))+4;
  const grid=decorateCells(buildQuadGrid({radius:Math.ceil(ext/S)+3,hexSize:1,seed:strHash(id)%100000}));
  const index=buildCellIndex(grid),world=new World(grid);world.palette=PALETTES.town;
  // clearance cap per cell (lazy): the highest level a column may reach without touching rail / town / protected sites
  const cap=new Int8Array(grid.cells.length).fill(-1),drop={rail:0,protected:0,town:0};
  const maxLevelAt=c=>{if(cap[c.id]>=0)return cap[c.id];const x=c.cx*S,z=c.cz*S;let hm=MAX_LEVEL;while(hm>0){const why=blockedAt(x,z,hm*LEVEL_M);if(!why)break;hm--;}return cap[c.id]=hm;};
  // terrain: REACodeRefactoring terrain pipeline (apostlesTerrain.js) inside the approved composition
  const shrunk=footprint.map(l=>[l[0],l[1],l[2]*.78,l[3]*.78,l[4],l[5]]);
  const generate=()=>{const r=generateApostleTerrain(world,{seed,spire,
    mask:c=>{const x=c.cx*S,z=c.cz*S;return!lobeHeight(footprint,metres,x,z,seed+3,...edgeNoise)?0:lobeHeight(shrunk,metres,x,z,seed+3,...edgeNoise)?1:.62;},
    cap:c=>Math.max(1,Math.round(lobeHeight(lobes,metres,c.cx*S,c.cz*S,seed,...edgeNoise)/LEVEL_M)),limit:maxLevelAt,
    towers:spire?0:1,canyons:!spire,rivers:spire?0:1,caves:spire?1:2,overhangs:spire?0:3,arches:spire?0:1,stacks:0});
   clip();return r.features;};
  const clip=()=>{for(const c of grid.cells){const top=world.top(c);if(!top)continue;const hm=maxLevelAt(c);for(let lv=top;lv>hm;lv--)world.setSolid(c,lv,false);}world.touch();};
  const feats=generate();
  let restored=false;try{const saved=localStorage.getItem(EDIT_KEY(id));if(saved){decodeWorld(saved,world);clip();restored=true;}}catch{generate();}
  // ---- scene objects: one group per mass in its sea frame, uniform scale S
  const group=new THREE.Group();group.name='apostle-reacode-'+id;
  parent.add(group);parentInv.clone().multiply(frame).multiply(new THREE.Matrix4().makeScale(S,S,S)).decompose(group.position,group.quaternion,group.scale);
  const wm=new WorldMesh(world,{levelHeight:L});
  const rock=new THREE.Mesh(new THREE.BufferGeometry(),rockMat);rock.name='g30-far-mountain';rock.castShadow=rock.receiveShadow=true;rock.onBeforeRender=tick;
  const skirt=new THREE.Mesh(new THREE.BufferGeometry(),skirtMat);skirt.name='apostle-reacode-shore-skirt';skirt.renderOrder=2;
  const waveMatM=waveMat.clone();waveMatM.uniforms.uTime=uTime;waveMatM.uniforms.uBend={value:S/(2*Rw)};
  const waves=new THREE.Mesh(new THREE.BufferGeometry(),waveMatM);waves.name='apostle-reacode-shore-waves';waves.renderOrder=3;waves.frustumCulled=false;waves.onBeforeRender=tick;
  // ---- vegetation (life/vegetation.js), low-poly bushes / trees, no ink shells; instances bent onto the sphere
  const veg=new Vegetation({levelHeight:L,uTime,max:{tufts:spire?120:500,shrubs:spire?14:70,crowns:spire?2:8}});
  const oldGeo=new Set([veg.shrubs.geometry,...veg.crowns.map(c=>c.m.geometry)]);for(const m of[veg.shrubs,veg.shrubInk])m.geometry=SHRUB_LOW;veg.crowns.forEach((c,i)=>{if(CROWNS_LOW[i])c.m.geometry=c.ink.geometry=CROWNS_LOW[i];});for(const g of oldGeo)g.dispose();
  veg.shrubInk.visible=false;for(const c of veg.crowns)c.ink.visible=false;
  veg.group.name='apostle-reacode-vegetation';
  // edit hover: one quad on the picked cell
  const hover=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3)).setIndex([0,1,2,0,2,3]),hoverMat);hover.visible=false;hover.renderOrder=5;hover.frustumCulled=false;
  group.add(rock,skirt,waves,veg.group,hover);
  const bandPhase=makeRng(seed+99)()*6.28,tmp=new THREE.Color(),vn=new THREE.Vector3();
  // ---- mesh pass: WorldMesh (incremental chunks + bake), then limestone bands, wet foot, sphere bend
  const meshPass=()=>{if(!wm.rebuild()&&rock.geometry===wm.geometry)return false;
   const src=wm.geometry,pos=src.attributes.position,nor=src.attributes.normal,out=src.attributes.aOutline,col=src.attributes.color,k=S/Rw,foot=FOOT_M/S;
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);let y=pos.getY(i);
    if(Math.abs(nor.getY(i))<.55&&y*S>1.2){const ym=y*S,n=fbm(x*.35,z*.35,{octaves:2,freq:1,seed:seed+41}),b=Math.sin(ym*1.15+n*2.4+bandPhase),c=Math.sin(ym*.43+n*1.7+bandPhase*.7);
     tmp.setRGB(col.getX(i),col.getY(i),col.getZ(i));if(b>.55)tmp.lerp(BAND_WARM,(b-.55)*.9);else if(c<-.35)tmp.lerp(BAND_COOL,(-.35-c)*.75);else if(b<-.7)tmp.lerp(BAND_PALE,(-.7-b)*1.2);col.setXYZ(i,tmp.r,tmp.g,tmp.b);}
    const ym=y*S;if(ym<1.6){tmp.setRGB(col.getX(i),col.getY(i),col.getZ(i)).lerp(WET,(1-ym/1.6)*.5);col.setXYZ(i,tmp.r,tmp.g,tmp.b);}
    if(y<1e-4){y=-foot;tmp.setRGB(col.getX(i),col.getY(i),col.getZ(i)).lerp(WET_DEEP,.8);col.setXYZ(i,tmp.r,tmp.g,tmp.b);}
    pos.setY(i,y-bendU(x,z));
    for(const a of[nor,out]){const nx=a.getX(i),ny=a.getY(i),nz=a.getZ(i);vn.set(nx+ny*x*k,ny-(nx*x+nz*z)*k,nz+ny*z*k).normalize();a.setXYZ(i,vn.x,vn.y,vn.z);}}
   src.computeBoundingBox();src.computeBoundingSphere();rock.geometry=src;return true;};
  const shorePass=force=>{if(!force&&!wm.shoreDirty)return;const shore=buildShore(world,grid,index,{posts:wm.posts,shape:wm.shape});
   const sp=shore.skirt.attributes.position;for(let i=0;i<sp.count;i++){const x=sp.getX(i),z=sp.getZ(i);sp.setY(i,sp.getY(i)+.04/S-bendU(x,z));}shore.skirt.computeBoundingSphere();
   skirt.geometry.dispose();waves.geometry.dispose();skirt.geometry=shore.skirt;waves.geometry=shore.waves;};
  const mtx=new THREE.Matrix4(),vp=new THREE.Vector3();
  const vegPass=()=>{veg.refresh(world,wm.shape,wm.garden||{},seed);let plants=0;
   veg.group.traverse(o=>{if(!o.isInstancedMesh)return;for(let i=0;i<o.count;i++){o.getMatrixAt(i,mtx);vp.setFromMatrixPosition(mtx);mtx.elements[13]-=bendU(vp.x,vp.z);o.setMatrixAt(i,mtx);}
    o.instanceMatrix.needsUpdate=true;if(o.count){o.computeBoundingSphere?.();o.frustumCulled=true;plants+=o.count;}});
   veg.shrubInk.visible=false;for(const c of veg.crowns)c.ink.visible=false;return plants;};
  const refresh=({vegetation=true,shore=false}={})=>withPalette(()=>{meshPass();shorePass(shore);return vegetation?vegPass():0;});
  const plants=refresh({vegetation:true,shore:true});
  group.updateWorldMatrix(true,true);
  const src=rock.geometry,maxTop=Math.max(0,...grid.cells.map(c=>world.top(c)));
  rock.userData.apostleMass=id;
  rock.userData.seaStack={height:maxTop*LEVEL_M,radius:src.boundingSphere.radius*S,detailId:'apostle-'+id,seaAnchor:water.toArray(),worldUp:Y.toArray(),placement:'apostles-reacode',waterSupport:'rendered-ocean-triangle'};
  rock.userData.reacode={world,grid,index,levelHeight:L,scale:S};rock.userData.coastalSurface={revision:APOSTLES_REACODE_REVISION+':'+id,method:'reacode-worldmesh-baked-ao-bounce'};
  const center=group.localToWorld(src.boundingSphere.center.clone());
  const st={id,name:APOSTLE_MASS_NAMES[id]||id,spire,S,L,Rw,group,rock,world,grid,index,wm,veg,hover,center,r:src.boundingSphere.radius*S,editing:false,restored,
   lodNear:[veg.tufts,veg.tuftInk,veg.flowers].filter(Boolean),lodMid:[veg.shrubs,veg.trunks,...veg.crowns.map(c=>c.m)].filter(Boolean),
   bendU,maxLevelAt,clip,generate,refresh};
  states.push(st);
  const tris=wm.stats.triangles;report.triangles+=tris;
  let draws=0;group.traverse(o=>{if((o.isMesh||o.isInstancedMesh)&&o.visible&&o!==hover)draws++;});report.drawCalls+=draws;
  report.masses.push({id,s:sourceMass.s,d:sourceMass.d,scale:S,cells:grid.cells.length,land:grid.cells.filter(c=>world.top(c)).length,maxLevel:maxTop,height:+(maxTop*LEVEL_M).toFixed(1),restoredEdit:restored,
   features:{overhangs:feats.overhangs,arches:feats.arches,stacks:feats.stacks},dropped:drop,triangles:tris,bakeMs:wm.stats.bakeMs,plants,drawCalls:draws,buildMs:+(performance.now()-tm).toFixed(1)});
 });yield `正在用 REACodeRefactoring 构建十二门徒岩群（${mi+1}/${masses.length}）…`;}
 report.built=states.length;report.buildMs=+(performance.now()-t0).toFixed(1);
 return{rocks:states.map(s=>s.rock),report,editor:createApostlesEditor(states)};
}
export function buildTwelveApostlesReacode(options){const it=buildTwelveApostlesReacodeSteps(options);let r=it.next();while(!r.done)r=it.next();return r.value;}

/**
 * Edit targets for the lake build menu (morrisTownscaper.js). Each target has the same shape as the Morris lake
 * target: world / anchor / allowed / maxLevel / pickRay(local ray) / updateHover / rebuild / persist / reset / encode.
 */
function createApostlesEditor(states){
 const targets=new Map();
 const make=st=>{const {world,index,L,S,hover,bendU}=st;
  // world/app.js picking on the bent mass: march the local ray, test voxels with the sphere drop removed
  const pickRay=ray=>{const o=ray.origin,d=ray.direction,maxY=MAX_LEVEL*L+1.5,step=Math.max(.04,L*.14),p=new THREE.Vector3(),len=o.length()+st.r/S*3+40;
   const probe=(x,y,z)=>{const yu=y+bendU(x,z);if(yu<0)return{water:true,yu};if(yu>maxY)return null;const level=Math.min(MAX_LEVEL,Math.max(1,Math.floor(yu/L)+1));for(const cell of index.at(x,z)){if(!pointInQuad(cell.pts,x,z))continue;if(world.isSolid(cell,level))return{cell,level};}return null;};
   let prevT=0;for(let t=0;t<=len;t+=step){p.copy(o).addScaledVector(d,t);const hit=probe(p.x,p.y,p.z);
    if(hit){let a=prevT,b=t;for(let i=0;i<12;i++){const m=(a+b)*.5;p.copy(o).addScaledVector(d,m);if(probe(p.x,p.y,p.z))b=m;else a=m;}p.copy(o).addScaledVector(d,b);
     if(hit.water){for(const cell of index.at(p.x,p.z))if(pointInQuad(cell.pts,p.x,p.z))return{cell,level:0,point:p.clone(),water:true};return null;}
     return{cell:hit.cell,level:hit.level,point:p.clone()};}
    prevT=t;}
   return null;};
  const updateHover=(hit,mode)=>{if(!hit){hover.visible=false;return;}const cell=hit.cell;let lv;
   if(mode==='erase'){lv=hit.level||world.top(cell);if(!lv){hover.visible=false;return;}}
   else{const top=world.top(cell),empty=hit.level>=1&&!world.isSolid(cell,hit.level);lv=(empty?hit.level:Math.min(MAX_LEVEL,top+1))-1;}
   const pos=hover.geometry.getAttribute('position');for(let i=0;i<4;i++){const q=cell.pts[Math.min(i,cell.n-1)];pos.setXYZ(i,q.x,lv*L+.03-bendU(q.x,q.z),q.z);}pos.needsUpdate=true;
   hover.material.opacity=mode==='erase'?.4:.3;hover.material.color.set(mode==='erase'?0xff6a5a:0xffffff);hover.visible=true;};
  const persist=()=>{try{localStorage.setItem(EDIT_KEY(st.id),encodeWorld(world,'fusion'));return true;}catch{return false;}};
  return{id:'apostle:'+st.id,kind:'apostle',name:'十二门徒 · '+st.name,world,anchor:st.group,state:st,
   allowed:cell=>st.maxLevelAt(cell)>0,maxLevel:cell=>st.maxLevelAt(cell),clip:st.clip,pickRay,updateHover,
   rebuild:(opts={})=>st.refresh({vegetation:!!opts.vegetation}),
   persist(){st.refresh({vegetation:true});return persist();},
   reset(){st.generate();try{localStorage.removeItem(EDIT_KEY(st.id));}catch{}st.refresh({vegetation:true,shore:true});},
   encode:()=>encodeWorld(world,'fusion'),
   setEditing(on){st.editing=!!on;if(!on)hover.visible=false;},
   undo:[],redo:[]};};
 for(const st of states)targets.set('apostle:'+st.id,make(st));
 // root target 「十二门徒」: build from any camera (player, airship); the ray picks whichever mass it hits first
 const leaves=[...targets.values()],dirty=new Set(),_l=new THREE.Ray(),_m=new THREE.Matrix4(),_p=new THREE.Vector3();
 const root={id:'apostles',kind:'apostles',name:'十二门徒',world:leaves[0]?.world||null,anchor:leaves[0]?.anchor||null, // palette / menu reads; edits go to hit.world
  allowed:()=>true,maxLevel:()=>MAX_LEVEL,undo:[],redo:[],
  pickWorldRay(ray){let best=null;for(const t of leaves){const st=t.state;if(ray.distanceSqToPoint(st.center)>(st.r+6)**2)continue;
    t.anchor.updateWorldMatrix(true,false);_l.copy(ray).applyMatrix4(_m.copy(t.anchor.matrixWorld).invert());_l.direction.normalize();
    const hit=t.pickRay(_l);if(!hit||!t.allowed(hit.cell))continue;const d=_p.copy(hit.point).applyMatrix4(t.anchor.matrixWorld).distanceTo(ray.origin);
    if(!best||d<best.d)best={...hit,d,leaf:t,world:t.world,maxLevel:t.maxLevel};}return best;},
  updateHover(hit,mode){for(const t of leaves)t.updateHover(hit?.leaf===t?hit:null,mode);},
  rebuild(hit){if(hit?.leaf){dirty.add(hit.leaf);hit.leaf.rebuild();}},
  persist(){let ok=true;for(const t of dirty)ok=t.persist()&&ok;dirty.clear();return ok;},
  snapshot:()=>leaves.map(t=>({t,snap:t.world.snapshot(),v:t.world.version})),
  restore(list){for(const{t,snap,v}of list){if(t.world.version===v)continue;t.world.restore(snap);dirty.add(t);t.rebuild();}},
  reset(){for(const t of leaves)t.reset();dirty.clear();},
  encode:()=>JSON.stringify(Object.fromEntries(leaves.map(t=>[t.id,t.encode()]))),
  setEditing(on){for(const t of leaves)t.setEditing(on);}};
 return{root,
  list:()=>[...targets.values()].map(t=>({id:t.id,name:t.name})),
  target:id=>targets.get(id)||null,
  /** true when the camera is close to any mass (the build menu stays visible there) */
  near:(point,margin=120)=>states.some(st=>point.distanceTo(st.center)<st.r+margin),
  states};
}
