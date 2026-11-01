import * as THREE from 'three';
import {factoryKit} from '../assets/factoryArchitecture.js';
import {townSurfacePoint} from './bookshopTownSite.js';
import {mergeStaticGroup} from './geometryMerge.js';

// Geometric connections only. Dispatch, switches and production orders belong
// to the later factory gameplay, not this architectural construction pass.
export function buildBookshopFreightSpurs({root,districts,R}){
 const g=new THREE.Group();g.name='bookshop-factory-freight-spurs';root.add(g);
 const {M,mesh,beam}=factoryKit(g),audit=[];
 const flat=world=>{const p=root.worldToLocal(world),s=(R+.9)/(p.y+R+.9);return new THREE.Vector3(p.x*s,0,p.z*s);};
 for(const d of districts){
  const start=flat(d.localToWorld(townSurfacePoint(d,15,7.5,R))),ahead=flat(d.localToWorld(townSurfacePoint(d,15,13.5,R)));
  const a=Math.atan2(start.x,start.z-32)+.28,end=new THREE.Vector3(Math.sin(a)*33.7,0,32+Math.cos(a)*33.7),tangent=new THREE.Vector3(Math.cos(a),0,-Math.sin(a));
  const curve=new THREE.CubicBezierCurve3(start,ahead,end.clone().addScaledVector(tangent,-6),end);
  const tracks=[[],[]],steps=72;
  for(let i=0;i<=steps;i++){
   const u=i/steps,p=curve.getPoint(u),t=curve.getTangent(u).normalize(),n=new THREE.Vector3(t.z,0,-t.x),lift=1.1125*(1-u)+1.06*u;
   for(const [j,side]of[-1,1].entries()){const v=p.clone().addScaledVector(n,side*.70);tracks[j].push(townSurfacePoint(g,v.x,v.z,R,lift));}
   if(i%4===0){const l=p.clone().addScaledVector(n,-.90),r=p.clone().addScaledVector(n,.90);beam(townSurfacePoint(g,l.x,l.z,R,lift-.04).toArray(),townSurfacePoint(g,r.x,r.z,R,lift-.04).toArray(),.065,M.wood);}
  }
  for(const points of tracks)mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),steps,.045,6,false),M.iron);
  audit.push({factory:d.name,start:start.toArray(),end:end.toArray(),gauge:1.4,length:curve.getLength(),role:'architectural spur; train dispatch not implemented'});
 }
 mergeStaticGroup(g);root.userData.freightSpurs=audit;return g;
}
