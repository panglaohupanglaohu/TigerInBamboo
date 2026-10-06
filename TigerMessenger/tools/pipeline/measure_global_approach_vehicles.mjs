import * as T from 'three';
import {createFreightVehicle} from '../../src/assets/freightTrain.js';
import {addFreightMotion} from '../../src/assets/freightMotion.js';
import {ROBOT_CARGO_SLOTS} from '../../src/gameplay/robotOps/logistics.js';
import {productionTransportRobots} from '../../tests/world/robotTransportEnvelope.fixture.mjs';

/** Actual factory + actual running gear. Track coordinates: +Z travel, +X
 * right, +Y corrected radial up, exactly as tramSystem.placeVehicle. */
export async function measureGlobalApproachVehicles(){
 const records=[],union=new T.Box3();
 const dispose=root=>{const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());};
 for(const wagon of[-1,0,ROBOT_CARGO_SLOTS,ROBOT_CARGO_SLOTS+1]){
  const car=createFreightVehicle({wagon}),prior=globalThis.document;let motion;
  globalThis.document??={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
  try{motion=addFreightMotion(car,{locomotive:wagon<0,heavy:wagon===0});}finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
  car.rotation.y=-Math.PI/2;car.position.y=.12;
  const box=new T.Box3(),dynamicBox=new T.Box3();let vertices=0;
  for(let phase=0;phase<32;phase++){motion.update(0,2*Math.PI*.247/32);car.updateMatrixWorld(true);car.traverse(o=>{if(!o.isMesh||o.name.includes('steam')||o.userData.transientFx)return;const p=o.geometry?.attributes.position;if(!p)return;let v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);box.expandByPoint(v);if(o.parent?.name==='freight-running-gear'||o.parent?.name==='freight-wheel-spokes')dynamicBox.expandByPoint(v);vertices++;}});}
  union.union(box);records.push({wagon,name:car.name,vertices,box:{min:box.min.toArray(),max:box.max.toArray()},dynamicBox:dynamicBox.isEmpty()?null:{min:dynamicBox.min.toArray(),max:dynamicBox.max.toArray()}});dispose(car);
 }
 for(const {robot,box}of await productionTransportRobots()){
  const mount=new T.Group();mount.rotation.y=-Math.PI/2;mount.position.y=.12;robot.position.y=.65-box.min.y;mount.add(robot);mount.updateMatrixWorld(true);const actual=new T.Box3().setFromObject(robot,true);union.union(actual);records.push({cargo:robot.userData.robotType,box:{min:actual.min.toArray(),max:actual.max.toArray()}});dispose(mount);
 }
 return{box:union,report:{method:'Actual createFreightVehicle variants, addFreightMotion 32 wheel/rod phases, all three production transport robot factories scaled1.25 and bottom-seated on .65 flatcar deck; all transformed by production rotateY(-PI/2), positionY+.12. Steam particles excluded from solid geometry.',bodyLift:.12,trackAxes:'x right / y up / z travel',records,box:{min:union.min.toArray(),max:union.max.toArray()},factoryDerivedWheelBottom:{locomotive:(.07-.19)*1.3+.12,heavyFlatcar:.11-.24+.12},factoryDerivedNonWheelBogieBottom:{locomotive:(.22-.16/2)*1.3+.12,heavyFlatcar:.24-.20/2+.12},wheelExceptions:[]}};
}
