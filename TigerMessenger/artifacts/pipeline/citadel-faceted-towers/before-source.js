import * as THREE from 'three';
import {solveCastleFacade} from './castleFacadeWfc.js';
import {mergeStaticGroup} from '../geometryMerge.js';
import {nightWeightAt} from '../../render/lighting/highlandLightVolumes.js';

// Reference-driven volumes with WFC front-wall modules. Original crown stays archived;
// the working portal, switchback, spiral stairs and upper balcony stay intact.
export function applyTargetCastleSilhouette(city){
 if(city.getObjectByName('citadel-target-castle-silhouette'))return;
 const original=city.getObjectByName('west-city-crown');
 if(!original)return;

 const root=new THREE.Group();root.name='citadel-target-castle-silhouette';
 const stone=new THREE.MeshStandardMaterial({color:0xcac3b1,roughness:.94});
 const edge=new THREE.MeshStandardMaterial({color:0xd9ceb8,roughness:.92});
 const shadow=new THREE.MeshStandardMaterial({color:0x766e66,roughness:1});
 const blue=new THREE.MeshStandardMaterial({color:0x1c61b1,roughness:.85,flatShading:true});
 const warm=new THREE.MeshStandardMaterial({color:0x573c23,emissive:0xffb767,emissiveIntensity:.6,roughness:.86});
 const unit=new THREE.BoxGeometry(1,1,1);
 const facadeReports=[];
 const alternateStone=stone.clone();alternateStone.color.setHex(0xc6bfad);
 function box(name,x,y,z,w,h,d,mat=stone){
  const m=new THREE.Mesh(unit,mat);m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);
  m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
 }
 function frontPanel(name,x,z,w,low,high){if(high>low)box(name,x,(low+high)/2,z,w,high-low,.42);}
 function window(x,y,z,w=.64,h=1.7,angle=0){
  const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);
  s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();
  const geometry=new THREE.ShapeGeometry(s,6);
  const recess=new THREE.Mesh(geometry,shadow);recess.position.set(x,y-.1,z);recess.rotation.y=angle;recess.scale.set(1.36,1.16,1);root.add(recess);
  const pane=new THREE.Mesh(geometry,warm);pane.position.set(x+Math.sin(angle)*.015,y,z+Math.cos(angle)*.015);pane.rotation.y=angle;root.add(pane);
 }
 function facade(id,x,front,w,bottom,top){
  const rows=Math.max(1,Math.round((top-bottom)/7.4));
  const solved=solveCastleFacade({rows,seed:20260913+facadeReports.length});
  const cw=w/3,ch=(top-bottom)/rows;
  let openings=0;
  solved.grid.forEach((row,r)=>row.forEach((tile,c)=>{
   const cx=x-w/2+(c+.5)*cw,low=bottom+r*ch;
   if(tile.startsWith('stone')){
    box(id+'-wfc-'+tile,cx,low+ch/2,front,cw,ch,.42,tile==='stone-alt'?alternateStone:stone);return;
   }
   // Extrusion contains a genuine opening: no legacy solid front behind it.
   const shape=new THREE.Shape();shape.moveTo(-cw/2,0);shape.lineTo(cw/2,0);shape.lineTo(cw/2,ch);shape.lineTo(-cw/2,ch);shape.closePath();
   const ww=tile==='arch'?.64:.36,wh=tile==='arch'?1.7:1.5,wy=Math.min(ch-wh-.5,4.8);
   const hole=new THREE.Path();hole.moveTo(-ww/2,wy);hole.lineTo(-ww/2,wy+wh-ww/2);
   hole.absarc(0,wy+wh-ww/2,ww/2,Math.PI,0,true);hole.lineTo(ww/2,wy);hole.closePath();shape.holes.push(hole);
   const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.42,bevelEnabled:false,curveSegments:6}),stone);
   mesh.name=id+'-wfc-'+tile;mesh.position.set(cx,low,front-.21);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
   const paneShape=new THREE.Shape();paneShape.moveTo(-ww/2,0);paneShape.lineTo(ww/2,0);paneShape.lineTo(ww/2,wh-ww/2);paneShape.absarc(0,wh-ww/2,ww/2,0,Math.PI,false);paneShape.closePath();
   const pane=new THREE.Mesh(new THREE.ShapeGeometry(paneShape,6),warm);pane.position.set(cx,low+wy,front-.18);root.add(pane);openings++;
  }));
  facadeReports.push({id,rows,modules:rows*3,openings,grid:solved.grid,solutionHash:solved.solutionHash});
 }
 function tower({id,x,z,w,d=w,bottom=16,top,cap=false,shaft=false}){
  const h=top-bottom,t=.45,front=z+d/2;
  // Butt joints instead of intersecting boxes: overlapping top planes caused
  // visible black stippling along the former copings in the overview camera.
  box(id+'-west',x-w/2+t/2,bottom+h/2,z+(t-.21)/2,t,h,d-t-.21);
  box(id+'-east',x+w/2-t/2,bottom+h/2,z+(t-.21)/2,t,h,d-t-.21);
  box(id+'-rear',x,bottom+h/2,z-d/2+t/2,w,h,t);
  if(shaft){
   // Genuine holes precisely at the existing 22.3 m entry and 37 m exit.
   for(const side of [-1,1])frontPanel(id+'-front-pier',x+side*(w/4+.95),front,w/2-1.9,bottom,top);
   // Recess the ground-level center wall behind the courtyard switchback.
   // The route turns at z=1.8; the soldier's shield/arm envelope extends behind
   // its feet, so a wall at z=1.0 clipped equipment despite clear center rays.
   frontPanel(id+'-courtyard-recess',x,front-.85,3.8,bottom,22.05);
   for(const side of [-1,1])box(id+'-recess-return',x+side*1.9,(bottom+22.05)/2,front-.425,.18,22.05-bottom,.85);
   for(const [lo,hi] of [[25.5,36.75],[39.7,top]])frontPanel(id+'-front-lintel',x,front,3.8,lo,hi);
  }else facade(id,x,front,w,bottom,top);
  for(const side of [-1,1])box(id+'-corner',x+side*(w/2-.25),bottom+(h-.3)/2,front+.12,.5,h-.3,.25,edge);
  for(const side of [-1,1]){
   box(id+'-side-cornice',x+side*w/2,top+.08,z,.65,.32,d-.65,edge);
   box(id+'-end-cornice',x,top+.08,z+side*d/2,w+.65,.32,.65,edge);
  }
  if(cap){
   const radius=Math.min(w,d)*.55;
   const drum=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.85,8),stone);drum.position.set(x,top+.2,z);root.add(drum);
   const rise=radius*.98;
   const profile=[new THREE.Vector2(radius,0),new THREE.Vector2(radius*.96,rise*.22),new THREE.Vector2(radius*.68,rise*.68),new THREE.Vector2(radius*.31,rise*.95),new THREE.Vector2(0,rise)];
   const roof=new THREE.Mesh(new THREE.LatheGeometry(profile,8),blue);roof.position.set(x,top+.63,z);roof.castShadow=true;root.add(roof);
  }else{
   // Thin roof slab: no new solid block is inserted through the stair shaft.
   box(id+'-roof',x,top-.25,z,w-.35,.22,d-.35);
   const n=Math.max(3,Math.round(w/1.65));
   for(let i=0;i<n;i++)for(const side of [-1,1]){
    const dx=-w/2+.48+(w-.96)*i/(n-1);
    box(id+'-merlon',x+dx,top+.35,z+side*(d/2-.22),.72,.85,.5,edge);
   }
   for(let i=1;i<n-1;i++)for(const side of [-1,1])box(id+'-side-merlon',x+side*(w/2-.22),top+.35,z-d/2+.48+(d-.96)*i/(n-1),.5,.85,.72,edge);
  }
  for(let y=bottom+5;y<top-2;y+=7.4){
   if(shaft&&!((y<25.8&&y>20)||(y>35&&y<40)))window(x,y,front+.24,.6,1.65);
   window(x+w/2+.018,y+1,z,.57,1.55,Math.PI/2);
  }
 }
 // Readable uneven skyline: terrace bastions, one offset high keep, and only
 // three blue caps. This replaces the five identical rounded silos.
 tower({id:'left-gate-bastion',x:49.1,z:10,w:8,d:8,top:29.6});
 tower({id:'right-gate-bastion',x:73,z:9,w:8,d:8,top:33.4});
 tower({id:'left-outer-turret',x:42.4,z:6,w:5.2,top:26.4});
 tower({id:'right-outer-turret',x:81.2,z:3,w:5.6,top:29.6});
 tower({id:'left-blue-tower',x:48.2,z:-3.5,w:6.8,top:35.8,cap:true});
 tower({id:'right-blue-tower',x:72,z:-3.6,w:8.8,top:43,cap:true});
 tower({id:'central-stair-keep',x:60,z:-4.4,w:8.6,d:10.8,top:42.3,shaft:true});
 tower({id:'offset-high-keep',x:63.8,z:-14.6,w:9.8,d:9,top:52.4,cap:true});
 // Side cheeks meet, not cover, the existing Blender-refined pointed portal.
 frontPanel('west-gate-shoulder',53.95,11.2,1.7,16,29.0);
 frontPanel('east-gate-shoulder',67.2,11.2,3.7,16,30.5);
 for(const x of [54.2,56.7,59.2,61.7,64.2])box('gate-top-merlon',x,29.55,11,.7,.8,.65,edge);
 mergeStaticGroup(root,{mergedTag:'target-castle-silhouette'});
 root.traverse(m=>{if(m.isMesh){m.name='target-castle-exterior';m.userData.isCitadelTerrain=false;m.userData.westCityWalkable=false;m.userData.citadelSolidExterior=true;}});
 root.userData.sourceId='reference-square-asymmetric-castle-v2-wfc-facades';
 root.userData.facadeWfc={scope:'seven front facades; authored volumes, side walls and stair keep',towers:facadeReports};
 root.userData.originalArchivedNode='west-city-crown';
 root.userData.update=phase=>{warm.emissiveIntensity=.04+nightWeightAt(phase)*1.1;};
 root.userData.update(.85);
 original.visible=false;
 original.userData.archivedBy='target-square-asymmetric-castle';
 city.add(root);
 city.userData.targetCastleSilhouette={squareTowers:8,blueCaps:3,preserved:'gate, courtyard, spiral stairs, balcony'};
 return root;
}
