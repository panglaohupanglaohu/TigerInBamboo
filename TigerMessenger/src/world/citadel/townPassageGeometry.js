import * as THREE from 'three';
import {PLAYER_HEIGHT,PLAYER_RADIUS} from '../../core/constants.js';

// A genuine U-shaped solid extruded through the entire occupied cell. The
// arch opening reaches both socket faces; there is no hidden box or door leaf.
export function makeTownPassageGeometry(cellSize,cellHeight,{axis='z'}={}){
 if(!(cellSize>0&&cellHeight>0)||!['x','z'].includes(axis))throw Error('Invalid passage dimensions/axis');
 const half=cellSize/2,openingHalf=cellSize*.33,spring=cellHeight*.56,rise=cellHeight*.28;
 const section=new THREE.Shape();
 section.moveTo(-half,0);section.lineTo(-openingHalf,0);section.lineTo(-openingHalf,spring);
 for(let i=1;i<=12;i++){const angle=Math.PI*(1-i/12);section.lineTo(i===12?openingHalf:Math.cos(angle)*openingHalf,i===12?spring:spring+Math.sin(angle)*rise);}
 section.lineTo(openingHalf,0);section.lineTo(half,0);section.lineTo(half,cellHeight);section.lineTo(-half,cellHeight);section.closePath();
 const geometry=new THREE.ExtrudeGeometry(section,{depth:cellSize,bevelEnabled:false,curveSegments:12,steps:1});
 geometry.translate(0,-cellHeight/2,-cellSize/2);if(axis==='x')geometry.rotateY(Math.PI/2);
 const clearHeight=spring+rise,clearWidth=openingHalf*2;
 // Player collision is 1.66m tall, 0.70m wide. Current 1.70m cells cannot
 // contain that player plus a structurally visible arch; never change cells.
 geometry.userData.wfcPassage={version:1,axis,clearWidth,clearHeight,springHeight:spring,crownThickness:cellHeight-clearHeight,
  throughDepth:cellSize,playerHeight:PLAYER_HEIGHT,playerDiameter:PLAYER_RADIUS*2,
  playerTraversable:false,scope:'visual-structure experiment; clearance is not certified for player traversal',
  playerHeightFits:clearHeight>=PLAYER_HEIGHT,playerWidthFits:clearWidth>=PLAYER_RADIUS*2};
 return geometry;
}

// Two cells retain their own owner and closed solid; shared split is exactly
// at the existing 1.70m level, not a raised floor or scaled building.
export function makeTownPassagePairGeometry(cellSize,cellHeight,{axis='x',half='lower'}={}){
 if(!['x','z'].includes(axis)||!['lower','upper'].includes(half)||Math.abs(cellHeight-1.7)>1e-8)throw Error('Unsupported passage pair dimensions');
 const h=cellSize/2,a=cellSize*.33,spring=1.90-cellHeight,rise=.40,shapes=[];
 if(half==='lower'){
  for(const [left,right]of [[-h,-a],[a,h]]){const s=new THREE.Shape();s.moveTo(left,0);s.lineTo(right,0);s.lineTo(right,cellHeight);s.lineTo(left,cellHeight);s.closePath();shapes.push(s);}
 }else{
  const s=new THREE.Shape();s.moveTo(-h,0);s.lineTo(-a,0);s.lineTo(-a,spring);
  for(let i=1;i<=12;i++){const angle=Math.PI*(1-i/12);s.lineTo(i===12?a:Math.cos(angle)*a,i===12?spring:spring+Math.sin(angle)*rise);}
  s.lineTo(a,0);s.lineTo(h,0);s.lineTo(h,cellHeight);s.lineTo(-h,cellHeight);s.closePath();shapes.push(s);
 }
 const g=new THREE.ExtrudeGeometry(shapes,{depth:cellSize,bevelEnabled:false,steps:1});g.translate(0,-cellHeight/2,-cellSize/2);if(axis==='x')g.rotateY(Math.PI/2);
 g.userData.wfcPassage={version:2,axis,half,cellHeight,clearWidth:a*2,clearHeight:2.30,springHeight:1.90,crownThickness:cellHeight*2-2.30,throughDepth:cellSize,playerHeight:PLAYER_HEIGHT,playerDiameter:PLAYER_RADIUS*2,playerHeightFits:true,playerWidthFits:true,playerTraversable:false,scope:'two-storey candidate; final capsule and gameplay acceptance required'};
 return g;
}

// CPU verification of the emitted candidate, including the unchanged quays,
// foundations and neighboring regions. No collider flags or declared clearance
// substitute for these actual triangle-ray intersections.
export function auditTownPassageClearance(roots,{referenceRoot=null}={}){
 referenceRoot?.updateWorldMatrix(true,true);
 const inverse=referenceRoot?.matrixWorld.clone().invert(),proxies=[],passages=[];
 for(const root of roots){
  root.updateWorldMatrix(true,true);let attached=false;
  for(let node=root;node;node=node.parent)if(node===referenceRoot){attached=true;break;}
  root.traverse(o=>{if(!o.isMesh||!o.geometry)return;
   const proxy=new THREE.Mesh(o.geometry,o.material);proxy.name=o.name;proxy.userData={...o.userData,auditRegion:root.userData.junctionRegion??null,auditFoundation:!root.userData.junctionRegion};
   proxy.matrixWorld.copy(o.matrixWorld);if(attached)proxy.matrixWorld.premultiply(inverse);
   proxies.push(proxy);if(o.userData.wfcPassage)passages.push(proxy);
  });
 }
 const blocked=[],foundationSupport=[];let probes=0;
 for(const mesh of passages){const p=mesh.userData.wfcPassage,axis=p.axis==='x'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),cross=new THREE.Vector3(-axis.z,0,axis.x);
  const up=new THREE.Vector3(0,1,0).transformDirection(mesh.matrixWorld),floor=new THREE.Vector3(0,-(p.cellHeight??p.springHeight/.56)/2,0).applyMatrix4(mesh.matrixWorld);
  const supportRay=new THREE.Raycaster(floor.clone().addScaledVector(up,2),up.clone().negate(),0,20);
  const foundationHit=supportRay.intersectObjects(proxies.filter(o=>o.userData.auditFoundation),false)[0];
  const delta=foundationHit?foundationHit.point.clone().sub(floor).dot(up):null;
  foundationSupport.push({region:mesh.userData.auditRegion,cell:p.cell,foundation:foundationHit?.object.name??null,delta,supported:delta!==null&&Math.abs(delta)<2e-5});
  for(const h of [.18,p.springHeight*.7,p.clearHeight*.82])for(const offset of [-.2,0,.2]){
   const start=cross.clone().multiplyScalar(p.clearWidth*offset).addScaledVector(axis,-p.throughDepth/2+.001);
   start.y=h-(p.cellHeight??p.springHeight/.56)/2;
   const end=start.clone().addScaledVector(axis,p.throughDepth-.002);start.applyMatrix4(mesh.matrixWorld);end.applyMatrix4(mesh.matrixWorld);
   const distance=start.distanceTo(end),ray=new THREE.Raycaster(start,end.sub(start).normalize(),0,distance);probes++;
   const hit=ray.intersectObjects(proxies,false)[0];if(hit)blocked.push({cell:p.cell,axis:p.axis,height:h,offset,object:hit.object.name,distance:hit.distance});
  }
 }
 return {ok:blocked.length===0,passages:passages.length,probes,blocked,foundationSupport,fixedFoundationSupported:foundationSupport.filter(s=>s.supported).length,playerTraversable:false,
  limitation:'sampled actual interior aperture triangles, not a capsule sweep or certification of external approach routes'};
}
