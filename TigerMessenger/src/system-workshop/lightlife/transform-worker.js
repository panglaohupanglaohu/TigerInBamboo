// 光影与生命管线 · 改造 Worker：PipeLineEngine 在扫描到的场景采样上执行 lightlife 能力库（src/system-workshop/lightlife/capabilities.js）。
// worker-host 带版本号引入：它再带版本号引入 worker-adapters.js（里面登记了 lightlife 适配器），避免浏览器用旧副本。
import { installPipeLineWorker } from '../../pipeline-engine/worker-host.js?v=light-r65';
installPipeLineWorker('lightlife');
