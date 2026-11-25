// 建筑管线 · 改造 Worker：PipeLineEngine 在采样高度场的副本上执行建筑能力库（building/capabilities.js → 重构库 prefab-socket.js）。
// worker-host 带本层版本号引入：它再带版本号引入 worker-adapters.js（里面登记了 building 适配器），避免浏览器用旧副本。
import { installPipeLineWorker } from '../../pipeline-engine/worker-host.js?v=building-r1';
installPipeLineWorker('building');
