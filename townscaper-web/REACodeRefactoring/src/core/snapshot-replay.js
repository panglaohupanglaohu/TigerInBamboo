/** Replay read-only history snapshots; live world always returns to its entry state. */
export async function replaySnapshots(world, frames, { apply=()=>{}, wait=()=>Promise.resolve(), signal }={}) {
  const final=world.snapshot();let shown=0;
  try {
    for(const frame of frames){if(signal?.aborted)break;world.restore(frame);apply();shown++;await wait(signal);}
    return {shown,cancelled:!!signal?.aborted};
  } finally { world.restore(final);apply(); }
}
export function replayDelay(ms,signal){
  if(!Number.isFinite(ms)||ms<0)throw new RangeError('Replay delay');
  return new Promise(resolve=>{
    if(signal?.aborted){resolve();return;}
    const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);resolve();};
    const timer=setTimeout(finish,ms);signal?.addEventListener('abort',finish,{once:true});
  });
}
