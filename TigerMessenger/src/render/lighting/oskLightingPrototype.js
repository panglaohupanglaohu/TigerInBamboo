import * as THREE from "three";

const PHASES = Object.freeze({
  noon: Object.freeze({
    background: 0x79c8c1,
    sunColor: 0xffe2b9,
    sunIntensity: 1.7,
    skyColor: 0xd8f2ef,
    groundColor: 0xb6a790,
    hemiIntensity: 0.96,
    ambientIntensity: 0.25,
    worldDirection: Object.freeze([0.6, 0.72, 0.35]),
  }),
  sunset: Object.freeze({
    background: 0xb87982,
    sunColor: 0xff9b62,
    sunIntensity: 1.5,
    skyColor: 0xaab5ca,
    groundColor: 0x8c7164,
    hemiIntensity: 0.76,
    ambientIntensity: 0.18,
    worldDirection: Object.freeze([-0.2, 0.38, 0.9]),
  }),
  night: Object.freeze({
    // 参考图夜港（2026-08-28）：深蓝夜空 + 蓝调月夜氛围，不再死黑
    background: 0x24406e,
    sunColor: 0x8aa8e6,
    sunIntensity: 0.3,
    skyColor: 0x35507e,
    groundColor: 0x1a2438,
    hemiIntensity: 0.52,
    ambientIntensity: 0.13,
    worldDirection: Object.freeze([-0.25, 0.65, 0.7]),
  }),
});

const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();
const _toLight = new THREE.Vector3();
const _corner = new THREE.Vector3();

function phaseByName(name) {
  return PHASES[name] || PHASES.noon;
}

function isShadowMaterial(material) {
  if (!material || material.visible === false || material.transparent) return false;
  if (material.isMeshBasicMaterial || material.side === THREE.BackSide) return false;
  return true;
}

function prepareShadowCasters(root) {
  root?.traverse?.((object) => {
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some(isShadowMaterial)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function chooseWorldSunDirection(phase, out) {
  return out.fromArray(phase.worldDirection).normalize();
}

function lightSpaceBounds(box, camera) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        _corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        minX = Math.min(minX, _corner.x);
        minY = Math.min(minY, _corner.y);
        minZ = Math.min(minZ, _corner.z);
        maxX = Math.max(maxX, _corner.x);
        maxY = Math.max(maxY, _corner.y);
        maxZ = Math.max(maxZ, _corner.z);
      }
    }
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/**
 * shot-harness 专用的 OskSta 风格光照垂直样片。
 * 只验证一个主光、受控天光和稳定阴影；不冒充完整体素 AO/GI。
 */
export function createOskLightingPrototype({
  scene,
  renderer,
  legacyLights = [],
  shadowMapSize = 1024,
} = {}) {
  if (!scene || !renderer) throw new Error("lighting prototype requires scene and renderer");

  const legacyRenderer = {
    shadowEnabled: renderer.shadowMap.enabled,
    shadowType: renderer.shadowMap.type,
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    outputColorSpace: renderer.outputColorSpace,
  };
  const legacyBackground = scene.background?.isColor ? scene.background.clone() : null;

  const root = new THREE.Group();
  root.name = "osk-lighting-prototype";
  root.visible = false;
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xffffff, PHASES.noon.ambientIntensity);
  ambient.name = "osk-ambient-floor";
  root.add(ambient);

  const hemi = new THREE.HemisphereLight(
    PHASES.noon.skyColor,
    PHASES.noon.groundColor,
    PHASES.noon.hemiIntensity
  );
  hemi.name = "osk-sky-ground-fill";
  root.add(hemi);

  const sun = new THREE.DirectionalLight(PHASES.noon.sunColor, PHASES.noon.sunIntensity);
  sun.name = "osk-key-sun";
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.025;
  root.add(sun);
  root.add(sun.target);

  let mode = "legacy";
  let phaseName = "noon";
  let fittedObject = null;
  let fittedCamera = null;
  let lastFit = null;

  function applyPhase(name = phaseName) {
    phaseName = PHASES[name] ? name : "noon";
    const phase = phaseByName(phaseName);
    ambient.intensity = phase.ambientIntensity;
    hemi.color.setHex(phase.skyColor);
    hemi.groundColor.setHex(phase.groundColor);
    hemi.intensity = phase.hemiIntensity;
    sun.color.setHex(phase.sunColor);
    sun.intensity = phase.sunIntensity;
    if (scene.background?.isColor) scene.background.setHex(phase.background);
    if (fittedObject && fittedCamera) fitShadowToObject(fittedObject, fittedCamera);
  }

  function fitShadowToObject(object, camera, padding = 1.16) {
    if (!object || !camera) return null;
    fittedObject = object;
    fittedCamera = camera;
    object.updateWorldMatrix?.(true, true);
    _box.setFromObject(object);
    if (_box.isEmpty()) return null;
    _box.getCenter(_center);
    _box.getSize(_size);
    const radius = Math.max(_size.length() * 0.5, 1);
    const phase = phaseByName(phaseName);
    chooseWorldSunDirection(phase, _toLight);

    sun.target.position.copy(_center);
    sun.position.copy(_center).addScaledVector(_toLight, radius * 3.2);
    sun.target.updateMatrixWorld(true);
    sun.updateMatrixWorld(true);
    sun.shadow.updateMatrices(sun);

    const bounds = lightSpaceBounds(_box, sun.shadow.camera);
    const width = Math.max((bounds.maxX - bounds.minX) * padding, 1);
    const height = Math.max((bounds.maxY - bounds.minY) * padding, 1);
    const span = Math.max(width, height);
    const texel = span / shadowMapSize;
    const centerX = Math.round(((bounds.minX + bounds.maxX) * 0.5) / texel) * texel;
    const centerY = Math.round(((bounds.minY + bounds.maxY) * 0.5) / texel) * texel;
    const cameraShadow = sun.shadow.camera;
    cameraShadow.left = centerX - span * 0.5;
    cameraShadow.right = centerX + span * 0.5;
    cameraShadow.bottom = centerY - span * 0.5;
    cameraShadow.top = centerY + span * 0.5;
    cameraShadow.near = Math.max(0.1, -bounds.maxZ - radius * 0.2);
    cameraShadow.far = Math.max(cameraShadow.near + 1, -bounds.minZ + radius * 0.2);
    cameraShadow.updateProjectionMatrix();

    lastFit = Object.freeze({
      span,
      texel,
      near: cameraShadow.near,
      far: cameraShadow.far,
      center: _center.toArray(),
      sunDirection: _toLight.toArray(),
    });
    return lastFit;
  }

  function setMode(nextMode = "legacy", nextPhase = phaseName) {
    mode = nextMode === "prototype" ? "prototype" : "legacy";
    const active = mode === "prototype";
    root.visible = active;
    for (const light of legacyLights) light.visible = !active;
    if (active) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.BasicShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1;
      prepareShadowCasters(fittedObject);
      applyPhase(nextPhase);
    } else {
      renderer.shadowMap.enabled = legacyRenderer.shadowEnabled;
      renderer.shadowMap.type = legacyRenderer.shadowType;
      renderer.toneMapping = legacyRenderer.toneMapping;
      renderer.toneMappingExposure = legacyRenderer.exposure;
      renderer.outputColorSpace = legacyRenderer.outputColorSpace;
      if (legacyBackground && scene.background?.isColor) scene.background.copy(legacyBackground);
    }
    return getState();
  }

  function attach(object, camera) {
    fittedObject = object;
    fittedCamera = camera;
    if (mode === "prototype") {
      prepareShadowCasters(object);
      fitShadowToObject(object, camera);
    }
  }

  function getState() {
    return {
      mode,
      phase: phaseName,
      ambient: ambient.intensity,
      hemisphere: hemi.intensity,
      sun: sun.intensity,
      shadowMapSize,
      fit: lastFit,
    };
  }

  return { root, ambient, hemi, sun, attach, setMode, applyPhase, fitShadowToObject, getState };
}
