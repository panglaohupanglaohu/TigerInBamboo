// One shared gate for whale reveal and the defending formation. Patrol scans,
// story signals, escort-only visits and attacks elsewhere cannot open this battle.
export function saihojiBattleTrigger(fleet,hub,radius=160){
 const s=fleet?.snapshot?.();
 const blocked=reason=>({allowed:false,reason,cycle:s?.cycle??0,distance:null});
 if(!fleet?.active||!s)return blocked('flagship-idle');
 if(s.target!=='moss')return blocked('other-target');
 if(!['blockade','pincer','cannon','guard'].includes(s.phase))return blocked('not-attacking');
 const p=s.flagshipPosition;
 if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||!hub)return blocked('missing-flagship-position');
 const len=Math.hypot(...p),hl=Math.hypot(hub.x,hub.y,hub.z);
 if(len<1||hl<.1||s.arrival?.visible===false)return blocked('flagship-absent');
 const distance=Math.acos(Math.max(-1,Math.min(1,(p[0]*hub.x+p[1]*hub.y+p[2]*hub.z)/(len*hl))))*radius;
 if(distance>145)return {...blocked('flagship-out-of-range'),distance};
 const flagshipHasFired=Number.isFinite(s.shots)&&Number.isFinite(s.unitShots)&&s.shots>s.unitShots||s.fireLog?.some(f=>f.role==='flagship');
 if(!flagshipHasFired)return {...blocked('awaiting-flagship-first-strike'),distance};
 return {allowed:true,reason:'batian-attacking-saihoji',cycle:s.cycle,distance};
}
