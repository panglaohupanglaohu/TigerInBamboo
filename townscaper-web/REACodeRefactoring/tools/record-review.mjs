// record-review.mjs — 把一条片子的核验结果写回 learn/data.js，然后重算总账。
// 只改这一条 item 的字段，其余 261 条原样不动（整体 JSON.stringify 保持 2 空格排版）。
//
// 必填：--id、--frames（全片帧数，必须等于 artifacts/coverage/<id>/frames.json 的 decoded）、
//       --evidence（证据 md 路径，必须真实存在）、--note（一句话结论，写清做到哪、缺什么）
// 选填：--status done|partial（默认 partial）、--where、--scope、--impl 0|1、--runtime 0|1、
//       --native 1,24,63（原尺寸回看的帧号）、--range 0-297
//
// 例：
//   node tools/record-review.mjs --id 820977247083528192 --frames 132 \
//     --evidence artifacts/coverage/blobshadow-review.md --status partial \
//     --note "132帧全核；共享World单位软影局部接入，原软影梯度/多层叠仍缺" \
//     --where "src/world/blob-shadow.js · blob-shadow.html" --scope "单位软影" \
//     --impl 1 --runtime 1 --native 1,40,90,131
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => path.join(ROOT, ...a);
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const id = arg('id');
const frames = Number(arg('frames', 0));
const evidence = arg('evidence');
const note = arg('note');
if (!id || !frames || !evidence || !note) {
  console.error('缺参数：--id / --frames / --evidence / --note 都是必填');
  process.exit(2);
}
if (!fs.existsSync(p(evidence))) {
  console.error('证据文件不存在：' + evidence + '（先写证据再记账，不许先记后补）');
  process.exit(2);
}
const seqPath = p('artifacts/coverage', id, 'frames.json');
if (!fs.existsSync(seqPath)) {
  console.error('frames.json 不存在：' + seqPath);
  process.exit(2);
}
const decoded = JSON.parse(fs.readFileSync(seqPath, 'utf8')).decoded;
if (decoded !== frames) {
  console.error(`帧数不符：frames.json decoded=${decoded}，你写的是 ${frames}`);
  process.exit(2);
}

const file = p('learn/data.js');
const raw = fs.readFileSync(file, 'utf8');
const data = JSON.parse(raw.replace(/^window\.LEARN\s*=\s*/, '').replace(/;\s*$/, ''));
const item = data.items.find((it) => it.id === id);
if (!item) {
  console.error('data.js 里没有这条 ID：' + id);
  process.exit(2);
}

item.decodedFrames = frames;
item.reviewEvidence = evidence.replace(/^\.\//, '');
const range = arg('range', `0-${frames - 1}`).split('-').map(Number);
item.reviewStages = {
  textRead: true,
  allFramesReviewed: true,
  frameRange: range,
  nativeRevisits: arg('native', '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n)),
  implementationVerified: arg('impl', '0') === '1',
  runtimeAccepted: arg('runtime', '0') === '1',
  acceptanceScope: arg('scope', ''),
};
item.status = arg('status', 'partial');
if (arg('where')) item.where = arg('where');
item.note = note;

fs.writeFileSync(file, 'window.LEARN = ' + JSON.stringify(data, null, 2) + ';\n');

// 重算总账（这一步才是真正的口径来源，别手改 coverage-progress.json）
try {
  const out = execFileSync('python3', ['tools/update-learning-counts.py'], { cwd: ROOT, encoding: 'utf8' });
  console.log(out.trim());
} catch (e) {
  console.error('update-learning-counts.py 失败：\n' + (e.stdout || '') + (e.stderr || ''));
  process.exit(1);
}
const pace = JSON.parse(fs.readFileSync(p('learn/coverage-progress.json'), 'utf8')).learningPace;
console.log(`已记 ${id}（${frames} 帧）→ 已核 ${pace.reviewedClips}/${pace.totalClips}，剩 ${pace.remainingClips}`);
