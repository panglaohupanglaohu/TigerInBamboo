// Shared near-cloud drift; match GLSL mod also for negative time/yaw.
export function cloudDrift(time,yaw){return ((time*.12+yaw*7)%40+40)%40-20;}
export const CLOUD_DRIFT_GLSL=`float cloudDrift(float time,float yaw){return mod(time*.12+yaw*7.,40.)-20.;}`;
