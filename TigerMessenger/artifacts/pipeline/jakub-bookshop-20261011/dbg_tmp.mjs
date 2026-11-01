import * as T from 'three';
globalThis.location={search:''};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
const {installBookshopJakubPass}=await import(process.cwd()+'/src/world/bookshopJakubPass.js');
const {bookshopTownPose,townSurfacePoint}=await import(process.cwd()+'/src/world/bookshopTownSite.js');
const R=160,scene=new T.Scene(),root=new T.Group();
const pose=bookshopTownPose(R);root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);scene.add(root);
const rail=new T.Mesh(new T.BoxGeometry(160,.4,1.4,80,1,1),new T.MeshBasicMaterial());rail.position.copy(townSurfacePoint(root,0,-80,R,1.1));root.add(rail);
scene.updateMatrixWorld(true);
console.log('railpos',rail.position.toArray());
const api=installBookshopJakubPass({scene,root,R});const o=api.occupancy;
let s='';for(let x=-80;x<80;x+=4){const k=(-80-o.MINZ)*o.N+(x-o.MINX);s+=o.obj[k]?'#':o.path[k]?'.':'_';}console.log(s);
for(let z=-84;z<-74;z++){let s='';for(let x=-80;x<80;x+=2){const k=(z-o.MINZ)*o.N+(x-o.MINX);s+=o.obj[k]?'#':o.path[k]?'.':'_';}console.log(z,s);}
