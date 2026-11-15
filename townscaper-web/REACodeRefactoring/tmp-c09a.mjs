import {Atlas} from './src/core/atlas.js';
import {runPackSequence,treeLayers} from './src/core/atlas-c09.js';
const a=new Atlas(512,512);const {log}=runPackSequence(a,{steps:300,seed:7,removeAfter:120,removeEvery:2});
const adds=log.filter(l=>l.op==='add'&&l.ok);
const early=adds.slice(0,15),late=adds.slice(-30);
const avg=a=>a.reduce((s,l)=>s+l.fingers,0)/a.length;
console.log(adds.length,avg(early),avg(late),early.map(l=>l.freeLeaves).join(','),late.map(l=>l.freeLeaves).slice(-5), a.report(), treeLayers(a).maxDepth, adds.slice(0,10).map(l=>l.tried));
