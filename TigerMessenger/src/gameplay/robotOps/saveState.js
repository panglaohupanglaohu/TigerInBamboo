import {RobotLogistics} from './logistics.js';
import {RobotCombat} from './combat.js';
// Validate the complete save before any live inventory, camera or train changes.
export function validateRobotOperationsSave(data){
 if(data?.version!==1)throw Error('存档版本不兼容');
 const logistics=new RobotLogistics(data.logistics),combat=new RobotCombat();combat.restore(data.combat);
 if(!Number.isFinite(data.shipment)||data.shipment<0||data.shipment>28)throw Error('零件卸货进度无效');
 if(!Number.isSafeInteger(data.exerciseNumber)||data.exerciseNumber<0)throw Error('演练编号无效');
 if(!Array.isArray(data.trains)||data.trains.length!==2||new Set(data.trains.map(t=>t.variant)).size!==2)throw Error('列车记录不完整');
 for(const t of data.trains){
  if(t.shuntingBack!==undefined&&typeof t.shuntingBack!=='boolean')throw Error('调车状态无效');
  if(!['red','blue'].includes(t.variant)||!Number.isFinite(t.progress)||t.progress<0||t.progress>=1||!Number.isFinite(t.dwell)||t.dwell<0||t.dwell>60||!(t.lastStop==null||['locust','ant','beetle','frontline'].includes(t.lastStop)))throw Error('列车位置或停站记录无效');
 }
 for(const u of combat.units){
  if(u.team==='enemy'){
   if(logistics.get(u.id))throw Error('敌方编号与工厂整机重复');
   continue;
  }
  const source=logistics.get(u.id);
  if(!source||source.kind!==u.kind||!['deployed','repair','lost'].includes(source.status))throw Error('军团与工厂整机记录不一致');
  if((source.status==='lost')!==(u.hp===0)||Math.abs(source.health-u.hp/u.maxHp)>1e-6)throw Error('军团与工厂整机损伤记录不一致');
 }
 for(const u of logistics.units)if(['deployed','repair','lost'].includes(u.status)&&!combat.get(u.id))throw Error('已部署整机缺少军团记录');
 return {logistics:logistics.snapshot(),combat:combat.snapshot(),shipment:data.shipment,exerciseNumber:data.exerciseNumber,trains:data.trains.map(t=>({...t}))};
}
