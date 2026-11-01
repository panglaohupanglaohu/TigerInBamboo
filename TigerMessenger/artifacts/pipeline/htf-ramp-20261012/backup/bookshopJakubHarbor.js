import * as THREE from 'three';
import {BOOKSHOP_RAISE,BOOKSHOP_SITE_OUTLINE,BOOKSHOP_TERRACE,bookshopRaiseFlat,bookshopRailRaiseFlat,bookshopSiteRadius,RAIL_CONNECTOR,RAIL_RAMPS} from './bookshopTownSite.js';
import {createBookshopWorker} from '../assets/bookshopWorker.js';
import {createDukeShip,bendDukeToPlanet,DUKE_DIMENSIONS} from '../assets/dukeFreighter.js';

// Raised bookshop town, lower level (?bookshopRaise=1). The island stands
// BOOKSHOP_RAISE metres above the old grade; this builds what the target image
// shows below it: an arched stone viaduct wall around the coast, one lower
// wharf at the old grade on the front-left with a stair down from the town,
// a dock crane and the DUKE coastal steamer moored alongside. Additive only.
const CZ=BOOKSHOP_SITE_OUTLINE.centerZ,EDGE=BOOKSHOP_SITE_OUTLINE.radius;
const hash=(x,z)=>{const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);};
const polar=(r,t)=>[Math.sin(t)*r,CZ+Math.cos(t)*r];
const distTo=(P,x,z)=>{let b=1e9;for(let i=1;i<P.length;i++){const[ax,az]=P[i-1],[bx,bz]=P[i],dx=bx-ax,dz=bz-az,t=Math.min(1,Math.max(0,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));b=Math.min(b,Math.hypot(x-ax-dx*t,z-az-dz*t));}return b;};

export function buildJakubRaisedHarbor({root,R=160,g,occ,colliders=null,platforms=null,glowMat,lanternMat,ironMat,crateMat}){
 const H=BOOKSHOP_RAISE,G=R+.9,stats={viaductBays:0,wharfSegments:0,ship:0,stair:0};
 const v=new THREE.Vector3(),q=new THREE.Quaternion(),s1=new THREE.Vector3(1,1,1),Y=new THREE.Vector3(0,1,0);
 // Seat at an absolute grade (R+lift), ignoring the town raise falloff.
 const seat=(x,z,yaw,lift,out=new THREE.Matrix4())=>{
  root.updateWorldMatrix(true,false);
  const p=root.worldToLocal(root.localToWorld(new THREE.Vector3(x,0,z)).setLength(R+lift));
  const up=new THREE.Vector3(p.x,p.y+G,p.z).normalize();
  q.setFromUnitVectors(Y,up).multiply(new THREE.Quaternion().setFromAxisAngle(Y,yaw));
  return out.compose(p,q,s1);
 };
 const at=(m,x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(m);
 const mat=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.88,...o});
 const M={stone:mat(0xb3a07f),stoneDark:mat(0x8a785d),arch:mat(0x463c32),cap:mat(0xcdbd98),wood:mat(0x6e553d),pile:mat(0x3e3226),
  door:new THREE.MeshStandardMaterial({color:0xffcf8a,emissive:0xff9a40,emissiveIntensity:1.1,roughness:.5}),
  hull:mat(0x1f2124,{roughness:.6,metalness:.2}),boot:mat(0x9b2f22,{roughness:.7}),white:mat(0xe9e2cf),cream:mat(0xd9ccaa),deck:mat(0x9c7a52),
  funnelRed:mat(0xb23a27),black:mat(0x18191b),tarp:mat(0x3f5a48),iron:ironMat,lantern:lanternMat,crate:crateMat,brass:mat(0xa88954,{metalness:.5,roughness:.5})};
 // lit arch interiors (target: every arch glows warm, a lantern hangs inside)
 {const c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d');const gr=x.createRadialGradient(32,92,4,32,80,70);gr.addColorStop(0,'#ffd28a');gr.addColorStop(.45,'#d98a3e');gr.addColorStop(1,'#3a2a1e');x.fillStyle=gr;x.fillRect(0,0,64,128);
  x.strokeStyle='rgba(40,28,20,.85)';x.lineWidth=3;for(let i=1;i<5;i++){x.beginPath();x.moveTo(i*12.8,30);x.lineTo(i*12.8,128);x.stroke();}x.beginPath();x.moveTo(0,70);x.lineTo(64,70);x.stroke();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;M.arch=new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.85,roughness:.8});}
 const meshes=[];
 const add=(geo,material,matrix,name)=>{const o=new THREE.Mesh(geo,material);o.matrixAutoUpdate=false;o.matrix.copy(matrix);o.castShadow=o.receiveShadow=true;o.name=name;g.add(o);meshes.push(o);return o;};
 const instanced=(geo,material,matrices,name)=>{if(!matrices.length)return null;const im=new THREE.InstancedMesh(geo,material,matrices.length);matrices.forEach((m,i)=>im.setMatrixAt(i,m));im.instanceMatrix.needsUpdate=true;im.castShadow=im.receiveShadow=true;im.name=name;g.add(im);return im;};
 const glow=(p,s=1.8)=>{const sp=new THREE.Sprite(glowMat);sp.position.copy(p);sp.scale.setScalar(s);sp.name='jakub-harbor-glow';g.add(sp);};
 const local=new THREE.Matrix4();
 const off=(m,x,y,z,sx=1,sy=1,sz=1,ry=0)=>m.clone().multiply(local.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(Y,ry),new THREE.Vector3(sx,sy,sz)));

 // ---- 1. lower wharf span (front-left, old grade) -------------------------
 const W0=-.86,W1=-.30,deckTop=.78,deckIn=101.0,deckOut=109.6;
 const seg=[];for(let t=W0;t<=W1+1e-6;t+=.042){let ok=true;for(const r of[102,105,108.5]){const[x,z]=polar(r,t);if(!occ.clearLow(x,z,1.2))ok=false;}seg.push({t,ok});}
 let best=[0,0];for(let i=0;i<seg.length;){if(!seg[i].ok){i++;continue;}let j=i;while(j<seg.length&&seg[j].ok)j++;if(j-i>best[1]-best[0])best=[i,j];i=j;}
 const wharf=seg.slice(best[0],best[1]);stats.wharfSegments=wharf.length;
 const wharfSpan=wharf.length?[wharf[0].t-.021,wharf[wharf.length-1].t+.021]:null;
 const onWharf=t=>wharfSpan&&t>wharfSpan[0]-.01&&t<wharfSpan[1]+.01;

 // ---- 2. stair site: first wharf end whose upper landing is free ------------
 let stairT=null,stairDir=1;
 if(wharf.length>=6)for(const [t,dir]of[[wharf[wharf.length-1].t-.02,-1],[wharf[0].t+.02,1]]){const[x,z]=polar(97.6,t);if(occ.clear(x,z,1.4,true)){stairT=t;stairDir=dir;break;}}

 // ---- 3. arched viaduct wall around the whole coast --------------------------
 const N=160,bayW=2*Math.PI*(EDGE+.45)/N,wallH=H+3.6;
 const archLamps=[],bays=[],pil=[],arches=[],cornice=[],parapets=[],doors=[],lampPosts=[],lampHeads=[];
 for(let i=0;i<N;i++){
  const t=i*2*Math.PI/N,[ox,oz]=polar(101.6,t),[fx,fz]=polar(103.5,t);
  // leave openings only where a railway leaves the island or the grand freighter berth meets the coast
  {const[ex,ez]=polar(100.5,t);if(!onWharf(t)&&([RAIL_CONNECTOR,RAIL_RAMPS.arrival,RAIL_RAMPS.exit].some(P=>distTo(P,ex,ez)<7)||Math.abs(Math.atan2(Math.sin(t+1.38),Math.cos(t+1.38)))<.14))continue;}
  const hb=bookshopRaiseFlat(...polar(99.2,t));if(hb<.4)continue;
  const [x,z]=polar(EDGE-.05,t),m=seat(x,z,t,.9-3.6),k=(hb+3.6)/wallH,full=hb>H-.3;
  bays.push(off(m,0,wallH*k/2,0,1,k,1));pil.push(off(m,bayW/2,wallH*k/2,.62,1,k,1));
  if(full){arches.push(off(m,0,0,.505));archLamps.push(off(m,0,wallH-2.9,.95));glow(at(m,0,wallH-2.9,1.05),2.6);}cornice.push(off(m,0,wallH*k-.12,.32));
  const clearAbove=occ.clearLow(...polar(101.4,t),.6)&&occ.clear(...polar(101.4,t),.6,true);
  const stairGap=stairT!==null&&Math.abs(t-stairT)<.035;
  if(clearAbove&&!stairGap&&full){parapets.push(off(m,0,wallH+.38,.36));
   if(colliders)for(const dx of[-bayW/3,0,bayW/3])colliders.push({position:root.localToWorld(at(m,dx,wallH+1,.3)),radius:.55,kind:'bookshop-jakub-tree'});
   if(i%4===0){lampPosts.push(off(m,0,wallH+.75,.36));lampHeads.push(off(m,0,wallH+2.55,.36));glow(root.localToWorld(at(m,0,wallH+2.55,.36)).applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert()));}}
  if(full&&onWharf(t)&&i%2===0){doors.push(off(m,0,3.6+deckTop-.9+1.3,.53));glow(at(m,0,3.6+deckTop-.9+1.3,.9),2.4);}
 }
 stats.viaductBays=bays.length;
 instanced(new THREE.BoxGeometry(bayW+.04,wallH,1.0),M.stone,bays,'jakub-viaduct-wall');
 instanced(new THREE.BoxGeometry(.75,wallH,.3),M.stoneDark,pil,'jakub-viaduct-pilasters');
 {const r=1.15,spring=Math.max(1.4,wallH-1.0-r-.8),sh=new THREE.Shape();sh.moveTo(-r,3.2);sh.lineTo(r,3.2);sh.lineTo(r,spring);sh.absarc(0,spring,r,0,Math.PI,false);sh.closePath();
  const ag=new THREE.ShapeGeometry(sh,16);{const p=ag.attributes.position,uv=ag.attributes.uv,top=spring+r;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+r)/(2*r),(p.getY(i)-3.2)/(top-3.2));uv.needsUpdate=true;}
  instanced(ag,M.arch,arches,'jakub-viaduct-arches');}
 instanced(new THREE.BoxGeometry(.32,.42,.32),M.lantern,archLamps,'jakub-viaduct-arch-lanterns');
 instanced(new THREE.CylinderGeometry(.02,.02,.9,4).translate(0,.65,0),M.iron,archLamps,'jakub-viaduct-arch-chains');
 instanced(new THREE.BoxGeometry(bayW+.06,.34,1.5),M.cap,cornice,'jakub-viaduct-cornice');
 instanced(new THREE.BoxGeometry(bayW+.02,.76,.28),M.cap,parapets,'jakub-viaduct-parapet');
 instanced(new THREE.BoxGeometry(1.5,2.4,.06),M.door,doors,'jakub-viaduct-doors');
 instanced(new THREE.CylinderGeometry(.06,.08,3.2,6).translate(0,1.6,0),M.iron,lampPosts,'jakub-viaduct-lamp-posts');
 instanced(new THREE.BoxGeometry(.3,.4,.3),M.lantern,lampHeads,'jakub-viaduct-lamps');

 // ---- 3b. stone embankments under the island railway ramps outside the coast
 {const ramps=[[[95.5,60.1],[85.1,61.2],[75.1,62.2],[65.4,63],[56.1,63.8],[47,64.5],[38.1,65.1]],[[91,-8.2],[95.4,-1.8],[98,5.5],[98.4,13.1],[98,20.8],[98.4,28.6],[99.6,36.6],[100.5,44.7]]];
  const blocks=[],caps=[];
  for(const P of ramps)for(let i=1;i<P.length;i++){const[ax,az]=P[i-1],[bx,bz]=P[i],len=Math.hypot(bx-ax,bz-az),n=Math.ceil(len/2),yaw=Math.atan2(bx-ax,bz-az);
   for(let k=0;k<n;k++){const x=ax+(bx-ax)*(k+.5)/n,z=az+(bz-az)*(k+.5)/n;if(bookshopSiteRadius(x,z)<99.6)continue;const h=bookshopRailRaiseFlat(x,z);if(h<.15)continue;
    const m=seat(x,z,yaw,-2.6),top=.9+h-.2+2.6;blocks.push(off(m,0,top/2,0,1,top,1));caps.push(off(m,0,top,0));}}
  instanced(new THREE.BoxGeometry(12,1,len2(2.15)),M.stone,blocks,'jakub-rail-embankment');
  instanced(new THREE.BoxGeometry(12.4,.25,2.2),M.cap,caps,'jakub-rail-embankment-cap');
  stats.embankment=blocks.length;}
 function len2(v){return v;}

 // ---- 3c. arched stone bridge carrying the freight loop over the front-left sea
 {const P=RAIL_CONNECTOR,decks=[],piers=[],walls=[],archL=[];let acc=0;
  for(let i=1;i<P.length;i++){const[ax,az]=P[i-1],[bx,bz]=P[i],len=Math.hypot(bx-ax,bz-az),n=Math.ceil(len/2),yaw=Math.atan2(bx-ax,bz-az);
   for(let k=0;k<n;k++){const x=ax+(bx-ax)*(k+.5)/n,z=az+(bz-az)*(k+.5)/n;acc+=len/n;if(bookshopSiteRadius(x,z)<100.2)continue;
    const m=seat(x,z,yaw,.9+H-.95);decks.push(off(m,0,0,0,1,1,len/n+.06));for(const sx of[-1,1])walls.push(off(m,sx*5.6,.75,0,1,1,len/n+.06));
    if(Math.round(acc/2)%3===0){const mp=seat(x,z,yaw,-3);piers.push(off(mp,0,(.9+H-.95-.6+3)/2,0,1,(.9+H-.95-.6+3),1));}}}
  instanced(new THREE.BoxGeometry(11.6,1.2,1),M.stone,decks,'jakub-freight-bridge-deck');
  instanced(new THREE.BoxGeometry(.35,.9,1),M.cap,walls,'jakub-freight-bridge-parapet');
  instanced(new THREE.BoxGeometry(9.5,1,1.6),M.stoneDark,piers,'jakub-freight-bridge-piers');
  stats.bridgeSpans=decks.length;}

 // ---- 4. lower wharf deck, piles, platforms ----------------------------------
 const deckM=[],piles=[],kerbs=[],rInner=(deckIn+deckOut)/2,depth=deckOut-deckIn;
 for(const s of wharf){
  const[x,z]=polar(rInner,s.t),m=seat(x,z,s.t,deckTop);const len=.042*rInner+.15;
  deckM.push(off(m,0,-.2,0,len,1,depth));
  for(const dr of[-depth/2+.4,0,depth/2-.3])for(const dt of[-len/2+.3,len/2-.3])piles.push(off(m,dt,-2.2,dr));
  kerbs.push(off(m,0,.08,depth/2-.15,len,1,1));
  if(platforms){const c=root.localToWorld(at(m,0,0,0)),right=root.localToWorld(at(m,1,0,0)).sub(c).normalize(),fwd=root.localToWorld(at(m,0,0,1)).sub(c).normalize();
   platforms.push({mesh:g,center:c.clone(),normal:c.clone().normalize(),right,forward:fwd,half:new THREE.Vector3(len/2+.1,.2,depth/2+.6),topHeight:c.length(),kind:'bookshop-jakub-wharf'});}
 }
 instanced(new THREE.BoxGeometry(1,.4,1),M.wood,deckM,'jakub-wharf-deck');
 instanced(new THREE.CylinderGeometry(.22,.26,4.4,7),M.pile,piles,'jakub-wharf-piles');
 instanced(new THREE.BoxGeometry(1,.16,.3),M.stoneDark,kerbs,'jakub-wharf-kerb');

 // ---- 5. stair from the town down to the wharf --------------------------------
 if(stairT!==null){
  const [lx,lz]=polar(EDGE+.6,stairT),land=seat(lx,lz,stairT,.9+H);
  add(new THREE.BoxGeometry(3.2,.5,4.4),M.stone,off(land,0,-.25,0),'jakub-stair-landing');
  if(platforms){const c=root.localToWorld(at(land,0,0,0));platforms.push({mesh:g,center:c,normal:c.clone().normalize(),right:root.localToWorld(at(land,1,0,0)).sub(c).normalize(),forward:root.localToWorld(at(land,0,0,1)).sub(c).normalize(),half:new THREE.Vector3(1.6,.2,2.4),topHeight:c.length(),kind:'bookshop-jakub-wharf'});}
  // flight runs along the wall (tangent, local x) into the wharf
  const L=12,steps=24,drop=.9+H-deckTop,rise=drop/steps,run=L/steps,dir=stairDir;
  const stepM=[];for(let k=0;k<steps;k++){stepM.push(off(land,dir*(1.6+run*(k+.5)),-rise*(k+1)+(-.0),1.0,run+.02,1,1));}
  instanced(new THREE.BoxGeometry(1,1,2.2).translate(0,-.5,0),M.stone,stepM.map((m,k)=>m.multiply(new THREE.Matrix4().makeScale(1,rise*(k+1)+.3,1)).premultiply(new THREE.Matrix4())),'jakub-stair-steps');
  // outer handrail posts
  const rail=[];for(let k=0;k<=steps;k+=3)rail.push(off(land,dir*(1.6+run*k),-rise*k+.5,2.0));
  instanced(new THREE.CylinderGeometry(.04,.04,1,5),M.iron,rail,'jakub-stair-rail');
  if(platforms){const top=root.localToWorld(at(land,dir*1.6,0,1.0)),bot=root.localToWorld(at(land,dir*(1.6+L),-drop,1.0)),mid=top.clone().lerp(bot,.5),axis=bot.clone().sub(top),axisLen=axis.length();axis.normalize();
   const n=mid.clone().normalize(),tan=axis.clone().addScaledVector(n,-axis.dot(n)).normalize(),side=new THREE.Vector3().crossVectors(n,tan).normalize(),rTop=top.length(),rBot=bot.length();
   platforms.push({mesh:g,center:mid,normal:n,right:tan,forward:side,half:new THREE.Vector3(L/2+.2,.2,1.15),topHeight:(rTop+rBot)/2,kind:'bookshop-jakub-wharf',
    topHeightAt(pos){const u=THREE.MathUtils.clamp((pos.clone().sub(mid).dot(tan))/L+.5,0,1);return rTop+(rBot-rTop)*u;}});
   if(colliders)for(let k=0;k<=8;k++){const p=top.clone().lerp(bot,k/8).addScaledVector(side,1.45).setLength(top.clone().lerp(bot,k/8).length()+.8);colliders.push({position:p,radius:.35,kind:'bookshop-jakub-tree'});}}
  stats.stair=1;
 }

 // ---- 6. wharf life: crane, crates, workers, lamps ----------------------------
 if(wharf.length>=6){
  const L0=DUKE_DIMENSIONS.length,B0=DUKE_DIMENSIONS.beam,K0=1,shipR0=deckOut+.7+B0*K0/2;
  const shipFits=m=>{for(let k=-3;k<=3;k++){const tt=m+k*(L0*K0/7)/shipR0,[x,z]=polar(shipR0,tt);if(!occ.clearLow(x,z,3)||distTo(RAIL_CONNECTOR,x,z)<10)return false;}return true;};
  let mid=wharf[Math.floor(wharf.length*.45)].t;{const cands=wharf.map(w=>w.t).sort((a,b)=>Math.abs(a-mid)-Math.abs(b-mid));for(let tt=wharf[0].t-.2;tt<=wharf[wharf.length-1].t+.2;tt+=.02)cands.push(tt);const ok=cands.find(shipFits);if(ok!==undefined)mid=ok;}
  const [cx,cz]=polar(107.2,mid),crane=seat(cx,cz,mid,deckTop);
  for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]])add(new THREE.BoxGeometry(.28,9,.28),M.iron,off(crane,a*1.1,4.5,b*1.1),'jakub-crane-leg');
  for(let y=1.5;y<9;y+=2.2)add(new THREE.BoxGeometry(2.5,.14,2.5),M.iron,off(crane,0,y,0),'jakub-crane-brace');
  add(new THREE.BoxGeometry(1.8,1.6,2),M.wood,off(crane,0,9.6,0),'jakub-crane-cab');add(new THREE.BoxGeometry(.9,.6,.05),M.door,off(crane,0,9.7,1.02),'jakub-crane-window');
  const jib=new THREE.Mesh(new THREE.BoxGeometry(.4,.45,12),M.brass);jib.matrixAutoUpdate=false;jib.matrix.copy(off(crane,0,10.6,5.2).multiply(new THREE.Matrix4().makeRotationX(-.12)));jib.name='jakub-crane-jib';g.add(jib);
  add(new THREE.CylinderGeometry(.025,.025,4.2,4),M.iron,off(crane,0,8.25,10.4),'jakub-crane-cable');
  add(new THREE.BoxGeometry(1.5,1.1,1.5),M.crate,off(crane,0,5.6,10.4),'jakub-crane-load');
  glow(root.localToWorld(at(crane,0,9.7,1.4)).applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert()),2);
  if(colliders)colliders.push({position:root.localToWorld(at(crane,0,1,0)),radius:1.7,kind:'bookshop-jakub-tree'});
  const crates=[];for(let i=0;i<26;i++){const t=wharf[0].t+hash(i,11)*(wharf[wharf.length-1].t-wharf[0].t),r=102.4+hash(i,12)*5.4;if(Math.abs(t-mid)<.05&&r>104.5)continue;if(stairT!==null&&Math.abs(t-stairT)<.13)continue;const[x,z]=polar(r,t),m=seat(x,z,t+hash(i,13)*.5,deckTop),hgt=1+Math.floor(hash(i,14)*2.6);for(let k=0;k<hgt;k++)crates.push(off(m,0,.45+k*.9,0,.9,.9,.9));}
  instanced(new THREE.BoxGeometry(1,1,1),M.crate,crates,'jakub-wharf-crates');
  const lamps=[];for(let k=0;k<wharf.length;k+=2){const t=wharf[k].t,[x,z]=polar(109.1,t),m=seat(x,z,t,deckTop);lamps.push(m);glow(at(m,0,3.3,0),1.8);}
  instanced(new THREE.CylinderGeometry(.06,.09,3.1,6).translate(0,1.55,0),M.iron,lamps,'jakub-wharf-lamp-posts');
  instanced(new THREE.BoxGeometry(.32,.42,.32).translate(0,3.3,0),M.lantern,lamps,'jakub-wharf-lamps');
  for(let i=0;i<10;i++){const t=wharf[1].t+hash(i,21)*(wharf[wharf.length-2].t-wharf[1].t),r=102.6+hash(i,22)*5.6,[x,z]=polar(r,t);const w=createBookshopWorker({coat:[0x56626a,0x746b5d,0x5b4d40,0x3f5560][i%4],apron:i%3===0,carrying:i%2===0});w.matrixAutoUpdate=false;w.matrix.copy(seat(x,z,hash(i,23)*6.28,deckTop));g.add(w);}

  // ---- 7. the DUKE coastal steamer --------------------------------------------
  const L=DUKE_DIMENSIONS.length,B=DUKE_DIMENSIONS.beam,K=1,shipR=deckOut+.7+B*K/2,[sx,sz]=polar(shipR,mid);
  const ship=seat(sx,sz,mid+Math.PI/2,.5).multiply(new THREE.Matrix4().makeScale(K,K,K)); // local +z = bow along the quay, +x = towards the wharf
  let footprintOK=true;for(let k=-3;k<=3;k++){const tt=mid+k*(L*K/7)/shipR,[x,z]=polar(shipR,tt);if(!occ.clearLow(x,z,3)||distTo(RAIL_CONNECTOR,x,z)<10)footprintOK=false;}
  if(footprintOK){
   // DUKE production model (src/assets/dukeFreighter.js), riding light so a band of red bottom shows
   g.updateWorldMatrix(true,false);const SEA_R=R+.33,WATERLINE=-.3,centre=new THREE.Vector3().applyMatrix4(g.matrixWorld.clone().invert()),originR=new THREE.Vector3().setFromMatrixPosition(ship).distanceTo(centre),onPlanet=Math.abs(originR-R)<20,RIDE=onPlanet?SEA_R-WATERLINE-originR:.9;const duke=createDukeShip();if(onPlanet)bendDukeToPlanet(duke,SEA_R-WATERLINE);duke.matrixAutoUpdate=false;duke.matrix.copy(ship).multiply(new THREE.Matrix4().makeTranslation(0,RIDE,0));g.add(duke);stats.shipRide=+RIDE.toFixed(2);
   const S=duke.matrix,wx=B/2+.7,deckLocal=DUKE_DIMENSIONS.freeboard,wharfY=deckTop-.5-RIDE;
   const gang=new THREE.Mesh(new THREE.BoxGeometry(1.1,.12,1),M.wood);gang.matrixAutoUpdate=false;{const a=new THREE.Vector3(B/2-.4,deckLocal+.1,-1.5),b=new THREE.Vector3(wx+1.6,wharfY+.1,-1.5),mid=a.clone().lerp(b,.5),len=a.distanceTo(b);gang.matrix.copy(S).multiply(new THREE.Matrix4().compose(mid,new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),b.clone().sub(a).normalize()),new THREE.Vector3(len,1,1)));}gang.name='duke-gangway';g.add(gang);
   const moor=[];for(const z of[-24,-9,10,24]){moor.push(new THREE.Vector3(B/2-.3,deckLocal+.8,z).applyMatrix4(S),new THREE.Vector3(wx+1.2,wharfY+.4,z+(z>0?4:-4)).applyMatrix4(S));}
   const ml=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(moor),new THREE.LineBasicMaterial({color:0x5b4a36}));ml.name='duke-mooring';g.add(ml);
   const sc=document.createElement('canvas');sc.width=sc.height=64;const sx3=sc.getContext('2d'),gr=sx3.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(250,250,246,.9)');gr.addColorStop(1,'rgba(250,250,246,0)');sx3.fillStyle=gr;sx3.fillRect(0,0,64,64);
   const steamMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false,opacity:.75});
   for(let k=0;k<7;k++){const sp=new THREE.Sprite(steamMat);const ft=duke.userData.funnelTop;sp.position.copy(new THREE.Vector3(ft.x+.5*k,ft.y+1+k*1.5,ft.z-k*1.3).applyMatrix4(S));sp.scale.setScalar(2.4+k*1.1);sp.name='duke-steam';g.add(sp);}
   stats.ship=1;stats.shipVersion=duke.userData.version;}
 }

 function buildDuke(S,L,B){
  const hb=z=>{const f=z>6?Math.max(.03,1-Math.pow((z-6)/(L/2-5.8),1.9)):z<-L/2+4?Math.sqrt(Math.max(0,1-Math.pow((z+L/2-4)/4.6,2)))*.92+.08:1;return B/2*f;};
  const outline=(scale=1)=>{const pts=[];for(let z=-L/2;z<=L/2;z+=.5)pts.push(new THREE.Vector2(hb(z)*scale,-z));for(let z=L/2;z>=-L/2;z-=.5)pts.push(new THREE.Vector2(-hb(z)*scale,-z));return pts;};
  const prism=(scale,y0,y1)=>new THREE.ExtrudeGeometry(new THREE.Shape(outline(scale)),{depth:y1-y0,bevelEnabled:false,curveSegments:4}).rotateX(-Math.PI/2).translate(0,y0,0);
  // rotateX(-pi/2) maps shape y -> -z so outline uses -z; extrusion becomes +y
  add(prism(1,-2.8,3.2),M.hull,S,'duke-hull');
  add(prism(1.012,-2.85,.35),M.boot,S,'duke-boot-top');
  add(prism(1.014,2.82,3.0),M.white,S,'duke-sheer-stripe');
  {const sh=new THREE.Shape(outline(1.0));sh.holes.push(new THREE.Path(outline(.93).reverse()));add(new THREE.ExtrudeGeometry(sh,{depth:.85,bevelEnabled:false}).rotateX(-Math.PI/2).translate(0,3.2,0),M.hull,S,'duke-bulwark');}
  add(new THREE.ShapeGeometry(new THREE.Shape(outline(.95))).rotateX(-Math.PI/2).translate(0,3.22,0),M.deck,S,'duke-deck');
  const box=(w,h,d,x,y,z,m,name)=>add(new THREE.BoxGeometry(w,h,d),m,off(S,x,y,z),name);
  box(5.4,2.4,9.5,0,4.4,-7.2,M.white,'duke-deckhouse');box(4.4,2.1,6.4,0,6.65,-7.6,M.cream,'duke-boat-deck');box(5.8,1.7,3,0,8.55,-4.9,M.white,'duke-bridge');
  for(const sx of[-1,1]){box(.05,.5,8,sx*2.73,4.6,-7.2,M.door,'duke-windows');box(.05,.45,2.6,sx*2.93,8.6,-4.9,M.door,'duke-bridge-windows');box(.9,.7,3.4,sx*2.5,8.0,-8.6,M.white,'duke-lifeboat');}
  box(5.8,.08,.05,0,8.6,-3.38,M.door,'duke-bridge-front');
  for(const[y0,h,m]of[[7.7,4.9,M.funnelRed],[12.6,.55,M.white],[13.15,1.2,M.black]])add(new THREE.CylinderGeometry(1.05,1.05,h,16).translate(0,h/2,0),m,off(S,0,y0,-9.6),'duke-funnel');
  for(const[z,h]of[[10.5,16],[-14,13]]){add(new THREE.CylinderGeometry(.13,.18,h,8).translate(0,h/2,0),M.wood,off(S,0,3.2,z),'duke-mast');box(4.2,.12,.12,0,3.2+h*.78,z,M.wood,'duke-yard');
   const boom=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,7,6),M.wood);boom.matrixAutoUpdate=false;boom.matrix.copy(off(S,0,5.6,z+(z>0?-3.0:3.0)).multiply(new THREE.Matrix4().makeRotationX(z>0?-1.05:1.05)));g.add(boom);}
  for(const z of[3,7.2,13.6])box(3.2,.75,3.4,0,3.6,z,M.tarp,'duke-hatch');
  // portholes on both sides
  const port=[];for(let z=-14;z<=13;z+=2.2)for(const sx of[-1,1])port.push(off(S,sx*(hb(z)+.02),1.7,z,1,1,1,sx*Math.PI/2));
  instanced(new THREE.CircleGeometry(.17,10),M.door,port,'duke-portholes');
  // name boards at the bow
  const c=document.createElement('canvas');c.width=512;c.height=256;const x2=c.getContext('2d');x2.clearRect(0,0,512,256);x2.fillStyle='#f3ead6';x2.textAlign='center';x2.font='bold 120px "Songti SC","Noto Serif SC",serif';x2.fillText('杜',256,120);x2.font='bold 70px Georgia,serif';x2.fillText('Duke',256,220);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const nameMat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
  for(const sx of[-1,1]){const z=11.5;add(new THREE.PlaneGeometry(2.6,1.3),nameMat,off(S,sx*(hb(z)+.06),1.6,z,1,1,1,sx*Math.PI/2+sx*.22*-1),'duke-name');}
  // rigging
  const rig=[[0,3.2+16,10.5,0,3.6,L/2-.3],[0,3.2+16,10.5,0,3.2+13,-14],[0,3.2+13,-14,0,3.8,-L/2+.6]];
  for(const sx of[-1,1]){rig.push([0,3.2+12,10.5,sx*hb(10.5),3.6,9.5],[0,3.2+10,-14,sx*hb(-14),3.6,-13]);}
  const rp=[];for(const[a,b,c3,d,e,f]of rig){rp.push(at(S,a,b,c3),at(S,d,e,f));}
  const lines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rp),new THREE.LineBasicMaterial({color:0x2b2622}));lines.name='duke-rigging';g.add(lines);
  // mooring lines and gangway to the wharf (+x side)
  const moor=[];for(const z of[-L/2+2,-6,8,L/2-3]){moor.push(at(S,hb(z),3.6,z),at(S,B/2+.54+1.5,.25,z+(z>0?3:-3)));}
  const ml=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(moor),new THREE.LineBasicMaterial({color:0x5b4a36}));ml.name='duke-mooring';g.add(ml);
  const gang=new THREE.Mesh(new THREE.BoxGeometry(3.4,.12,1.1),M.wood);gang.matrixAutoUpdate=false;gang.matrix.copy(off(S,B/2+1.0,1.75,-1.5).multiply(new THREE.Matrix4().makeRotationZ(-.86)));gang.name='duke-gangway';g.add(gang);
  for(const p of[at(S,0,8.6,-3.2),at(S,2.9,4.6,-7),at(S,-2.9,4.6,-7)])glow(p,2.2);
  // funnel steam
  const sc=document.createElement('canvas');sc.width=sc.height=64;const sx3=sc.getContext('2d'),gr=sx3.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(250,250,246,.9)');gr.addColorStop(1,'rgba(250,250,246,0)');sx3.fillStyle=gr;sx3.fillRect(0,0,64,64);
  const steamMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false,opacity:.75});
  for(let k=0;k<6;k++){const sp=new THREE.Sprite(steamMat);sp.position.copy(at(S,.4*k,14.6+k*1.3,-9.6-k*1.1));sp.scale.setScalar(2.2+k*.9);sp.name='duke-steam';g.add(sp);}
 }
 return stats;
}

// Upper level: the seaside Hard To Find bookshop sits on a deck carried by an
// open stone arcade (target image). Piers stand only on free ground, so the
// red/blue railway runs under the arches; the stair lands clear of the tracks.
export function buildHardToFindTerrace({root,R=160,g,bookshop,terrace,occ=null,platforms=null,colliders=null}){
 if(!bookshop||!terrace)return {terrace:0};
 const H=BOOKSHOP_RAISE,G=R+.9,Y=new THREE.Vector3(0,1,0);
 root.updateWorldMatrix(true,false);bookshop.updateWorldMatrix(true,true);
 const w=bookshop.getWorldPosition(new THREE.Vector3()),l=root.worldToLocal(w.clone()),fx=l.x*G/(l.y+G),fz=l.z*G/(l.y+G);
 const yaw=Math.atan2(-fx,-fz);
 const seatAt=(x,z,lift)=>{const p=root.worldToLocal(root.localToWorld(new THREE.Vector3(x,0,z)).setLength(R+lift));const up=new THREE.Vector3(p.x,p.y+G,p.z).normalize();const q=new THREE.Quaternion().setFromUnitVectors(Y,up).multiply(new THREE.Quaternion().setFromAxisAngle(Y,yaw));return new THREE.Matrix4().compose(p,q,new THREE.Vector3(1,1,1));};
 const base=seatAt(fx,fz,.9+H),inv=base.clone().invert(),T=terrace,slab=.6;
 // terrace-frame (u,v) -> town flat (x,z)
 const flat=(u,v)=>{const p=new THREE.Vector3(u,0,v).applyMatrix4(base);const q=p.clone();return [q.x*G/(q.y+G),q.z*G/(q.y+G)];};
 const box=new THREE.Box3(),rootInv=new THREE.Matrix4().copy(root.matrixWorld).invert();
 bookshop.traverse(o=>{if(!o.isMesh||!o.geometry)return;o.geometry.boundingBox||o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(o.matrixWorld).applyMatrix4(rootInv).applyMatrix4(inv));});
 const hx=THREE.MathUtils.clamp(Math.max(-box.min.x,box.max.x)+2.4,5,8),hz=THREE.MathUtils.clamp(Math.max(-box.min.z,box.max.z)+2.4,5,8);
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.9});
 const stone=mat(0xb3a07f),cap=mat(0xcdbd98),pave=mat(0xd6c6a3),dark=mat(0x8a785d),archShade=mat(0x5a4a3a),iron=new THREE.MeshStandardMaterial({color:0x24302f,metalness:.55,roughness:.55});
 const lantern=new THREE.MeshStandardMaterial({color:0xffd9a0,emissive:0xffa64a,emissiveIntensity:1.6,roughness:.4});
 const add=(geo,m,x,y,z,name,extra=null)=>{const o=new THREE.Mesh(geo,m);o.matrixAutoUpdate=false;o.matrix.copy(base).multiply(new THREE.Matrix4().makeTranslation(x,y,z));if(extra)o.matrix.multiply(extra);o.castShadow=o.receiveShadow=true;o.name=name;g.add(o);return o;};
 const free=(u,v,r=.9)=>{if(!occ)return true;const[x,z]=flat(u,v);return occ.clearLow(x,z,r);};
 // ---- plan: straight back and sides, the SEA face (-v, outward from the town) is a convex arc ----
 // Pick the largest sagitta whose arc piers land on clear ground (rails stay untouched).
 let S=4.2;const arcPts=(S,n,off=0)=>{const Rc=(hx*hx+S*S)/(2*S),cv=-hz-S+Rc,a0=Math.asin(Math.min(1,hx/Rc)),pts=[];for(let k=0;k<=n;k++){const a=-a0+2*a0*k/n;pts.push([(Rc+off)*Math.sin(a),cv-(Rc+off)*Math.cos(a)]);}return pts;};
 const arcN=()=>Math.max(4,Math.round(2*hx/2.9));
 while(S>1.6&&!arcPts(S,arcN()).every(([u,v],k,a)=>k===0||k===a.length-1||free(u,v,1.1)))S-=.4;
 const outline=(o=0)=>{const pts=[[-hx-o,hz+o],[hx+o,hz+o]];const Rc=(hx*hx+S*S)/(2*S),cv=-hz-S+Rc,a0=Math.asin(Math.min(1,hx/Rc));
  pts.push([hx+o,-hz]);for(let k=0;k<=32;k++){const a=a0-2*a0*k/32;pts.push([(Rc+o)*Math.sin(a),cv-(Rc+o)*Math.cos(a)]);}pts.push([-hx-o,-hz]);
  const sh=new THREE.Shape();sh.moveTo(pts[0][0],-pts[0][1]);for(const[u,v]of pts.slice(1))sh.lineTo(u,-v);sh.closePath();return sh;};
 const slabGeo=(o,y0,d)=>new THREE.ExtrudeGeometry(outline(o),{depth:d,bevelEnabled:false,curveSegments:1}).rotateX(-Math.PI/2).translate(0,y0,0);
 add(slabGeo(0,T-slab,slab),stone,0,0,0,'htf-deck-slab');
 add(slabGeo(.22,T-slab-.18,.26),cap,0,0,0,'htf-deck-cornice');
 add(slabGeo(.12,T-.02,.12),cap,0,0,0,'htf-deck-coping');
 add(slabGeo(-.35,T+.04,.04),pave,0,0,0,'htf-deck-paving');
 // ---- arcade: perimeter ring of piers (arc front + straight sides/back) plus clear interior grid ----
 const piers=[],ring=[],h=T-slab,pierAt=(u,v,edge)=>{if(!free(u,v,1.1))return null;const p={u,v,edge};piers.push(p);return p;};
 const sideN=Math.max(2,Math.round(2*hz/3.4)),backN=Math.max(2,Math.round(2*hx/3.4));
 const loop=[];for(const[u,v]of arcPts(S,arcN(),-.55).reverse())loop.push([u,v]);           // sea arc, +u -> -u
 for(let k=1;k<=sideN;k++)loop.push([-hx+.55,-hz+(2*hz-.55)*k/sideN]);                     // left side to back
 for(let k=1;k<=backN;k++)loop.push([-hx+.55+(2*hx-1.1)*k/backN,hz-.55]);                    // back
 for(let k=1;k<sideN;k++)loop.push([hx-.55,hz-.55-(2*hz-.55)*k/sideN]);                     // right side to front
 for(const[u,v]of loop)ring.push(pierAt(u,v,true));
 const nx=Math.max(1,Math.round(2*hx/4)),nz=Math.max(1,Math.round(2*hz/4));
 for(let i=1;i<nx;i++)for(let k=1;k<nz;k++)pierAt(-hx+2*hx*i/nx,-hz+2*hz*k/nz,false);
 for(const p of piers){
  if(p.edge){add(new THREE.BoxGeometry(1.1,h,1.1),stone,p.u,h/2,p.v,'htf-arcade-pier');add(new THREE.BoxGeometry(1.45,.4,1.45),dark,p.u,.2,p.v,'htf-arcade-plinth');add(new THREE.BoxGeometry(1.35,.28,1.35),cap,p.u,h*.62,p.v,'htf-arcade-impost');}
  else{add(new THREE.CylinderGeometry(.42,.48,h,12),stone,p.u,h/2,p.v,'htf-arcade-column');add(new THREE.CylinderGeometry(.62,.62,.3,12),cap,p.u,h-.15,p.v,'htf-arcade-capital');add(new THREE.CylinderGeometry(.62,.66,.36,12),dark,p.u,.18,p.v,'htf-arcade-base');}
  if(colliders)colliders.push({position:root.localToWorld(new THREE.Vector3(p.u,1,p.v).applyMatrix4(base)),radius:.8,kind:'bookshop-jakub-tree'});}
 // round-arched openings between consecutive ring piers: spandrel wall, archivolt, keystone, hanging lantern
 const archFace=(a,b)=>{const span=Math.hypot(b.u-a.u,b.v-a.v)-1.1;if(span<1.2)return;const r=span/2,sp=Math.max(h*.45,h-r-.5);if(sp+r>h-.15)return;
  const sh=new THREE.Shape();sh.moveTo(-r,h);sh.lineTo(r,h);sh.lineTo(r,sp);sh.absarc(0,sp,r,0,Math.PI,false);sh.lineTo(-r,h);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:.7,bevelEnabled:false,curveSegments:16}).translate(0,0,-.35);
  const mu=(a.u+b.u)/2,mv=(a.v+b.v)/2,ang=Math.atan2(b.v-a.v,b.u-a.u),R=new THREE.Matrix4().makeRotationY(-ang);
  add(geo,stone,mu,0,mv,'htf-arcade-arch',R);
  add(new THREE.TorusGeometry(r+.09,.1,6,20,Math.PI),cap,mu,sp,mv,'htf-arcade-archivolt',R.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,-.37)));
  add(new THREE.BoxGeometry(.34,.46,.8),cap,mu,sp+r+.12,mv,'htf-arcade-keystone',R);
  add(new THREE.CylinderGeometry(.012,.012,.55,4),iron,mu,sp+r-.3,mv,'htf-arcade-lantern-chain');
  add(new THREE.BoxGeometry(.3,.42,.3),lantern,mu,sp+r-.78,mv,'htf-arcade-lantern');
  add(new THREE.ConeGeometry(.24,.2,4),iron,mu,sp+r-.48,mv,'htf-arcade-lantern-cap',new THREE.Matrix4().makeRotationY(Math.PI/4));};
 for(let k=0;k<ring.length;k++){const a=ring[k],b=ring[(k+1)%ring.length];if(a&&b)archFace(a,b);}
 // soffit lanterns: the vault under the deck glows like the town's lit arches
 for(const p of piers)if(!p.edge)add(new THREE.BoxGeometry(.32,.4,.32),lantern,p.u+1.2,h-.55,p.v,'htf-soffit-lantern');
 // stone balustrade along the outline (posts + rail cap); sea arc sampled densely
 const rail=[];{const Rc=(hx*hx+S*S)/(2*S),cv=-hz-S+Rc,a0=Math.asin(Math.min(1,hx/Rc)),n=Math.ceil(2*a0*Rc/1.0);
  for(let k=0;k<=n;k++){const a=-a0+2*a0*k/n;rail.push([(Rc-.2)*Math.sin(a),cv-(Rc-.2)*Math.cos(a)]);}
  // continue the loop: right side (front->back), back (right->left), left side (back->front)
  const nS=Math.ceil((2*hz-.4)/1),nB=Math.ceil((2*hx-.4)/1);
  for(let k=0;k<=nS;k++)rail.push([hx-.2,-hz+.2+(2*hz-.4)*k/nS]);for(let k=1;k<=nB;k++)rail.push([hx-.2-(2*hx-.4)*k/nB,hz-.2]);for(let k=1;k<nS;k++)rail.push([-hx+.2,hz-.2-(2*hz-.4)*k/nS]);rail.push(rail[0]);}
 const posts=rail;
 // stair: pick the side whose landing run is clear of rails, preferring the plaza side
 const pc=root.localToWorld(new THREE.Vector3(0,0,32)).setLength(R+.9+H);const pl=root.worldToLocal(pc).applyMatrix4(inv);
 const SW=3,steps=Math.ceil(T/.22),run=.36,L=run*steps,faces=[0,Math.PI/2,Math.PI,-Math.PI/2].sort((a,b)=>{const d=f=>-(Math.sin(f)*pl.x+Math.cos(f)*pl.z);return d(a)-d(b);});
 let face=null;for(const f of faces){if(Math.abs(Math.cos(f)+1)<.01)continue;const ext=Math.abs(Math.sin(f))>.5?hx:hz;let ok=true;for(let t=.5;t<=L+1.5;t+=1)for(const s of[-SW/2,0,SW/2]){const u=Math.sin(f)*(ext+t)+Math.cos(f)*s,v=Math.cos(f)*(ext+t)-Math.sin(f)*s;if(!free(u,v,.7))ok=false;}if(ok){face=f;break;}}
 if(face===null)face=faces.find(f=>Math.abs(Math.cos(f)+1)>.01);
 const F=new THREE.Matrix4().makeRotationY(face),ext=Math.abs(Math.sin(face))>.5?hx:hz,rise=T/steps;
 const addF=(geo,m,x,y,z,name)=>{const o=add(geo,m,0,0,0,name);o.matrix.copy(base).multiply(F).multiply(new THREE.Matrix4().makeTranslation(x,y,z));return o;};
 for(let k=0;k<steps;k++){const h=T-rise*(k+1);addF(new THREE.BoxGeometry(SW,.22,run+.02),stone,0,h-.11,ext+run*(k+.5),'htf-stair-step');}
 addF(new THREE.BoxGeometry(.4,1,L),dark,-SW/2-.2,T/2-.2,ext+L/2,'htf-stair-stringer').matrix.multiply(new THREE.Matrix4().makeRotationX(Math.atan2(T,L)));
 for(const sx of[-1,1])for(let k=0;k<=steps;k+=3)addF(new THREE.CylinderGeometry(.04,.04,1,5),iron,sx*(SW/2+.05),T-rise*k+.5,ext+run*k,'htf-stair-rail');
 const gapF=([x,z])=>{const v=new THREE.Vector3(x,0,z).applyMatrix4(F.clone().invert());return v.z>ext-.6&&Math.abs(v.x)<SW/2+.3;};
 for(let i=posts.length-1;i>=0;i--)if(gapF(posts[i]))posts.splice(i,1);
 for(const[x,z]of posts){add(new THREE.BoxGeometry(.3,.8,.3),stone,x,T+.44,z,'htf-balustrade-post');}
 {const bal=new THREE.Mesh(new THREE.BufferGeometry(),cap);bal.name='htf-balustrade-rail';const segs=[];for(let k=1;k<posts.length;k++){const[a,b]=[posts[k-1],posts[k]];if(Math.hypot(b[0]-a[0],b[1]-a[1])<1.3)segs.push([a,b]);}
  const balGeo=new THREE.CylinderGeometry(.055,.075,.62,6);for(const[a,b]of segs)for(const f of[.25,.5,.75]){const x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;add(balGeo,cap,x,T+.42,z,'htf-baluster');}
  for(const[a,b]of segs){const L2=Math.hypot(b[0]-a[0],b[1]-a[1]);const o=add(new THREE.BoxGeometry(L2+.1,.12,.34),cap,(a[0]+b[0])/2,T+.88,(a[1]+b[1])/2,'htf-balustrade-rail',new THREE.Matrix4().makeRotationY(-Math.atan2(b[1]-a[1],b[0]-a[0])));}}
 for(const[x,z]of[[-hx+.5,-hz+.2],[hx-.5,-hz+.2],[-hx+.4,hz-.4],[hx-.4,hz-.4],[0,-hz-S+.5]]){add(new THREE.CylinderGeometry(.06,.08,2.8,6),iron,x,T+1.4,z,'htf-lamp-post');add(new THREE.BoxGeometry(.3,.4,.3),lantern,x,T+3,z,'htf-lamp');}
 const world=(x,y,z)=>root.localToWorld(new THREE.Vector3(x,y,z).applyMatrix4(base));
 if(platforms){
  const c=world(0,T+.04,0),right=world(1,T+.04,0).sub(c).normalize(),fwd=world(0,T+.04,1).sub(c).normalize();
  platforms.push({mesh:g,center:c,normal:c.clone().normalize(),right,forward:fwd,half:new THREE.Vector3(hx,.2,hz),topHeight:c.length(),kind:'bookshop-jakub-wharf'});
  {const Rc=(hx*hx+S*S)/(2*S),cv=-hz-S+Rc,n=6;for(let k=0;k<n;k++){const u0=-hx+2*hx*k/n,u1=u0+2*hx/n,um=(u0+u1)/2,vEdge=cv-Math.sqrt(Math.max(0,Rc*Rc-Math.max(u0*u0,u1*u1))),depth=-hz-vEdge;if(depth<.3)continue;const cc=world(um,T+.04,-hz-depth/2);platforms.push({mesh:g,center:cc,normal:cc.clone().normalize(),right,forward:fwd,half:new THREE.Vector3(hx/n,.2,depth/2+.05),topHeight:cc.length(),kind:'bookshop-jakub-wharf'});}}
  const fv=(x,y,z)=>world(...new THREE.Vector3(x,y,z).applyMatrix4(F).toArray());
  const a=fv(0,T+.04,ext),b=fv(0,0,ext+L),mid=a.clone().lerp(b,.5),n=mid.clone().normalize(),rA=a.length(),rB=b.length(),sf=b.clone().sub(a).normalize(),sr=new THREE.Vector3().crossVectors(n,sf).normalize();
  platforms.push({mesh:g,center:mid,normal:n,right:sr,forward:sf,half:new THREE.Vector3(SW/2,.2,L/2+.1),topHeight:(rA+rB)/2,kind:'bookshop-jakub-wharf',
   topHeightAt(pos){const u=THREE.MathUtils.clamp(pos.clone().sub(mid).dot(sf)/L+.5,0,1);return rA+(rB-rA)*u;}});
 }
 if(colliders)for(const[x,z]of posts)colliders.push({position:world(x,T+1,z),radius:.4,kind:'bookshop-jakub-tree'});
 return {terrace:1,terraceSize:[+(hx*2).toFixed(1),+(hz*2).toFixed(1)],seaArcSagitta:+S.toFixed(1),arcadePiers:piers.length,stairFace:+face.toFixed(2)};
}
