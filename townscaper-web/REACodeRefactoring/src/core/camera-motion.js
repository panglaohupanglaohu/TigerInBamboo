/** Wrapped orbit delta, avoiding a false full revolution at the ±pi seam.
 * Invalid/zero render dt cannot establish velocity and yields no smear.
 */
export function cameraAngularSpeed(yaw,pitch,lastYaw,lastPitch,dt){if(![yaw,pitch,lastYaw,lastPitch,dt].every(Number.isFinite)||dt<=0)return 0;const dy=Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw));return (Math.abs(dy)+Math.abs(pitch-lastPitch))/dt;}
/** Convert the legacy 60 Hz retention to elapsed-time retention. */
export function smearHistoryWeight(speed,dt){if(!Number.isFinite(speed)||!Number.isFinite(dt)||dt<=0)return 0;const reference=Math.min(.72,Math.max(0,(speed-.4)*.35));return reference===0?0:Math.min(.98,Math.pow(reference,dt*60));}
