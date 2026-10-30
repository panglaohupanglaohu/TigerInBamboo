import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),mat=c=>new T.MeshStandardMaterial({color:c,roughness:.95});
function ball(root,m,p,s){const o=new T.Mesh(new T.SphereGeometry(1,16,10),m);o.position.set(...p);o.scale.set(...s);root.add(o);return o;}
function compact(root){root.updateWorldMatrix(true,true);const buckets=new Map(),inv=root.matrixWorld.clone().invert();for(const o of [...root.children])if(o.isMesh){const g=o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld));if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);o.geometry.dispose();root.remove(o);}for(const[m,gs]of buckets){const mesh=new T.Mesh(mergeGeometries(gs,false),m);gs.forEach(g=>g.dispose());mesh.castShadow=true;root.add(mesh);}}
function strand(root,material,pts,r=.006){const g=new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>V(...p))),Math.max(3,pts.length*2),r,4,false);const m=new T.Mesh(g,material);root.add(m);return m;}
function earShell(){const p=[],ix=[];for(let j=0;j<=14;j++){const t=j/14,w=.10*Math.pow(Math.sin(Math.PI*t),.68)+.008;for(let k=0;k<8;k++){const a=k/8*Math.PI*2;p.push(Math.cos(a)*w,.65*t,Math.sin(a)*w*.43-.09*t*t);if(j<14){const n=j*8+k,b=j*8+(k+1)%8;ix.push(n,n+8,b,b,n+8,b+8);}}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;}
export function createMorrisRabbit(){
 const root=new T.Group();root.name='morris-tapestry-brown-rabbit';root.scale.setScalar(.45);const brown=mat(0x92724b),warm=mat(0xa4875d),light=mat(0xcbb48c),dark=mat(0x302d24),pink=mat(0xa48377),white=mat(0xe1d0a9);
 // Overlapping tapered chest and haunch volumes form a seated rabbit silhouette.
 ball(root,brown,[0,.46,-.13],[.37,.47,.48]);ball(root,warm,[0,.71,.22],[.25,.47,.31]);ball(root,brown,[0,1.01,.48],[.245,.26,.255]);
 for(const side of[-1,1]){ball(root,brown,[side*.255,.27,-.20],[.23,.29,.32]);ball(root,warm,[side*.25,.087,.02],[.19,.085,.34]);const fore=ball(root,warm,[side*.155,.27,.40],[.09,.23,.11]);fore.rotation.x=-.12;ball(root,light,[side*.15,.065,.49],[.105,.065,.20]);ball(root,light,[side*.095,.93,.68],[.078,.073,.105]);ball(root,dark,[side*.205,1.062,.58],[.020,.027,.018]);ball(root,white,[side*.221,1.074,.598],[.005,.007,.004]);
  for(let k=0;k<3;k++)strand(root,brown,[[side*.15+(k-1)*.043,.105,.55],[side*.15+(k-1)*.043,.10,.64]],.003);
  // Short directional marks stay on the haunch ellipsoid instead of floating
  // outside its skin. Their repeated flow is botanical-tapestry stylisation.
  for(let j=0;j<22;j++){const phi=.55+(j%6)*.29,theta=-.75+Math.floor(j/6)*.47,pts=[];for(const d of[-.035,0,.035]){const f=phi+d;pts.push([side*.373*Math.sin(f)*Math.cos(theta),.46+.473*Math.cos(f),-.13+.483*Math.sin(f)*Math.sin(theta)]);}strand(root,j%3===0?warm:brown,pts,.003);}
  for(let j=0;j<3;j++)strand(root,white,[[side*.10,.925,.76],[side*.23,.935+(j-1)*.035,.80],[side*.36,.94+(j-1)*.055,.79]],.0025);
 }
 ball(root,light,[0,.45,-.57],[.135,.145,.135]);ball(root,pink,[0,.962,.793],[.035,.025,.026]);strand(root,dark,[[0,.945,.792],[0,.91,.787],[-.04,.90,.773]],.003);strand(root,dark,[[0,.91,.787],[.04,.90,.773]],.003);
 compact(root);const ears=[];for(const side of[-1,1]){const e=new T.Group();e.position.set(side*.13,1.15,.49);const outer=new T.Mesh(earShell(),brown);e.add(outer);const inner=new T.Mesh(earShell(),pink);inner.scale.set(.57,.80,.45);inner.position.set(0,.055,.035);e.add(inner);e.rotation.z=side*-.16;e.rotation.x=side>0?-.04:.05;root.add(e);ears.push(e);}root.userData.ears=ears;root.userData.targetReview={revision:'seated-surface-fur-r2',fourFeet:true,taperedEars:true,whiskers:6};return root;
}
export function createMorrisBird(kind='robin'){
 const root=new T.Group();root.name=`morris-${kind}-reference-plumage`;const robin=kind==='robin',back=mat(robin?0x776c53:0x8a7652),wingMat=mat(robin?0x655b47:0x756344),breast=mat(robin?0xb95132:0xd3c29a),cream=mat(0xcab58a),dark=mat(0x292c25),gold=mat(0x998353);
 ball(root,back,[0,.30,0],[.17,.22,.28]);ball(root,breast,[0,.34,.125],[.15,.195,.17]);ball(root,back,[0,.535,.16],[.14,.145,.155]);if(robin)ball(root,breast,[0,.516,.238],[.118,.105,.083]);
 for(const side of[-1,1]){ball(root,cream,[side*.118,.56,.225],[.022,.026,.016]);ball(root,dark,[side*.132,.563,.236],[.012,.015,.010]);ball(root,mat(0xe6dab4),[side*.14,.570,.244],[.0035,.0045,.003]);strand(root,gold,[[side*.06,.16,.04],[side*.06,.045,.08]],.009);for(const toe of[-1,0,1])strand(root,gold,[[side*.06,.05,.08],[side*.06+toe*.035,.018,.13],[side*.06+toe*.04,.015,.18]],.006);}
 const beak=new T.Mesh(new T.ConeGeometry(robin?.027:.032,robin?.12:.15,7),gold);beak.rotation.x=Math.PI/2;beak.position.set(0,.535,.355);root.add(beak);
 // Layered tail and folded wing feathers replace floating paddle wings.
 for(let j=0;j<5;j++){const t=ball(root,j%2?wingMat:back,[(j-2)*.037,.215,-.37-Math.abs(j-2)*.012],[.032,.024,.24]);t.rotation.y=(j-2)*.05;t.rotation.x=-.08;}
 if(!robin)for(let row=0;row<7;row++)for(let k=0;k<5;k++){const x=(k-2)*.047,y=.18+row*.045,u=x/.16,v=(y-.34)/.2;if(u*u+v*v>.86)continue;const z=.125+.17*Math.sqrt(Math.max(0,1-u*u-v*v));const spot=ball(root,dark,[x,y,z+.003],[.006,.012,.0025]);spot.rotation.z=x*3;}
 compact(root);const wings=[];for(const side of[-1,1]){const w=new T.Group();w.position.set(side*.145,.425,-.055);for(let j=0;j<8;j++){const f=ball(w,j%3===0?back:wingMat,[side*(.018+j*.003),-.06-j*.018,-.02-j*.025],[.028-j*.001,.13-j*.003,.11]);f.rotation.x=-.30+j*.035;if(!robin)for(let k=0;k<2;k++)ball(w,k?cream:dark,[side*.061,-.07-j*.016,-.02-j*.025],[.006,.011,.018]);}compact(w);root.add(w);wings.push(w);}root.scale.setScalar(robin?.50:.58);root.userData.wings=wings;root.userData.targetReview={revision:'folded-plumage-r2',kind,foldedWingFeathers:16,breastPattern:robin?'orange-red':'cream-spotted',naming:'user target decorative reference, not scientific species identification'};return root;
}
export function createMorrisWildlife({root,heightAt,trees,playBird=()=>false,safeSite=()=>true}){
 const rabbits=[],birds=[],perches=[];
 trees.forEach(tree=>(tree.userData.perches??[]).forEach(p=>perches.push(p.clone().add(tree.position))));
 for(let i=0;i<6;i++){const rabbit=createMorrisRabbit();let [x,z]=[[-34,18],[-12,26],[0,25],[22,23],[-25,8],[-5,12],[22,0],[30,30]][i];for(let n=0;n<8&&!safeSite(x,z);n++)x+=2;rabbit.position.set(x,heightAt(x,z),z);rabbit.rotation.y=i*1.7;root.add(rabbit);rabbits.push({root:rabbit,x,z,phase:i*.82});}
 for(let i=0;i<2;i++){const kind=i===0?'robin':'cuckoo',bird=createMorrisBird(kind),start=perches[(i*2)%perches.length].clone(),end=perches[(i*2+3)%perches.length].clone();bird.position.copy(start);root.add(bird);birds.push({root:bird,kind,start,end,phase:i*3.2,nextCall:2+i*2.7,calls:0});}
 let time=0;const world=V();
 return{rabbits,birds,perches,update(dt,t){time=t;
  for(const r of rabbits){const cycle=(t+r.phase)%13,hopping=cycle>10,hop=hopping?(cycle-10)/3:0,x=r.x+Math.sin(hop*Math.PI)*1.1,z=r.z+Math.sin(hop*Math.PI)*.8;r.root.position.set(x,heightAt(x,z)+(hopping?Math.abs(Math.sin(hop*Math.PI*3))*.16:0),z);r.root.rotation.x=Math.sin(t*1.3+r.phase)*.025;r.root.userData.ears.forEach((e,j)=>e.rotation.z=(j?-.16:.16)+Math.sin(t*.7+r.phase+j)*.07);}
  for(const b of birds){const phase=(t+b.phase)%24;if(b.lastPhase>phase){[b.start,b.end]=[b.end,b.start];}b.lastPhase=phase;const flight=phase>19,p=flight?(phase-19)/5:0;
   if(flight){b.root.position.lerpVectors(b.start,b.end,p);b.root.position.y+=Math.sin(p*Math.PI)*3;b.root.rotation.y=Math.atan2(b.end.x-b.start.x,b.end.z-b.start.z);b.root.userData.wings.forEach((w,j)=>w.rotation.z=(j?1:-1)*Math.sin(t*17)*1.05);}else{b.root.position.copy(b.start);b.root.rotation.y=Math.sin(t*.3+b.phase)*.45;b.root.userData.wings.forEach((w,j)=>w.rotation.z=(j?1:-1)*.06);}
   if(t>b.nextCall){b.nextCall=t+(b.kind==='robin'?9:14)+b.phase*.2;root.updateWorldMatrix(true,true);if(playBird(b.kind,b.root.getWorldPosition(world)))b.calls++;}
  }
 },call(kind){const b=birds.find(b=>b.kind===kind);root.updateWorldMatrix(true,true);const played=!!b&&playBird(kind,b.root.getWorldPosition(world));if(played)b.calls++;return played;},status(){return{rabbits:rabbits.length,robins:1,cuckoos:1,scheduledAt:time,successfulVoices:birds.reduce((n,b)=>n+b.calls,0)};}};
}
