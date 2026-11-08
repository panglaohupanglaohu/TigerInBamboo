#!/usr/bin/env node
/**
 * 重构第 2 步 · 材质收编（外观不变）：把指定文件里的 new T.XxxMaterial(args) 改成 styleMat('角色','XxxMaterial',args)。
 * 参数一字不改；只加一行 import。阴影专用的 MeshDepth / MeshDistance 材质不动。
 * 用法：node tools/refactor/codemod-materials.mjs <场景前缀> <文件...>   （--dry 只打印角色表）
 */
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2), dry = args.includes('--dry');
const [scene, ...files] = args.filter((a) => a !== '--dry');
const TYPES = /new\s+(?:T|THREE)\.((?:Mesh(?:Standard|Basic|Toon|Lambert|Phong|Physical)|LineBasic|Points|Sprite)Material)\s*\(/g;
const report = [];
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const stem = path.basename(f, '.js').replace(new RegExp('^' + scene), '').replace(/^./, (c) => c.toLowerCase()) || 'main';
  const used = new Map();
  let out = '', last = 0, n = 0;
  for (const m of s.matchAll(TYPES)) {
    const before = s.slice(Math.max(0, m.index - 160), m.index);
    // 用途：最近的赋值名 / 函数名 / mesh 名字字符串
    const hint = (before.match(/(?:const|let|var|,)\s*([A-Za-z_$][\w$]*)\s*=\s*(?:\([^()]*\)\s*=>\s*)?(?:new\s+T\.\w+\([^()]*,?\s*)?$/) || before.match(/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[^{}]*$/) || before.match(/['"]([a-z][\w-]{2,40})['"][^'"]*$/) || before.match(/([A-Za-z_$][\w$]*)\s*=\s*[^=;]*$/) || [, 'mat'])[1];
    const key = hint.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/^morris-/, '').replace(/(-?mat(erial)?)$/, '') || 'mat';
    const k = used.get(key) || 0; used.set(key, k + 1);
    const role = `${scene}.${stem}.${key}${k ? '-' + (k + 1) : ''}`;
    out += s.slice(last, m.index) + `styleMat('${role}','${m[1]}',`;
    last = m.index + m[0].length; n++;
    report.push({ file: f, role, type: m[1] });
  }
  if (!n) continue;
  out += s.slice(last);
  const rel = path.relative(path.dirname(f), 'src/style/materials.js').replace(/\\/g, '/');
  const imp = `import {styleMat} from '${rel.startsWith('.') ? rel : './' + rel}';\n`;
  if (!out.includes("from '" + (rel.startsWith('.') ? rel : './' + rel) + "'")) {
    // import 放在第一条 import 之后（保持文件头注释在前）
    const i = out.search(/^import .*$/m);
    out = i >= 0 ? out.slice(0, out.indexOf('\n', i) + 1) + imp + out.slice(out.indexOf('\n', i) + 1) : imp + out;
  }
  if (!dry) fs.writeFileSync(f, out);
}
console.log(JSON.stringify(report, null, 1));
console.error(`${dry ? '[dry] ' : ''}${report.length} 处材质 → styleMat（${new Set(report.map((r) => r.file)).size} 个文件）`);
