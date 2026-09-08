// Headless browser evidence only. Does not touch the user's foreground browser.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.env.TIGER_TEST_OUTPUT ? path.resolve(process.env.TIGER_TEST_OUTPUT) : path.join(root, 'artifacts/pipeline/tiger-web-v3');
const base = (process.env.TIGER_TEST_BASE_URL || 'http://127.0.0.1:8877/TigerMessenger').replace(/\/$/, '');
const runtimeFiles = ['src/assets/tigerAnatomy.js', 'src/assets/characters/moebiusTiger.js', 'src/world/moebiusTiger.js'];
const runtimeHashes = async () => Object.fromEntries(await Promise.all(runtimeFiles.map(async file =>
  [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])));
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const pageErrors = [], networkErrors = [];
let report;
try {
  const initialRuntimeHashes = await runtimeHashes();
  const page = await browser.newPage({viewport: {width: 1400, height: 720}, deviceScaleFactor: 1});
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) networkErrors.push({url: response.url(), status: response.status()}); });
  await page.route('**/tiger-anatomy-test.html', route => route.fulfill({contentType: 'text/html', body: `
    <!doctype html><meta charset="utf-8"><title>Tiger anatomy comparison</title>
    <style>body{margin:0;background:#d7dfda;color:#263a31;font:15px system-ui}header{height:55px;display:flex;align-items:center;justify-content:space-around}main{display:flex}canvas{display:block}footer{height:35px;text-align:center}#bubble{display:none}</style>
    <script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js","three/addons/":"${base}/vendor/jsm/"}}</script>
    <header><strong>Original factory — anatomy off</strong><strong>Blender v3 — anatomy on</strong></header>
    <main></main><footer id="caption"></footer><div id="bubble"></div>`}));
  await page.goto(base + '/tiger-anatomy-test.html');
  report = await page.evaluate(async ({base}) => {
    const T = await import('three');
    const {createMoebiusTigerModel, TIGER_SCALE} = await import(base + '/src/assets/characters/moebiusTiger.js');
    const world = await import(base + '/src/world/moebiusTiger.js');
    const sourceResponse = await fetch(base + '/assets/models/originals/moebiusTiger.source.json');
    if (!sourceResponse.ok) throw Error('Original source snapshot unavailable');
    const source = await sourceResponse.json();
    const checks = [];
    function check(name, condition, detail) {
      checks.push({name, passed: !!condition, ...(detail === undefined ? {} : {detail})});
    }
    const nodes = object => {const list = []; object.traverse(node => list.push(node)); return list;};
    const oldNodes = object => nodes(object).filter(n => /^n\d+$/.test(n.userData.blenderSourceNode || ''));
    const idMap = object => new Map(oldNodes(object).map(n => [n.userData.blenderSourceNode, n]));
    const vecFinite = array => Array.from(array).every(Number.isFinite);
    const sameArray = (a, b, epsilon = 1e-6) => a?.length === b?.length && Array.from(a).every((v, i) => Math.abs(v - b[i]) <= epsilon);
    const geometryKey = geometry => JSON.stringify({
      attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([key, value]) => [key, Array.from(value.array)])),
      index: geometry.index ? Array.from(geometry.index.array) : null,
    });
    async function ready(object) {
      if (object.userData.tigerAnatomy?.ready) await object.userData.tigerAnatomy.ready;
      object.updateMatrixWorld(true);
      return object;
    }
    const make = async anatomy => ready(createMoebiusTigerModel(() => .5, {anatomy, optimizedGeometry: false}));
    const legacy = await make(false), tiger = await make(true);
    const legacyNodes = nodes(legacy);
    check('explicit false remains lazy without candidate controller or metadata',
      !legacy.userData.tigerAnatomy && !legacy.userData.tigerAnatomyController);
    check('legacy traversal is original 80-node source', legacyNodes.length === 80 && source.nodes.length === 80);
    let legacySourceMatches = true;
    for (let i = 0; i < Math.min(legacyNodes.length, source.nodes.length); i++) {
      const node = legacyNodes[i], spec = source.nodes[i];
      node.updateMatrix();
      legacySourceMatches &&= node.name === spec.name && node.type === spec.type && sameArray(node.matrix.elements, spec.matrix);
      if (spec.geometry) {
        const geometry = source.geometries[spec.geometry];
        legacySourceMatches &&= !!node.geometry && Object.entries(geometry.attributes).every(([key, attr]) => sameArray(node.geometry.attributes[key]?.array, attr.values));
        legacySourceMatches &&= sameArray(node.geometry.index?.array || [], geometry.index || [], 0);
      }
    }
    check('explicit anatomy optout retains archived geometry and local transforms', legacySourceMatches);
    check('anatomy v3 loaded and active', tiger.userData.tigerAnatomy?.active === true && tiger.userData.tigerAnatomy?.version === 3);
    check('root identity and narrative preserved', tiger.name === legacy.name && tiger.userData.kind === legacy.userData.kind
      && tiger.userData.displayName === legacy.userData.displayName && JSON.stringify(tiger.userData.speech) === JSON.stringify(legacy.userData.speech)
      && sameArray(tiger.scale.toArray(), [TIGER_SCALE, TIGER_SCALE, TIGER_SCALE]));
    const ids = idMap(tiger);
    check('all 80 original IDs remain unique', ids.size === 80 && oldNodes(tiger).length === 80
      && source.nodes.every(spec => ids.has(spec.id)));
    check('all original parent relationships preserved', source.nodes.every(spec => {
      const node = ids.get(spec.id); return node && (spec.parent === null ? node === tiger : node.parent === ids.get(spec.parent));
    }));
    const additions = nodes(tiger).filter(n => n.userData.blenderSourceNode?.startsWith('add:'));
    check('ten separately identified anatomy additions', additions.length === 10 && new Set(additions.map(n => n.userData.blenderSourceNode)).size === 10, {count: additions.length});
    const changedGeometry = source.nodes.filter((spec, i) => spec.geometry && ids.get(spec.id)?.geometry
      && geometryKey(ids.get(spec.id).geometry) !== geometryKey(legacyNodes[i].geometry)).map(spec => spec.id);
    check('candidate actually replaces original mesh geometry', changedGeometry.length > 0, {changedMeshNodes: changedGeometry.length});
    const legs = ['n52', 'n59', 'n66', 'n73'].map(id => ids.get(id));
    const paws = ['n55', 'n62', 'n69', 'n76'].map(id => ids.get(id));
    check('four original leg pivots and paws remain', legs.every(n => n?.isGroup) && paws.every(n => n?.isMesh)
      && paws.every((paw, i) => paw.parent === legs[i]));
    const tailRoot = tiger.userData.tailRoot, tail = tiger.userData.tailSegs;
    check('eight original tail joints remain', tail?.length === 8 && tail.every((n, i) => n === ids.get(['n28','n31','n34','n37','n40','n43','n46','n49'][i])));
    const lightRefs = nodes(tiger).filter(n => n.isPointLight);
    check('both original eye lights remain', lightRefs.length === 2 && lightRefs[0] === ids.get('n20') && lightRefs[1] === ids.get('n22'));
    const updateRef = tiger.userData.update;
    const originalRefs = new Map(ids);
    let reversible = typeof tiger.userData.setTigerAnatomy === 'function';
    if (reversible) {
      await tiger.userData.setTigerAnatomy(false); await ready(tiger);
      const current = idMap(tiger);
      reversible &&= tiger.userData.tigerAnatomy.active === false && current.size === 80
        && Array.from(originalRefs).every(([id, node]) => current.get(id) === node)
        && source.nodes.every((spec, i) => !spec.geometry || geometryKey(current.get(spec.id).geometry) === geometryKey(legacyNodes[i].geometry));
      await tiger.userData.setTigerAnatomy(true); await ready(tiger);
      reversible &&= tiger.userData.tigerAnatomy.active === true && tiger.userData.update === updateRef
        && tiger.userData.tailRoot === tailRoot && tiger.userData.tailSegs.every((node, i) => node === tail[i])
        && Array.from(originalRefs).every(([id, node]) => idMap(tiger).get(id) === node)
        && lightRefs.every(light => nodes(tiger).includes(light));
    }
    check('toggle is reversible without replacing root, callbacks, original nodes or lights', reversible);
    if (typeof tiger.userData.setTigerAnatomy === 'function') {
      const candidateIntensities = lightRefs.map(light => light.intensity);
      const originalIntensities = ['n20', 'n22'].map(id => legacyNodes[Number(id.slice(1))].intensity);
      tiger.visible = false; lightRefs[0].visible = false; lightRefs[1].visible = false;
      await tiger.userData.setTigerAnatomy(false); await ready(tiger);
      const originalIntensityRestored = lightRefs.every((light, i) => Math.abs(light.intensity - originalIntensities[i]) < 1e-9);
      let outsideVisibilityPreserved = tiger.visible === false && lightRefs.every(light => light.visible === false);
      await tiger.userData.setTigerAnatomy(true); await ready(tiger);
      outsideVisibilityPreserved &&= tiger.visible === false && lightRefs.every(light => light.visible === false);
      check('external root and eye-light visibility survives both toggle directions', outsideVisibilityPreserved);
      check('candidate eye lights are restrained and original intensities restore on optout', originalIntensityRestored
        && lightRefs.every((light, i) => light.intensity > 0 && light.intensity <= originalIntensities[i] * .1
          && Math.abs(light.intensity - candidateIntensities[i]) < 1e-9), {candidateIntensities, originalIntensities});
    }
    const disposable = await make(false), disposableNodes = nodes(disposable), disposeCallback = disposable.userData.update;
    const originalGeometryRefs = new Map(disposableNodes.filter(n => n.geometry).map(n => [n, n.geometry]));
    let originalDisposals = 0;
    for (const geometry of new Set(originalGeometryRefs.values())) geometry.addEventListener('dispose', () => originalDisposals++);
    let disposeRestores = typeof disposable.userData.disposeTigerAnatomy === 'function';
    if (disposeRestores) {
      disposable.userData.setTigerAnatomy(true); await ready(disposable);
      const candidateGeometries = new Set(nodes(disposable).filter(n => n.geometry).map(n => n.geometry));
      let candidateDisposals = 0;
      for (const geometry of candidateGeometries) geometry.addEventListener('dispose', () => candidateDisposals++);
      disposable.userData.disposeTigerAnatomy();
      disposeRestores &&= originalDisposals === 0 && candidateDisposals === candidateGeometries.size
        && disposable.userData.tigerAnatomy?.disposed === true && disposable.userData.tigerAnatomy.active === false
        && nodes(disposable).length === 80 && disposable.userData.update === disposeCallback
        && Array.from(originalGeometryRefs).every(([node, geometry]) => node.geometry === geometry);
      disposable.userData.setTigerAnatomy(true); await ready(disposable);
      disposeRestores &&= disposable.userData.tigerAnatomy.active === true && nodes(disposable).length === 90
        && idMap(disposable).size === 80 && disposable.userData.update === disposeCallback;
    }
    check('candidate disposal releases owned geometry, restores original and re-enables without duplicates', disposeRestores);
    // All previous loads have settled. Inject failure only for one distinct
    // factory and immediately restore the original loader after its ready fails.
    const originalTextureLoad = T.TextureLoader.prototype.load;
    let failureFallback = false;
    try {
      T.TextureLoader.prototype.load = function(_url, _onLoad, _onProgress, onError) {
        const texture = new T.Texture();
        queueMicrotask(() => onError(new Error('Injected texture failure for isolated QA actor')));
        return texture;
      };
      const failed = createMoebiusTigerModel(() => .5, {anatomy: true, optimizedGeometry: false});
      let observedFailure = false;
      await failed.userData.tigerAnatomy.ready.catch(() => {observedFailure = true;});
      await Promise.resolve();
      const fallbackNodes = nodes(failed);
      failureFallback = observedFailure && failed.userData.tigerAnatomy.textureStatus === 'failed'
        && failed.userData.tigerAnatomy.active === false && fallbackNodes.length === 80
        && source.nodes.every((spec, i) => !spec.geometry || geometryKey(fallbackNodes[i].geometry) === geometryKey(legacyNodes[i].geometry))
        && failed.userData.setTigerAnatomy(true) === false;
      failed.userData.disposeTigerAnatomy?.();
    } finally {T.TextureLoader.prototype.load = originalTextureLoad;}
    check('texture load failure restores original geometry and rejects failed candidate activation', failureFallback);

    const poseRecords = [], pairs = [], union = new T.Box3();
    const animatedIds = ['n1', 'n8', 'n27', 'n28', 'n31', 'n34', 'n37', 'n40', 'n43', 'n46', 'n49', 'n52', 'n59', 'n66', 'n73'];
    const snapshotPose = map => Object.fromEntries(animatedIds.map(id => {
      const n = map.get(id); return [id, [...n.position.toArray(), n.rotation.x, n.rotation.y, n.rotation.z]];
    }));
    const vertex = new T.Vector3();
    const minimumMeshY = meshes => {
      let min = Infinity;
      for (const mesh of meshes) {
        if (!mesh?.geometry || mesh.visible === false) continue;
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          min = Math.min(min, vertex.y);
        }
      }
      return min;
    };
    const states = [{name: 'idle', walking: false, drinking: false}, {name: 'walk', walking: true, drinking: false}, {name: 'drink', walking: false, drinking: true}];
    for (const state of states) {
      const pair = [await make(false), await make(true)];
      const samples = [];
      for (const [variant, model] of pair.entries()) {
        model.userData._walking = state.walking; model.userData._drinking = state.drinking; model.userData._baseY = 0;
        const modelNodes = nodes(model);
        const mapped = variant ? idMap(model) : new Map(source.nodes.map((spec, i) => [spec.id, modelNodes[i]]));
        const restPose = snapshotPose(mapped);
        const posePaws = ['n55', 'n62', 'n69', 'n76'].map(id => mapped.get(id));
        const poseTail = ['n29', 'n32', 'n35', 'n38', 'n41', 'n44', 'n47', 'n50'].map(id => mapped.get(id));
        const visibleMeshes = modelNodes.filter(node => {
          if (!node.isMesh) return false;
          for (let parent = node; parent; parent = parent.parent) if (parent.visible === false) return false;
          return true;
        });
        const baselineTail = model.userData.tailRoot.userData.baseLeanX ?? model.userData.tailRoot.rotation.x;
        let finite = true, maxTailRestDelta = 0, minimumPawY = Infinity, minimumTailY = Infinity, maxLegGroundLift = 0;
        const lowestVisibleVertex = {y: Infinity, node: null, frame: null};
        for (let frame = 0; frame < 120; frame++) {
          model.userData.update(1 / 60, frame / 60); model.updateMatrixWorld(true);
          finite &&= nodes(model).every(n => vecFinite(n.matrixWorld.elements));
          maxTailRestDelta = Math.max(maxTailRestDelta, Math.abs(model.userData.tailRoot.rotation.x - baselineTail));
          minimumPawY = Math.min(minimumPawY, minimumMeshY(posePaws));
          minimumTailY = Math.min(minimumTailY, minimumMeshY(poseTail));
          for (const id of ['n52', 'n59', 'n66', 'n73']) maxLegGroundLift = Math.max(maxLegGroundLift, mapped.get(id).position.y - restPose[id][1]);
          for (const mesh of visibleMeshes) {
            const y = minimumMeshY([mesh]);
            if (y < lowestVisibleVertex.y) Object.assign(lowestVisibleVertex, {y, node: mesh.userData.blenderSourceNode || source.nodes[modelNodes.indexOf(mesh)]?.id, frame});
          }
        }
        const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3());
        finite &&= vecFinite(box.min.toArray()) && vecFinite(box.max.toArray()) && size.length() > .1 && size.length() < 30;
        for (const node of nodes(model)) if (node.geometry) finite &&= Object.values(node.geometry.attributes).every(attr => vecFinite(attr.array));
        union.union(box);
        const currentPose = snapshotPose(mapped);
        const animationDeltas = Object.fromEntries(animatedIds.map(id => [id, currentPose[id].map((v, i) => v - restPose[id][i])]));
        samples.push({anatomy: !!variant, finite, bounds: {min: box.min.toArray(), max: box.max.toArray()}, baselineTail,
          tailX: model.userData.tailRoot.rotation.x, maxTailRestDelta, minimumPawY, minimumTailY,
          finalPawMinima: posePaws.map(paw => minimumMeshY([paw])), lowestVisibleVertex,
          maxLegGroundLift, maxLegGroundLiftWorld: maxLegGroundLift * model.scale.y, animationDeltas});
      }
      check(state.name + ' legacy and v3 matrices, geometry and bounds finite', samples.every(s => s.finite));
      check(state.name + ' v3 tail respects its actual authored rest lean', samples[1].maxTailRestDelta < .06, samples[1]);
      check(state.name + ' v3 tail does not snap to the old minus-45-degree lean',
        Math.abs(samples[1].baselineTail + Math.PI / 4) < .15 || Math.abs(samples[1].tailX + Math.PI / 4) > .15);
      let maxDeltaDifference = 0, maxLegGroundCorrection = 0, legCorrectionValid = true;
      const legIds = ['n52', 'n59', 'n66', 'n73'];
      for (const id of animatedIds) samples[0].animationDeltas[id].forEach((value, i) => {
        const difference = samples[1].animationDeltas[id][i] - value;
        if (legIds.includes(id) && i === 1) {
          maxLegGroundCorrection = Math.max(maxLegGroundCorrection, difference);
          legCorrectionValid &&= difference >= -1e-6 && difference <= .1;
        } else maxDeltaDifference = Math.max(maxDeltaDifference, Math.abs(difference));
      });
      check(state.name + ' preserves callback rotations and translations except bounded paw ground lift',
        maxDeltaDifference < 1e-6 && legCorrectionValid && samples[1].maxLegGroundLift <= .1,
        {maxDeltaDifference, maxLegGroundCorrection, maxLegGroundLiftAcrossCycle: samples[1].maxLegGroundLift});
      check(state.name + ' visible v3 geometry remains above the ground plane', samples[1].lowestVisibleVertex.y >= -1e-6,
        {lowestVisibleVertex: samples[1].lowestVisibleVertex});
      poseRecords.push({state: state.name, samples}); pairs.push({state: state.name, pair});
    }
    // Exercise the existing wrapper, including its callback chained into the factory.
    const roam = {rim: [new T.Vector3(0, 2, 8), new T.Vector3(4, 2, 8)],
      steps: [new T.Vector3(0, 2, 8), new T.Vector3(0, 1, 6), new T.Vector3(0, 0, 4)], drink: new T.Vector3(0, 0, 4), speed: 3};
    const wrapped = await ready(world.createMoebiusTiger(() => .5, roam, {anatomy: true, optimizedGeometry: false}));
    const parent = new T.Group(); parent.add(wrapped); parent.updateMatrixWorld(true);
    const wrapperCallback = wrapped.userData.update;
    check('world wrapper forwards anatomy options and can find the same root', wrapped.userData.tigerAnatomy?.active === true && world.findSwampTiger(parent) === wrapped);
    wrapped.userData.forceDrink = true;
    let sawWalking = false, sawDrinking = false, wrapperFinite = true;
    for (let i = 0; i < 900 && !sawDrinking; i++) {
      wrapped.userData.update(1 / 60, i / 60, {}); wrapped.updateMatrixWorld(true);
      sawWalking ||= !!wrapped.userData._walking; sawDrinking ||= !!wrapped.userData._drinking;
      wrapperFinite &&= vecFinite(wrapped.matrixWorld.elements);
    }
    const headAngle = wrapped.getObjectByName('tiger-head')?.rotation.x;
    wrapped.userData.update(1 / 60, 16, {player: {position: new T.Vector3(1, 0, 1)}});
    check('world patrol-to-drink and greeting callbacks still drive the same tiger', sawWalking && sawDrinking && wrapped.userData._greeting === true && Number.isFinite(headAngle) && wrapperFinite,
      {sawWalking, sawDrinking, greeting: !!wrapped.userData._greeting, headAngle});
    if (wrapped.userData.setTigerAnatomy) {await wrapped.userData.setTigerAnatomy(false); await wrapped.userData.setTigerAnatomy(true); await ready(wrapped);}
    check('anatomy toggle preserves world wrapper callback', wrapped.userData.update === wrapperCallback);
    const dialogCamera = new T.PerspectiveCamera(40, 1, .1, 100); dialogCamera.position.set(0, 4, 12); dialogCamera.lookAt(0, 1, 0);
    const dialogPlayer = {position: wrapped.getWorldPosition(new T.Vector3())};
    const dialog = world.updateSwampTigerDialog({tiger: wrapped, player: dialogPlayer, camera: dialogCamera});
    check('existing riddle dialog still starts', dialog === true && wrapped.userData._dialog.phase === 'tiger');

    // All captures share one camera, ground, lights and dimensions, across poses.
    const center = union.getCenter(new T.Vector3()), span = union.getSize(new T.Vector3()).length();
    const camera = new T.PerspectiveCamera(34, 700 / 630, .01, 150);
    camera.position.copy(center).add(new T.Vector3(1.1, .55, 1.15).normalize().multiplyScalar(span * 1.65));
    camera.lookAt(center); camera.updateMatrixWorld(true);
    const renders = [];
    for (let i = 0; i < 2; i++) {
      const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
      renderer.setPixelRatio(1); renderer.setSize(700, 630); renderer.setClearColor('#a9b8ad');
      renderer.outputColorSpace = T.SRGBColorSpace;
      document.querySelector('main').appendChild(renderer.domElement);
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight(0xffffff, 0x687461, 2.5));
      const key = new T.DirectionalLight(0xfff6e2, 3); key.position.set(4, 8, 7); scene.add(key);
      const fill = new T.DirectionalLight(0xd6e9ff, 1.4); fill.position.set(-5, 3, -4); scene.add(fill);
      const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({color: 0xa9b8ad, roughness: 1}));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.03; scene.add(floor);
      renders.push({renderer, scene, shown: null});
    }
    window.__tigerTestCapture = state => {
      const item = pairs.find(p => p.state === state); if (!item) throw Error('Unknown capture state');
      for (let i = 0; i < 2; i++) {
        const view = renders[i]; if (view.shown) view.scene.remove(view.shown);
        view.shown = item.pair[i]; view.scene.add(view.shown); view.renderer.render(view.scene, camera);
      }
      document.getElementById('caption').textContent = state.toUpperCase() + ' · identical camera and light · 2 seconds of actual factory animation · structural evidence, not visual acceptance';
      return {state, camera: {position: camera.position.toArray(), target: center.toArray(), fov: camera.fov}};
    };
    return {checks, passed: checks.every(c => c.passed), originalNodeCount: ids.size, addedNodeCount: additions.length,
      changedGeometryIds: changedGeometry, poses: poseRecords, visual_approved: false,
      scope: 'isolated real factory and world wrapper callbacks; no full-game or player-controlled acceptance',
      source: {version: tiger.userData.tigerAnatomy?.version, sha256: tiger.userData.tigerAnatomy?.sha256}, screenshots: []};
  }, {base});
  for (const state of ['idle', 'walk', 'drink']) {
    const capture = await page.evaluate(state => window.__tigerTestCapture(state), state);
    const filename = state + '-before-after.png';
    await page.screenshot({path: path.join(output, filename)});
    report.screenshots.push({file: filename, ...capture});
  }
  report.pageErrors = pageErrors; report.networkErrors = networkErrors;
  report.runtimeHashes = initialRuntimeHashes;
  report.runtimeInputsUnchanged = JSON.stringify(initialRuntimeHashes) === JSON.stringify(await runtimeHashes());
  report.passed &&= pageErrors.length === 0 && networkErrors.length === 0 && report.runtimeInputsUnchanged;
  await writeFile(path.join(output, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Tiger v3 browser comparison</title><style>body{margin:30px;background:#edf1ed;color:#203629;font:16px system-ui}img{max-width:100%;display:block;margin:20px 0}p{max-width:900px}</style><h1>Tiger v3: original / revised</h1><p>Matched camera and light. Real factory idle, walk and drink callbacks were advanced for two seconds. This is structural and comparison evidence, not final visual or gameplay approval.</p>${report.screenshots.map(s => `<h2>${s.state}</h2><img src="${s.file}" alt="Original and revised tiger ${s.state}">`).join('')}<p><a href="browser-check.json">Full browser check report</a></p>`);
} catch (error) {
  report = {passed: false, error: String(error.stack || error), pageErrors, networkErrors, visual_approved: false};
} finally {
  await browser.close();
}
await writeFile(path.join(output, 'browser-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({passed: report.passed, checks: report.checks?.length,
  failed: report.checks?.filter(check => !check.passed), error: report.error,
  ground: report.poses?.map(pose => ({state: pose.state, samples: pose.samples.map(sample => ({anatomy: sample.anatomy,
    minimumPawY: sample.minimumPawY, minimumTailY: sample.minimumTailY, lowestVisibleVertex: sample.lowestVisibleVertex,
    maxLegGroundLift: sample.maxLegGroundLift, maxLegGroundLiftWorld: sample.maxLegGroundLiftWorld}))})),
  report: path.join(output, 'browser-check.json')}));
process.exitCode = report.passed ? 0 : 1;
