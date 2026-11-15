// 1331905048801144836 · "Townscaper now has lighthouses!"
// 验收：灯室是**方形**（Box，不是圆柱）、屋顶是**四坡**（4 段的锥）、观景台有一圈**立杆**栏杆，
// 且塔身仍是建筑本体（我们只在顶上罩灯室，不改楼身）。最后渲染一张图看外形。
const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 700, height: 700 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    await p.goto('http://localhost:8769/index.html');
    await p.waitForFunction(() => !!window.rea, null, { timeout: 60000 });

    const r = await p.evaluate(async () => {
      const T = await import('three');
      const { Lighthouses } = await import('/src/build/lighthouse.js');
      const scene = new T.Scene(); scene.background = new T.Color('#6aa8b0');
      const uTime = { value: 0 }, uNight = { value: 0.2 };
      const lh = new Lighthouses({ scene, levelHeight: 0.5, uTime, uNight });

      // 一格粗、6 层高、六邻全海：满足「海边细塔」规则
      const cell = { id: 42, cx: 0, cz: 0, size: 1.0, n: 6 };
      const world = { cells: [cell], top: () => 6, isRock: () => false, neighbor: () => null };
      const n = lh.refresh(world);
      const g = lh.group.children[0];
      const byName = {};
      g.traverse((o) => { if (o.name) (byName[o.name] ??= []).push(o); });
      const lantern = byName.lantern?.[0], roof = byName.roof?.[0], deck = byName.deck?.[0];
      const postCount = (byName.railpost || []).length;
      // 灯室四角是否真的在同一个方框上（方形容器：x/z 的半宽相同，都是 -r..r）
      const lb = new T.Box3().setFromObject(lantern), ls = new T.Vector3(); lb.getSize(ls);

      // 渲染一张斜视图
      const canvas = document.createElement('canvas'); canvas.width = 520; canvas.height = 620;
      const r2 = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      r2.outputColorSpace = T.SRGBColorSpace;
      const cam = new T.PerspectiveCamera(28, 520 / 620, 0.1, 100);
      cam.position.set(3.2, 6.4, 4.6); cam.lookAt(0, 2.6, 0);
      const sun = new T.DirectionalLight(0xfff1dc, 2.4); sun.position.set(-4, 9, 5); r2.shadowMap.enabled = false;
      scene.add(sun, new T.AmbientLight(0xfffbf2, 1.2));
      // 塔身（模拟下面的楼体），只为截图好看
      const body = new T.Mesh(new T.BoxGeometry(0.92, 3.0, 0.92), new T.MeshLambertMaterial({ color: '#f2f0e6' }));
      body.position.y = 3.0 - 1.5; scene.add(body);
      const trim = new T.Mesh(new T.BoxGeometry(0.96, 0.5, 0.96), new T.MeshLambertMaterial({ color: '#c2543f' }));
      trim.position.y = 2.75; scene.add(trim);
      r2.render(scene, cam);
      return {
        count: n,
        lanternGeom: lantern?.geometry?.type, lanternSize: { x: +ls.x.toFixed(3), y: +ls.y.toFixed(3), z: +ls.z.toFixed(3) },
        lanternSkew: +Math.abs(ls.x - ls.z).toFixed(4),
        roofGeom: roof?.geometry?.type, roofSegments: roof?.geometry?.parameters?.radialSegments,
        deckGeom: deck?.geometry?.type, postCount,
        postsNamed: Object.keys(byName),
        png: canvas.toDataURL('image/png').split(',')[1],
      };
    });

    fs.writeFileSync('artifacts/coverage/lighthouse-1331905048801144836.png', Buffer.from(r.png, 'base64'));

    assert.equal(r.count, 1, `应识别出 1 座灯塔，实际 ${r.count}`);
    assert.equal(r.lanternGeom, 'BoxGeometry', `灯室应是方盒，实际 ${r.lanternGeom}`);
    assert.ok(r.lanternSkew < 1e-3, `灯室底面应是方形（x/z 半宽相同），差 ${r.lanternSkew}`);
    assert.equal(r.roofGeom, 'ConeGeometry');
    assert.equal(r.roofSegments, 4, `屋顶应是四坡（4 段），实际 ${r.roofSegments}`);
    assert.equal(r.deckGeom, 'BoxGeometry', `观景台应是方形，实际 ${r.deckGeom}`);
    assert.ok(r.postCount >= 20, `栏杆立杆应有 20+ 根，实际 ${r.postCount}`);

    console.log(JSON.stringify(r, null, 2).replace(/"png": "[^"]*"/, '"png": "<omitted>"'));
    assert.deepEqual(errors, []);
    console.log('PASS lighthouse');
  } finally {
    await b.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
