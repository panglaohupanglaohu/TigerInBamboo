import * as THREE from 'three';

// DUKE (杜) coastal steam freighter, laid out from the 2026-10-12 concept sheet
// (side elevation, top-down deck plan and 3/4 bow view were all measured):
//  - 58 m x 10 m, long low black hull, red bottom about a third of the side,
//    near-plumb raked stem, counter stern with rudder and propeller showing
//  - continuous brass bulwark rail, two porthole rows, 杜 / Duke + anchor high on the bow
//  - midship: a long dark deckhouse (z -20..+6) with warm windows and copper
//    piping; only the bridge house on top is cream; tall white/red/black funnel
//    at z -3 ringed by copper steam domes and pipes; lifeboat aft of the funnel
//  - plan: aft crew area, aft grated hatch with derrick, bridge (z +2),
//    large forward grated hatch (z +11) served by the lattice deck crane (z +17)
//  - masts: stern staff, tall main mast aft of the funnel, tall foremast by the crane
// Ship-local frame: +z bow, +x starboard, +y up, waterline y=0. Metres.
export const DUKE_VERSION='duke-r9';
export const DUKE_DIMENSIONS=Object.freeze({length:58,beam:10,draft:2.6,freeboard:3.0});

const C={hull:0x1c1e21,boot:0xa1392a,brass:0xc0924a,copper:0xa9683c,houseDark:0x3b3530,houseTrim:0x5a4a3a,cream:0xeadfc6,roof:0x6e5a44,funnelW:0xf0e9da,funnelR:0xb4392a,funnelB:0x17181b,iron:0x262d31,wood:0x7a5a3c,crate:0x8d6a45,grate:0x2c2a27,boat:0xd9cdb2};

export function createDukeShip(){
 const g=new THREE.Group();g.name='duke-coastal-steam-freighter';g.userData.version=DUKE_VERSION;
 const M={},mat=(k,o={})=>{const key=k+JSON.stringify(o);return M[key]||(M[key]=new THREE.MeshStandardMaterial({color:C[k],roughness:.7,...o}));};
 const metal=k=>mat(k,{metalness:.6,roughness:.4});
 const glowM=new THREE.MeshStandardMaterial({color:0xffe0a0,emissive:0xffa040,emissiveIntensity:1.4,roughness:.5});
 const add=(geo,m,x=0,y=0,z=0,name='duke-part')=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;o.name=name;g.add(o);return o;};
 const box=(w,h,d,x,y,z,m,name)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,name);
 const cyl=(r1,r2,h,x,y,z,m,name,seg=14)=>add(new THREE.CylinderGeometry(r1,r2,h,seg),m,x,y,z,name);
 const beam=(a,b,r,m,name='duke-beam')=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),o=add(new THREE.CylinderGeometry(r,r,d.length(),6),m,0,0,0,name);o.position.copy(A).addScaledVector(d,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 const L=58,B=10,half=L/2;

 // ---- hull ------------------------------------------------------------------
 const deckY=z=>3.0+Math.pow(Math.max(0,z/half),2.4)*1.5+Math.pow(Math.max(0,-z/half),2.4)*.45;
 const halfBeam=z=>{const t=z/half;if(t>.42){const u=(t-.42)/.58;return B/2*Math.max(.015,1-Math.pow(u,1.55));}if(t<-.72){const u=(-t-.72)/.28;return B/2*Math.sqrt(Math.max(.05,1-u*u*.9));}return B/2;};
 const keelY=z=>{const t=z/half;if(t>.9)return -2.6+(t-.9)/.1*1.8;if(t<-.8)return -2.6+Math.pow((-t-.8)/.2,1.4)*3.4;return -2.6;};
 const stations=[];for(let i=0;i<=80;i++)stations.push(-half+L*i/80);
 const N=12,rings=stations.map(z=>{const hb=halfBeam(z),dy=deckY(z),ky=keelY(z),pts=[];for(let k=0;k<=N;k++){const a=k/N*Math.PI,s=Math.sin(a),c=Math.cos(a);pts.push(new THREE.Vector3(-c*hb*(1-.14*Math.pow(s,8)),dy+(ky-dy)*Math.pow(s,2.6),z));}return pts;});
 const pos=[],col=[],idx=[],cB=new THREE.Color(C.boot),cH=new THREE.Color(C.hull),cT=new THREE.Color(C.brass);
 for(const r of rings)for(const p of r){pos.push(p.x,p.y,p.z);const c=p.y<-.5?cB:p.y>deckY(p.z)-.22?cT:cH;col.push(c.r,c.g,c.b);}
 const W=N+1;for(let i=0;i<rings.length-1;i++)for(let k=0;k<W-1;k++){const a=i*W+k,b=a+1,c=a+W,d=c+1;idx.push(a,c,b,b,c,d);}
 for(const[i,flip]of[[0,true],[rings.length-1,false]]){const base=i*W,centre=pos.length/3,r=rings[i];pos.push(0,r.reduce((s,p)=>s+p.y,0)/W,r[0].z);col.push(cH.r,cH.g,cH.b);for(let k=0;k<W-1;k++)flip?idx.push(centre,base+k,base+k+1):idx.push(centre,base+k+1,base+k);}
 const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));hg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));hg.setIndex(idx);hg.computeVertexNormals();
 add(hg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.15,side:THREE.DoubleSide}),0,0,0,'duke-hull');
 const sectionX=(z,y)=>{const dy=deckY(z),ky=keelY(z),f=Math.min(1,Math.max(0,(dy-y)/(dy-ky))),s=Math.pow(f,1/2.6),c=Math.sqrt(Math.max(0,1-s*s));return c*halfBeam(z)*(1-.14*Math.pow(s,8));};
 // planked deck
 {const dp=[],di=[],uv=[];rings.forEach((r,i)=>{dp.push(r[0].x*.98,r[0].y-.04,r[0].z,r[W-1].x*.98,r[W-1].y-.04,r[W-1].z);uv.push(0,r[0].z,1,r[0].z);if(i){const a=(i-1)*2;di.push(a,a+1,a+2,a+1,a+3,a+2);}});
  const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.fillStyle='#b08a5c';x.fillRect(0,0,64,64);x.strokeStyle='rgba(70,48,28,.55)';x.lineWidth=1;for(let i=0;i<=8;i++){x.beginPath();x.moveTo(i*8,0);x.lineTo(i*8,64);x.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10,.5);t.colorSpace=THREE.SRGBColorSpace;
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(dp,3));dg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));dg.setIndex(di);dg.computeVertexNormals();add(dg,new THREE.MeshStandardMaterial({map:t,roughness:.85,side:THREE.DoubleSide}),0,0,0,'duke-deck');}
 // bulwark: brass top rail, mid rail, stanchions all round
 for(const side of[-1,1]){for(const h of[1.05,.55]){const pts=stations.slice(1,-1).map(z=>new THREE.Vector3(side*halfBeam(z)*.985,deckY(z)+h,z));add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),140,h>1?.06:.035,5,false),metal('brass'),0,0,0,'duke-rail');}
  for(let i=1;i<stations.length-1;i++){const z=stations[i];beam([side*halfBeam(z)*.985,deckY(z),z],[side*halfBeam(z)*.985,deckY(z)+1.05,z],.03,mat('iron'),'duke-stanchion');}}
 // riveted strake seams and a brass rubbing band under the deck edge
 for(const side of[-1,1])for(const[dy,r,m]of[[.3,.08,'brass'],[1.45,.03,'iron'],[2.5,.03,'iron'],[3.3,.03,'iron']]){const pts=stations.slice(2,-2).map(z=>{const y=deckY(z)-dy;return new THREE.Vector3(side*(sectionX(z,y)+.02),y,z);});add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),120,r,4,false),m==='brass'?metal('brass'):mat('iron'),0,0,0,'duke-strake');}
 // two porthole rows: upper lit, lower dark brass-rimmed
 {const ring=new THREE.TorusGeometry(.2,.05,6,12),glass=new THREE.CircleGeometry(.17,12),rows=[];for(let z=-24;z<=22;z+=1.6)for(const[y,lit]of[[1.95,true],[1.0,false]])for(const s of[-1,1])if(lit||Math.round(z/1.6)%2===0)rows.push([s,deckY(z)-3.0+y,z,lit]);
  const mk=(geo,m,list,name)=>{const im=new THREE.InstancedMesh(geo,m,list.length),m4=new THREE.Matrix4();list.forEach(([s,y,z],i)=>{m4.compose(new THREE.Vector3(s*(sectionX(z,y)+.04),y,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s*Math.PI/2),new THREE.Vector3(1,1,1));im.setMatrixAt(i,m4);});im.name=name;g.add(im);};
  mk(glass,glowM,rows.filter(r=>r[3]),'duke-portholes-lit');mk(glass,mat('grate'),rows.filter(r=>!r[3]),'duke-portholes-dark');mk(ring,metal('brass'),rows,'duke-porthole-rims');}

 // ---- midship: long dark deckhouse, cream bridge house, funnel and copper plant
 const D=3.0;
 box(6.8,2.5,20,0,D+1.25,-4.5,mat('houseDark'),'duke-deckhouse');box(7.2,.2,20.4,0,D+2.6,-4.5,mat('roof'),'duke-deckhouse-roof');
 for(const s of[-1,1]){for(let z=-13.5;z<=4.5;z+=1.5)box(.06,.9,.8,s*3.42,D+1.45,z,glowM,'duke-deckhouse-window');
  box(.08,.14,20,s*3.43,D+.5,-4.5,metal('brass'),'duke-deckhouse-trim');box(.08,.14,20,s*3.43,D+2.4,-4.5,metal('brass'),'duke-deckhouse-trim');
  for(let z=-14.5;z<=5.5;z+=2.5)box(.12,2.5,.18,s*3.46,D+1.25,z,mat('houseTrim'),'duke-deckhouse-pilaster');}
 box(6.6,2.3,6.4,0,D+2.7+1.15,2.2,mat('cream'),'duke-bridge-house');box(7.2,.22,7,0,D+2.7+2.42,2.2,mat('roof'),'duke-bridge-roof');
 box(5.4,1.9,4.2,0,D+5.2+.95,3.2,mat('cream'),'duke-wheelhouse');box(5.8,.2,4.6,0,D+5.2+2,3.2,mat('roof'),'duke-wheelhouse-roof');
 for(const s of[-1,1]){for(let z=-.4;z<=4.8;z+=1.05)box(.05,.8,.7,s*3.32,D+2.7+1.3,z,glowM,'duke-bridge-window');for(let z=1.6;z<=4.8;z+=.8)box(.05,.75,.6,s*2.72,D+5.2+1.05,z,glowM,'duke-wheelhouse-window');}
 box(5.42,.7,.05,0,D+5.2+1.05,5.32,glowM,'duke-wheelhouse-front');
 for(const s of[-1,1]){box(1.8,.15,1.4,s*3.6,D+5.2+.05,4.3,mat('roof'),'duke-bridge-wing');beam([s*4.4,D+5.2,3.7],[s*4.4,D+5.2+1,3.7],.03,metal('brass'),'duke-wing-rail');}
 // funnel
 const fz=-3.2,fb=D+2.7;cyl(1.15,1.25,6.2,0,fb+3.1,fz,mat('funnelW'),'duke-funnel');cyl(1.16,1.16,1.5,0,fb+6.95,fz,mat('funnelR'),'duke-funnel-band');cyl(1.18,1.16,2.1,0,fb+8.75,fz,mat('funnelB'),'duke-funnel-top');
 cyl(.16,.2,1.2,.75,fb+10.2,fz+.6,metal('brass'),'duke-whistle');
 // copper steam domes, tanks and pipes around the funnel (target: a dense cluster)
 const dome=(x,z,h,r)=>{cyl(r,r,h,x,fb+h/2,z,metal('copper'),'duke-steam-dome');add(new THREE.SphereGeometry(r,12,8,0,Math.PI*2,0,Math.PI/2),metal('copper'),x,fb+h,z,'duke-steam-dome-cap');cyl(r*1.05,r*1.05,.12,x,fb+h*.35,z,metal('brass'),'duke-dome-band');};
 for(const[x,z,h,r]of[[-2.3,-5.6,3.2,.45],[2.3,-5.6,3.2,.45],[-2.7,-2.4,2.2,.35],[2.7,-2.4,2.2,.35],[-1.7,-7.8,4.4,.3],[1.7,-7.8,4.4,.3],[-2.6,-10,2.6,.5],[2.6,-10,2.6,.5],[0,-11,1.8,.65],[-2.3,-.4,1.6,.28],[2.3,-.4,1.6,.28],[-1.2,-12.8,3.6,.28],[1.2,-12.8,3.6,.28]])dome(x,z,h,r);
 for(const[a,b]of[[[-2.3,fb+3.2,-5.6],[-1.2,fb+5.6,-3.6]],[[2.3,fb+3.2,-5.6],[1.2,fb+5.6,-3.6]],[[-2.6,fb+2.6,-10],[-2.6,fb+3.4,-6.4]],[[2.6,fb+2.6,-10],[2.6,fb+3.4,-6.4]],[[-1.9,fb+4.4,-7.8],[-1.1,fb+7.4,-4.1]],[[1.9,fb+4.4,-7.8],[1.1,fb+7.4,-4.1]]])beam(a,b,.11,metal('copper'),'duke-steam-pipe');
 for(const[x,z,f]of[[-3,-14,1],[3,-14,1],[-2.9,5.6,-1],[2.9,5.6,-1]]){cyl(.25,.28,1.8,x,fb+.9,z,metal('copper'),'duke-vent');const h=add(new THREE.CylinderGeometry(.55,.35,.8,12,1,true),mat('brass',{metalness:.6,roughness:.4,side:THREE.DoubleSide}),x,fb+2,z+.25*f,'duke-vent-cowl');h.rotation.x=f*1.1;}
 // lifeboat on chocks aft of the funnel with davits
 {const lb=add(new THREE.CapsuleGeometry(.85,3.4,4,10),mat('boat'),0,fb+.95,-12.3,'duke-lifeboat');lb.rotation.x=Math.PI/2;lb.scale.set(1.15,1,.55);box(1.6,.1,4.4,0,fb+1.25,-12.3,mat('wood'),'duke-lifeboat-cover');
  for(const z of[-14,-10.6])for(const s of[-1,1])beam([s*1.6,fb,z],[s*1.1,fb+2.4,z],.07,mat('iron'),'duke-davit');}

 // ---- cargo hatches (grated, per deck plan) and deck cargo
 const hatch=(z,w,d)=>{box(w+.5,.75,d+.5,0,D+.37,z,mat('iron'),'duke-hatch-coaming');box(w,.08,d,0,D+.72,z,mat('grate'),'duke-hatch-grate');for(let k=-w/2+.35;k<w/2;k+=.5)box(.07,.1,d,k,D+.78,z,metal('brass'),'duke-hatch-bar');for(let k=-d/2+.5;k<d/2;k+=1)box(w,.08,.07,0,D+.78,k+z,mat('iron'),'duke-hatch-bar');};
 hatch(10.6,5.6,6);hatch(-19.5,4.6,4.4);
 const crates=[[3.7,7.2],[-3.7,7.6],[3.6,14.5],[-3.9,15.2],[3.4,21.5],[-3.6,22.5],[0,24.5],[3.8,-21],[-3.8,-20.5],[-3.6,-25.2],[3.5,-25.6]];
 crates.forEach(([x,z],i)=>{const s=.95+(i%3)*.2;box(s,s,s,x,deckY(z)+s/2,z,mat('crate'),'duke-deck-crate');for(const k of[-.3,.3])box(s*1.02,.06,.06,x,deckY(z)+s/2+k*s,z+s*.51,mat('iron'),'duke-crate-band');if(i%2===0)box(s*.8,s*.8,s*.8,x+.1,deckY(z)+s+s*.4,z,mat('crate'),'duke-deck-crate');});
 for(const[x,z]of[[3.2,9.4],[-3.4,-18.6],[3.3,-27],[2.6,-26.2]])cyl(.42,.42,1.05,x,deckY(z)+.52,z,mat('wood'),'duke-barrel',10);
 for(const s of[-1,1])for(const z of[-26.5,-19,19,25])cyl(.22,.26,.6,s*3.6,deckY(z)+.3,z,mat('iron'),'duke-bollard',10);
 cyl(.55,.65,.8,0,deckY(-27)+.4,-27,mat('iron'),'duke-capstan');cyl(.55,.65,.8,0,deckY(26)+.4,26,mat('iron'),'duke-windlass');

 // aft crew cabin (target side elevation: small lit house over the stern crew area)
 {const z=-24.6,y=deckY(z);box(4.6,2.2,3.4,0,y+1.1,z,mat('houseDark'),'duke-aft-cabin');box(5,.2,3.8,0,y+2.3,z,mat('roof'),'duke-aft-cabin-roof');for(const s of[-1,1])for(const dz of[-1,0,1])box(.05,.7,.6,s*2.32,y+1.3,z+dz,glowM,'duke-aft-cabin-window');box(4.62,.12,.05,0,y+.45,z+1.72,metal('brass'),'duke-aft-cabin-trim');cyl(.18,.2,1.4,1.4,y+2.9,z,metal('copper'),'duke-aft-stovepipe');}
 // forward deck cargo stacks around the hatch (target 3/4 view)
 for(const[x,z,n]of[[-3.6,4.8,2],[3.7,5.2,1],[-3.8,13,3],[3.9,17.8,2]])for(let k=0;k<n;k++){const sz=.9;box(sz,sz,sz,x+(k%2)*.15,deckY(z)+sz/2+k*sz,z+(k%2)*.1,mat('crate'),'duke-deck-crate');}
 // ---- masts, derricks, deck crane ------------------------------------------
 const mast=(z,h,r=.24)=>{const b=deckY(z);cyl(r*.75,r,h,0,b+h/2,z,mat('wood'),'duke-mast');box(4.2,.16,.16,0,b+h*.74,z,mat('wood'),'duke-yard');box(.7,.5,.7,0,b+h*.74+.35,z,mat('iron'),'duke-crow');cyl(.12,.12,.4,0,b+h+.2,z,metal('brass'),'duke-mast-cap');return b+h;};
 const mainTop=mast(-15.6,16),foreTop=mast(18.8,16.5),sternTop=mast(-27.2,7,.13);
 beam([0,deckY(-15.6)+2,-15.6],[1.8,deckY(-20)+6.4,-20],.12,mat('wood'),'duke-derrick');beam([1.8,deckY(-20)+6.4,-20],[1.8,deckY(-20)+3,-20],.025,mat('iron'),'duke-derrick-fall');box(1,1,1,1.8,deckY(-20)+2.4,-20,mat('crate'),'duke-derrick-load');
 // lattice deck crane (target panel 5): braced tower, cab, lattice jib, hook and crate over the forward hatch
 {const cz=16.6,cx=-2.6,b=D,top=b+5.2;for(const[a,c]of[[-1,-1],[1,-1],[-1,1],[1,1]])beam([cx+a*1.3,b,cz+c*1.3],[cx+a*.85,top,cz+c*.85],.12,mat('iron'),'duke-crane-leg');
  for(let y=1;y<5;y+=1.05)for(const s of[-1,1]){const w=1.3-(y/5.2)*.45;beam([cx-w,b+y,cz+s*w],[cx+w,b+y+1,cz+s*w],.045,mat('iron'),'duke-crane-brace');beam([cx+s*w,b+y,cz-w],[cx+s*w,b+y+1,cz+w],.045,mat('iron'),'duke-crane-brace');}
  box(2.4,2,2.6,cx,top+1,cz,mat('houseDark'),'duke-crane-cab');box(2.6,.2,2.8,cx,top+2.1,cz,mat('roof'),'duke-crane-cab-roof');box(.05,.7,1.4,cx+1.22,top+1.2,cz,glowM,'duke-crane-window');
  cyl(.55,.55,1.4,cx-.4,top+.6,cz-1.6,metal('brass'),'duke-crane-winch').rotation.z=Math.PI/2;
  const root=new THREE.Vector3(cx+.4,top+1.6,cz-1),tip=new THREE.Vector3(cx+2.2,top+9.5,cz-6.4),up=new THREE.Vector3(0,1,0);
  const dir=tip.clone().sub(root),side=new THREE.Vector3().crossVectors(dir,up).normalize().multiplyScalar(.45),lift=new THREE.Vector3().crossVectors(side,dir).normalize().multiplyScalar(.45);
  const chords=[side.clone().add(lift),side.clone().negate().add(lift),side.clone().negate().sub(lift),side.clone().sub(lift)].map(o=>[root.clone().add(o),tip.clone().add(o.clone().multiplyScalar(.35))]);
  for(const[a,c]of chords)beam(a.toArray(),c.toArray(),.07,metal('brass'),'duke-crane-jib-chord');
  for(let k=0;k<9;k++){const t0=k/9,t1=(k+1)/9;for(let j=0;j<4;j++){const A=chords[j][0].clone().lerp(chords[j][1],t0),Bq=chords[(j+1)%4][0].clone().lerp(chords[(j+1)%4][1],t1);beam(A.toArray(),Bq.toArray(),.03,mat('iron'),'duke-crane-jib-lace');}}
  beam([cx,top+2.2,cz],tip.toArray(),.03,mat('iron'),'duke-crane-stay');
  const hookY=D+3.2;beam(tip.toArray(),[tip.x,hookY+1.6,tip.z],.025,mat('iron'),'duke-crane-fall');box(.5,.3,.3,tip.x,hookY+1.5,tip.z,mat('iron'),'duke-crane-block');
  box(1.5,1.2,1.5,tip.x,hookY+.6,tip.z,mat('crate'),'duke-crane-load');for(const s of[-1,1])beam([tip.x+s*.7,hookY+1.2,tip.z],[tip.x,hookY+1.55,tip.z],.02,mat('iron'),'duke-crane-sling');}
 // rigging: stays fore and aft, shrouds to the bulwarks
 const rig=[],r=(a,b)=>rig.push(new THREE.Vector3(...a),new THREE.Vector3(...b));
 r([0,foreTop,18.8],[0,deckY(half)+.6,half-.3]);r([0,foreTop-.5,18.8],[0,mainTop-.5,-15.6]);r([0,mainTop,-15.6],[0,sternTop,-27.2]);r([0,sternTop,-27.2],[0,deckY(-half)+.8,-half+.6]);r([0,mainTop-1,-15.6],[0,fb+9.8,fz]);
 for(const s of[-1,1])for(const dz of[-1.6,0,1.6])for(const[z,top]of[[18.8,foreTop],[-15.6,mainTop]])r([0,top-2.5,z],[s*halfBeam(z+dz)*.985,deckY(z+dz)+1,z+dz]);
 const rl=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rig),new THREE.LineBasicMaterial({color:0x2a2420}));rl.name='duke-rigging';g.add(rl);

 // ---- bow name and anchors, stern gear, crew, lamps
 {const c=document.createElement('canvas');c.width=768;c.height=300;const x=c.getContext('2d');x.fillStyle='#f4e6c2';x.strokeStyle='#f4e6c2';x.lineWidth=10;x.lineJoin='round';x.textAlign='center';x.font='900 250px "PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif';x.strokeText?.('少',170,240);x.fillText('少',170,240);x.fillStyle='#d6a44e';x.font='bold 130px Georgia,serif';x.fillText('Duke',520,215);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const nm=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
  for(const s of[-1,1]){const z=half-11,y=deckY(z)-1.55,p=add(new THREE.PlaneGeometry(6.4,2.5),nm,s*(halfBeam(z)+.14),y,z,'duke-name');p.rotation.y=s*Math.PI/2-s*.26;
   const az=half-3.6,ay=deckY(az)-1.3,an=new THREE.Group();an.name='duke-anchor';const sm=metal('brass');an.add(new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1.7,6),sm));const arm=new THREE.Mesh(new THREE.TorusGeometry(.62,.09,6,14,Math.PI),sm);arm.position.y=-.75;arm.rotation.z=Math.PI;an.add(arm);const stock=new THREE.Mesh(new THREE.BoxGeometry(1,.12,.12),sm);stock.position.y=.7;an.add(stock);an.position.set(s*(sectionX(az,ay)+.15),ay,az);an.rotation.y=s*Math.PI/2;g.add(an);}}
 box(.3,2.8,2.2,0,-1.3,-half+1.1,mat('boot'),'duke-rudder');
 {const prop=new THREE.Group();prop.name='duke-propeller';for(let k=0;k<4;k++){const bl=new THREE.Mesh(new THREE.BoxGeometry(.2,1.5,.55),metal('brass'));bl.position.y=.75;bl.rotation.y=.4;const p=new THREE.Group();p.rotation.z=k*Math.PI/2;p.add(bl);prop.add(p);}prop.position.set(0,-1.7,-half+2.9);g.add(prop);}
 beam([0,deckY(-half)+.4,-half+.4],[0,deckY(-half)+4.6,-half-.2],.05,mat('wood'),'duke-flagstaff');box(.04,.9,1.5,0,deckY(-half)+4,-half-.95,mat('funnelR'),'duke-flag');
 for(const[x,z]of[[1.5,11.6],[-1.2,9],[2.6,-24.5],[-2.2,-21.6],[1.1,22.8],[-3.2,1.5]]){const y=deckY(z);cyl(.2,.24,1.05,x,y+.53,z,mat('iron'),'duke-crew-body',8);add(new THREE.SphereGeometry(.16,8,6),mat('cream'),x,y+1.25,z,'duke-crew-head');cyl(.18,.18,.08,x,y+1.42,z,mat('houseDark'),'duke-crew-cap',8);}
 for(const[x,z]of[[0,27.2],[-4.4,-1.2],[4.4,-1.2],[0,-28.2],[-4.3,13.5],[4.3,13.5]]){const y=deckY(z);cyl(.05,.05,1.5,x,y+.75,z,mat('iron'),'duke-lamp-post',6);box(.26,.34,.26,x,y+1.6,z,glowM,'duke-lamp');}
 g.userData.dimensions=DUKE_DIMENSIONS;g.userData.funnelTop=new THREE.Vector3(0,fb+9.8,fz);
 return g;
}

// r9: on a small planet a straight 58 m hull lifts ~2.6 m clear of the sea at bow and stern.
// Bend the finished ship about its local x axis so the keel and deck follow the sea's curve.
// radius = distance from the planet centre to the ship origin. Long meshes (hull, strakes,
// rails, rigging) are bent per vertex; compact parts are moved rigidly. Call once, before use.
export function bendDukeToPlanet(ship,radius){
 if(!ship||!(radius>0)||ship.userData.planetBend)return ship;
 ship.updateMatrixWorld(true);
 const inv=new THREE.Matrix4().copy(ship.matrixWorld).invert(),v=new THREE.Vector3(),box=new THREE.Box3();
 const bendPoint=p=>{const phi=p.z/radius,r=radius+p.y;return p.set(p.x,r*Math.cos(phi)-radius,r*Math.sin(phi));};
 const rigid=z=>{const phi=z/radius;return new THREE.Matrix4().makeTranslation(0,-radius,0).multiply(new THREE.Matrix4().makeRotationX(phi)).multiply(new THREE.Matrix4().makeTranslation(0,radius,-z));};
 const rel=o=>new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
 const extent=o=>{box.makeEmpty();o.traverse(m=>{const g=m.geometry;if(!g?.attributes?.position)return;if(!g.boundingBox)g.computeBoundingBox();box.union(g.boundingBox.clone().applyMatrix4(rel(m)));if(m.isSprite)box.expandByPoint(v.setFromMatrixPosition(rel(m)));});if(box.isEmpty())box.expandByPoint(v.setFromMatrixPosition(rel(o)));return box.clone();};
 const setRel=(o,M)=>{const parentRel=o.parent===ship?new THREE.Matrix4():rel(o.parent);const local=parentRel.invert().multiply(M);local.decompose(o.position,o.quaternion,o.scale);o.matrix.copy(local);};
 const visit=o=>{
  const b=extent(o),span=b.max.z-b.min.z;
  if(span<4){const c=(b.min.z+b.max.z)/2;setRel(o,rigid(c).multiply(rel(o)));return;}
  const g=o.geometry;
  if(g?.attributes?.position&&!o.isSprite&&!g.userData?.dukeBent){
   const M=rel(o),Mi=M.clone().invert(),pos=g.attributes.position,ng=g.clone();ng.userData.dukeBent=true;const np=ng.attributes.position;
   for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(M);bendPoint(v).applyMatrix4(Mi);np.setXYZ(i,v.x,v.y,v.z);}
   np.needsUpdate=true;if(ng.attributes.normal)ng.computeVertexNormals();ng.computeBoundingBox();ng.computeBoundingSphere();o.geometry=ng;
  }
  for(const c of o.children.slice())visit(c);
 };
 // children of the ship need their matrices current while siblings move: snapshot the list first
 for(const c of ship.children.slice()){visit(c);ship.updateMatrixWorld(true);}
 if(ship.userData.funnelTop)bendPoint(ship.userData.funnelTop);
 ship.userData.planetBend=radius;return ship;
}
