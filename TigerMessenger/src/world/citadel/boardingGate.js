/** Boarding occupancy owns the movement interlock; actor identity stays with caller. */
export function createBoardingGate(setProgress,{duration=1.5}={}) {
  if(!Number.isFinite(duration)||duration<=0)throw Error('Positive deployment duration required');
  let progress=0,phase='stowed';const occupants=new Set();
  setProgress(0);
  return {
    snapshot:()=>({phase,progress,occupants:[...occupants],canSail:phase==='stowed'&&occupants.size===0}),
    deploy({stopped=false}={}) {
      if(!stopped||occupants.size||phase==='retracting')return false;
      if(phase==='stowed')phase='deploying';
      return true;
    },
    retract() {
      if(occupants.size||phase==='deploying')return false;
      if(phase==='deployed')phase='retracting';
      return true;
    },
    enter(id) {
      if(typeof id!=='string'||!id||phase!=='deployed'||occupants.has(id))return false;
      occupants.add(id);return true;
    },
    leave(id) {return occupants.delete(id);},
    tick(dt) {
      if(!Number.isFinite(dt)||dt<0)throw Error('Finite nonnegative timestep required');
      if(phase==='deploying') {progress=Math.min(1,progress+dt/duration);if(progress===1)phase='deployed';}
      else if(phase==='retracting') {progress=Math.max(0,progress-dt/duration);if(progress===0)phase='stowed';}
      setProgress(progress);
    }
  };
}
