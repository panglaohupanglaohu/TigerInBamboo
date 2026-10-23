// A short-lived mix focus, independent of BGM ownership and playback position.
export function createBombMixFocus(clock=()=>performance.now()/1000){
  const pulses=new Map();let level=0,last=clock();
  function read(){const now=clock(),dt=Math.max(0,now-last);last=now;let wanted=0;for(const [key,p]of pulses){if(p.until<=now)pulses.delete(key);else wanted=Math.max(wanted,p.strength);}const tau=wanted>level ? .045 : .7;level+=(wanted-level)*(1-Math.exp(-dt/tau));if(level<.0001)level=0;return {active:level>.01,music:1-.7*level,otherWeapons:1-.45*level,vehicles:1-.4*level,level};}
  return {pulse(kind,seconds=.2,audibility=1){read();const strength=({latch:.4,fall:.7,blast:1}[kind]??0)*Math.max(0,Math.min(1,audibility)),old=pulses.get(kind);if(strength>0)pulses.set(kind,{until:Math.max(old?.until||0,clock()+seconds),strength:Math.max(old?.strength||0,strength)});},read,reset(){pulses.clear();level=0;last=clock();}};
}
export const bombMixFocus=createBombMixFocus();
