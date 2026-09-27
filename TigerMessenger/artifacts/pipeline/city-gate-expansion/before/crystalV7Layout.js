import * as THREE from 'three';
import {generateHighRidgeLayout,cityLocalToDir} from './crystalCityLayout.js';

// Default game uses r03; crystalV7=0 retains the previous layout for comparison.
export function crystalV7Round() {
 if(typeof location==='undefined')return 3;
 if(!new URLSearchParams(location.search).has('crystalV7'))return 3;
 return Math.max(0,Math.min(3,Number(new URLSearchParams(location.search).get('crystalV7'))||0));
}
export const V7_SWAMP_LOCAL={lx:.28,lz:.08};
export function crystalV7Layout(){
 const layout=generateHighRidgeLayout(20260803);
 // Keep the measured mother-tower berth transform exactly intact.
 const mother=layout.halls.find(h=>h.kind==='grand');
 layout.halls=[mother,
  {id:'v7-west',kind:'gold',lx:.08,lz:.25,scale:.55,seed:4107},
  {id:'v7-east',kind:'gold',lx:.47,lz:.21,scale:.55,seed:4138}];
 // Scatter remains on the outer banks, leaving the original swamp assembly intact.
 layout.crystals=layout.crystals.filter(c=>Math.hypot(c.lx-V7_SWAMP_LOCAL.lx,c.lz-V7_SWAMP_LOCAL.lz)>.28);
 return layout;
}
export function crystalV7SwampDir(){return cityLocalToDir(V7_SWAMP_LOCAL.lx,V7_SWAMP_LOCAL.lz,new THREE.Vector3());}
