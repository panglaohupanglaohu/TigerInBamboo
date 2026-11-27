// serve-guard.mjs — 8769 本地静态服务的自愈守护（r256）。
//
// 现象（r238、r254、r256 各一次）：serve.py 跑一段时间后，浏览器拉 ES module 会拿到
// `net::ERR_CONNECTION_RESET`。curl 单连接仍然 200，于是门禁在 waitForFunction 上 120s 超时，
// 伪装成「测试红 / 代码坏」。根因是 ThreadingHTTPServer 默认 listen backlog = 5，而一个页要并行拉
// 几十个 module，backlog 一溢出内核直接 reset 新连接；进程活得越久 fd/TIME_WAIT 越积越多，越容易撞。
//
// 这里做三件事（都不改被测代码）：
//   ① 子进程退出 → 立刻重启（serve.py 崩了不至于让整轮红）；
//   ② 每 probeMs 探一次 /__rea_identity__，连续 failStreak 次失败 → 杀掉重启（连接层已坏但进程还活着的最常见形态）；
//   ③ 子进程跑满 maxAgeMs（默认 6h）→ 主动重启（fd/TIME_WAIT 累积）。
//
// 用法：node tools/serve-guard.mjs <port> [--max-age-ms N] [--probe-ms N] [--fail-streak N]
// 每起一次子进程向 stdout 打一行 `SERVE-PID <pid>`（测试与排障用），自身退出时带走子进程。
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import http from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a)) ?? 8769);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = Number(args[i + 1]);
  if (!Number.isFinite(v) || v <= 0) throw new RangeError(`Invalid --${name}: ${args[i + 1]}`);
  return v;
};
const maxAgeMs = opt('max-age-ms', 6 * 3600 * 1000);
const probeMs = opt('probe-ms', 30 * 1000);
const failStreak = opt('fail-streak', 2);

let child = null, startedAt = 0, fails = 0, restarts = 0, stopping = false;
const retired = new Set();   // 主动停掉的 pid（它们的 exit 不该触发「意外退出 → 重启」）

function probe(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/__rea_identity__', timeout: timeoutMs }, (res) => {
      res.resume(); resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

function start(reason) {
  startedAt = Date.now(); fails = 0;
  const c = spawn('python3', [join(ROOT, 'tools/serve.py'), String(port)], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
  child = c;
  console.log(`SERVE-PID ${c.pid}${reason ? ' (' + reason + ')' : ''}`);
  c.on('exit', (code, sig) => {
    if (retired.has(c.pid)) return;
    if (stopping) return;
    child = null; restarts++;
    console.log(`SERVE-EXIT ${code ?? sig} → restart #${restarts}`);
    setTimeout(() => { if (!stopping) start('after exit'); }, 200);
  });
}

function stopChild() {
  const c = child;
  if (!c) return Promise.resolve();
  retired.add(c.pid);
  return new Promise((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    c.once('exit', fin);
    try { c.kill('SIGTERM'); } catch { fin(); }
    setTimeout(() => { try { c.kill('SIGKILL'); } catch {} fin(); }, 2000);
  });
}

async function restart(reason) {
  restarts++;
  console.log(`SERVE-RESTART ${reason} #${restarts}`);
  await stopChild();
  if (!stopping) start(reason);
}

const timer = setInterval(async () => {
  if (stopping) return;
  if (Date.now() - startedAt > maxAgeMs) return restart(`max-age ${Math.round(maxAgeMs / 1000)}s`);
  if (await probe()) { fails = 0; return; }
  fails++;
  if (fails >= failStreak) await restart(`probe failed ${fails}×`);
}, probeMs);
timer.unref?.();

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { stopping = true; clearInterval(timer); await stopChild(); process.exit(0); });
process.on('exit', () => { stopping = true; try { child?.kill('SIGTERM'); } catch {} });

start();
