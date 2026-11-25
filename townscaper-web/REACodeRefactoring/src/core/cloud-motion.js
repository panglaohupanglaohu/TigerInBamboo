// Shared near-cloud drift; match GLSL mod also for negative time/yaw.
export function cloudDrift(time,yaw){return ((time*.12+yaw*7)%40+40)%40-20;}
export const CLOUD_DRIFT_GLSL=`float cloudDrift(float time,float yaw){return mod(time*.12+yaw*7.,40.)-20.;}`;

// 1852334860137849222「完整风材质」残差：REACode engine/impostor.js 顶点着色器的云起伏
//（uniform uWindAmt：树 0 / 云 0.6）。相位取实例位置 ph = x*0.13 + z*0.17，三轴异频
//（0.11 / 0.15 / 0.09），幅度 y×0.25、z×0.6 —— 整圈云不会一块板一起滑。
// 与 engine 同式的函数化移植；CPU 镜像给云影（light/cloud-shadow.js）与测试用。
export const CLOUD_WIND_AMT=.6;
export function cloudWindBob(time,x,z,amt=CLOUD_WIND_AMT){const ph=x*.13+z*.17;return[Math.sin(time*.11+ph)*amt,Math.sin(time*.15+ph*.7)*amt*.25,Math.cos(time*.09+ph*1.3)*amt*.6];}
export const CLOUD_WIND_BOB_GLSL=`vec3 cloudWindBob(float t,vec3 c,float amt){float ph=c.x*.13+c.z*.17;return vec3(sin(t*.11+ph)*amt,sin(t*.15+ph*.7)*amt*.25,cos(t*.09+ph*1.3)*amt*.6);}`;

// 前景云层次：近云按离岛心半径分深度层（内缘 1 → 外缘 1.8）。着色器端按 mix(1,depth,uCloudParallax)
// 得 cd，漂移与起伏都除 cd —— 与 clouddeck「v ∝ 1/depth」同一视差口径；parallax=0 时逐位等同旧行为。
export function nearCloudDepth(r,R){const t=Math.min(1,Math.max(0,(r/Math.max(R,1e-9)-1)/.5));return 1+t*.8;}
