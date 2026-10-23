import * as T from 'three';
import {mergeStaticGroup} from '../geometryMerge.js';
import {relicBuilder,relicMetalPalette} from '../../assets/relicMetal.js';
import original from '../../../assets/models/optimized/citadel-statue/citadelStatueData.js';

export function buildCitadelPlazaStatue(){
 const root=new T.Group();root.name='citadel-plaza-hero-statue';root.scale.setScalar(1.2);
 root.userData={preserveCitadelMaterials:true,sourceId:'roman-ivory-stone-guardian-5-pointed-armour',approvedTarget:'statue-target-v2-roman.png',materialDirection:'2026-10-06 user: milk-white stone, original stone pedestal'};
 const stone=(name,color,roughness)=>{const mat=new T.MeshStandardMaterial({name,color,roughness,metalness:0});mat.userData.preserveCitadelMaterial=true;return mat;};
 const ivory=stone('guardian-milk-white-limestone',0xeee6d4,.78),recess=stone('guardian-warm-stone-recess',0xd6cbb8,.85),carving=stone('guardian-cut-stone-relief',0xe4d9c4,.8);
 const m={silver:ivory,edge:ivory,dark:recess,gold:carving,bronze:carving};
 const baseBuilder=relicBuilder(root);
 // Restore the exact original pedestal meshes and material colours.
 const baseMats=new Map();
 for(const part of original.parts.filter(p=>/^pedestal-|^figure-carved-plinth$/.test(p.name))){
  if(!baseMats.has(part.material)){const src=original.materials[part.material],p=src.pbrMetallicRoughness;const mat=stone(src.name,new T.Color().setRGB(...p.baseColorFactor.slice(0,3)),p.roughnessFactor);baseMats.set(part.material,mat);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(part.position,3));geo.setAttribute('normal',new T.Float32BufferAttribute(part.normal,3));geo.setIndex(part.index);
  const o=baseBuilder.mesh(part.name,geo,baseMats.get(part.material));o.position.fromArray(part.translation);o.quaternion.fromArray(part.rotation);o.scale.fromArray(part.scale);
 }
 const figure=new T.Group();figure.name='volumetric-stone-guardian';figure.scale.setScalar(.63);figure.position.y=2.875-.45*.63;root.add(figure);
 const b=relicBuilder(figure),{mesh,ell,box,rod,ring,plate}=b;
 const joints={},rest=new Map();
 const pivot=(name,point,parent=figure)=>{const j=new T.Group();j.name='guardian-'+name;j.position.fromArray(point);figure.add(j);figure.updateWorldMatrix(true,true);parent.attach(j);j.userData.heroJoint=true;rest.set(j,j.quaternion.clone());return j;};
 const collect=(joint,fn)=>{const before=new Set(figure.children);fn();figure.updateWorldMatrix(true,true);for(const o of [...figure.children])if(!before.has(o)&&o.isMesh)joint.attach(o);};
 // Closed, elliptical armour sections give real front/back depth and rounded
 // side silhouettes. Both end caps are geometry, not double-sided flat faces.
 function armour(name,rows,mat){
  const n=24,pos=[],idx=[];
  for(const[y,rx,rz,z=0]of rows)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;pos.push(Math.cos(a)*rx,y,z+Math.sin(a)*rz);}
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,c=a+n+1;idx.push(a,c,a+1,a+1,c,c+1);}
  for(const[j,reverse]of[[0,true],[rows.length-1,false]]){const center=pos.length/3;pos.push(0,rows[j][0],rows[j][3]||0);for(let i=0;i<n;i++){const a=j*(n+1)+i;idx.push(center,reverse?a:a+1,reverse?a+1:a);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();return mesh(name,geo,mat);
 }
 function mantle(points,z,thickness){
  const cx=points.reduce((a,p)=>a+p[0],0)/points.length,cy=points.reduce((a,p)=>a+p[1],0)/points.length,n=points.length,pos=[],idx=[];
  for(const depth of[0,thickness]){for(const[x,y]of points)pos.push(x,y,z+depth);pos.push(cx,cy,z+depth-.18);}
  for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(n,j,i,2*n+1,n+1+i,n+1+j,i,j,n+1+i,j,n+1+j,n+1+i);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();return mesh('sculpted-stone-mantle',geo,m.silver);
 }
 // Convex stone relief has a continuous rounded face and a closed back.
 // Three depth rings roll the edge into the front instead of adding a flat card.
 function relief(name,points,z,depth,mat,bulge=.085){
  const n=points.length,cx=points.reduce((v,p)=>v+p[0],0)/n,cy=points.reduce((v,p)=>v+p[1],0)/n,pos=[],idx=[];
  for(const[scale,dz]of[[1,0],[1,depth*.42],[.72,depth+bulge*.6]])for(const[x,y]of points)pos.push(cx+(x-cx)*scale,cy+(y-cy)*scale,z+dz);
  const back=pos.length/3;pos.push(cx,cy,z);const front=pos.length/3;pos.push(cx,cy,z+depth+bulge);
  for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(back,j,i,front,2*n+i,2*n+j);for(let r=0;r<2;r++){const a=r*n+i,b=r*n+j;idx.push(a,b,b+n,a,b+n,a+n);}}
  const area=points.reduce((a,p,i)=>a+p[0]*points[(i+1)%n][1]-points[(i+1)%n][0]*p[1],0);
  if(area<0)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();return mesh(name,geo,mat);
 }
 // Orient a CLOSED variable-section volume to the actual bone, rather than
 // placing a straight cylinder behind a thin front card.
 function limbVolume(name,A,B,sections,mat){
  const a=new T.Vector3(...A),delta=a.clone().sub(new T.Vector3(...B)),length=delta.length();
  const o=armour(name,sections.map(([t,rx,rz])=>[-t*length,rx,rz]).reverse(),mat);o.position.copy(a);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;
 }
 function limbPlate(name,A,B,outline,z,depth,mat,back=false){
  const a=new T.Vector3(...A),delta=a.clone().sub(new T.Vector3(...B)),length=delta.length(),o=relief(name,outline.map(([x,t])=>[back?-x:x,-t*length]),z,depth,mat,.055);
  o.position.copy(a);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());if(back)o.rotateY(Math.PI);return o;
 }
 // Solid carved anatomy and full-depth armour.
 armour('full-depth-cuirass',[[3.41,.35,.27],[3.86,.47,.34],[4.21,.70,.46],[4.49,.68,.43],[4.67,.39,.31]],m.silver);
 armour('continuous-stone-waist',[[2.97,.34,.28],[3.29,.39,.31],[3.62,.37,.29]],m.dark);
 ell('hip-core',[0,2.96,0],[.49,.40,.37],m.dark);
 rod('neck',[0,4.60,0],[0,4.99,0],.255,m.silver);
 for(const s of [-1,1]){
  // Left leg bears the weight; right leg is set back and slightly outward.
  // Both sabaton soles still meet the unchanged carved plinth at y=.45.
  const hip=[s*.34,2.94,0],knee=s<0?[-.32,1.91,.04]:[.48,1.99,-.20],ankle=s<0?[-.32,.78,.07]:[.67,.78,-.47];
  const side=s<0?'left':'right',leg=joints[side+'Leg']={};leg.hip=pivot(side+'-hip',hip);leg.knee=pivot(side+'-knee',knee,leg.hip);leg.foot=pivot(side+'-foot',ankle,leg.knee);
  collect(leg.hip,()=>{
   rod('thigh-inner-frame',hip,knee,.18,m.dark,.21);
   limbVolume('tapered-thigh-armour',hip,knee,[[0,.27,.26],[.22,.33,.32],[.56,.28,.28],[.84,.19,.21],[1,.17,.18]],m.silver);
   limbPlate('pointed-thigh-overplate',hip,knee,[[-.22,0],[.25,.02],[.33,.28],[.19,.78],[.015,1.01],[-.18,.80]],.24,.11,m.silver);
   limbPlate('thigh-rear-shell',hip,knee,[[-.20,.04],[.22,.06],[.29,.28],[.15,.83],[0,.97],[-.17,.73]],.21,.095,m.silver,true);
  });
  collect(leg.knee,()=>{
   rod('shin-inner-frame',knee,ankle,.11,m.dark,.14);
   limbVolume('shaped-calf-greave',knee,ankle,[[0,.18,.18],[.23,.235,.26],[.44,.21,.24],[.74,.145,.17],[1,.13,.15]],m.silver);
   limbPlate('pointed-shin-ridge',knee,ankle,[[-.16,.14],[.16,.14],[.215,.35],[.10,.86],[0,1.03],[-.125,.82]],.175,.10,m.silver);
   limbPlate('rear-calf-overlap',knee,ankle,[[-.15,.15],[.16,.16],[.19,.36],[.12,.66],[0,.81],[-.13,.65]],.185,.085,m.silver,true);
   ell('knee-joint',knee,[.20,.20,.20],m.dark);ring('knee-gold-bearing',[knee[0],knee[1],knee[2]+.205],.13,.026,m.gold);
   limbPlate('pointed-knee-cap',knee,ankle,[[-.17,-.12],[.18,-.08],[.22,.09],[0,.28],[-.19,.12]],.19,.11,m.silver);
  });
  collect(leg.foot,()=>{
   ell('anchored-sabatons',[ankle[0],.62,ankle[2]+.18],[.25,.17,.43],m.dark);
   for(let j=0;j<3;j++)relief('overlapping-foot-armour',[[ankle[0]-.20,.58+j*.035],[ankle[0]+.20,.58+j*.035],[ankle[0]+.18,.71+j*.025],[ankle[0]-.17,.72+j*.025]],ankle[2]+.22+j*.10,.075,m.silver,.035);
   ring('ankle-bearing',[ankle[0],ankle[1],ankle[2]+.13],.10,.025,m.gold);
  });
  ring('hip-bearing',[s*.48,2.93,.18],.17,.032,m.gold);
  // Large overlapping shoulder shells with swept, plate-like tips.
  const shoulder=[s*.74,4.47,0],elbow=[s*.94,3.79,.03],hand=s>0?[1.18,3.89,.34]:[-1.01,3.12,.13];
  const arm=joints[side+'Arm']={};arm.shoulder=pivot(side+'-shoulder',shoulder);arm.elbow=pivot(side+'-elbow',elbow,arm.shoulder);arm.hand=pivot(side+'-hand',hand,arm.elbow);
  collect(arm.shoulder,()=>{ell('shoulder-core',shoulder,[.28,.27,.32],m.dark);rod('upper-arm',shoulder,elbow,.20,m.dark,.23);});collect(arm.elbow,()=>rod('forearm',elbow,hand,.16,m.dark));
  collect(arm.shoulder,()=>{
   const outline=[[s*.43,4.64],[s*.63,4.84],[s*.94,4.69],[s*1.15,4.43],[s*1.26,4.04],[s*.98,4.15],[s*.68,4.37],[s*.46,4.43]];
   relief('vaulted-pointed-pauldron',outline,-.32,.56,m.silver,.14);
   for(let j=0;j<2;j++){
    const p=[[s*.63,4.47-j*.17],[s*.94,4.45-j*.17],[s*1.16,4.23-j*.19],[s*1.08,3.94-j*.16],[s*.84,4.08-j*.16],[s*.67,4.24-j*.17]];
    relief('layered-pauldron-blade-'+j,p,.24+j*.03,.10,m.silver,.055);
    const rear=relief('rear-pauldron-lame-'+j,p.map(([x,y])=>[-x,y]),.24+j*.025,.10,m.silver,.055);rear.rotation.y=Math.PI;
   }
   ring('shoulder-brass-bearing',[s*.91,4.4,.34],.14,.028,m.gold);
  });collect(arm.elbow,()=>{ell('elbow-bearing',elbow,[.19,.18,.18],m.dark);ring('elbow-brass-bearing',[elbow[0],elbow[1],.22],.11,.022,m.gold);
  limbVolume('tapered-vambrace',elbow,hand,[[0,.19,.20],[.25,.24,.24],[.65,.20,.21],[1,.15,.17]],m.silver);
  });collect(arm.hand,()=>{ell('hand',hand,[.15,.19,.14],m.dark);
  for(let f=0;f<4;f++)rod('metal-finger',[hand[0]+(f-1.5)*.055,hand[1]-.03,hand[2]+.1],[hand[0]+(f-1.5)*.055,hand[1]-.19,hand[2]+.1],.029,m.silver);
  });
  relief('chest-carved-ridge',[[s*.02,4.48],[s*.47,4.52],[s*.55,4.26],[s*.25,4.07],[s*.02,4.13]],.36,.11,m.silver);
  for(let j=0;j<4;j++)relief('abdominal-lame',[[s*.02,4.06-j*.18],[s*(.29-j*.025),4.10-j*.18],[s*(.33-j*.025),3.94-j*.18],[s*.02,3.89-j*.18]],.26,.10,m.silver);
  relief('hip-tasset',[[s*.05,3.19],[s*.44,3.27],[s*.62,2.78],[s*.36,2.51],[s*.14,2.68]],.21,.12,m.silver);
  const rearHip=relief('rear-stone-tasset',[[s*.05,3.18],[s*.40,3.20],[s*.55,2.82],[s*.32,2.65],[s*.12,2.78]],.24,.10,m.silver,.05);rearHip.rotation.y=Math.PI;
  // Thick bowed stone mantle lames, with closed front, back and edge surfaces.
  for(let j=0;j<3;j++){
   const p=mantle([[s*.16,4.79-j*.12],[s*.61,4.77-j*.16],[s*(1.52-j*.18),3.31-j*.43],[s*(.71-j*.1),3.80-j*.28]],-.50-j*.10,.16);p.rotation.y=s*-.22;
  }
 }
 // Explicit carved anatomy: the old borrowed face did not share this figure's transform.
 joints.head=pivot('head',[0,4.94,0]);
 collect(joints.head,()=>{
 ell('human-cranium',[0,5.28,.045],[.29,.38,.275],ivory);
 ell('human-jaw',[0,5.035,.15],[.235,.18,.205],ivory);
 ell('human-chin',[0,4.965,.28],[.13,.075,.095],ivory);
 for(const sign of[-1,1]){
  ell('carved-cheek',[sign*.17,5.19,.235],[.12,.12,.10],ivory);
  ell('eye-socket',[sign*.116,5.335,.285],[.083,.044,.029],recess);
  ell('stone-eyelid',[sign*.116,5.325,.31],[.066,.023,.020],ivory);
  rod('carved-brow',[sign*.035,5.397,.29],[sign*.207,5.385,.262],.033,ivory);
  ell('nostril-wing',[sign*.052,5.166,.365],[.034,.029,.041],carving);
 }
 ell('nose-bridge',[0,5.27,.326],[.045,.139,.074],ivory);
 ell('nose-tip',[0,5.173,.388],[.054,.042,.052],ivory);
 ell('mouth-recess',[0,5.075,.324],[.106,.014,.021],recess);
 ell('upper-lip',[0,5.094,.337],[.098,.022,.028],ivory);
 ell('lower-lip',[0,5.055,.335],[.095,.022,.027],ivory);
 mesh('roman-galea-bowl',new T.SphereGeometry(.355,32,18,0,Math.PI*2,0,Math.PI*.57),m.silver,[0,5.54,0]);
 const brow=ring('roman-brow-rim',[0,5.53,0],.36,.037,m.gold,'y');brow.scale.z=.97;
 for(const s of [-1,1]){
  plate('roman-hinged-cheek',[[s*.23,5.54],[s*.35,5.5],[s*.32,5.06],[s*.23,5.00],[s*.18,5.23]],.14,.085,m.silver);
  ring('cheek-hinge',[s*.30,5.47,.245],.043,.013,m.gold);
  ell('cheek-rivet',[s*.275,5.15,.24],[.025,.025,.012],m.gold);
 }
 const guard=mesh('roman-neck-guard',new T.SphereGeometry(.42,24,10,Math.PI/2,Math.PI,Math.PI*.43,Math.PI*.22),m.silver,[0,5.45,0]);guard.scale.y=.40;
 for(let i=0;i<25;i++){
  const a=-1.12+i/24*2.24,cy=5.54,cz=-.025,r=.41;
  rod('bronze-roman-crest',[0,cy+Math.cos(a)*r,cz+Math.sin(a)*r],[0,cy+Math.cos(a)*(.71),cz+Math.sin(a)*(.65)],.032,m.bronze,.021);
 }
 });
 // A complete rigid spear is pivoted around the real palm, 18 degrees out.
 // Shaft, ferrules, blade and strike tip use ONE local axis and follow the hand.
 const gripPoint=new T.Vector3(1.18,3.89,.34),spearDirection=new T.Vector3(Math.sin(Math.PI/10),Math.cos(Math.PI/10),0);
 const spear=new T.Group();spear.name='guardian-spear-grip';spear.position.copy(gripPoint);spear.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),spearDirection);figure.add(spear);
 const sb=relicBuilder(spear);sb.rod('spear-shaft',[0,-(3.89-.49)/Math.cos(Math.PI/10),0],[0,2.25,0],.045,m.dark);
 for(let i=0;i<10;i++)sb.ring('spear-gold-ferrule',[0,-2.7+i*.49,0],.052,.016,m.gold,'y');
 sb.plate('spearhead',[[-.14,2.04],[-.20,2.42],[0,3.05],[.16,2.42],[.09,2.04]],-.0525,.105,m.silver);
 sb.plate('spear-inlay',[[-.045,2.15],[-.06,2.46],[0,2.83],[.045,2.36]],.058,.015,m.gold);
 const spearTip=new T.Object3D();spearTip.name='guardian-spear-tip';spearTip.position.set(0,3.05,0);spear.add(spearTip);
 mergeStaticGroup(spear,{mergedTag:'guardian-spear'});figure.updateWorldMatrix(true,true);joints.rightArm.hand.attach(spear);

 const seat=new T.Object3D();seat.name='guardian-seat-anchor';seat.position.set(0,2.94,0);figure.add(seat);
 // Sparse small fasteners retain readable material boundaries at game scale.
 for(const s of [-1,1])for(let j=0;j<4;j++)ell('armour-rivet',[s*(.14+j*.1),4.56-j*.06,.415],[.027,.027,.013],m.gold);
 // Each rigid link may be merged; never bake joints or the body into its stone pedestal.
 for(const j of rest.keys())mergeStaticGroup(j,{mergedTag:'guardian-rigid-link',skip:o=>o.parent!==j});
 mergeStaticGroup(figure,{mergedTag:'guardian-torso',skip:o=>o.parent!==figure});
 mergeStaticGroup(root,{mergedTag:'guardian-pedestal',skip:o=>o.parent!==root});
 const figureRest={position:figure.position.clone(),quaternion:figure.quaternion.clone(),scale:figure.scale.clone()};
 const spearRest=spear.quaternion.clone();
 const reset=()=>{spear.quaternion.copy(spearRest);for(const[j,q]of rest)j.quaternion.copy(q);figure.updateWorldMatrix(true,true);};
 const setPose=(pose='rest',amount=1)=>{
  if(!Number.isFinite(amount))throw new TypeError('pose amount must be finite');
  const states=typeof pose==='string'?{[pose]:amount}:pose;
  if(!states||Object.keys(states).some(k=>!['rest','mounted','raiseSpear'].includes(k)||!Number.isFinite(states[k])))throw new TypeError('unknown or non-finite guardian pose');
  reset();const mounted=T.MathUtils.clamp(states.mounted||0,0,1),raised=T.MathUtils.clamp(states.raiseSpear||0,0,1);
  for(const[side,sign]of[['left',-1],['right',1]]){const l=joints[side+'Leg'];l.hip.rotation.x=-.95*mounted;l.hip.rotation.z=sign*.42*mounted;l.knee.rotation.x=1.22*mounted;l.foot.rotation.x=-.27*mounted;}
  // Raise away from the chest: the former negative shoulder angle pulled
  // the palm across the body and drove the long spear butt through the horse.
  joints.rightArm.shoulder.rotation.z=1.40*raised;joints.rightArm.elbow.rotation.z=-1.00*raised;joints.rightArm.hand.rotation.z=-.40*raised;
  // Keep the rigid shaft 18 degrees from upright, turning its lean forward
  // while mounted so its full butt clears the wooden torso beside the rider.
  spear.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),Math.PI*.5*raised).multiply(spearRest);
  // Carry the butt outside the horse during the lift; return to the same
  // 18-degree hold at both endpoints, without telescoping or detaching it.
  spear.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),raised===0||raised===1?0:.9*Math.pow(Math.max(0,Math.sin(Math.PI*raised)),.3)*T.MathUtils.smoothstep(raised,0,.12)));
  joints.leftArm.shoulder.rotation.x=-.60*mounted;joints.leftArm.elbow.rotation.x=-.45*mounted;
  figure.updateWorldMatrix(true,true);return true;
 };
 root.userData.heroRig={version:1,bodyRoot:figure,joints,anchors:{seat,spearTip,spearGrip:spear},setPose,reset,
  detachTo(parent){if(!parent?.isObject3D)throw new TypeError('parent Object3D required');parent.updateWorldMatrix(true,true);figure.updateWorldMatrix(true,true);parent.attach(figure);return figure;},
  restoreToPedestal(){root.add(figure);figure.position.copy(figureRest.position);figure.quaternion.copy(figureRest.quaternion);figure.scale.copy(figureRest.scale);reset();},
  getSpearTipWorld(target=new T.Vector3()){spearTip.updateWorldMatrix(true,false);return spearTip.getWorldPosition(target);},
  locomotionImplemented:false};
 // A town-scale inverse ink hull overwhelms the small ivory carving and
 // flickers across its overlapping relief. Let real geometry shade the stone.
 root.traverse(o=>{if(o.isMesh)o.userData.skipInkOutline=true;});
 root.userData.pedestalRestored=true;root.userData.figureScale=.63;root.userData.figureSeatedAt=2.875;
 root.userData.materialRevision='ivory-idle-iron-awake-pointed-armour-5';
 root.userData.poseContract={version:3,weightBearingLeg:'left',rearOutwardLeg:'right',spearOutwardDegrees:18,gripInPalm:true,heroJointCount:13};
 const stoneBindings=new Map();figure.traverse(o=>{if(o.isMesh)stoneBindings.set(o,o.material);});
 let awake=false,metalMaterials=null,appearanceDisposed=false;
 const appearance={get awake(){return awake;},setAwake(value){
  if(typeof value!=='boolean')throw new TypeError('guardian awake state must be boolean');if(appearanceDisposed||value===awake)return false;
  if(value){const palette=relicMetalPalette();metalMaterials=[palette.silver,palette.dark,palette.gold];for(const material of [palette.edge,palette.bronze,palette.brass])material.dispose();const replacement=new Map([[ivory,palette.silver],[recess,palette.dark],[carving,palette.gold]]);for(const[o,material]of stoneBindings)o.material=replacement.get(material)||material;}
  else{for(const[o,material]of stoneBindings)o.material=material;metalMaterials?.forEach(m=>m.dispose());metalMaterials=null;}
  awake=value;return true;
 },dispose(){if(appearanceDisposed)return;appearance.setAwake(false);appearanceDisposed=true;}};
 root.userData.guardianAppearance=appearance;
 return root;
}
