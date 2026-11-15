// r56 C08 · the "Burst job": module Worker that runs the generation pipeline and sleeps by reading
// a SharedArrayBuffer written by the main thread (see pipeline-job-c08.js).
import { runJob, makeJobSleep } from './pipeline-job-c08.js';
self.onmessage = (e) => {
  const { buf, shared, rounds, count } = e.data, ctl = new Int32Array(buf);
  const sleep = makeJobSleep(ctl, { shared });
  runJob({ post: (m) => self.postMessage(m), sleep, rounds, count });
};
