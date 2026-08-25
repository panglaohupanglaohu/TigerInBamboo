// =====================================================================
//  BitSet — WFC 候选域的位集存储（V7-G1）
//  基于 Uint32Array；热循环（andInto/orInto/andNotInto/popcount）零临时
//  JS 数组分配。最后 word 的有效位由 mask 保证：模块数 1/31/32/33/63/64/65
//  时 has/set/clear/popcount/迭代均不越界、不读到填充位。
//  纯数据，禁止 import Three.js / DOM。
// =====================================================================

/** 末 word 有效位 mask：size 不是 32 倍数时屏蔽填充位 */
function tailMask(size) {
  const rem = size & 31;
  return rem === 0 ? 0xffffffff : (1 << rem) - 1;
}

export class BitSet {
  /**
   * @param {number} size 位总数（= 模块 variant 数）
   * @param {boolean} fill true=全 1（全候选），false=全 0（空域）
   */
  constructor(size, fill = false) {
    size = size >>> 0;
    if (size <= 0) throw new Error(`BitSet size must be > 0, got ${size}`);
    this.size = size;
    this.words = new Uint32Array((size + 31) >>> 5);
    this._tailMask = tailMask(size);
    if (fill) this.words.fill(0xffffffff);
    if (fill && this._tailMask !== 0xffffffff) {
      this.words[this.words.length - 1] = this._tailMask;
    }
  }

  /** 全部置位（受 tail mask 约束） */
  setAll() {
    this.words.fill(0xffffffff);
    if (this._tailMask !== 0xffffffff) {
      this.words[this.words.length - 1] = this._tailMask;
    }
    return this;
  }

  /** 全部清零 */
  clearAll() {
    this.words.fill(0);
    return this;
  }

  /** 深拷贝 */
  clone() {
    const out = new BitSet(this.size, false);
    out.words.set(this.words);
    return out;
  }

  /** 从 other 复制（尺寸必须一致） */
  copyFrom(other) {
    if (other.size !== this.size) throw new Error(`BitSet copyFrom size mismatch ${this.size} vs ${other.size}`);
    this.words.set(other.words);
    return this;
  }

  has(bit) {
    if (bit < 0 || bit >= this.size) return false;
    return (this.words[bit >>> 5] & (1 << (bit & 31))) !== 0;
  }

  set(bit) {
    if (bit < 0 || bit >= this.size) throw new Error(`BitSet set out of range ${bit}/${this.size}`);
    this.words[bit >>> 5] |= 1 << (bit & 31);
    return this;
  }

  clear(bit) {
    if (bit < 0 || bit >= this.size) throw new Error(`BitSet clear out of range ${bit}/${this.size}`);
    this.words[bit >>> 5] &= ~(1 << (bit & 31));
    return this;
  }

  /** this &= other（原地） */
  andInto(other) {
    const w = Math.min(this.words.length, other.words.length);
    for (let i = 0; i < w; i++) this.words[i] &= other.words[i];
    return this;
  }

  /** this |= other（原地） */
  orInto(other) {
    const w = Math.min(this.words.length, other.words.length);
    for (let i = 0; i < w; i++) this.words[i] |= other.words[i];
    if (this._tailMask !== 0xffffffff) {
      this.words[this.words.length - 1] &= this._tailMask;
    }
    return this;
  }

  /** this &= ~other（原地） */
  andNotInto(other) {
    const w = Math.min(this.words.length, other.words.length);
    for (let i = 0; i < w; i++) this.words[i] &= ~other.words[i];
    return this;
  }

  equals(other) {
    if (other.size !== this.size) return false;
    for (let i = 0; i < this.words.length; i++) {
      if (this.words[i] !== other.words[i]) return false;
    }
    return true;
  }

  intersects(other) {
    const w = Math.min(this.words.length, other.words.length);
    for (let i = 0; i < w; i++) {
      if ((this.words[i] & other.words[i]) !== 0) return true;
    }
    return false;
  }

  /** 置位数量 */
  popcount() {
    let n = 0;
    const last = this.words.length - 1;
    for (let i = 0; i < last; i++) n += popcount32(this.words[i]);
    if (last >= 0) n += popcount32(this.words[last] & this._tailMask);
    return n;
  }

  /** 最小置位下标；空集返回 -1 */
  firstSetBit() {
    for (let i = 0; i < this.words.length; i++) {
      const v = this.words[i] & (i === this.words.length - 1 ? this._tailMask : 0xffffffff);
      if (v !== 0) return (i << 5) | ntz32(v);
    }
    return -1;
  }

  /** 稳定升序迭代置位下标 */
  forEachSetBit(fn) {
    const last = this.words.length - 1;
    for (let i = 0; i < this.words.length; i++) {
      let v = this.words[i] & (i === last ? this._tailMask : 0xffffffff);
      while (v !== 0) {
        const b = ntz32(v);
        fn((i << 5) | b);
        v &= v - 1;
      }
    }
  }

  /** 升序置位下标数组（调试/序列化用；热循环请用 forEachSetBit） */
  toArray() {
    const out = [];
    this.forEachSetBit((b) => out.push(b));
    return out;
  }

  /** 位图十六进制指纹（canonical hash 友好） */
  toHashString() {
    let s = "";
    for (let i = 0; i < this.words.length; i++) s += this.words[i].toString(16).padStart(8, "0");
    return s;
  }
}

/** 单字 popcount（SWAR） */
export function popcount32(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  v = (v + (v >>> 4)) & 0x0f0f0f0f;
  return (Math.imul(v, 0x01010101) >>> 24) & 0x3f;
}

/** 单字尾零（ntz）；v≠0 */
export function ntz32(v) {
  if (v === 0) return 32;
  return 31 - Math.clz32(v & -v);
}

/** 便利构造：从下标数组 */
export function bitSetOf(size, bits) {
  const out = new BitSet(size, false);
  for (const b of bits) out.set(b);
  return out;
}
