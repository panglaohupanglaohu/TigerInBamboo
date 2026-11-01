import * as T from 'three';
import {createMorrisIsland} from '../../../src/world/morrisIsland.js';
const i=createMorrisIsland(),b=i.landscape.bridge,d=b.userData.morrisBridgeDetail;
const samples=d.archBottomSamples.map(([z,y])=>{const p=b.localToWorld(new T.Vector3(0,y,z));return {z:z*b.scale.z,radial:p.length()-160,aboveCenterWater:p.length()-160-3.1};});
console.log(JSON.stringify({scope:'actual bridge geometry chart, not normal-game navigation',span:8*b.scale.z,width:3.2*b.scale.x,centralOpening:samples.filter(p=>Math.abs(p.z)<1.5),bridgeGrade:i.landscape.report.bridgeMaxRadialGrade,profile:i.landscape.report.landformRevision??null},null,2));
