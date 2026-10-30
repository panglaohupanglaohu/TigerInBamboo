// Original synthesis: a short irregular robin phrase and descending cuckoo pairs.
// This is not a field recording or a species-authentication claim.
export function synthMorrisBird(ctx,input,t0,kind){
 const phrase=kind==='cuckoo'?[[0,660,650,.19],[.31,550,535,.24],[.9,660,650,.19],[1.21,550,535,.24]]:[[0,2650,3370,.13],[.19,3480,2910,.1],[.35,2400,3180,.19],[.65,3760,2990,.12],[.85,3020,4050,.09],[1.03,3820,2800,.22]];
 for(const[start,from,to,duration]of phrase){const o=ctx.createOscillator(),g=ctx.createGain(),t=t0+start;o.type='sine';o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(kind==='cuckoo'?.25:.16,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(input);o.start(t);o.stop(t+duration+.03);o.onended=()=>{o.disconnect();g.disconnect();};}
}
