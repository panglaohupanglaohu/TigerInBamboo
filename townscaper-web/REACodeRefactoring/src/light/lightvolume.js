/**
 * lightvolume.js — 光体积 + 多次反弹（第三个项目的 GI）。
 *
 * 依据：
 *   1580835075629133825 "I always write my own lighting solutions … this is my first decent attempt to actually have the
 *     light *bounce*"   画面：橙色台地，打开反弹后阴影里泛出地面的暖色、草地的绿色。
 *   1580845127207387137 "1st texture here is an sdf volume … 2nd is a baked 6 directional light volume, raycast against the
 *     sdf, sampling the mega texture using the UVs where it hits the sdf"
 *   1580846877855338497 "the slowed down bounce sequence … After about the 3rd bounce, further bounces are not noticeable"
 *   1582757294672314368 "if my light volume approach can work with point lights too … keep em big and soft"
 *   1481661852887265288 "Yet another light baker … 3D Signed Distance Field, 3D Ambient Occlusion in positive and negative X,Y and Z"
 *
 * 做法（CPU，按需烘一次）：
 *   1. 体素化：岛的包围盒切成 nx × ny × nz 的格子（水平 0.25、竖直半层），每格记 实心 / 反照率（地面草色 / 岩石 / 墙色）。
 *   2. 直射：每个空格子朝太阳走，没被挡住 = 1（+ 可选点光源：距离衰减、也要不被挡）。
 *   3. 反弹：每个空格子朝 6 个方向走，碰到实心格就取"那块表面的反照率 × 它旁边空格子的光"，6 向平均 = 间接光；
 *      迭代 bounces 次；记录实际变化量，不保证任意场景第三次后收敛。
 *   4. 6 向开放率：固定范围内未命中的方向占比；不是连续距离SDF。可选保存六向RGB并按法线平方权重采样。
 *   网格顶点按位置 + 法线偏移在体积里三线性取样，得到间接光（RGB），着色器里加到 indirectDiffuse 上。
 */

import {voxelDistance} from '../core/voxel-distance.js';
import {firstVoxelHit} from '../core/voxel-ray.js';

export function bakeLightVolume(world, index, { L = 0.5, sun = [0.4, 0.8, 0.45], res = 0.25, bounces = 3, point = null, points = point ? [point] : [], sunIntensity = 1, maxVoxels = 2000000, maxBytes = 134217728, directional = false, distanceField = false, albedoOf = () => [.5,.5,.5] } = {}) {
  const t0 = performance.now();
  if(!Number.isFinite(L)||L<=0||!Number.isFinite(res)||res<=0||!Number.isInteger(bounces)||bounces<0||bounces>8||!Number.isFinite(sunIntensity)||sunIntensity<0||sunIntensity>1e4||!Array.isArray(sun)||sun.length!==3||!sun.every(Number.isFinite)||(!Number.isFinite(Math.hypot(...sun))||Math.hypot(...sun)===0)||!Number.isInteger(maxVoxels)||maxVoxels<8||typeof albedoOf!=='function'||!Array.isArray(points)||points.length>16)throw new RangeError('invalid light volume options');
  for(const p of points)if(!p||!Array.isArray(p.pos)||p.pos.length!==3||!p.pos.every(Number.isFinite)||!Array.isArray(p.color)||p.color.length!==3||p.color.some(c=>!Number.isFinite(c)||c<0||c>16)||!Number.isFinite(p.radius)||p.radius<=0||!Number.isFinite(p.intensity)||p.intensity<0||p.intensity>1e4)throw new RangeError('invalid volume point light');
  // 包围盒
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxH = 1;
  for (const c of world.cells) { const t = world.top(c); if (!t) continue; minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); maxH = Math.max(maxH, t); }
  if (!Number.isFinite(minX)) return null;
  minX -= 1; minZ -= 1; maxX += 1; maxZ += 1;
  const nx = Math.max(2,Math.ceil((maxX - minX) / res)), nz = Math.max(2,Math.ceil((maxZ - minZ) / res)), ny = (maxH + 2) * 2;
  const dy = L / 2;
  const N = nx * ny * nz, id = (x, y, z) => (z * ny + y) * nx + x;
  if(N>maxVoxels||!Number.isFinite(maxBytes)||maxBytes<=0||N*((directional?173:101)+24+(distanceField?40:0))>maxBytes)throw new RangeError('light volume exceeds voxel/working-set budget');
  const solid = new Uint8Array(N), alb = new Float32Array(N * 3);
  // 1. 体素化（每个 xz 柱只查一次格子）
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const wx = minX + (x + 0.5) * res, wz = minZ + (z + 0.5) * res;
    const c = index.cellAt(wx, wz);
    for (let y = 0; y < ny; y++) {
      const wy = (y + 0.5) * dy;
      const k = id(x, y, z);
      if (y === 0 && (!c || world.top(c) === 0)) { solid[k] = 2; alb.set([0.30, 0.55, 0.60], k * 3); continue; }   // 海面：也反光（偏青）
      if (!c) continue;
      const lv = Math.floor(wy / L) + 1;
      if (world.isSolid(c, lv)) { solid[k] = 1; const rgb=albedoOf(c,lv,wy);if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(v=>!Number.isFinite(v)||v<0||v>1))throw new RangeError('invalid volume albedo');alb.set(rgb,k*3); }
    }
  }
  const sdf=distanceField?voxelDistance(solid,{nx,ny,nz,spacing:[res,dy,res],maxVoxels}):null;
  const rayHit=(A,B)=>sdf?sdf.rayHit(A,B):firstVoxelHit(solid,{nx,ny,nz},A,B);
  const S = sun.slice(); { const l = Math.hypot(...S); S[0] /= l; S[1] /= l; S[2] /= l; }
  const march = (x, y, z, dx, dy2, dz, maxSteps) => {
    // 返回第一个碰到的实心格序号，没碰到返回 -1（单位：格）
    let fx = x + 0.5, fy = y + 0.5, fz = z + 0.5;
    for (let s = 0; s < maxSteps; s++) {
      fx += dx; fy += dy2; fz += dz;
      const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return -1;
      const k = id(ix, iy, iz);
      if (solid[k]) return k;
    }
    return -1;
  };
  // 2. 直射（每个空格子）
  const direct = new Float32Array(N * 3), pointDirect = new Float32Array(N * 3);
  const reach=Math.hypot(nx*res,ny*dy,nz*res)+1;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const k = id(x, y, z);
    if (solid[k]) continue;
    let r = 0, g = 0, b = 0;
    if (sunIntensity && rayHit([x+.5,y+.5,z+.5],[x+.5+S[0]*reach/res,y+.5+S[1]*reach/dy,z+.5+S[2]*reach/res]) < 0) { r = sunIntensity; g = .95*sunIntensity; b = .85*sunIntensity; }
    // 1582757294672314368: finite point→voxel segments on the shared occupancy.
    const wx=minX+(x+.5)*res,wy=(y+.5)*dy,wz=minZ+(z+.5)*res;
    for(const point of points){const d=Math.hypot(point.pos[0]-wx,point.pos[1]-wy,point.pos[2]-wz);if(d>=point.radius)continue;
      const end=[(point.pos[0]-minX)/res,point.pos[1]/dy,(point.pos[2]-minZ)/res];
      if(rayHit([x+.5,y+.5,z+.5],end)<0){const f=(1-d/point.radius)**2*point.intensity;for(let c=0;c<3;c++)pointDirect[k*3+c]+=point.color[c]*f;}
    }
    r+=pointDirect[k*3];g+=pointDirect[k*3+1];b+=pointDirect[k*3+2];
    direct[k * 3] = r; direct[k * 3 + 1] = g; direct[k * 3 + 2] = b;
  }
  // 3. 反弹：6 方向收集
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const total = direct.slice();
  const indirect = new Float32Array(N * 3);
  const ao = new Float32Array(N);
  // Six incident lobes are a local voxel approximation, not SDF/UV feedback.
  const directionalFields=directional?DIRS.map(()=>new Float32Array(N*3)):null;
  const hitCache=new Int32Array(N*6).fill(-1);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const k=id(x,y,z);if(solid[k])continue;let open=0;for(let d=0;d<6;d++){const hit=march(x,y,z,...DIRS[d],10);hitCache[k*6+d]=hit;if(hit<0)open++}ao[k]=open/6}
  const aoDirections=DIRS.map(()=>new Float32Array(N));
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const k=id(x,y,z);if(solid[k])continue;for(let d=0;d<6;d++){const hit=hitCache[k*6+d];if(hit<0){aoDirections[d][k]=1;continue}const axis=Math.floor(d/2),h=[hit%nx,Math.floor(hit/nx)%ny,Math.floor(hit/(nx*ny))],origin=[x,y,z];aoDirections[d][k]=Math.max(0,Math.min(1,(Math.abs(h[axis]-origin[axis])-.5)/10))}}
  const hist=[],bounceStats=[];
  for(let bounce=0;bounce<bounces;bounce++){
    const next=new Float32Array(N*3);
    for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const k=id(x,y,z);if(solid[k])continue;
      for(let d=0;d<6;d++){
        const [ax,ay,az]=DIRS[d],hit=hitCache[k*6+d];let r=0,g=0,b=0;
        if(hit<0){if(ay>0){r=.55;g=.62;b=.75}}
        else{const hx=hit%nx,hy=Math.floor(hit/nx)%ny,hz=Math.floor(hit/(nx*ny)),bx=hx-ax,by=hy-ay,bz=hz-az;
          if(bx>=0&&by>=0&&bz>=0&&bx<nx&&by<ny&&bz<nz){const kb=id(bx,by,bz);r=total[kb*3]*alb[hit*3];g=total[kb*3+1]*alb[hit*3+1];b=total[kb*3+2]*alb[hit*3+2]}}
        next[k*3]+=r/6;next[k*3+1]+=g/6;next[k*3+2]+=b/6;
        if(directionalFields){directionalFields[d][k*3]=r;directionalFields[d][k*3+1]=g;directionalFields[d][k*3+2]=b}
      }
    }
    let change=0,maxChange=0,energy=0,previous=0;
    for(let i=0;i<N*3;i++){const delta=Math.abs(next[i]-indirect[i]);change+=delta;maxChange=Math.max(maxChange,delta);previous+=Math.abs(indirect[i]);energy+=next[i];indirect[i]=next[i];total[i]=direct[i]+indirect[i]}
    hist.push(+(change/N).toFixed(4));bounceStats.push({iteration:bounce+1,meanChange:change/(N*3),maxChange,meanEnergy:energy/(N*3),relativeChange:previous>0?change/previous:null});
  }
  const vol = { nx, ny, nz, minX, minZ, res, dy, indirect, direct, pointDirect, ao, solid, pointCount:points.length, sdf, aoDirections, directional:directionalFields, bounceStats, estimatedWorkingBytes:N*((directional?173:101)+24+(distanceField?40:0)), ms: Math.round(performance.now() - t0), bounceChange: hist };
  /** 世界坐标 → 三线性插值的间接光 [r,g,b] */
  const sampleField = (field,px, py, pz) => {
    if(![px,py,pz].every(Number.isFinite))throw new RangeError('invalid light sample');
    const fx = (px - minX) / res - 0.5, fy = py / dy - 0.5, fz = (pz - minZ) / res - 0.5;
    const x0 = Math.max(0, Math.min(nx - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(ny - 2, Math.floor(fy))), z0 = Math.max(0, Math.min(nz - 2, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0)), tz = Math.min(1, Math.max(0, fz - z0));
    const out = [0, 0, 0];
    let wsum = 0;
    for (let c = 0; c < 8; c++) {
      const x = x0 + (c & 1), y = y0 + ((c >> 1) & 1), z = z0 + ((c >> 2) & 1);
      const k = id(x, y, z);
      if (solid[k]) continue;   // 只从空格子取（实心格子里没有光）
      const w = (c & 1 ? tx : 1 - tx) * ((c >> 1) & 1 ? ty : 1 - ty) * ((c >> 2) & 1 ? tz : 1 - tz);
      out[0] += field[k * 3] * w; out[1] += field[k * 3 + 1] * w; out[2] += field[k * 3 + 2] * w; wsum += w;
    }
    if (wsum > 1e-4) { out[0] /= wsum; out[1] /= wsum; out[2] /= wsum; }
    return out;
  };
  vol.sample=(...p)=>sampleField(indirect,...p);
  vol.samplePoint=(...p)=>sampleField(pointDirect,...p);
  vol.sampleDirection=(direction,...p)=>{if(!directionalFields||!Number.isInteger(direction)||direction<0||direction>5)throw new RangeError('directional volume unavailable/invalid direction');return sampleField(directionalFields[direction],...p)};
  vol.sampleDirectional=(px,py,pz,normal)=>{
    if(!directionalFields||!Array.isArray(normal)||normal.length!==3||!normal.every(Number.isFinite)||Math.hypot(...normal)===0)throw new RangeError('invalid directional normal/volume');
    const len=Math.hypot(...normal),out=[0,0,0];for(let a=0;a<3;a++){const weight=(normal[a]/len)**2;if(!weight)continue;const value=sampleField(directionalFields[a*2+(normal[a]<0?1:0)],px,py,pz);for(let c=0;c<3;c++)out[c]+=value[c]*weight}return out;
  };
  return vol;
}
