// r256：8769 服务的自愈（tools/serve-guard.mjs）+ serve.py backlog 修复的运行验收。
//   ① 正常起：/__rea_identity__ 与真实 module 都 200（backlog 256 之后并行拉模块不再被 reset）；
//   ② 子进程意外退出 → 守护换新 pid 并恢复服务；
//   ③ 跑满 max-age → 守护主动换 pid（这条是本轮踩到的形态：进程活着、连接层已坏）；
//   ④ 探活连续失败 → 判定连接层坏掉后重启（本测试用「杀掉子进程但守护以为它活着」无法模拟，
//      所以只验 ②③ 两条重启触发源 + ① 的服务可用性，restart 计数一并校）。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(path, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path, timeout }, (res) => {
      let body = ''; res.setEncoding('utf8'); res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
    req.on('error', () => resolve({ status: 0, body: '' }));
  });
}

async function waitUp(ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const r = await get('/__rea_identity__', 800); if (r.status === 200) return true; await sleep(120); }
  return false;
}
async function waitDown(ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const r = await get('/__rea_identity__', 400); if (r.status !== 200) return true; await sleep(100); }
  return false;
}

/** 起一个守护，收集它 stdout 里的 SERVE-PID 序列。 */
function launch(extra = []) {
  const p = spawn(process.execPath, [join(ROOT, 'tools/serve-guard.mjs'), String(PORT), ...extra], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const pids = [];
  let buf = '';
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', (d) => {
    buf += d;
    for (const m of buf.matchAll(/SERVE-PID (\d+)/g)) if (!pids.includes(+m[1])) pids.push(+m[1]);
  });
  p.stderr.setEncoding('utf8'); p.stderr.on('data', (d) => (buf += d));
  return { p, pids, lines: () => buf };
}
async function killGuard(h) {
  h.p.kill('SIGTERM');
  await new Promise((r) => { h.p.once('exit', r); setTimeout(r, 3000); });
  for (const pid of h.pids) { try { process.kill(pid, 'SIGKILL'); } catch {} }
  await waitDown(4000);
}

const out = {};
// ① 正常起 + backlog 修复后并行拉模块不再 reset
{
  const h = launch(['--max-age-ms', '600000', '--probe-ms', '600000']);
  assert.ok(await waitUp(), '守护起服务');
  const id = await get('/__rea_identity__');
  assert.equal(id.status, 200);
  assert.equal(JSON.parse(id.body).edition, 'REACodeRefactoring', '身份端点仍是本仓');
  // 并行 40 条 module：backlog 5 的老实现在这里最容易 reset（单条 curl 200 看不出来）
  const paths = ['/index.html', '/vendor/three.module.js', '/src/world/battle-navigation.js', '/src/core/world.js', '/src/core/grid.js'];
  const burst = await Promise.all(Array.from({ length: 40 }, (_, i) => get(paths[i % paths.length], 6000)));
  const bad = burst.filter((r) => r.status !== 200);
  assert.equal(bad.length, 0, `并行 40 条全部 200（失败 ${bad.length}）`);
  assert.equal(h.pids.length, 1, '只起了一个子进程');
  out.burst = { requests: burst.length, failed: bad.length, bytes: burst.reduce((a, r) => a + r.body.length, 0) };

  // ② 子进程意外退出 → 重启
  const first = h.pids[0];
  process.kill(first, 'SIGKILL');
  const t0 = Date.now();
  let up = false;
  while (Date.now() - t0 < 10000) { if (h.pids.length >= 2 && (await get('/__rea_identity__', 500)).status === 200) { up = true; break; } await sleep(150); }
  assert.ok(up, `意外退出后重建（pids ${h.pids}）`);
  assert.notEqual(h.pids.at(-1), first, '换了新 pid');
  out.respawn = { first, next: h.pids.at(-1), ms: Date.now() - t0 };
  await killGuard(h);
}
// ③ 跑满 max-age 主动重启（进程还活着、连接层可能已坏的那种形态）
{
  const h = launch(['--max-age-ms', '1200', '--probe-ms', '300']);
  assert.ok(await waitUp(), '守护起服务');
  const t0 = Date.now();
  let rotated = false;
  while (Date.now() - t0 < 12000) { if (h.pids.length >= 2) { rotated = true; break; } await sleep(100); }
  assert.ok(rotated, `满龄后主动换 pid（pids ${h.pids}）`);
  const up = await waitUp(6000);
  assert.ok(up, '换 pid 后服务仍可用');
  out.maxAge = { pids: h.pids.slice(0, 3), ms: Date.now() - t0 };
  assert.ok((await get('/__rea_identity__')).status === 200);
  await killGuard(h);
}
console.log('PASS serve-guard 自愈（并行 40 条 module 无 reset / 意外退出重建 / 满龄主动换 pid）+ serve.py backlog 256', JSON.stringify(out));
