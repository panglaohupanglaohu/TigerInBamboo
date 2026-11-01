// The first real flagship strike starts the original physical landing. Keep a
// stable blockade and conserve ammunition until that landing has formed cover.
// No position, hit, health or defender phase is changed by this policy.
export function saihojiLandingHold(state,escortShots,defenders,operation=null){
 if(state?.target?.id!=='moss'||!['blockade','pincer','cannon','guard'].includes(state.phase)||!(state.shots>escortShots))return false;
 if(state.age>=60)return false; // A broken landing must not trap the fleet forever.
 return !defenders||defenders.ambush?.stage==='landing'||!!(operation?.active&&['suppression','insertion'].includes(operation.stage)&&operation.ready>0&&operation.deployed===0);
}

// A prepared but unfired straight bombing leg must not carry the flagship out
// of its blockade while it waits for the real ground deployment.
export function suspendSaihojiBombApproach(holding,run,pending){return !!(holding&&run&&run.releasedAt===null&&!pending);}
