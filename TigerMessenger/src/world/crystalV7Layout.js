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
  {id:'v7-east',kind:'gold',lx:.47,lz:.21,scale:.55,seed:4138},
  {id:'v10-northwest',kind:'gold',lx:-.05,lz:-.06,scale:.46,seed:4157},
  {id:'v10-northeast',kind:'gold',lx:.53,lz:-.55,scale:.64,seed:4171},
  {id:'v10-distant',kind:'gold',lx:.34,lz:-.38,scale:.38,seed:4193},
  {id:'v10-west-islet',kind:'gold',lx:-.20,lz:.12,scale:.43,seed:4201},
  {id:'v10-backwest',kind:'gold',lx:.06,lz:-.30,scale:.48,seed:4217},
  {id:'v10-backeast',kind:'gold',lx:.62,lz:-.28,scale:.42,seed:4231},
  {id:'v10-east-islet',kind:'gold',lx:.69,lz:.23,scale:.50,seed:4243},
  {id:'v10-foreground',kind:'gold',lx:.30,lz:.40,scale:.36,seed:4259},
  {id:'v10-west-foreground',kind:'gold',lx:-.36,lz:.14,scale:.40,seed:4271}];
 // Blue tram travels opposite curve parameter: three satellites now occupy its left bank.
 // Scatter remains on the outer banks, leaving the original swamp assembly intact.
 layout.crystals=layout.crystals.filter(c=>Math.hypot(c.lx-V7_SWAMP_LOCAL.lx,c.lz-V7_SWAMP_LOCAL.lz)>.28);
 return layout;
}
export function crystalV7SwampDir(){return cityLocalToDir(V7_SWAMP_LOCAL.lx,V7_SWAMP_LOCAL.lz,new THREE.Vector3());}
