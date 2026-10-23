import * as THREE from 'three';
// Revision 21 (2026-10-12): ant / locust / beetle factory target sheets.
// Heavy riveted dark-iron lattice gantry, chain hoist block, Chinese freight gate with
// lanterns, rail-side lamps, ant glass door canopy, locust lit pediment window.
// Additive only: called after the revision-20 passes, before the static merge.
export function addFactoryTargetV21(fixed,root,kind,K,anim=[]){
 const {M,mesh,box,cyl,beam,sign,gear,crate}=K,ant=kind==='ant',locust=kind==='locust',sx=-3.1,front=2.4;
 const lantern=(x,y,z,p=fixed,s=1)=>{box(.34*s,.46*s,.34*s,x,y,z,M.amber,p);for(const dx of[-1,1])for(const dz of[-1,1])box(.04*s,.5*s,.04*s,x+dx*.17*s,y,z+dz*.17*s,M.iron,p);box(.42*s,.06*s,.42*s,x,y-.25*s,z,M.iron,p);mesh(new THREE.ConeGeometry(.3*s,.24*s,4),M.iron,x,y+.35*s,z,p).rotation.y=Math.PI/4;mesh(new THREE.SphereGeometry(.05*s,8,6),M.brass,x,y+.5*s,z,p);};

 // ---- 1. lattice gantry ------------------------------------------------------
 const gh=locust?9.2:7.7,cols=[[2.2,2.3],[2.2,-1.2],[9.1,2.3],[9.1,-1.2]],h=.32,step=1.1;
 for(const[x,z]of cols){
  box(1.05,.9,1.05,x,.45,z,M.trim);box(1.2,.12,1.2,x,.94,z,M.trim);
  for(const dx of[-h,h])for(const dz of[-h,h])box(.13,gh-.9,.13,x+dx,.9+(gh-.9)/2,z+dz,M.iron);
  for(let y=.95;y<gh-.2;y+=step){const y2=Math.min(gh,y+step);
   for(const dz of[-h,h]){beam([x-h,y,z+dz],[x+h,y2,z+dz],.03,M.iron);beam([x+h,y,z+dz],[x-h,y2,z+dz],.03,M.iron);}
   for(const dx of[-h,h]){beam([x+dx,y,z-h],[x+dx,y2,z+h],.03,M.iron);beam([x+dx,y,z+h],[x+dx,y2,z-h],.03,M.iron);}
   box(.78,.07,.78,x,y,z,M.iron);
   for(const dx of[-h,h])for(const dz of[-h,h])box(.17,.17,.17,x+dx,y,z+dz,M.brass);}
 }
 // deep box girders over the bay (both faces) and end cross-girders
 for(const z of[2.3,-1.2]){
  for(const y of[gh-.05,gh+1.15])box(7.6,.28,.34,5.65,y,z,M.iron);
  for(let x=2.2;x<=9.11;x+=.86){box(.12,1.2,.12,x,gh+.55,z,M.iron);if(x<9)beam([x,gh-.05,z],[x+.86,gh+1.15,z],.04,M.iron);}
  for(let x=2.4;x<9;x+=.43)for(const y of[gh+.12,gh+.98])mesh(new THREE.SphereGeometry(.035,6,4),M.brass,x,y,z+.18);
 }
 for(const x of[2.2,9.1])for(const y of[gh-.05,gh+1.15])box(.34,.28,3.9,x,y,.55,M.iron);
 box(.4,.25,3.6,5.65,gh+1.35,.55,M.iron); // trolley runway
 if(ant)sign('蚂蚁工厂 · 起重架',3.4,.62,5.65,gh+.55,2.3+.2);

 // ---- 2. chain hoist block on the moving hook ----------------------------------
 const hook=root.getObjectByName(kind+'-working-parts-hoist');
 if(hook){
  box(.7,.55,.5,0,-.55,0,M.iron,hook);gear(-.42,-.55,.27,.24,hook);gear(.42,-.55,.27,.24,hook);
  const link=new THREE.TorusGeometry(.065,.018,4,8);
  for(const x of[-.18,.18])for(let k=0;k<(locust?11:5);k++){const l=mesh(link,M.iron,x,-.9-k*.11,0,hook);l.rotation.y=k%2?Math.PI/2:0;}
  if(locust)mesh(new THREE.TorusGeometry(.13,.04,6,12,Math.PI*1.4),M.brass,0,-2.15,0,hook);
  if(locust){ // dark freight crate replaces the old tilted panel (see compound revision<21 guard)
   box(2.2,.9,1.2,0,-2.55,0,M.slate,hook);for(const dx of[-1,0,1])box(.08,.95,1.25,dx*.95,-2.55,0,M.iron,hook);for(const y of[-2.1,-3.0])box(2.25,.07,1.25,0,y,0,M.iron,hook);
   for(const x of[-.9,.9])beam([x,-2.1,0],[0,-1.95,0],.022,M.iron,hook);}
 }

 // ---- 3. freight gate: Chinese sign + lanterns, yard lamps along the spur ------
 for(const x of[10.4,14.7]){box(.28,.12,.28,x,3.1,5.8,M.iron);lantern(x,3.45,5.8);}
 for(const x of[10.4,14.7])beam([x,2.5,5.83],[12.5,2.78,5.86],.02,M.iron);
 for(const z of[-1,-9,-17,-25]){cyl(.07,3.4,10.25,1.7,z,M.iron);cyl(.16,.12,10.25,.06,z,M.iron);beam([10.25,3.3,z],[10.65,3.45,z],.025,M.iron);lantern(10.65,3.2,z,fixed,.8);}

 // ---- 4. storefront ----------------------------------------------------------
 if(!locust){ // wrought-iron glass canopy over the central door
  const can=box(2.3,.05,1.05,sx,3.62,front+.55,M.glass);can.rotation.x=.18;
  for(const dx of[-1.1,0,1.1]){beam([sx+dx,3.3,front+.05],[sx+dx,3.72,front+1.05],.025,M.iron);beam([sx+dx,3.72,front+1.05],[sx+dx,3.68,front+.05],.02,M.iron);}
  box(2.35,.06,.06,sx,3.52,front+1.07,M.brass);
 }else{ // lit arched window in the pediment
  box(.95,1.15,.04,sx,5.4,front+.06,M.amber);box(.05,1.2,.06,sx,5.4,front+.09,M.iron);box(1,.05,.06,sx,5.45,front+.09,M.iron);
  box(1.3,.12,.24,sx,4.82,front+.12,M.trim);
 }
}
