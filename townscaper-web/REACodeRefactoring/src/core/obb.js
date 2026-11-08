/**
 * obb.js — 自己写的盒-盒相交测试（分离轴定理）。
 *
 * 依据：974325184525201409 "We were having strange crashes when using Unity's Physics.OverlapBox. We solved it (hopefully)
 *   by making our own box-box test in two incredibly stressful hours."
 *   画面：一块岩石周围一堆彩色的盒子线框在转，有的相交、有的不相交。
 *
 * 盒子 = { c: [x,y,z] 中心, u: [[ax],[ay],[az]] 三个单位轴, e: [hx,hy,hz] 半尺寸 }。
 * 15 根候选分离轴：A 的 3 轴、B 的 3 轴、两两叉积 9 根；任何一根上两盒投影不重叠 → 不相交。
 * 叉积接近 0（两轴平行）时跳过，避免除零 / 误判；原视频/配文并未证明 Unity 崩溃的具体原因。
 */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function validateBox(b){
 if(!b||!b.c||!b.e||!b.u||b.c.length!==3||b.e.length!==3||b.u.length!==3||![...b.c,...b.e,...b.u.flat()].every(Number.isFinite)||b.e.some(x=>x<0)||b.u.some(a=>a.length!==3||Math.abs(dot(a,a)-1)>1e-6)||Math.abs(dot(b.u[0],b.u[1]))>1e-6||Math.abs(dot(b.u[0],b.u[2]))>1e-6||Math.abs(dot(b.u[1],b.u[2]))>1e-6)throw new RangeError('finite orthonormal OBB required');
}
export function obbOverlap(A, B, {touching=true,epsilon=0}={}) {
 validateBox(A);validateBox(B);
 if(typeof touching!=='boolean'||!Number.isFinite(epsilon)||epsilon<0)throw new RangeError('invalid overlap policy');
 if(!touching&&(A.e.some(x=>x===0)||B.e.some(x=>x===0)))return false;
  const T = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
  const axes = [...A.u, ...B.u];
  for (const a of A.u) for (const b of B.u) {
    const x = cross(a, b), l = Math.hypot(...x);
    if (l > 1e-6) axes.push([x[0] / l, x[1] / l, x[2] / l]);
  }
  for (const L of axes) {
    const ra = A.e[0] * Math.abs(dot(A.u[0], L)) + A.e[1] * Math.abs(dot(A.u[1], L)) + A.e[2] * Math.abs(dot(A.u[2], L));
    const rb = B.e[0] * Math.abs(dot(B.u[0], L)) + B.e[1] * Math.abs(dot(B.u[1], L)) + B.e[2] * Math.abs(dot(B.u[2], L));
    if (touching ? Math.abs(dot(T,L)) > ra+rb+epsilon : Math.abs(dot(T,L)) >= ra+rb-epsilon) return false;
  }
  return true;
}

/** 由欧拉角（弧度，YXZ）造一个盒子 */
export function makeBox(c, e, [rx, ry, rz] = [0, 0, 0]) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Ry * Rx * Rz 的三列
  const m = [
    [cy * cz + sy * sx * sz, cx * sz, -sy * cz + cy * sx * sz],
    [-cy * sz + sy * sx * cz, cx * cz, sy * sz + cy * sx * cz],
    [sy * cx, -sx, cy * cx],
  ];
  const box={c:[...c],e:[...e],u:m};validateBox(box);return box;
}

/** 慢但可靠的对照：在 A 里撒点，看有没有点落在 B 里（只用于测试） */
export function obbOverlapSampled(A, B, n = 14) {
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
    const f = [i / n * 2 - 1, j / n * 2 - 1, k / n * 2 - 1];
    const p = [0, 1, 2].map((d) => A.c[d] + A.u[0][d] * f[0] * A.e[0] + A.u[1][d] * f[1] * A.e[1] + A.u[2][d] * f[2] * A.e[2]);
    const q = [p[0] - B.c[0], p[1] - B.c[1], p[2] - B.c[2]];
    if (Math.abs(dot(q, B.u[0])) <= B.e[0] && Math.abs(dot(q, B.u[1])) <= B.e[1] && Math.abs(dot(q, B.u[2])) <= B.e[2]) return true;
  }
  return false;
}
