import {buildHistoricRelief} from './historicRelief.js';
import * as THREE from 'three';

// Scoped, reversible weathering of the existing holy city, never global palettes.
// Each entry is a cumulative construction pass, exposed for identical-camera review.
export const HISTORIC_PASSES = [
 ['old','emission','旧城：去除石墙自发光'],['old','warm','旧城：暖灰石灰岩'],
 ['old','rough','旧城：粗糙石材'],['old','blocks','旧城：大块石材色差'],
 ['old','joints','旧城：错缝灰浆'],['old','wash','旧城：矿物斑驳'],
 ['old','rain','旧城：竖向雨水痕'],['old','damp','旧城：墙脚湿痕'],
 ['old','pits','旧城：细小风化孔'],['old','repairs','旧城：补砌石块'],
 ['new','emission','新城：去除石墙自发光'],['new','warm','新城：暖白旧石'],
 ['new','rough','新城：石材消光'],['new','blocks','新城：砌块色差'],
 ['new','joints','新城：错缝灰浆'],['new','wash','新城：矿物斑驳'],
 ['new','rain','新城：雨痕'],['new','damp','新城：临水湿痕'],
 ['new','pits','新城：表面石孔'],['new','repairs','新城：修补砌块'],
 ['gate','emission','高山之门：移除墙面自发光'],['gate','warm','高山之门：暖灰砂石'],
 ['gate','rough','高山之门：粗糙石面'],['gate','blocks','高山之门：巨石色差'],
 ['gate','joints','高山之门：粗灰浆缝'],['gate','wash','高山之门：矿物沉积'],
 ['gate','rain','高山之门：长雨痕'],['gate','damp','高山之门：潮湿基脚'],
 ['gate','pits','高山之门：风化石孔'],['gate','repairs','高山之门：历代补石'],
 ['old','cornice','旧城：石缝积灰'],['new','cornice','新城：檐部积灰'],['gate','cornice','高山之门：石缝深色沉积'],
 ['old','foot','旧城：基座厚重色层'],['new','foot','新城：承重墙脚色层'],['gate','foot','高山之门：门柱基座色层'],
 ['old','roof','旧城：穹顶陶土斑驳'],['new','roof','新城：陶顶色差'],['gate','bronze','高山之门：旧铜、常绿植被与岩石原色'],
 ['old','recess','旧城：窗洞压暗'],['new','recess','新城：窗洞压暗'],['gate','recess','高山之门：壁龛压暗'],
 ['old','relief','旧城：灰缝凹凸'],['new','relief','新城：灰缝凹凸'],['gate','relief','高山之门：石块凹凸'],
 ['old','chips','旧城：城垛边缘石损'],['new','chips','新城：石柱边缘石损'],['gate','chips','高山之门：压顶石损'],
 ['all','paving','三处：磨损铺石'],['all','balance','三处：远景纹理抗闪烁与色差平衡'],
];
const states = new WeakMap();
function semanticGateSurfaces(root){
 const entries=[];if(root.name!=='highland-gate')return entries;
 root.traverse(o=>{
  if(!o.isMesh||Array.isArray(o.material))return;
  const names=[o.name,...(o.userData.sources||[])].join(' ');
  const color=/wall-ivy|rock-shrub/.test(names)?0x536849:/cypress-trunk|vine-stem/.test(names)?0x705b43:/cypress/.test(names)?0x3e5848:/foot-rock|Gate_rock|rock-foundation/.test(names)?0x7d8075:null;
  if(color===null)return;const original=o.material,m=original.clone();o.material=m;entries.push({m,original,color});
 });return entries;
}
const skip=/soldier|trooper|horse|bird|crew|player|courier|torch|glow|lamp|waterfall|cloud|light|particle|projectile|foliage|leaf|tree|cypress|pine|shrub|grass|canopy|plant|flower|vegetation|banner|cloth|flag|rope|rail|tram/i;
export function historicRound(){const n=new URLSearchParams(location.search).get('citadelHistory');return n===null?50:Math.max(0,Math.min(50,Number(n)||0));}
const hash=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};
let mask;
function stoneMask(){
 if(mask)return mask;
 const N=512,data=new Uint8Array(N*N*4);
 // R: individual ashlar value, G: soft mineral wash, B: pits/rain, A: mortar.
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const row=Math.floor(y/64),sx=(x+(row%2)*64)%N,col=Math.floor(sx/128),edge=Math.min(sx%128,128-sx%128,y%64,64-y%64);
  const grain=hash(x,y),block=hash(col,row),wave=(Math.sin(x*.033+y*.017)+Math.sin(x*.013-y*.057)+2)/4;
  const i=(y*N+x)*4;data[i]=100+block*145;data[i+1]=80+wave*150;data[i+2]=grain>.976?30:150+Math.sin(x*.19+Math.sin(y*.017))*(30+grain*25);data[i+3]=Math.round(Math.min(1,Math.max(0,(edge-1)/2))*255);
 }
 mask=new THREE.DataTexture(data,N,N);mask.wrapS=mask.wrapT=THREE.RepeatWrapping;mask.magFilter=THREE.LinearFilter;mask.minFilter=THREE.LinearMipmapLinearFilter;mask.generateMipmaps=true;mask.anisotropy=4;mask.needsUpdate=true;mask.name='historic-ashlar-masks';return mask;
}
function classification(o,m,root){
 if(Array.isArray(o.userData.sources)&&o.userData.sources.some(n=>skip.test(n)||/rock/.test(n)))return null;
 let district=root.name==='highland-gate'?'gate':'old',label=o.name+' '+m.name;
 for(let a=o;a&&a!==root;a=a.parent){if(skip.test(a.name))return null;if(a.name==='highland-west-city')district='new';if(!a.name.includes('assembly')&&/terrain|rock|cliff|ravine|peaks|ridge|slope/.test(a.name)&&!a.name.includes('foundation-platform')&&!label.includes('foundation-platform'))return null;if(a!==o)label+=' '+a.name;}
 if(district==='old'&&!/town-terrace-|central-sacred-tower|foundation-platform|old-town-rampart|holy-old|old-palace|pilgrimage|waterfront/.test(label))return null;
 if(o.userData.isOutline||m.isShaderMaterial||!m.isMeshStandardMaterial||m.transparent||!m.color)return null;
 if(/water-surface|water-channel|jade-pool|terrain|mountain-(wall|slope)|ridge|rock|cliff|bench|wood|door|trunk/.test(o.name+' '+m.name))return null;
 const h={};m.color.getHSL(h);
 let role=/window|niche|recess|Gate_dark/.test(o.name)?'recess':/roof|dome|tile/.test(o.name+' '+m.name)||m.userData.townscaperPattern==='roof'?'roof':/gold|bronze|brass|finial/.test(o.name)?'bronze':/paving|pavement|deck|walkable|step|stair|spiral|plaza-floor/.test(o.name)?'paving':'stone';
 if(role==='stone'&&h.s>.33&&h.h<.105)role='roof';
 // Dark hardware and coloured props are not limestone.
 if(role==='stone'&&(h.l<.10||h.s>.50))return null;
 return {district,role};
}
function installMaterial(original,root,district,role,state){
 const m=original.clone();m.onBeforeCompile=original.onBeforeCompile;const previous=m.onBeforeCompile;
 const u={ageInverse:{value:new THREE.Matrix4()},ageMask:{value:stoneMask()},ageA:{value:new THREE.Vector4()},ageB:{value:new THREE.Vector4()},ageC:{value:new THREE.Vector4()},ageD:{value:new THREE.Vector4()}};
 const entry={m,original,district,role,u};state.materials.push(entry);
 m.onBeforeCompile=function(shader,renderer){
  previous?.call(this,shader,renderer);Object.assign(shader.uniforms,u);
  shader.vertexShader='varying vec3 vHistoric; uniform mat4 ageInverse;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 hp=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
   hp=instanceMatrix*hp;
   #endif
   vHistoric=(ageInverse*modelMatrix*hp).xyz;`);
  shader.fragmentShader='varying vec3 vHistoric; uniform sampler2D ageMask; uniform vec4 ageA; uniform vec4 ageB; uniform vec4 ageC; uniform vec4 ageD;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 hn=abs(normalize(cross(dFdx(vHistoric),dFdy(vHistoric))));
   vec2 huv=hn.y>.72?vHistoric.xz*.30:vec2(hn.x>hn.z?vHistoric.z:vHistoric.x,vHistoric.y)*vec2(.28,.34);
   vec4 hm=texture2D(ageMask,huv);
   vec4 hw=texture2D(ageMask,huv*.193+vec2(.137,.391));
   float vertical=1.0-smoothstep(.5,.85,hn.y);
   float rowShade=(1.0-hm.a)*ageA.y;
   float broad=(hw.g-.5)*ageA.z;
   float rain=max(0.0,.70-hm.b)*ageA.w*vertical*(.4+hw.g);
   float damp=(1.0-smoothstep(0.0,3.8,vHistoric.y-ageD.x))*ageB.x;
   float pits=max(0.0,.4-hm.b)*ageB.y;
   float repair=step(.86,hm.r)*ageB.z;
   float deposit=(1.0-hm.a)*ageB.w*vertical;
   float baseBand=(1.0-smoothstep(0.0,8.0,vHistoric.y-ageD.x))*ageC.x;
   float value=1.0+(hm.r-.72)*ageA.x-rowShade+broad-rain-damp-pits+repair-deposit-baseBand;
   diffuseColor.rgb*=max(.40,value);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,.79,.64),damp*.34);
   diffuseColor.rgb*=1.0+ageC.y*(hw.g-.60);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // Small derivative relief; does not displace the walkable or collision surfaces.
   float hh=texture2D(ageMask,huv).a;
   vec3 hx=-dFdx(vViewPosition),hy=-dFdy(vViewPosition);
   vec3 hr1=cross(hy,normal),hr2=cross(normal,hx);
   float hd=dot(hx,hr1);
   normal=normalize(abs(hd)*normal-sign(hd)*ageC.z*(dFdx(hh)*hr1+dFdy(hh)*hr2));
  `);
 };
 m.customProgramCacheKey=()=>`historic-stone-v1-${original.customProgramCacheKey?.()||''}`;
 m.userData.historicStone=true;m.needsUpdate=true;return m;
}
function chipCandidate(o,district){
 const label=o.name;
 if(district==='old'&&!/merlon|crenel|parapet/.test(label))return false;
 if(district==='new'&&!/pilaster|coping|pillar|column-base/.test(label))return false;
 if(district==='gate'&&!/keystone|stone-plinth|ashlar/.test(label))return false;
 return !!o.geometry?.attributes?.position&&!o.isInstancedMesh;
}
function chippedGeometry(source,district){
 const g=source.clone();g.computeBoundingBox();const box=g.boundingBox,sz=box.getSize(new THREE.Vector3());
 if(Math.min(sz.x,sz.y,sz.z)<(district==='new'?.035:.12)||Math.max(sz.x,sz.y,sz.z)>(district==='new'?24:8)){g.dispose();return null;}
 const p=g.attributes.position,c=box.getCenter(new THREE.Vector3());
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=.012+.016*hash(Math.round(x*67)+Math.round(z*31),Math.round(y*71));
  // Identical coordinates use identical erosion, so duplicated face vertices stay welded.
  p.setXYZ(i,x+(c.x-x)*f,y+(c.y-y)*f,z+(c.z-z)*f);
 }
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function applyHistoricStone(root,round=historicRound()){
 if(!root||(!states.has(root)&&round===0))return null;
 let state=states.get(root);
 if(!state){state={root,round:0,materials:[],meshes:[],cache:new Map(),relief:buildHistoricRelief(root),semantic:semanticGateSurfaces(root)};states.set(root,state);root.userData.historicStone={round:0};}
 root.updateMatrixWorld(true);
 root.traverse(o=>{
  if(!o.isMesh||o.userData.historicStone)return;
  let category=null;
  const swap=m=>{const cl=classification(o,m,root);if(!cl)return m;category=cl;const key=m.uuid+cl.district+cl.role;let material=state.cache.get(key);if(!material){material=installMaterial(m,root,cl.district,cl.role,state);state.cache.set(key,material);}return material;};
  const old=o.material,next=Array.isArray(old)?old.map(swap):swap(old);
  if(category){o.material=next;o.userData.historicStone=true;const e={o,...category,geometry:o.geometry,chipped:null};state.meshes.push(e);}
 });
 setHistoricRound(root,round);return historicReport(root);
}
export function setHistoricRound(root,round){
 const s=states.get(root);if(!s)return;s.round=Math.max(0,Math.min(50,Math.floor(round)));
 const active={old:{},new:{},gate:{}};for(const[d,k]of HISTORIC_PASSES.slice(0,s.round))for(const a of d==='all'?Object.values(active):[active[d]])a[k]=true;
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
 for(const e of s.materials){
  const a=active[e.district],m=e.m,orig=e.original,stone=e.role==='stone'||e.role==='paving';
  m.color.copy(orig.color);m.emissive.copy(orig.emissive);m.emissiveIntensity=orig.emissiveIntensity;m.roughness=orig.roughness;m.metalness=orig.metalness;
  if(stone){if(a.emission){m.emissive.set(0);m.color.multiplyScalar(.985);}if(a.warm)m.color.multiply(new THREE.Color(e.district==='new'?0xf9f3e6:0xede5d5));if(a.rough){m.roughness=.94;m.metalness=0;}}
  if(e.role==='recess'&&a.recess){m.color.multiplyScalar(.50);m.emissive.multiplyScalar(.2);}
  if(e.role==='bronze'&&a.bronze){m.color.set(0x6e7356);m.roughness=.78;m.metalness=.48;m.emissive.set(0);}
  const enabled=stone&&(e.role!=='paving'||a.paving),strength=e.district==='new'?.8:1;
  const val=k=>enabled&&a[k]?strength:0;
  e.u.ageInverse.value.copy(inverse);e.u.ageD.value.x=e.district==='old'?4.95:e.district==='new'?4:0;
  e.u.ageA.value.set(val('blocks')*.42,val('joints')*.22,val('wash')*.26,val('rain')*.26);
  e.u.ageB.value.set(val('damp')*.20,val('pits')*.28,val('repairs')*.075,val('cornice')*.16);
  e.u.ageC.value.set(val('foot')*.10,e.role==='roof'&&a.roof?.38:0,val('relief')*.045,0);
  if(a.balance){e.u.ageA.value.x*=.88;e.u.ageB.value.y*=.7;}
 }
 for(const e of s.semantic){e.m.color.copy(e.original.color);e.m.emissive.copy(e.original.emissive);e.m.emissiveIntensity=e.original.emissiveIntensity;if(s.round>=39){e.m.color.set(e.color);e.m.emissive.set(0);e.m.roughness=1;}}
 for(const g of s.relief)g.visible=s.round>=g.userData.historyRound;
 for(const e of s.meshes){const enabled=active[e.district].chips&&e.role==='stone'&&chipCandidate(e.o,e.district);if(enabled&&!e.chipped)e.chipped=chippedGeometry(e.geometry,e.district);e.o.geometry=enabled&&e.chipped?e.chipped:e.geometry;}
 root.userData.historicStone=historicReport(root);return root.userData.historicStone;
}
export function historicReport(root){const s=states.get(root);if(!s)return null;return{round:s.round,pass:HISTORIC_PASSES[s.round-1]?.[2]||'baseline',semanticSurfaces:s.semantic.length,relief:s.relief.map(g=>({name:g.name,visible:g.visible,parts:g.userData.parts})),materials:s.materials.length,meshes:s.meshes.length,chipped:s.meshes.filter(e=>e.chipped&&e.o.geometry===e.chipped).length,districts:Object.fromEntries(['old','new','gate'].map(k=>[k,s.meshes.filter(e=>e.district===k).length])),roles:Object.fromEntries(['old','new','gate'].map(k=>[k,Object.fromEntries(['stone','paving','roof','recess','bronze'].map(r=>[r,s.materials.filter(e=>e.district===k&&e.role===r).length]))])),chipsByDistrict:Object.fromEntries(['old','new','gate'].map(k=>[k,s.meshes.filter(e=>e.district===k&&e.chipped&&e.o.geometry===e.chipped).length]))};}
