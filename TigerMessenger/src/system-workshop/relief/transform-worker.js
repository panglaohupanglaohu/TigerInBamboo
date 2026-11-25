// 地貌管线 · 改造 Worker：PipeLineEngine 在采样（擂台岛或游戏实景）上执行 relief 能力库（src/system-workshop/relief/capabilities.js）。
// worker-host 带本层版本号引入：它再带版本号引入 worker-adapters.js（里面登记了 relief 适配器），避免浏览器用旧副本。
import { installPipeLineWorker } from '../../pipeline-engine/worker-host.js?v=relief-r1';
installPipeLineWorker('relief');
