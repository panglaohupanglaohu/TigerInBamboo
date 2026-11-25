import assert from 'node:assert/strict';
import {cloudDrift,cloudWindBob,CLOUD_WIND_BOB_GLSL,CLOUD_WIND_AMT,nearCloudDepth} from '../src/core/cloud-motion.js';
for(let i=0;i<1000;i++){const t=i*.137-50,yaw=i*.002;const a=cloudDrift(t,yaw);assert.ok(a>=-20&&a<20);assert.ok(Math.abs(a-cloudDrift(t+40/.12,yaw))<1e-10)}
assert.ok(Math.abs(cloudDrift(10,0)-cloudDrift(0,0)-1.2)<1e-10);

// r214：REACode engine/impostor.js 顶点着色器云起伏（uWindAmt 树0/云0.6）的 CPU 镜像——
// ph=x*.13+z*.17；x:sin(t*.11+ph)*amt，z:cos(t*.09+ph*1.3)*amt*.6，y:sin(t*.15+ph*.7)*amt*.25
{
 let bad=0;
 for(let i=0;i<1000;i++){const t=i*.173-80,x=(i*.37%60)-30,z=(i*.53%40)-20,amt=.6;
  const ph=x*.13+z*.17,e=[Math.sin(t*.11+ph)*amt,Math.sin(t*.15+ph*.7)*amt*.25,Math.cos(t*.09+ph*1.3)*amt*.6],b=cloudWindBob(t,x,z,amt);
  if(Math.abs(b[0]-e[0])>1e-12||Math.abs(b[1]-e[1])>1e-12||Math.abs(b[2]-e[2])>1e-12)bad++;
  assert.ok(Math.abs(b[0])<=amt&&Math.abs(b[1])<=amt*.25+1e-15&&Math.abs(b[2])<=amt*.6+1e-15,'bob bounded by amt');}
 assert.equal(bad,0,'cloudWindBob matches engine formula componentwise');
 // 每实例相位：位置不同 → 起伏不同（不是整块板一起滑）
 const a=cloudWindBob(3,0,0),b=cloudWindBob(3,7,-11);
 assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])>.01,'per-instance phase from position');
 assert.ok(cloudWindBob(9,5,7,0).every(v=>v===0),'amt=0 no-op（树默认）');
 assert.equal(CLOUD_WIND_AMT,.6,'engine cloud uWindAmt');
 // GLSL 与 CPU 同式：引擎的 6 个常数与结构逐字在
 for(const s of ['.13','.17','.11','.09','.15','.25','.6','vec3 cloudWindBob','c.x','c.z'])assert.ok(CLOUD_WIND_BOB_GLSL.includes(s),'GLSL keeps engine constants '+s);
}
// 前景云层次：内缘深度 1 → 外缘 1.8，单调、确定、越界夹取
{
 assert.equal(nearCloudDepth(0,10),1);assert.equal(nearCloudDepth(10,10),1);
 assert.equal(nearCloudDepth(12.5,10),1.4);assert.equal(nearCloudDepth(15,10),1.8);assert.equal(nearCloudDepth(99,10),1.8);
 let prev=0;for(let i=0;i<=20;i++){const d=nearCloudDepth(10+i*.5,10);assert.ok(d>=prev&&d>=1&&d<=1.8);prev=d;}
 assert.equal(nearCloudDepth(5,0),1.8,'R 退化时不发散');
}
console.log('PASS cloud shared drift 1000 wrap/negative-time cases + engine wind bob mirror 1000 cases + near-cloud depth layers');
