// 十二门徒地形管线 · 改造 Worker：PipeLineEngine 在扫描到的实景采样上执行 apostles-terrain 能力库（src/system-workshop/apostles-terrain/capabilities.js）。
// worker-host 带版本号引入：它再带版本号引入 worker-adapters.js（里面登记了 apostles-terrain 适配器），避免浏览器用旧副本。
import { installPipeLineWorker } from '../../pipeline-engine/worker-host.js?v=apt-r1';
installPipeLineWorker('apostles-terrain');
