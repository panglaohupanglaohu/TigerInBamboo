/**
 * objexport.js — 把当前小镇导出成 .OBJ（1430224300003545091 "the Townscaper mesh exporter … Export .OBJ"）。
 *   画面：设置面板里一个「Export .OBJ」按钮；导出的白模在建模软件里打开，房子、台阶、栏杆都在。
 *
 * 我们的整座小镇本来就是 MeshWriter 写出的一个合并网格（1401145625572425728 的 mesh merger 思路：
 * 小网格合并成大块，减少 draw call），所以导出只要把这一个 BufferGeometry 写成文本：
 *   v x y z r g b   （顶点色作为 OBJ 的常见扩展，Blender / MeshLab 能读）
 *   vn nx ny nz
 *   f a//a b//b c//c
 * 相同位置 + 法线 + 颜色的顶点合并（量化到 1e-4），文件小一半左右。
 */

export function geometryToOBJ(geometry, { name = 'townscaper' } = {}) {
  const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal'), col = geometry.getAttribute('color');
  const index = geometry.getIndex();
  const map = new Map(), v = [], vn = [], f = [];
  const q = (x) => Math.round(x * 1e4) / 1e4;
  const id = (i) => {
    const key = [q(pos.getX(i)), q(pos.getY(i)), q(pos.getZ(i)), nor ? q(nor.getX(i)) : 0, nor ? q(nor.getY(i)) : 0, nor ? q(nor.getZ(i)) : 0, col ? q(col.getX(i)) : 1, col ? q(col.getY(i)) : 1, col ? q(col.getZ(i)) : 1].join(',');
    let k = map.get(key);
    if (k === undefined) {
      k = map.size + 1; map.set(key, k);
      const p = key.split(',');
      v.push(`v ${p[0]} ${p[1]} ${p[2]}${col ? ` ${p[6]} ${p[7]} ${p[8]}` : ''}`);
      vn.push(`vn ${p[3]} ${p[4]} ${p[5]}`);
    }
    return k;
  };
  const n = index ? index.count : pos.count;
  for (let t = 0; t + 2 < n; t += 3) {
    const a = id(index ? index.getX(t) : t), b = id(index ? index.getX(t + 1) : t + 1), c = id(index ? index.getX(t + 2) : t + 2);
    if (a === b || b === c || a === c) continue;
    f.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  const text = `# REACodeRefactoring OBJ export\no ${name}\n${v.join('\n')}\n${vn.join('\n')}\n${f.join('\n')}\n`;
  return { text, vertices: v.length, faces: f.length, sourceVerts: pos.count };
}

export function downloadOBJ(geometry, filename = 'town.obj') {
  const r = geometry ? geometryToOBJ(geometry) : null;
  if (!r) return null;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([r.text], { type: 'text/plain' }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return r;
}
