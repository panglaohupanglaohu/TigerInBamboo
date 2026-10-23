import * as T from 'three';
import {relicBuilder} from './relicMetal.js';
import {mergeStaticGroup} from '../world/geometryMerge.js';

export function createCitadelTrojanHorse({name='citadel-trojan-horse',seed=9901,scale=1}={}){
 const g=new T.Group();g.name=name;g.userData.preserveCitadelMaterials=true;g.userData.sourceId='wood-rearing-trojan-4-concealed-hip';g.userData.seed=seed;
 const grainData=new Uint8Array(128*256*4);
 for(let y=0;y<256;y++)for(let x=0;x<128;x++){const wave=Math.sin(x*.53+Math.sin(y*.021)*1.8),fine=Math.sin(x*2.17+y*.031),v=Math.round(245+wave*5+fine*2),i=(y*128+x)*4;grainData.set([v,v,v,255],i);}
 const grain=new T.DataTexture(grainData,128,256,T.RGBAFormat);grain.colorSpace=T.SRGBColorSpace;grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.needsUpdate=true;
 const wood=(name,color)=>{const material=new T.MeshStandardMaterial({name,color,map:grain,roughness:.88,metalness:0});material.userData.preserveCitadelMaterial=true;return material;};
 const oak=wood('troy-weathered-oak',0xa8794f),endgrain=wood('troy-cut-oak',0xb68c5e),walnut=wood('troy-dark-wood',0x58402d),aged=wood('troy-aged-timber',0x8b633f);
 const m={brass:oak,gold:endgrain,bronze:aged,dark:walnut},b=relicBuilder(g),{mesh,ell,box,rod,ring}=b;
 function flank(name,zy,x,depth,mat){const p=b.plate(name,zy.map(([z,y])=>[-z,y]),0,depth,mat);p.rotation.y=Math.PI/2;p.position.x=x;return p;}
 function neckSection(name,rows,mat){const pos=[],ix=[],n=24;for(const [y,z,rx,rz]of rows)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;pos.push(Math.sin(a)*rx,y,z+Math.cos(a)*rz);}for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,c=a+n+1;ix.push(a,a+1,c,a+1,c+1,c);}const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(pos,3));geom.setIndex(ix);geom.computeVertexNormals();return mesh(name,geom,mat);}
 box('troy-metal-platform',[0,.43,0],[4.8,.40,7.6],m.dark);
 for(const s of[-1,1]){
  box('chassis-brass-inlay',[s*2.4,.51,0],[.05,.08,7.5],m.gold);
  for(const z of[-2.7,2.7]){
   rod('axle',[-2.64,.68,z],[2.64,.68,z],.12,m.dark);
   const w=mesh('troy-wheel',new T.CylinderGeometry(.68,.68,.35,40),m.bronze,[s*2.55,.68,z]);w.rotation.z=Math.PI/2;
   ring('wheel-brass-rim',[s*2.74,.68,z],.59,.045,m.gold,'x');ring('wheel-inset',[s*2.755,.68,z],.42,.024,m.dark,'x');
   const hub=mesh('wheel-hub',new T.CylinderGeometry(.19,.19,.11,24),m.gold,[s*2.77,.68,z]);hub.rotation.z=Math.PI/2;
   for(let i=0;i<6;i++){const a=i*Math.PI/3;rod('wheel-spoke',[s*2.76,.68+Math.sin(a)*.22,z+Math.cos(a)*.22],[s*2.76,.68+Math.sin(a)*.53,z+Math.cos(a)*.53],.038,m.gold);}
  }
 }
 const joints={},restQuaternions=new Map();
 function pivot(name,point,parent=g){const o=new T.Group();o.name=name;o.userData.trojanJoint=true;g.add(o);o.position.set(...point);g.updateMatrixWorld(true);if(parent!==g)parent.attach(o);restQuaternions.set(o,o.quaternion.clone());return o;}
 function attachParts(joint,make){const before=new Set(g.children);make();g.updateMatrixWorld(true);for(const o of [...g.children])if(!before.has(o))joint.attach(o);}
 const body=ell('troy-gunmetal-torso',[0,4.23,0],[1.43,1.19,2.55],m.dark);body.rotation.x=-.14;
 // Overlapping bronze hull bands leave dark joints instead of plank seams.
 for(let i=0;i<8;i++){const z=-2.1+i*.59,y=4.23+z*.14;const r=mesh('body-armour-band',new T.CylinderGeometry(1,1,.53,16,1,true),i%3===0?m.bronze:m.brass,[0,y,z]);r.rotation.x=Math.PI/2;r.scale.set(1.47,1,1.21);}
 for(const s of[-1,1]){
  // The hip is buried in the body. The stifle stays up inside the fleshy
  // thigh silhouette, rather than becoming an extra exposed axle under it.
  // One backward-bent hock and a forward-sloping pastern finish the chain.
  const hip=[s*.96,4.25,-1.87],stifle=[s*1.08,3.35,-1.13],hock=[s*1.18,1.60,-2.14],hoof=[s*1.18,.79,-1.6];
  const shoulder=[s*1.04,4.78,1.83],elbow=[s*1.1,4.2,3.12],wrist=[s*1.14,3.32,2.83],forehoof=[s*1.14,3.11,3.07];
  for(const [label,points,names]of[['hind',[hip,stifle,hock,hoof],['hip','stifle','hock','hoof']],['fore',[shoulder,elbow,wrist,forehoof],['shoulder','elbow','wrist','hoof']]]){
   const id=label+(s<0?'Left':'Right'),chain={};let parent=g;
   for(let j=0;j<4;j++){const joint=pivot(id+'-'+names[j],points[j],parent);chain[names[j]]=joint;parent=joint;}
   if(label==='hind')Object.defineProperty(chain,'knee',{value:chain.stifle,enumerable:false}); // Existing pose API alias, not a fifth joint.
   joints[id]=chain;
   if(label==='hind'){
    attachParts(chain.hip,()=>{
     ell('full-wooden-haunch',[s*.92,4.25,-1.83],[.83,.93,.93],m.brass);
     const A=new T.Vector3(...hip),B=new T.Vector3(...stifle),delta=B.clone().sub(A);
     const thigh=ell('continuous-powerful-hind-thigh',A.clone().lerp(B,.53).toArray(),[.57,delta.length()*.58,.59],m.brass);thigh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
     // Overlapping solid wood at a single real stifle. No hip disk or exposed
     // intermediate rod lies between the haunch and this short upper segment.
     ell('concealed-stifle-socket',stifle,[.31,.31,.31],m.brass);
    });
    attachParts(chain.stifle,()=>{
     ell('wood-stifle-knuckle',stifle,[.32,.32,.32],m.brass);
     rod('solid-hind-shin',stifle,hock,.24,m.brass,.34);
     ell('hind-hock-socket',hock,[.21,.21,.21],m.bronze);
    });
    attachParts(chain.hock,()=>{
     ell('single-wood-hock',hock,[.235,.235,.235],m.bronze);
     rod('hind-pastern',hock,hoof,.19,m.brass,.22);
     ell('hind-hoof-socket',hoof,[.21,.20,.21],m.bronze);
    });
   }else for(let j=0;j<3;j++)attachParts(chain[names[j]],()=>{
    rod('fore-timber-bone',points[j],points[j+1],j===0?.23:.13,m.dark);
    const a=new T.Vector3(...points[j]),c=new T.Vector3(...points[j+1]);
    rod('fore-carved-limb',a.clone().lerp(c,.12).toArray(),a.clone().lerp(c,.85).toArray(),j===0?.34:.21,m.brass,j===0?.28:.17);
    const p=points[j];ell('fore-joint',p,[j?.25:.42,j?.25:.42,j?.25:.42],m.dark);ring('fore-gold-bearing',[p[0]+s*(j?.255:.425),p[1],p[2]],j?.16:.29,.055,m.gold,'x');
   });
   attachParts(chain.hoof,()=>{const p=points[3];if(label==='hind')ell('wood-fetlock-at-hoof',p,[.225,.225,.225],m.bronze);box(label+'-wood-hoof',[p[0],p[1]-.11,p[2]+.07],[.60,.37,.69],m.bronze);});
  }
  // Raised side hatch is decorative; functional belly opening stays at the
  // original controller's descent anchors (local y=2.46).
  flank('side-hatch',[[-.9,3.49],[.87,3.67],[.93,4.98],[-.94,4.76]],s*1.45,.075,m.bronze);
  ring('hatch-civilization-seal',[s*1.56,4.23,0],.32,.036,m.gold,'x');
  rod('hatch-symbol',[s*1.57,3.79,0],[s*1.57,4.67,0],.025,m.gold);
  for(const z of[-.94,.94])for(const y of[3.82,4.5])rod('hatch-hinge',[s*1.56,y,z],[s*1.56,y+.25,z],.075,m.gold);
 }
 neckSection('arched-neck-core',[[4.3,1.82,.87,.9],[5.12,1.94,.79,.86],[5.91,2.12,.64,.75],[6.58,2.38,.48,.62],[7.18,2.76,.46,.57],[7.59,3.10,.45,.54]],m.dark);
 for(let i=0;i<8;i++){const t=i/8,y=4.7+t*2.78,z=1.86+t*t*1.19,rx=.86-t*.40,rz=.86-t*.30;neckSection('neck-lapped-armour',[[y,z,rx,rz],[y+.35,z+.11,rx-.018,rz-.025]],i%3===0?m.bronze:m.brass);}
 // A single solid long wedge from poll to muzzle, with a broad horse jaw.
 // Faceted oval sections form a continuous forehead/nose rather than round balls.
 const headRows=[[2.71,7.55,.43,.43],[3.07,7.49,.53,.56],[3.40,7.26,.55,.53],[3.83,7.02,.37,.38],[4.24,6.76,.30,.29],[4.66,6.59,.32,.26],[4.86,6.56,.28,.23]];
 const hp=[],hi=[],hn=12;
 for(const[z,y,rx,ry]of headRows)for(let i=0;i<=hn;i++){const a=i/hn*Math.PI*2;hp.push(Math.cos(a)*rx,y+Math.sin(a)*ry,z);}
 for(let j=0;j<headRows.length-1;j++)for(let i=0;i<hn;i++){const a=j*(hn+1)+i,c=a+hn+1;hi.push(a,a+1,c,a+1,c+1,c);}
 for(const[j,reverse]of[[0,true],[headRows.length-1,false]]){const center=hp.length/3;hp.push(0,headRows[j][1],headRows[j][0]);for(let i=0;i<hn;i++){const a=j*(hn+1)+i;hi.push(center,reverse?a+1:a,reverse?a:a+1);}}
 const hg=new T.BufferGeometry();hg.setAttribute('position',new T.Float32BufferAttribute(hp,3));hg.setIndex(hi);hg.computeVertexNormals();mesh('carved-long-horse-head',hg,m.brass);
 for(const s of[-1,1]){
  ell('full-horse-cheek',[s*.405,7.14,3.19],[.25,.40,.42],m.brass);
  ell('horse-eye',[s*.505,7.48,3.27],[.018,.054,.067],m.dark);
  rod('carved-brow',[s*.49,7.61,3.17],[s*.49,7.51,3.44],.043,m.bronze);
  ell('inset-nostril',[s*.300,6.68,4.56],[.011,.045,.070],m.dark);
  rod('muzzle-mouth-seam',[s*.275,6.49,4.36],[s*.27,6.43,4.79],.012,m.dark);
  const ear=mesh('carved-horse-ear',new T.ConeGeometry(.145,.64,4),m.brass,[s*.29,8.00,2.96]);ear.rotation.x=-.18;
 }
 for(let j=0;j<10;j++){
  const y=4.91+j*.28,z=1.0+j*.17;
  flank('segmented-metal-mane',[[z,y],[z-.47,y+.03],[z-.37,y+.38],[z+.27,y+.40]],-.10,.20,m.bronze);
 }
 // Swept segmented metal tail, comfortably within the old actor bounds.
 const tail=[[0,4.66,-2.08],[0,4.44,-2.88],[0,3.69,-3.18],[0,2.89,-3.50],[0,2.23,-3.59]];
 for(let i=0;i<tail.length-1;i++)rod('tail-spine',tail[i],tail[i+1],.16-i*.027,m.dark);
 for(let i=0;i<7;i++)for(const s of[-1,1])flank('tail-metal-scale',[[-2.52-i*.15,4.40-i*.29],[-3.03-i*.13,4.27-i*.30],[-3.22-i*.10,3.73-i*.25],[-2.69-i*.15,4.03-i*.27]],s*.12,.11,m.brass);
 // Keep the original belly doors and API independent from static batching.
 const hatch=new T.Group();hatch.name='troy-belly-hatch';g.add(hatch);
 // Timber sides join the low functional hatch to the raised belly. The central
 // descent opening remains clear for the original night-time soldier anchors.
 for(const s of[-1,1])box('belly-hatch-timber-cheek',[s*.88,2.97,0],[.12,.96,1.94],m.bronze);
 const hb=relicBuilder(hatch),cavity=hb.box('troy-belly-cavity',[0,2.48,0],[1.7,.08,1.9],m.dark),doors=[];
 for(const s of[-1,1])doors.push(hb.box(s<0?'troy-belly-door-left':'troy-belly-door-right',[s*.43,2.53,0],[.82,.08,1.82],m.bronze));
 const setOpen=amount=>{const a=T.MathUtils.clamp(Number(amount)||0,0,1);doors[0].rotation.z=.92*a;doors[1].rotation.z=-.92*a;cavity.visible=a>.01;hatch.userData.open=a;};
 hatch.userData={cavity,doors,setOpen,open:0};g.userData.bellyHatch=hatch.userData;g.userData.setBellyOpen=setOpen;setOpen(0);
 // All parts sharing a wood material need UVs before static batching, including
 // the custom neck/head surfaces; otherwise a missing UV strips the whole batch.
 g.traverse(o=>{if(!o.isMesh||o.geometry.attributes.uv)return;const p=o.geometry.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push(p.getX(i)*.35+p.getZ(i)*.23,p.getY(i)*.17);o.geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));});
 // Merge within each rigid link only; never bake joints into the body.
 for(const chain of Object.values(joints))for(const joint of Object.values(chain))mergeStaticGroup(joint,{mergedTag:'trojan-rigid-link',skip:o=>o.parent!==joint});
 const jointAncestor=o=>{for(let p=o.parent;p&&p!==g;p=p.parent)if(p.userData.trojanJoint)return true;return false;};
 mergeStaticGroup(g,{mergedTag:'trojan-carved-wood',skip:o=>o.parent===hatch||jointAncestor(o)});
 const rider=pivot('troy-rider-seat',[0,5.39,-.20]);rider.userData.trojanJoint=false;
 const leftRein=pivot('troy-rein-left',[-.33,6.63,4.41]),rightRein=pivot('troy-rein-right',[.33,6.63,4.41]);
 g.userData.ridingAnchors={seat:rider,leftRein,rightRein,forward:[0,0,1],implementedGameplay:false};
 g.userData.articulation={version:2,hindChain:['hip','stifle','hock','hoof'],hiddenHip:true,stifleWithinThigh:true,kneeAlias:'stifle',joints,axis:'local-X',setJoint(chain,name,angle){const joint=joints[chain]?.[name];if(!joint||!Number.isFinite(angle))return false;joint.quaternion.copy(restQuaternions.get(joint)).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),T.MathUtils.clamp(angle,-.65,.65)));return true;},reset(){for(const chain of Object.values(joints))for(const joint of Object.values(chain))joint.quaternion.copy(restQuaternions.get(joint));},limits:[-.65,.65],locomotionImplemented:false};
 // Scale geometry and local translations like the old factory, allowing callers
 // to retain their independent actor scale and ground placement.
 if(scale!==1)g.traverse(o=>{if(o===g)return;o.position.multiplyScalar(scale);if(o.isMesh)o.geometry.scale(scale,scale,scale);});
 g.userData.pose='raised-forelegs-crouched-hindlegs';return g;
}
