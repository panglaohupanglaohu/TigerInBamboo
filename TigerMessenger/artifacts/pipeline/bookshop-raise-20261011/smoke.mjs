globalThis.location={search:'?bookshopRaise=1'};
const T=await import('three');
const S=await import(process.cwd()+'/src/world/bookshopTownSite.js');
const R=160,pose=S.bookshopTownPose(R),root=new T.Group();root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);root.updateWorldMatrix(true,false);
for(const [x,z] of [[0,32],[0,-100],[-60,50],[-70,60],[-80,70]]){const p=root.localToWorld(S.townSurfacePoint(root,x,z,R,.9));console.log(x,z,'r=',S.bookshopSiteRadius(x,z).toFixed(1),'h=',(p.length()-R-.9).toFixed(2),'rail',S.bookshopRailRaiseFlat(x,z).toFixed(2));}
const L=await import(process.cwd()+'/src/world/bookshopLoadingYards.js');
const e=L.factoryFreightEntry(R);console.log('entry heights',e.filter((_,i)=>i%6==0).map(p=>(p.length()-R).toFixed(2)).join(' '));
