// The first real flagship strike starts the original physical landing. Keep a
// stable blockade and conserve ammunition until that landing has formed cover.
// No position, hit, health or defender phase is changed by this policy.
export function saihojiLandingHold(state,escortShots,defenders,operation=null){
 if(state?.target?.id!=='moss'||!['blockade','guard'].includes(state.phase)||!(state.shots>escortShots))return false;
 if(state.age>=60)return false; // A broken landing must not trap the fleet forever.
 return !defenders||defenders.ambush?.stage==='landing'||!!(operation?.active&&operation.stage==='insertion'&&operation.ready>0&&operation.deployed===0);
}
