import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const mat=(c,r=.8,m=0)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m});
function ellipsoid(parent,material,pos,scale){const m=new T.Mesh(new T.SphereGeometry(1,16,10),material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;parent.add(m);return m;}
function tube(parent,material,pts,r=.025){const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>V(...p))),Math.max(8,pts.length*5),r,5,false),material);parent.add(m);return m;}
function compact(group){group.updateMatrixWorld(true);const buckets=new Map(),inverse=group.matrixWorld.clone().invert();for(const m of [...group.children]){if(!m.isMesh)continue;const g=m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld));if(!buckets.has(m.material))buckets.set(m.material,[]);buckets.get(m.material).push(g);group.remove(m);m.geometry.dispose();}for(const[material,geos]of buckets){const g=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());const m=new T.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;group.add(m);}}

function neckLoft(){const p=[],ix=[],sections=[[0,0,.40,.31],[.23,.02,.38,.33],[.52,.10,.31,.29],[.84,.19,.27,.25],[1.12,.34,.23,.22],[1.40,.48,.21,.20]];for(let j=0;j<sections.length;j++){const[y,z,rx,rz]=sections[j];for(let k=0;k<16;k++){const a=k/16*Math.PI*2;p.push(Math.cos(a)*rx,y,Math.sin(a)*rz+z);if(j<sections.length-1){const n=j*16+k,b=j*16+(k+1)%16;ix.push(n,n+16,b,b,n+16,b+16);}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.length/3*2),2));g.setIndex(ix);g.computeVertexNormals();return g;}
// Authored draft-horse proportions. The grazing neck is articulated; brocade,
// raised gold vines, bridle, bells and tassels are real geometry, not a decal.
export function createMorrisHorse({coat=0xe6dcc0,cloth=0x8b303a,seed=0}={}){
 const root=new T.Group();root.name='morris-decorated-draft-horse';
 const body=new T.Group(),neck=new T.Group(),tail=new T.Group();root.add(body,neck,tail);
 const skin=mat(coat),mane=mat(new T.Color(coat).getHSL({}).l>.55?0xcbb995:0x46372c),hoof=mat(0x302f2b),velvet=mat(cloth,.98),blue=mat(0x174b53,.95),gold=mat(0xb99b51,.48,.22),ivory=mat(0xf6e8c8),dark=mat(0x1b2424);
 ellipsoid(body,skin,[0,1.72,0],[.65,.67,1.2]);ellipsoid(body,skin,[0,1.67,.72],[.66,.72,.58]);ellipsoid(body,skin,[0,1.68,-.82],[.71,.69,.56]);
 const legs=[];
 for(const x of [-.43,.43])for(const z of [-.83,.7]){const leg=new T.Group();leg.position.set(x,1.6,z);root.add(leg);ellipsoid(leg,skin,[0,-.48,0],[.21,.62,.23]);const knee=new T.Group();knee.position.set(0,-.86,0);leg.add(knee);ellipsoid(knee,skin,[0,-.18,.06],[.13,.38,.14]);ellipsoid(knee,ivory,[0,-.45,.04],[.18,.16,.2]);ellipsoid(knee,hoof,[0,-.61,.1],[.19,.12,.27]);for(let f=0;f<10;f++){const a=f*Math.PI/5;tube(knee,ivory,[[Math.cos(a)*.12,-.40,Math.sin(a)*.12+.04],[Math.cos(a)*.16,-.53,Math.sin(a)*.16+.06],[Math.cos(a)*.19,-.66,Math.sin(a)*.18+.09]],.012);}compact(knee);compact(leg);leg.userData.knee=knee;legs.push(leg);}
 neck.position.set(0,1.76,.83);
 const neckSkin=new T.Mesh(neckLoft(),skin);neck.add(neckSkin);ellipsoid(neck,skin,[0,1.19,.77],[.225,.17,.30]);
 ellipsoid(neck,skin,[0,1.38,.58],[.27,.34,.46]);ellipsoid(neck,skin,[0,1.24,1.03],[.21,.22,.34]);
 for(const side of [-1,1]){ellipsoid(neck,dark,[side*.232,1.44,.66],[.028,.032,.036]);ellipsoid(neck,dark,[side*.15,1.26,1.28],[.045,.028,.04]);const ear=ellipsoid(neck,skin,[side*.16,1.78,.45],[.09,.25,.07]);ear.rotation.z=side*-.24;}
 for(let i=0;i<11;i++)tube(neck,mane,[[-.02,i*.125,-.18+i*.032],[-.1,i*.125+.06,-.28+i*.032],[.06,i*.125+.11,-.31+i*.032]],.055);
 for(const side of[-1,1]){ellipsoid(neck,ivory,[side*.248,1.452,.678],[.007,.008,.009]);ellipsoid(neck,mane,[side*.16,1.79,.47],[.044,.17,.025]);}
 // Browband, cheek straps and gilt noseband.
 for(const side of [-1,1])tube(neck,gold,[[side*.24,1.63,.5],[side*.27,1.35,.82],[side*.2,1.22,1.14]],.025);
 tube(neck,gold,[[-.25,1.55,.61],[0,1.6,.76],[.25,1.55,.61]],.03);
 tube(neck,gold,[[-.2,1.3,1.12],[0,1.39,1.14],[.2,1.3,1.12]],.025);
 tail.position.set(0,1.9,-1.12);for(let i=0;i<20;i++)tube(tail,mane,[[Math.sin(i)*.08,0,0],[Math.sin(i)*.13,-.55,-.22],[Math.sin(i)*.15,-1.3,-.16]],.021);
 // Saddle cloth drapes down both flanks; a scalloped lower border carries tassels.
 for(const side of [-1,1]){
  const positions=[],indices=[];for(let j=0;j<=12;j++)for(let i=0;i<=6;i++){const u=j/12,z=-1.03+u*2.0,v=i/6,y=2.22-v*(1.14+.055*Math.cos(u*Math.PI*8)),x=side*(.44+.24*Math.sin(v*Math.PI*.8));positions.push(x,y,z);}
  for(let j=0;j<12;j++)for(let i=0;i<6;i++){const a=j*7+i;indices.push(a,a+7,a+1,a+1,a+7,a+8);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const drape=new T.Mesh(g,velvet.clone());drape.material.side=T.DoubleSide;body.add(drape);
  for(const y of [1.14,2.15])tube(body,gold,Array.from({length:17},(_,i)=>[side*(y<1.5?.68:.47),y,-1.03+i*.125]),.027);
  for(let k=0;k<6;k++){const z=-.85+k*.32;tube(body,gold,[[side*.69,1.24,z],[side*.71,1.5,z+.15],[side*.67,1.8,z-.1],[side*.58,2.12,z+.05]],.016);for(const dy of [1.43,1.83]){const leaf=ellipsoid(body,gold,[side*.715,dy,z+.08],[.018,.08,.045]);leaf.rotation.x=.55;}}
  for(let k=0;k<15;k++){const z=-.98+k*.135;tube(body,gold,[[side*.68,1.12,z],[side*.7,.92,z]],.018);ellipsoid(body,gold,[side*.7,.88,z],[.033,.075,.033]);}
  for(let k=0;k<4;k++){const z=-.65+k*.42;ellipsoid(body,blue,[side*.713,1.65,z],[.024,.13,.1]);for(let petal=0;petal<6;petal++){const a=petal*Math.PI/3,fl=ellipsoid(body,gold,[side*.724,1.64+Math.sin(a)*.095,z+Math.cos(a)*.095],[.012,.062,.034]);fl.rotation.x=a;}ellipsoid(body,ivory,[side*.738,1.64,z],[.012,.025,.025]);}
  for(const z of[-.98,.98])tube(body,gold,[[side*.46,2.15,z],[side*.62,1.72,z],[side*.69,1.14,z]],.025);
 }
 ellipsoid(body,blue,[0,2.28,-.1],[.46,.14,.64]);tube(body,gold,[[-.45,2.29,-.64],[0,2.38,-.72],[.45,2.29,-.64]],.035);
 for(let i=0;i<8;i++){const a=i*Math.PI*2/8;ellipsoid(body,gold,[Math.cos(a)*.57,1.7+Math.sin(a)*.42,.99],[.06,.065,.04]);}
 compact(body);compact(neck);compact(tail);root.scale.setScalar(1.35+seed*.06);
 root.userData.horse={body,neck,tail,legs,phase:seed*2.1,action:'grazing',hoofLocalY:.01,targetRevision:'draft-neck-brocade-r1'};
 return root;
}
export function animateMorrisHorse(root,time){const h=root.userData.horse;if(!h)return;const dt=Math.min(.08,Math.max(0,time-(h.lastTime??time)));h.lastTime=time;const speed=Math.abs(h.speed||0),riding=!!h.ridden,blend=1-Math.exp(-dt*8);h.gaitPhase=(h.gaitPhase||0)+dt*(speed<2?speed*4.5:speed<4.2?speed*3.3:speed*2.6);const phase=h.gaitPhase;
 h.neck.rotation.x=T.MathUtils.lerp(h.neck.rotation.x,riding?.12+Math.sin(phase)*Math.min(.07,speed*.012):1.69+Math.sin(time*.63+h.phase)*.055,blend);h.neck.rotation.z=riding?(h.turn||0)*-.04:Math.sin(time*.37+h.phase)*.035;
 h.tail.rotation.z=Math.sin(time*.9+h.phase)*.09;h.tail.rotation.x=-Math.min(.3,speed*.04);h.body.scale.x=1+Math.sin(time*1.1+h.phase)*.009;h.body.position.y=riding?Math.abs(Math.sin(phase*2))*Math.min(.045,speed*.007):0;h.body.rotation.z=T.MathUtils.lerp(h.body.rotation.z,riding?(h.turn||0)*-.06:0,blend);
 for(let j=0;j<h.legs.length;j++){const leg=h.legs[j],offset=speed>4.2?[0,.28,2.5,2.8][j]:speed>2?[0,Math.PI,Math.PI,0][j]:[0,Math.PI,Math.PI/2,Math.PI*1.5][j],swing=Math.sin(phase+offset),amp=Math.min(.62,speed*.12);leg.rotation.x=T.MathUtils.lerp(leg.rotation.x,riding?swing*amp:0,blend);leg.userData.knee.rotation.x=T.MathUtils.lerp(leg.userData.knee.rotation.x,riding?Math.max(0,-swing)*amp*.85:0,blend);}
 if(!h.wake&&h.swimming){const wake=new T.Group();wake.name='morris-horse-swim-wake';const mat=new T.MeshBasicMaterial({color:0xc4f1ed,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide});for(const sign of[-1,1]){const m=new T.Mesh(new T.TorusGeometry(.9,.025,3,24,Math.PI*.9),mat);m.rotation.x=Math.PI/2;m.rotation.z=sign<0?Math.PI:0;m.position.set(sign*.65,1,-.25);wake.add(m);}root.add(wake);h.wake=wake;}if(h.wake){h.wake.visible=!!h.swimming;h.wake.scale.setScalar(1+Math.sin(time*4)*.06);}
 if(h.swimming){h.neck.rotation.x=.02;h.body.position.y=Math.sin(time*2)*.018;h.tail.rotation.x=.18;for(let j=0;j<h.legs.length;j++){h.legs[j].rotation.x=Math.sin(phase+j*Math.PI/2)*.35;h.legs[j].userData.knee.rotation.x=.65+Math.sin(phase+j*Math.PI/2)*.2;}}
 h.action=h.swimming?'swim':riding?(speed>.08?(speed>4.2?'canter':speed>2?'trot':'walk'):'mounted-idle'):'grazing';}
