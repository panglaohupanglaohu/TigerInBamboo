import {MathUtils} from 'three';

const finitePoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
function inside(x,z,polygon) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}

/** A sea-side cliff retreat, not a track-centred trench. Each explicit polygon
 * covers only the approved exterior toe. edge is oriented with seaSide +/-1
 * on its left/right; terrain from the edge all the way to the sea stays low.
 * City construction cores are protected and conflicts are reported, never
 * silently treated as successful route excavation. No default cuts guessed. */
export function createTargetCoastalCliffCutField({cuts=[],protectedPolygons=[],platforms=[],underwaterDepth=3}={}) {
  if(!Number.isFinite(underwaterDepth)||underwaterDepth<0)throw new RangeError('finite nonnegative underwater depth required');
  for(const polygon of protectedPolygons)if(!Array.isArray(polygon)||polygon.length<3||!polygon.every(finitePoint))throw new TypeError('finite protected polygon required');
  for(const p of platforms)if(!finitePoint(p.center)||!finitePoint(p.radii)||p.radii.some(v=>v<=0))throw new TypeError('finite positive platform ellipse required');
  const fields=cuts.map((cut,i)=>{
    const {edge,polygon,seaSide=1,transitionWidth=2}=cut;
    if(!Array.isArray(edge)||edge.length<2||!edge.every(finitePoint)||!Array.isArray(polygon)||polygon.length<3||!polygon.every(finitePoint))throw new TypeError('explicit finite edge and sea-side polygon required');
    if(![-1,1].includes(seaSide)||!Number.isFinite(transitionWidth)||transitionWidth<=0)throw new RangeError('invalid cliff side or transition width');
    const segments=edge.slice(1).map((b,k)=>{
      const a=edge[k],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<1e-6)throw new RangeError('duplicate cliff-edge control');
      return {a,dx,dz,length};
    });
    return {id:cut.id??String(i),polygon,seaSide,transitionWidth,segments};
  });
  const report={version:'target-coastal-cliff-cut-1',cutIds:fields.map(f=>f.id),changedQueries:0,protectedConflicts:0,maxDrop:0,
    status:'authored-field-not-mesh-validated',examples:[],railClearanceVerified:false};
  function height(x,z,original,sea) {
    if(![x,z,original,sea].every(Number.isFinite))throw new TypeError('finite terrain and sea heights required');
    let weight=0;
    for(const f of fields) {
      if(!inside(x,z,f.polygon))continue;
      let nearest=null,distance=Infinity;
      for(const s of f.segments) {
        const t=MathUtils.clamp(((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/(s.length*s.length),0,1);
        const dx=x-s.a[0]-t*s.dx,dz=z-s.a[1]-t*s.dz,d=dx*dx+dz*dz;
        if(d<distance){distance=d;nearest={signed:f.seaSide*(s.dx*dz-s.dz*dx)/s.length};}
      }
      weight=Math.max(weight,MathUtils.smoothstep(nearest.signed,-f.transitionWidth,0));
    }
    if(weight===0||original<=sea-underwaterDepth)return original;
    if(protectedPolygons.some(p=>inside(x,z,p))||platforms.some(p=>Math.hypot((x-p.center[0])/p.radii[0],(z-p.center[1])/p.radii[1])<=.78)) {
      report.protectedConflicts++;
      if(report.examples.length<12)report.examples.push({x,z,original,sea});
      return original;
    }
    const next=MathUtils.lerp(original,sea-underwaterDepth,weight);
    if(next<original){report.changedQueries++;report.maxDrop=Math.max(report.maxDrop,original-next);}
    return next;
  }
  return {height,report};
}
