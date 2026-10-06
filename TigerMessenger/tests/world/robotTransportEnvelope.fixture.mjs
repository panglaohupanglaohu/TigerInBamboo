import * as T from 'three';
import {animateArticulatedRobot} from '../../src/assets/robotArticulation.js';

// Texture painting is irrelevant to this geometry-only factory check.
export async function productionTransportRobots(){
 const prior=globalThis.document;
 const gradient=()=>({addColorStop(){}});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){},fillRect(){},createLinearGradient:gradient,createRadialGradient:gradient})})};
 try{const {BOOKSHOP_ROBOT_FACTORIES}=await import('../../src/assets/bookshopRobots.js');return BOOKSHOP_ROBOT_FACTORIES.map(factory=>{const robot=factory({rigged:true});robot.scale.setScalar(1.25);animateArticulatedRobot(robot,{state:'transport'});robot.updateMatrixWorld(true);return{robot,box:new T.Box3().setFromObject(robot,true)};});}
 finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
}
