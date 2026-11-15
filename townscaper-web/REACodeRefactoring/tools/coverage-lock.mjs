// coverage-lock.mjs — 防止每小时触发的那一轮和上一轮撞车（两个进程同时改 data.js 会互相覆盖）。
// status → 退出码 0=空闲可开跑，3=有人正在跑（带年龄）；start/end/touch 写心跳。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = path.join(ROOT, 'learn/.coverage.lock');
const MAX_AGE_MIN = 150; // 超过 2.5 小时没有任何心跳，视为死锁
const cmd = process.argv[2] || 'status';

function read() {
  try {
    return JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  } catch {
    return null;
  }
}
function write(state) {
  const now = new Date();
  fs.writeFileSync(LOCK, JSON.stringify({ ...state, heartbeat: now.toISOString(), pid: process.pid }, null, 1));
}
const ageMin = (s) => (s ? (Date.now() - new Date(s.heartbeat).getTime()) / 60000 : Infinity);

if (cmd === 'status') {
  const s = read();
  if (!s || ageMin(s) > MAX_AGE_MIN) {
    console.log(`IDLE${s ? `（上一次心跳 ${ageMin(s).toFixed(0)} 分钟前，视为死锁，可接管）` : ''}`);
    process.exit(0);
  }
  console.log(`BUSY ${ageMin(s).toFixed(0)} 分钟前心跳 · 批次 ${s.batch || '?'} · 已做 ${(s.done || []).join(',') || '-'}`);
  process.exit(3);
}
if (cmd === 'start') {
  const s = read();
  if (s && ageMin(s) <= MAX_AGE_MIN) {
    console.log('BUSY，不要抢：' + ageMin(s).toFixed(0) + ' 分钟前心跳');
    process.exit(3);
  }
  write({ batch: process.argv[3] || '', startedAt: new Date().toISOString(), done: [] });
  console.log('LOCKED');
} else if (cmd === 'touch') {
  const s = read() || { done: [] };
  if (process.argv[3]) s.done = [...(s.done || []), process.argv[3]];
  write(s);
  console.log('HEARTBEAT ' + (s.done || []).length);
} else if (cmd === 'end') {
  fs.rmSync(LOCK, { force: true });
  console.log('RELEASED');
} else {
  console.error('用法：node tools/coverage-lock.mjs status|start <批次>|touch <id>|end');
  process.exit(2);
}
