// 风格包登记：场景 ID → 风格包。新风格包（莫比斯、蒸汽朋克、湖沼珊瑚、Townscaper、日式苔园）提取后在这里登记。
import morris from './morris.js';
export const STYLE_PACKS = [morris];
export const packForScene = (sceneId) => STYLE_PACKS.find((p) => p.scenes.includes(sceneId)) || null;
