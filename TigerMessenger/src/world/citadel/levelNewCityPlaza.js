import * as T from 'three';
// 2026-10-13 user: the horse & statue plaza must be level like the new-city fountain.
// The new city is authored in one flat castle chart; ~95 m from its origin the chart is 25.9°
// off the planet's radial up, so the ground-following plaza leans. Chosen fix (user option
// "中心找平+石台基"): rotate the whole plaza (paving, rings, curb, railings, gardens) together with
// the statue, horse + tie-down squad, lantern and landmark pavings about the plaza centre so its
// normal is the local radial; lower terrain that pokes through the deck; wrap the edge in stone
// retaining walls (bastion where the deck is above ground, cut wall where the hill is above);
// add a stair flight from the old stair foot up the bastion; move soldier routes and anchors.
// ?plazaLevel=0 disables.
export const NEW_CITY_PLAZA_POLY=[[45,76],[49,69],[65,64],[81,67],[88,76],[83,87],[64,91],[49,87]];
export const plazaLevelEnabled=()=>new URLSearchParams(globalThis.location?.search||'').get('plazaLevel')!=='0';
const POLY=NEW_CITY_PLAZA_POLY;
function inPoly(x,z){let c=false;for(let i=0,j=POLY.length-1;i<POLY.length;j=i++){const[a,b]=[POLY[i],POLY[j]];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function edgeDist(x,z){let d=Infinity;for(let i=0;i<POLY.length;i++){const a=POLY[i],b=POLY[(i+1)%POLY.length],ux=b[0]-a[0],uz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*ux+(z-a[1])*uz)/(ux*ux+uz*uz)));d=Math.min(d,Math.hypot(x-a[0]-t*ux,z-a[1]-t*uz));}return d;}
const near=(x,z,r)=>inPoly(x,z)||edgeDist(x,z)<r;

export function levelNewCityPlaza({scene,pivot=[66,77]}={}){
 const report={version:'plaza-radial-level-1',applied:false};
 if(!plazaLevelEnabled()){report.reason='disabled';return report;}
 const plaza=scene?.getObjectByName('target-new-city-paved-plaza'),castle=scene?.getObjectByName('castleContainer'),terr=scene?.getObjectByName('citadel-oskar-grid-mountain-surface');
 const paving=plaza?.getObjectByName('target-plaza-paving-surface');
 if(!plaza||!castle||!terr||!paving){report.reason='missing:'+[!plaza&&'plaza',!castle&&'castle',!terr&&'terrain',!paving&&'paving'].filter(Boolean).join(',');return report;}
 if(plaza.userData.radialLevel)return plaza.userData.radialLevel;
 scene.updateMatrixWorld(true);
 const L=plaza.matrixWorld.clone(),Linv=L.clone().invert(),rc=new T.Raycaster();
 // deck height in plaza-local coordinates (paving geometry is plaza-local)
 const pavProxy=new T.Mesh(paving.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));pavProxy.updateMatrixWorld(true);
 const deckCache=new Map(),deckY=(x,z,fallback)=>{const k=Math.round(x*2)+','+Math.round(z*2);if(deckCache.has(k)){const v=deckCache.get(k);return v===null?fallback:v;}rc.set(new T.Vector3(Math.round(x*2)/2,40,Math.round(z*2)/2),new T.Vector3(0,-1,0));rc.far=80;const h=rc.intersectObject(pavProxy,false)[0];deckCache.set(k,h?h.point.y:null);return h?h.point.y:fallback;};
 const Yp=deckY(pivot[0],pivot[1],2.8);
 const Pw=new T.Vector3(pivot[0],Yp,pivot[1]).applyMatrix4(L),n=Pw.clone().normalize(),u=new T.Vector3(0,1,0).transformDirection(L);
 const Q=new T.Quaternion().setFromUnitVectors(u,n);
 const W=new T.Matrix4().makeTranslation(Pw.x,Pw.y,Pw.z).multiply(new T.Matrix4().makeRotationFromQuaternion(Q)).multiply(new T.Matrix4().makeTranslation(-Pw.x,-Pw.y,-Pw.z));
 const Wl=Linv.clone().multiply(W).multiply(L); // the same rigid move in plaza/castle-local coordinates
 const NL=W.clone().multiply(L),NLinv=NL.clone().invert(); // new deck frame -> world
 report.tiltDegrees=+(u.angleTo(n)*180/Math.PI).toFixed(2);report.pivot=[pivot[0],+Yp.toFixed(2),pivot[1]];

 // ---- 1. rigid move of the plaza and everything standing on it ----
 const moved=[];
 const move=o=>{if(!o||moved.includes(o))return;o.updateWorldMatrix(true,false);const local=o.parent.matrixWorld.clone().invert().multiply(W.clone().multiply(o.matrixWorld));local.decompose(o.position,o.quaternion,o.scale);if(!o.matrixAutoUpdate)o.matrix.copy(local);o.updateMatrixWorld(true);moved.push(o);};
 const onPlaza=o=>{if(!o)return false;const p=o.getWorldPosition(new T.Vector3()).applyMatrix4(Linv);return near(p.x,p.z,1.5)&&p.y>-3&&p.y<14;};
 move(plaza);
 for(const name of['citadel-plaza-hero-statue','citadel-trojan-horse','target-horse-paving','target-statue-paving']){const o=scene.getObjectByName(name);if(onPlaza(o))move(o);}
 castle.traverse(o=>{if(/^new-city-lantern-\d+$/.test(o.name)&&onPlaza(o))move(o);});
 report.moved=moved.map(o=>o.name);

 // ---- 2. lower terrain that pokes through the new deck ----
 {const geo=terr.geometry,pos=geo.attributes.position,Mt=terr.matrixWorld.clone(),MtInv=Mt.clone().invert(),v=new T.Vector3();let cut=0,maxCut=0;
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(Mt).applyMatrix4(NLinv);if(!near(v.x,v.z,.9))continue;const floor=deckY(v.x,v.z,Yp)-.75;if(v.y<=floor)continue;maxCut=Math.max(maxCut,v.y-floor);v.y=floor;v.applyMatrix4(NL).applyMatrix4(MtInv);pos.setXYZ(i,v.x,v.y,v.z);cut++;}
  if(cut){pos.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();}
  report.terrainCut={vertices:cut,maxDepth:+maxCut.toFixed(2)};}

 // ---- 3. retaining walls around the deck (in the new deck frame = plaza children) ----
 const stone=new T.MeshStandardMaterial({color:'#cdbd9c',roughness:.95}),coping=new T.MeshStandardMaterial({color:'#e6d9ba',roughness:.92}),dark=new T.MeshStandardMaterial({color:'#9c8c70',roughness:.97}),iron=new T.MeshStandardMaterial({color:'#526566',roughness:.88});
 for(const m of[stone,coping,dark,iron])m.userData.preserveCitadelMaterial=true;
 const box=new T.BoxGeometry(1,1,1),rows={stone:[],coping:[],dark:[],iron:[]};
 const put=(key,cx,cy,cz,sx,sy,sz,yaw=0)=>{rows[key].push(new T.Matrix4().compose(new T.Vector3(cx,cy,cz),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw),new T.Vector3(sx,sy,sz)));};
 const cx0=POLY.reduce((a,p)=>a+p[0],0)/POLY.length,cz0=POLY.reduce((a,p)=>a+p[1],0)/POLY.length;
 const groundRel=(x,z,yd)=>{const top=new T.Vector3(x,yd+45,z).applyMatrix4(NL),down=new T.Vector3(0,-1,0).transformDirection(NL);rc.set(top,down);rc.far=110;const h=rc.intersectObject(terr,false)[0];if(!h)return -16;return Math.max(-30,h.point.clone().applyMatrix4(NLinv).y-yd);};
 // stair: old flight foot (last surveyed tread) -> landing on the south-west edge (POLY[7]->POLY[0])
 let stair=null;{let last=null,idx=-1;castle.traverse(o=>{const m=/^surveyed-route-tread-(\d+)$/.exec(o.name);if(m&&o.isMesh&&+m[1]>idx){idx=+m[1];last=o;}});
  if(last){last.geometry.boundingSphere||last.geometry.computeBoundingSphere();const S=last.geometry.boundingSphere.center.clone().applyMatrix4(last.matrixWorld).applyMatrix4(NLinv);
   const a=POLY[7],b=POLY[0],t=.06,ex=a[0]+(b[0]-a[0])*t,ez=a[1]+(b[1]-a[1])*t,elen=Math.hypot(b[0]-a[0],b[1]-a[1]);let ox=(b[1]-a[1])/elen,oz=-(b[0]-a[0])/elen;if(ox*(ex-cx0)+oz*(ez-cz0)<0){ox=-ox;oz=-oz;}
   const yd=deckY(ex-ox*.5,ez-oz*.5,Yp),E={x:ex+ox*1.9,z:ez+oz*1.9,y:yd};const Sold=last.geometry.boundingSphere.center.clone().applyMatrix4(last.matrixWorld).applyMatrix4(Linv);stair={S,E,ox,oz,landing:[ex,ez],yd,fromTread:idx,Sold};}}
 const isStairGap=(x,z)=>stair&&Math.hypot(x-stair.landing[0],z-stair.landing[1])<1.7;
 let wallSpans=0,maxFill=0,maxCutWall=0,parapets=0;
 const strips={stone:[],coping:[],dark:[]};
 // a wall slab between two edge samples: offsets measured outward from the edge (o0 inner face, o1 outer face),
 // y relative to each sample's deck height; four faces so it reads from every side
 function ribbon(key,p,q,ox,oz,o0,o1,yb0,yb1,yt0,yt1){const P=(s,o,y)=>[s.x+ox*o,s.yd+y,s.z+oz*o];
  const a0=P(p,o0,yb0),a1=P(p,o0,yt0),b0=P(q,o0,yb1),b1=P(q,o0,yt1),c0=P(p,o1,yb0),c1=P(p,o1,yt0),d0=P(q,o1,yb1),d1=P(q,o1,yt1),out=strips[key];
  const quad=(A,B,C,D)=>out.push(...A,...B,...C,...A,...C,...D);quad(c0,d0,d1,c1);quad(a0,a1,b1,b0);quad(a1,c1,d1,b1);quad(a0,b0,d0,c0);}
 for(let j=0;j<POLY.length;j++){const a=POLY[j],b=POLY[(j+1)%POLY.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;let ox=dz,oz=-dx;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;if(ox*(mx-cx0)+oz*(mz-cz0)<0){ox=-ox;oz=-oz;}
  const yaw=-Math.atan2(dz,dx),nS=Math.max(1,Math.ceil(len/1.1)),samples=[];
  for(let k=0;k<=nS;k++){const x=a[0]+(b[0]-a[0])*k/nS,z=a[1]+(b[1]-a[1])*k/nS,yd=deckY(x-ox*.45,z-oz*.45,Yp);samples.push({x,z,yd,h:groundRel(x+ox*1.4,z+oz*1.4,yd),hIn:groundRel(x-ox*.35,z-oz*.35,yd)});}
  // smooth along the edge so wall tops / bases slope continuously instead of stepping per segment
  const sm=(arr,key)=>arr.map((v,k)=>{const a=arr[Math.max(0,k-1)][key],b=v[key],c=arr[Math.min(arr.length-1,k+1)][key];return(a+2*b+c)/4;});
  const fillD=sm(samples.map(v=>({f:Math.max(-14,Math.min(0,v.hIn))})),'f'),cutH=sm(samples.map(v=>({c:Math.max(0,v.h)})),'c');
  samples.forEach((v,k)=>{v.fill=fillD[k];v.cut=cutH[k];v.gap=isStairGap(v.x,v.z);});
  const fillRun=samples.map(v=>v.fill<-.25),cutRun=samples.map(v=>v.cut>.25);
  for(let k=0;k<nS;k++){const p=samples[k],q=samples[k+1];
   if(fillRun[k]||fillRun[k+1]){ribbon('stone',p,q,ox,oz,0,.84,p.fill-.8,q.fill-.8,-.02,-.02);ribbon('dark',p,q,ox,oz,.05,.95,p.fill-.8,q.fill-.8,p.fill+.2,q.fill+.2);wallSpans++;maxFill=Math.max(maxFill,-p.fill);
    if(j<=1||j===7){if(!p.gap&&!q.gap){ribbon('coping',p,q,ox,oz,.07,.77,0,0,.62,.62);ribbon('coping',p,q,ox,oz,0,.84,.62,.62,.72,.72);parapets++;}}
    else ribbon('coping',p,q,ox,oz,-.02,.95,-.05,-.05,.09,.09);}
   if(cutRun[k]||cutRun[k+1]){ribbon('stone',p,q,ox,oz,-.84,0,-.4,-.4,p.cut+.2,q.cut+.2);ribbon('coping',p,q,ox,oz,-.9,.06,p.cut+.2,q.cut+.2,p.cut+.34,q.cut+.34);wallSpans++;maxCutWall=Math.max(maxCutWall,p.cut);}}}
 // ---- 4. stair flight against the bastion: old tread foot -> deck landing ----
 if(stair){const{S,E}=stair,dx=E.x-S.x,dz=E.z-S.z,run=Math.hypot(dx,dz),rise=E.y-S.y+.05,steps=Math.max(1,Math.ceil(rise/.19)),yaw=-Math.atan2(dz,dx),W2=2.4;
  stair.report={fromTread:stair.fromTread,rise:+rise.toFixed(2),run:+run.toFixed(2),steps,going:+(run/steps).toFixed(2)};
  for(let k=0;k<steps;k++){const f=(k+.5)/steps,x=S.x+dx*f,z=S.z+dz*f,top=S.y+rise*(k+1)/steps-.02,bottom=S.y-.6;put('stone',x,(top+bottom)/2,z,run/steps+.03,top-bottom,W2,yaw);put('coping',x,top-.04,z,run/steps+.03,.08,W2+.06,yaw);}
  // landing across the wall onto the deck, and an outer parapet along the flight
  put('coping',(E.x+stair.landing[0])/2,E.y-.05,(E.z+stair.landing[1])/2,2.2,.12,W2,yaw+Math.PI/2);
  const px=-dz/run,pz=dx/run,side=(px*(S.x-cx0)+pz*(S.z-cz0))>0?1:-1;
  for(let k=0;k<steps;k+=2){const f=(k+1)/steps,x=S.x+dx*f+side*px*(W2/2+.1),z=S.z+dz*f+side*pz*(W2/2+.1),y=S.y+rise*f;put('iron',x,y+.55,z,.09,1.1,.09);}
  put('iron',S.x+dx/2+side*px*(W2/2+.1),S.y+rise/2+1.08,S.z+dz/2+side*pz*(W2/2+.1),Math.hypot(run,rise),.06,.06,yaw);
  {const rr=rows.iron.at(-1),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();rr.decompose(p,q,s);q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.atan2(rise,run)));rr.compose(p,q,s);}
  report.stair=stair.report;}
 const walls=new T.Group();walls.name='plaza-level-retaining-walls';walls.userData.preserveCitadelMaterials=true;
 for(const[key,mat]of[['stone',stone],['coping',coping],['dark',dark],['iron',iron]]){if(!rows[key].length)continue;const m=new T.InstancedMesh(box,mat,rows[key].length);rows[key].forEach((x,i)=>m.setMatrixAt(i,x));m.name='plaza-level-'+key;m.castShadow=m.receiveShadow=true;m.userData.preserveCitadelMaterials=true;if(key!=='iron')m.userData.targetWalkable=key==='stone'||key==='coping';walls.add(m);}
 for(const[key,mat]of[['stone',stone],['coping',coping],['dark',dark]]){if(!strips[key].length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(strips[key],3));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshStandardMaterial({color:mat.color,roughness:mat.roughness,side:T.DoubleSide,flatShading:true}));m.material.userData.preserveCitadelMaterial=true;m.name='plaza-level-wall-'+key;m.castShadow=m.receiveShadow=true;m.userData.preserveCitadelMaterials=true;m.userData.targetWalkable=key!=='dark';walls.add(m);}
 plaza.add(walls);walls.updateMatrixWorld(true);
 // open the sea railing where the new flight lands; close the old west opening (now an 8 m drop) with the parapet above
 for(const name of['plaza-sea-perimeter-railings','plaza-sea-perimeter-stone-curb']){const m=plaza.getObjectByName(name);if(!m||!stair)continue;const mm=new T.Matrix4(),p=new T.Vector3();let hidden=0;for(let i=0;i<m.count;i++){m.getMatrixAt(i,mm);p.setFromMatrixPosition(mm);if(Math.hypot(p.x-stair.landing[0],p.z-stair.landing[1])<1.6){m.setMatrixAt(i,new T.Matrix4().makeScale(0,0,0));hidden++;}}m.instanceMatrix.needsUpdate=true;report[name+'Opened']=hidden;}
 report.walls={spans:wallSpans,maxFill:+maxFill.toFixed(2),maxCutWall:+maxCutWall.toFixed(2),parapets};

 // ---- 5. routes and anchors (castle-local arrays) follow the deck ----
 const city=castle.getObjectByName('highland-west-city');const cInv=castle.matrixWorld.clone().invert();
 const toCastle=new T.Matrix4().multiplyMatrices(cInv,NL); // new-deck-frame -> castle-local
 const moveC=p=>{const w=new T.Vector3(...p).applyMatrix4(castle.matrixWorld).applyMatrix4(Linv);if(!near(w.x,w.z,.6))return null;return new T.Vector3(w.x,w.y,w.z).applyMatrix4(toCastle).toArray();};
 const routeReport={};
 if(city){for(const key of['walkRoute','plazaToKeepRoute','horsePlazaExit','harborRoute','frontHarborRoute','harborToKeepRoute','boardingRoute']){const r=city.userData[key];if(!Array.isArray(r))continue;let movedPts=0;const out=[];
   for(let i=0;i<r.length;i++){const m=moveC(r[i]);const prevIn=i>0&&!!moveC(r[i-1]);
    const outsidePt=m?r[i-1]:r[i],ow=i>0?new T.Vector3(...outsidePt).applyMatrix4(castle.matrixWorld).applyMatrix4(Linv):null;
    if(stair&&i>0&&!!m!==prevIn&&Math.hypot(ow.x-stair.Sold.x,ow.z-stair.Sold.z)<8){const flight=[];for(let k=0;k<=6;k++){const f=k/6;flight.push(new T.Vector3(stair.S.x+(stair.E.x-stair.S.x)*f,stair.S.y+(stair.E.y-stair.S.y)*f+.05,stair.S.z+(stair.E.z-stair.S.z)*f).applyMatrix4(toCastle).toArray());}flight.push(new T.Vector3(stair.landing[0],stair.yd+.05,stair.landing[1]).applyMatrix4(toCastle).toArray());out.push(...(m?flight:flight.reverse()));}
    out.push(m||r[i]);if(m)movedPts++;}
   city.userData[key]=out;routeReport[key]={moved:movedPts,length:out.length};}
  for(const key of['statueAnchor','plazaAnchor','horseReservation']){const a=city.userData[key];if(Array.isArray(a)){const m=moveC(a);if(m){city.userData[key]=m;routeReport[key]='moved';}}}}
 const horse=scene.getObjectByName('citadel-trojan-horse');if(horse?.userData.placement?.castleLocal){const m=moveC(horse.userData.placement.castleLocal);if(m)horse.userData.placement.castleLocal=m;}
 report.routes=routeReport;
 report.applied=true;plaza.userData.radialLevel=report;castle.userData.newCityPlazaLevel=report;return report;
}
