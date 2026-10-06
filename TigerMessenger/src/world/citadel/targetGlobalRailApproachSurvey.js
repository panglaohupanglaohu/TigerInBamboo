import * as T from 'three';

export const GLOBAL_APPROACH_SURVEY_VERSION = 'global-approach-water-preflight-1';

/** Read-only, world-radial preflight. Callbacks return the radius hit by an
 * outward-direction ray, not castle-local Y. Wave ceiling must be supplied by
 * the caller from the actual displaced ocean mesh. No meshes are built here. */
export function surveyTargetGlobalRailApproach(options = {}) {
  if (!options.enabled) return {version: GLOBAL_APPROACH_SURVEY_VERSION, enabled:false, accepted:false, built:false};
  const {curves,sampleSurface,sampleStep=.5,deckTop=-.75,deckBottom=-1.30,deckWidth=11.6,oceanWaveAmplitude=.067}=options;
  if (!['center','red','blue'].every(k => curves?.[k]?.getPointAt && curves[k].getTangentAt && curves[k].getLength)
      || typeof sampleSurface !== 'function') throw new Error('GLOBAL_APPROACH_SURVEY_INPUT');
  if (![sampleStep,deckTop,deckBottom,deckWidth,oceanWaveAmplitude].every(Number.isFinite)
      || sampleStep <= 0 || sampleStep > .5 || deckWidth <= 0 || deckBottom >= deckTop || oceanWaveAmplitude < 0)
    throw new Error('GLOBAL_APPROACH_SURVEY_DIMENSIONS');
  const rows = [], failures = [], checks = {deckTop:[],deckBottom:[],sleeperBottom:[],railLowerEnvelope:[],railTop:[],trackCenter:[]};
  const frame = (curve,u) => {
    const p=curve.getPointAt(u),t=curve.getTangentAt(u).normalize(),r=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(r).normalize();
    if (![...p.toArray(),...t.toArray(),...r.toArray()].every(Number.isFinite) || r.lengthSq()<.9) throw new Error('GLOBAL_APPROACH_FRAME');
    return {p,t,r,up};
  };
  function measure(point,kind,lane,distance,u,offset) {
    const s=sampleSurface(point.clone()),radius=point.length();
    const finite = k => Number.isFinite(s?.[k]);
    const known = finite('terrainRadius') && finite('seaRadius') && finite('seaUpperRadius');
    const classification = !known ? 'unknown' : s.terrainRadius >= s.seaUpperRadius ? 'land' : 'ocean';
    const row={kind,lane,distance,u,offset,world:point.toArray(),radius,classification,
      terrainRadius:finite('terrainRadius')?s.terrainRadius:null,terrainObject:s?.terrainObject??null,
      seaRadius:finite('seaRadius')?s.seaRadius:null,seaUpperRadius:finite('seaUpperRadius')?s.seaUpperRadius:null,
      seaOfficialUpperRadius:finite('seaOfficialUpperRadius')?s.seaOfficialUpperRadius:null,
      seaGap:finite('seaRadius')?radius-s.seaRadius:null,
      waveGap:finite('seaUpperRadius')?radius-s.seaUpperRadius:null,
      officialWaveGap:finite('seaOfficialUpperRadius')?radius-s.seaOfficialUpperRadius:null,
      terrainGap:finite('terrainRadius')?radius-s.terrainRadius:null};
    rows.push(row);checks[kind].push(row);
    return row;
  }
  for (const lane of ['center','red','blue']) {
    const curve=curves[lane],length=curve.getLength(),n=Math.ceil(length/sampleStep);
    if (!Number.isFinite(length)||length<=0) throw new Error('GLOBAL_APPROACH_LENGTH');
    for(let i=0;i<=n;i++) {
      const u=i/n,distance=u*length,{p,t,r,up}=frame(curve,u);
      measure(p,'trackCenter',lane,distance,u,0);
      if(lane==='center') {
        for(const offset of [-deckWidth/2,-deckWidth/4,0,deckWidth/4,deckWidth/2]) {
          measure(p.clone().addScaledVector(r,offset).addScaledVector(up,deckTop),'deckTop',lane,distance,u,offset);
          measure(p.clone().addScaledVector(r,offset).addScaledVector(up,deckBottom),'deckBottom',lane,distance,u,offset);
        }
      } else {
        // Production sleepers: 2.18 x .06 x .24, center at rail curve.
        for(const offset of [-1.09,0,1.09]) for(const along of [-.12,.12])
          measure(p.clone().addScaledVector(r,offset).addScaledVector(t,along).addScaledVector(up,-.03),'sleeperBottom',lane,distance,u,offset);
        // Production rail control sections normalize to radius + .06. Tube
        // radius .035 gives a conservative local radial lower/upper envelope;
        // global Catmull fitting between these sections is not audited here.
        for(const offset of [-.875,.875]) {
          const center=p.clone().addScaledVector(r,offset).normalize().multiplyScalar(p.length()+.06),radial=center.clone().normalize();
          measure(center.clone().addScaledVector(radial,-.035),'railLowerEnvelope',lane,distance,u,offset);
          measure(center.clone().addScaledVector(radial,.035),'railTop',lane,distance,u,offset);
        }
      }
    }
  }
  const summary={};
  for(const [kind,items] of Object.entries(checks)) {
    const ocean=items.filter(r=>r.classification==='ocean'),land=items.filter(r=>r.classification==='land');
    const min=(key,list)=>list.length?Math.min(...list.map(r=>r[key])):null;
    summary[kind]={samples:items.length,ocean: ocean.length,land:land.length,unknown:items.filter(r=>r.classification==='unknown').length,
      minOceanSeaGap:min('seaGap',ocean),minOceanWaveGap:min('waveGap',ocean),minOfficialWaveGap:min('officialWaveGap',items.filter(r=>r.officialWaveGap!==null)),
      minLandTerrainGap:min('terrainGap',land),submergedAtRest:ocean.filter(r=>r.seaGap<0).length,waveEnvelopeIntersections:ocean.filter(r=>r.waveGap<0).length};
  }
  const wet=checks.deckTop.filter(r=>r.classification==='ocean'&&r.waveGap<0);
  if(wet.length) failures.push({code:'GLOBAL_APPROACH_DECK_WET',count:wet.length,requiredRadialLiftAtWorst:Math.max(...wet.map(r=>-r.waveGap)),worst:wet.reduce((a,b)=>a.waveGap<b.waveGap?a:b)});
  const unknown=rows.filter(r=>r.classification==='unknown');
  if(unknown.length) failures.push({code:'GLOBAL_APPROACH_SURFACE_UNKNOWN',count:unknown.length});
  const buried=checks.deckTop.filter(r=>r.classification==='land'&&r.terrainGap<0);
  if(buried.length) failures.push({code:'GLOBAL_APPROACH_DECK_INSIDE_LAND',count:buried.length,worst:buried.reduce((a,b)=>a.terrainGap<b.terrainGap?a:b)});
  return {version:GLOBAL_APPROACH_SURVEY_VERSION,enabled:true,built:false,accepted:false,
    waterPreflightPass:failures.length===0,dimensions:{sampleStep,deckTop,deckBottom,deckWidth,oceanWaveAmplitude},
    lengths:Object.fromEntries(['center','red','blue'].map(k=>[k,curves[k].getLength()])),summary,failures,rows,
    limitations:['Finite section sampling, not a continuous watertightness proof.','No supports generated or installed.','Rail envelopes use actual production section dimensions; fitted global rail tube triangles are not included.','No actor, road, pillar, loaded body, station or GPU acceptance.']};
}
