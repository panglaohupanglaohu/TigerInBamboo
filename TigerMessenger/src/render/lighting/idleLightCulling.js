// =====================================================================
// 空闲灯剔除（2026-09-02 实测：78 盏点光/聚光 = 140ms / 62% 帧时间）
//
// Three.js 里 intensity = 0 的灯【依然】占据 lights uniform 槽位、依然参与
// 每个片元的光照循环；只有 visible = false 才会被 projectObject 排除。
// 而本项目大量灯是「创建时 intensity=0，夜里才调亮」的模式
// （highlandLightVolumes / harbor 火把 / 闪电 / 玩家光环 / 苔庭光柱…），
// 白天视觉贡献为零、成本全额收取。
//
// 本模块只做一件事：强度≈0 的灯 visible=false，强度回升时还原。
// 视觉零变化（强度 0 本来就不可见）。
//
// 迟滞是必需的：灯数变化会触发 Three 重新编译材质，
// 在阈值附近抖动会造成编译风暴（正是进场卡顿的成因之一）。
// =====================================================================

export const IDLE_LIGHT_CULLING_SCHEMA_VERSION = 1;

export function createIdleLightCulling({
  scene,
  offBelow = 0.002, // 低于此值熄灭
  onAbove = 0.02, // 高于此值点亮（与 offBelow 拉开形成迟滞）
  interval = 0.25, // 扫描节流（秒）
  recollectInterval = 5, // 重新收集灯列表的间隔（秒），应对运行时新增灯
} = {}) {
  if (!scene) throw new Error("idle light culling requires scene");

  let lights = [];
  const culled = new Set(); // 只还原「我们熄的」，不碰别人主动隐藏的灯
  let sinceScan = 0;
  let sinceCollect = Infinity;
  let lastActive = 0;

  const collect = () => {
    lights = [];
    scene.traverse((o) => {
      // 方向光/环境光/半球光数量少且常亮，不参与
      if (o.isPointLight || o.isSpotLight) lights.push(o);
    });
    sinceCollect = 0;
  };

  const update = (dt) => {
    const step = Math.max(0, Number(dt) || 0);
    sinceCollect += step;
    sinceScan += step;
    if (sinceCollect >= recollectInterval) collect();
    if (sinceScan < interval) return;
    sinceScan = 0;

    let active = 0;
    for (const light of lights) {
      const intensity = Number(light.intensity) || 0;
      if (light.visible && intensity <= offBelow) {
        light.visible = false;
        culled.add(light);
      } else if (!light.visible && culled.has(light) && intensity >= onAbove) {
        light.visible = true;
        culled.delete(light);
      }
      if (light.visible) active += 1;
    }
    lastActive = active;
  };

  const dispose = () => {
    for (const light of culled) light.visible = true;
    culled.clear();
    lights = [];
  };

  collect();
  return {
    update,
    dispose,
    recollect: collect,
    get trackedCount() {
      return lights.length;
    },
    get activeCount() {
      return lastActive;
    },
    get culledCount() {
      return culled.size;
    },
    schemaVersion: IDLE_LIGHT_CULLING_SCHEMA_VERSION,
  };
}
