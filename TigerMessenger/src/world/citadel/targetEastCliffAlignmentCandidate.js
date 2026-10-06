import * as T from 'three';
import {createSphericalShoreArcCandidate,applySphericalShoreGradeProfile} from './targetSphericalShoreArcCandidate.js';
import {createTargetCliffOffsetCurve} from './targetCliffShoreRoute.js';
/** Default-off exact curve replay. Does not mutate source curves, install rails,
 * change stations, or mark geometric/visual acceptance. Requires saved CPU input. */
export function createEastCliffAlignmentCandidate({enabled=false,input,sourceCurves,retainedRelease,castleMatrix}={}){
 if(!enabled)return{curves:null,report:{enabled:false,accepted:false,installed:false}};
 if(!input||!castleMatrix?.isMatrix4||!sourceCurves?.blue||!retainedRelease?.curves?.blue)throw new TypeError('saved candidate input and actual source/release curves required');
 const inv=castleMatrix.clone().invert(),base=createSphericalShoreArcCandidate({enabled:true,points:input.redWorldPoints,startTangent:input.redStartTangent,endTangent:input.redEndTangent,turnRadius:input.turnRadius,minRadius:27.05,maxGrade:.04});
 if(!base.curve||base.report.issues.length)return{curves:null,report:{accepted:false,installed:false,issues:base.report.issues}};
 const s=sourceCurves.blue,old=retainedRelease.curves.blue,u=input.blueSourceU,v=input.retainedReleaseEndFraction;
 const blue=applySphericalShoreGradeProfile(createTargetCliffOffsetCurve({base:base.curve,offset:input.offset,startWorld:s.getPointAt(u).toArray(),endWorld:old.getPointAt(v).toArray(),startTangent:s.getTangentAt(u).toArray(),endTangent:old.getTangentAt(v).toArray(),blendLength:30}).curve,{startTangent:s.getTangentAt(u).toArray(),endTangent:old.getTangentAt(v).toArray()});
 function shift(base){let at=0,dist=Infinity;for(let j=0;j<=1200;j++){const q=base.getPointAt(j/1200).applyMatrix4(inv),d=Math.hypot(q.x-86,q.z-82);if(d<dist){dist=d;at=j/1200;}}const length=base.getLength();class Shifted extends T.Curve{getPoint(u,target=new T.Vector3()){const p=base.getPointAt(u),t=base.getTangentAt(u),right=p.clone().normalize().cross(t).normalize(),q=p.clone().applyMatrix4(inv),lr=right.clone().transformDirection(inv),sign=Math.sign(lr.x*(62-q.x)+lr.z*(76-q.z))||1,s=(u-at)*length/input.shiftHalfLength,b=Math.abs(s)<1?Math.pow(1-s*s,3):0;return target.copy(p).addScaledVector(right,-sign*input.shiftAmplitude*b);}}const curve=new Shifted();curve.arcLengthDivisions=2400;curve.updateArcLengths();return curve;}
 return{curves:{red:shift(base.curve),blue:shift(blue)},report:{enabled:true,accepted:false,installed:false,sourceStartU:input.sourceStartU,blueSourceU:u,retainedReleaseEndFraction:v,amplitude:input.shiftAmplitude,halfLength:input.shiftHalfLength,centerlineProvided:false,structureVerified:false,actorsVerified:false,sourceIntervalImpact:'extends red replacement head to .59 (~157m extra); curves end on retained release, not directly on production source'}};
}
