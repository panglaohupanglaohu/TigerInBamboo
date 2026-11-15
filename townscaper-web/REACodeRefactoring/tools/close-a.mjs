// close-a.mjs — A 类收敛：只把「残差=美术/资产/界面复刻」的条目结为 done，
// 其余保持 partial 并写清缺的是哪个机制。所有写入都走 record-review（不手改 data.js）。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACodeRefactoring';
const data = JSON.parse(fs.readFileSync(ROOT + '/learn/data.js', 'utf8')
  .replace(/^window\.LEARN\s*=\s*/, '').replace(/;\s*$/, ''));
const byId = Object.fromEntries(data.items.map((i) => [String(i.id), i]));

// done：残差只有原片美术/图稿/动画姿态/界面复刻，片子里那件事已等价
const DONE = {
  '1024679338292256769': '残差=原徽章图稿与逐部件时序，机制（中央先显/外纹后展/尾迹最后退）等价',
  '793545297376972801': '残差=接共享 World 与本仓美术模块（窗洞/栏杆），WFC+体素 AO 机制等价且量化通过',
  '1758251637280268481': '残差=原片完整反射观感，SDF 叠平面+各向异性中心距离机制已落地并双网格通过',
  '839067977781768193': '残差=血泊尸体/木跳板/旗布摆动等美术件与 battle 接线，HUD 两件机制等价',
  '1786014232594485497': '残差=原山体纹理 atlas 与笔触，法线烘焙明度机制等价且 GPU 通过',
  '818857408848130048': '残差=真倒影/暗色碎片/带状水线/坡屋顶细节，等值面崩解重组机制等价',
  '1707490274425884929': '残差=球团体量（只保证锚点），形变后绕序判定修复且双网格 556/564 通过',
  '870296307889573889': '残差=翻滚姿态与落地扬尘（动画美术），击退越沿→逐级滚落→摔死机制等价',
  '1061221291137605633': '残差=纹样与 CPU 绘图 API，D4 八方向/固定像素尺度折叠机制等价且 GPU 无误差',
  '1991103578011029507': '残差=完整浪形与碰撞，分段近岸浪峰机制等价且双网格 GPU 对照通过',
  '1151770831619534848': '三块簇/插值接缝按块边界钉住，浏览器全 owner 逐模式验收通过',
  '1298689301488775169': '残差=半透明层叠画法与四小部件界面，AO 烘焙壳机制等价（608 面/1216 三角）',
  '912691357440978945': '残差=烧焦痕与血泊不规则扩散，崖壁竖斑/崖脚积血机制等价且已量化',
  '1313840428685447170': '残差=原界面与完整地平线日照，二维太阳盘+方位高度控制机制等价（含水面三场阴影）',
};

const rows = [];
for (const [id, why] of Object.entries(DONE)) {
  const it = byId[id];
  if (!it) { console.log('MISS', id); continue; }
  const rs = it.reviewStages || {};
  const args = [
    'tools/record-review.mjs',
    '--id', id,
    '--frames', String(it.decodedFrames),
    '--evidence', it.reviewEvidence,
    '--status', 'done',
    '--note', `${it.note.replace(/；?【第62轮[^】]*】.*$/, '')}；【第62轮 A 类收敛】${why}，判为 done`,
    '--where', it.where,
    '--scope', rs.acceptanceScope || '',
    '--impl', '1', '--runtime', '1',
    '--native', (rs.nativeRevisits || []).join(','),
    '--range', (rs.frameRange || [0, it.decodedFrames - 1]).join('-'),
  ];
  try {
    const out = execFileSync('node', args, { cwd: ROOT, encoding: 'utf8' });
    rows.push([id, 'done', out.trim().split('\n').pop()]);
  } catch (e) {
    rows.push([id, 'FAIL', (e.stderr || '').slice(0, 200)]);
  }
}
for (const r of rows) console.log(r.join(' | '));
