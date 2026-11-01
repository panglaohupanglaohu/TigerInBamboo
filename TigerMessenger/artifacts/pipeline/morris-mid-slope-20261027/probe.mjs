import * as T from'three';import{createMorrisTerrain}from'../../../src/world/morrisLandscape.js';
const t=createMorrisTerrain(160,a=>22*Math.sqrt(7)*(1+.055*Math.sin(a*3+.7)+.028*Math.cos(a*7)));
console.log(JSON.stringify({route:t.route.report,points:t.route.points.filter((p,j)=>j%35===0).map(p=>[p.x,p.z,p.h,p.s]),treeSites:[[-2,33],[-3,28],[-2,24],[0,23],[5,23],[14,39],[20,40],[-2,40]].map(([x,z])=>({x,z,d:t.route.nearest(x,z).distance,stream:Math.min(...t.stream.map(p=>Math.hypot(x-p.x,z-p.z))),sight:t.bridgeSightline(x,z),height:t.height(x,z)}))},null,2));
