// Actual traditional projectiles share Batian's shield/damage event bus.
// This adapter never starts an assault, invents a hit, or edits a projectile.
export const SAIHOJI_FLEET_PROJECTILE_POWER=Object.freeze({arrow:3,javelin:8});
function commandedTarget(fleet,target){
 return fleet?.active===true&&fleet.snapshot?.().target==='moss'&&fleet.units?.().includes(target);
}
export function interceptSaihojiFleetProjectile(fleet,target,from,to,kind){
 if(!commandedTarget(fleet,target))return null;
 const power=SAIHOJI_FLEET_PROJECTILE_POWER[kind];if(!power)return null;
 const point=fleet.shieldPoint?.(target,from,to);if(!point)return null;
 const result=fleet.receiveHit?.(target,power,point);
 return result?.accepted&&result.intercepted?{...result,point,kind,power,cycle:fleet.snapshot().cycle}:null;
}
export function applySaihojiFleetHullContact(fleet,target,point,kind){
 if(!commandedTarget(fleet,target))return null;
 const power=SAIHOJI_FLEET_PROJECTILE_POWER[kind];if(!power)return null;
 const result=fleet.receiveHit?.(target,power,point);
 return result?.accepted?{...result,point,kind,power,cycle:fleet.snapshot().cycle}:null;
}
export function recordSaihojiFleetContact(root,contact){
 if(!contact?.accepted)return;
 root.userData.batianBattleContactTotal=(root.userData.batianBattleContactTotal||0)+1;
 let stats=root.userData.commandFleetContacts;
 if(!stats||stats.cycle!==contact.cycle)stats=root.userData.commandFleetContacts={cycle:contact.cycle,contacts:0,shield:0,hull:0,arrows:0,javelins:0};
 stats.contacts++;stats[contact.intercepted?'shield':'hull']++;
 stats[contact.kind==='arrow'?'arrows':'javelins']++;
}
