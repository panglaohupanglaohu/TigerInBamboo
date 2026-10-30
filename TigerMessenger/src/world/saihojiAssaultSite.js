import * as T from 'three';
// Site adapter for the existing command troop controller. No actors or aircraft
// are created here; ground support remains owned by the moving Kun/phalanx.
export function createSaihojiAssaultSite(scene,target,R=160){
 const battle=()=>scene.getObjectByName('saihoji-phalanx-battle');
 const dir=target.dir.clone().normalize(),up=new T.Vector3(0,1,0);
 const east=new T.Vector3().crossVectors(up,dir);if(east.lengthSq()<.001)east.set(1,0,0);east.normalize();
 const north=new T.Vector3().crossVectors(dir,east).normalize();
 const groundAt=p=>{const d=p.clone().normalize(),h=battle()?.userData.groundHeightAt?.(d);return Number.isFinite(h)?d.multiplyScalar(h+.05):null;};
 const ground=(x,z)=>groundAt(dir.clone().multiplyScalar(R).addScaledVector(east,x*.45).addScaledVector(north,12+(z-32)*.5));
 const actors=()=> (battle()?.userData.getDefenders?.()||[]).filter(m=>m.parent&&!m.userData.dead).map(m=>({m,id:m.userData.uid,path:[]}));
 function routeWorld(from,to){const path=[];for(let i=1;i<=12;i++){const p=groundAt(from.clone().lerp(to,i/12));if(!p)return [];if(path.length&&path.at(-1).distanceTo(p)>2)return [];path.push(p);}return path;}
 return {id:'moss',ground,groundAt,routeWorld,actors,
  ready:()=>{const s=battle()?.userData.getBattleSnapshot?.();return s?.ambush?.stage==='ambush'&&(s.battleContacts||0)>0;},
  damageTarget:(a,amount)=>battle()?.userData.receiveCommandTrooperStrike?.(a.m,amount),
  // Route rejection is a real navigation failure, not permission to teleport.
  snapshot:()=>({id:'moss',ready:!!battle()?.userData.getBattleSnapshot?.()?.battleContacts,actors:actors().length})};
}
