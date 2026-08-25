// =====================================================================
// ScalarField — 稠密标量场的坐标/采样契约（V7-G7）
// bounds 使用世界坐标；网格索引顺序 x 最快、再 y、再 z，与 MC 输出一致。
// 纯数据，可在主线程/Worker 使用，不依赖 Three.js。
// =====================================================================

function vec3(value, name) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => !Number.isFinite(n))) throw new Error(`${name} must be a finite vec3`);
  return value.slice();
}

export class ScalarField {
  constructor({ min, max, resolution, data, sample, semantics = null, flow = null } = {}) {
    this.min = vec3(min, "min");
    this.max = vec3(max, "max");
    if (this.max.some((n, i) => n <= this.min[i])) throw new Error("ScalarField max must be greater than min");
    const resolutionObject = typeof resolution === "number" ? { x: resolution, y: resolution, z: resolution } : resolution;
    const nx = resolutionObject?.x >>> 0; const ny = resolutionObject?.y >>> 0; const nz = resolutionObject?.z >>> 0;
    if (nx < 2 || ny < 2 || nz < 2) throw new Error("ScalarField resolution must be >= 2 on every axis");
    this.resolution = Object.freeze({ x: nx, y: ny, z: nz });
    this.count = nx * ny * nz;
    this.spacing = Object.freeze([0, 1, 2].map((i) => (this.max[i] - this.min[i]) / (this.resolution[["x", "y", "z"][i]] - 1)));
    this.data = data ? Float32Array.from(data) : new Float32Array(this.count);
    if (this.data.length !== this.count) throw new Error(`ScalarField data length ${this.data.length} != ${this.count}`);
    this.semantics = semantics ? Uint8Array.from(semantics) : null;
    if (this.semantics && this.semantics.length !== this.count) throw new Error("ScalarField semantics length mismatch");
    // flow/tangent 通道（TODO 1181）：每采样点 3 分量，为瀑布/岸线/UV 方向提供稳定数据
    this.flow = flow ? Float32Array.from(flow) : null;
    if (this.flow && this.flow.length !== this.count * 3) throw new Error("ScalarField flow length mismatch");
    if (typeof sample === "function") this.fill(sample);
    Object.freeze(this.resolution);
  }

  index(x, y, z) {
    return (z * this.resolution.y + y) * this.resolution.x + x;
  }

  coords(index) {
    const x = index % this.resolution.x;
    const yz = (index - x) / this.resolution.x;
    const y = yz % this.resolution.y;
    return [x, y, (yz - y) / this.resolution.y];
  }

  worldPosition(x, y, z) {
    return [this.min[0] + x * this.spacing[0], this.min[1] + y * this.spacing[1], this.min[2] + z * this.spacing[2]];
  }

  valueAt(x, y, z) {
    if (x < 0 || x >= this.resolution.x || y < 0 || y >= this.resolution.y || z < 0 || z >= this.resolution.z) return undefined;
    return this.data[this.index(x, y, z)];
  }

  flowAt(x, y, z) {
    if (!this.flow) return null;
    if (x < 0 || x >= this.resolution.x || y < 0 || y >= this.resolution.y || z < 0 || z >= this.resolution.z) return null;
    const i = this.index(x, y, z) * 3;
    return [this.flow[i], this.flow[i + 1], this.flow[i + 2]];
  }

  sampleWorld(position, outside = 0) {
    const p = vec3(position, "position");
    const grid = p.map((value, i) => (value - this.min[i]) / this.spacing[i]);
    const x0 = Math.floor(grid[0]); const y0 = Math.floor(grid[1]); const z0 = Math.floor(grid[2]);
    if (x0 < 0 || y0 < 0 || z0 < 0 || x0 >= this.resolution.x - 1 || y0 >= this.resolution.y - 1 || z0 >= this.resolution.z - 1) return outside;
    const tx = grid[0] - x0; const ty = grid[1] - y0; const tz = grid[2] - z0;
    const c = (dx, dy, dz) => this.valueAt(x0 + dx, y0 + dy, z0 + dz);
    const a = c(0, 0, 0) * (1 - tx) + c(1, 0, 0) * tx;
    const b = c(0, 1, 0) * (1 - tx) + c(1, 1, 0) * tx;
    const d = c(0, 0, 1) * (1 - tx) + c(1, 0, 1) * tx;
    const e = c(0, 1, 1) * (1 - tx) + c(1, 1, 1) * tx;
    return (a * (1 - ty) + b * ty) * (1 - tz) + (d * (1 - ty) + e * ty) * tz;
  }

  fill(sample) {
    for (let z = 0; z < this.resolution.z; z++) for (let y = 0; y < this.resolution.y; y++) for (let x = 0; x < this.resolution.x; x++) {
      const value = sample(this.worldPosition(x, y, z), x, y, z);
      if (!Number.isFinite(value)) throw new Error(`ScalarField sampler returned non-finite at ${x},${y},${z}`);
      this.data[this.index(x, y, z)] = value;
    }
    return this;
  }

  map(fn) {
    const output = new ScalarField({ min: this.min, max: this.max, resolution: this.resolution, semantics: this.semantics });
    for (let i = 0; i < this.count; i++) output.data[i] = fn(this.data[i], this.worldPosition(...this.coords(i)), i);
    return output;
  }

  combine(other, fn) {
    if (other.count !== this.count || other.resolution.x !== this.resolution.x || other.resolution.y !== this.resolution.y || other.resolution.z !== this.resolution.z) throw new Error("ScalarField combine requires equal grids");
    return this.map((value, position, i) => fn(value, other.data[i], position, i));
  }

  minMax() {
    let min = Infinity; let max = -Infinity;
    for (const value of this.data) { min = Math.min(min, value); max = Math.max(max, value); }
    return { min, max };
  }
}

export function createScalarField(options) { return new ScalarField(options); }
