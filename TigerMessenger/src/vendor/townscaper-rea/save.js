/**
 * save.js — the share string.
 *
 * Mirrors Placemaker.TextSaveSystem from the shipped build, which stores the
 * town as a packed bit array and renders it through a 64-symbol alphabet
 * (fields: bitArray, chars, bitsPerCharacter, bitCountBitCount,
 * typeCountBitCount). Same idea here:
 *
 *   [3b version][6b radius]  then run-length records:
 *   [1b occupied][4b height][5b colour]  [5b runLen-1][1b continue]
 *
 * then 6 bits per character. A small island town lands around 60-120 chars.
 */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const ALPHABET_INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

// v4: the grid is now the subdivided-triangle quad grid; older strings index
// cells of the old kite grid and cannot be mapped onto it.
const VERSION = 4;
const BITS_PER_CHAR = 6;

class BitWriter {
  constructor() { this.bits = []; }
  push(value, count) {
    for (let i = count - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  toChars() {
    const chars = [];
    for (let i = 0; i < this.bits.length; i += BITS_PER_CHAR) {
      let v = 0;
      for (let b = 0; b < BITS_PER_CHAR; b++) v = (v << 1) | (this.bits[i + b] ?? 0);
      chars.push(ALPHABET[v]);
    }
    return chars.join('');
  }
}

class BitReader {
  constructor(chars) {
    this.bits = [];
    for (const ch of chars) {
      const v = ALPHABET_INDEX.get(ch);
      if (v === undefined) throw new Error(`unknown symbol "${ch}"`);
      for (let i = BITS_PER_CHAR - 1; i >= 0; i--) this.bits.push((v >> i) & 1);
    }
    this.pos = 0;
  }
  read(count) {
    if (this.pos + count > this.bits.length) throw new Error('save string is truncated');
    let v = 0;
    for (let i = 0; i < count; i++) v = (v << 1) | this.bits[this.pos++];
    return v;
  }
  get exhausted() { return this.pos >= this.bits.length; }
}

export function encodeTown(town) {
  const w = new BitWriter();
  w.push(VERSION & 7, 3);
  w.push(town.grid.radius, 6);

  const masks = town.solid;
  const colors = town.colors;
  const roofs = town.roofColors;
  const n = masks.length;

  let i = 0;
  while (i < n) {
    const mask = masks[i];
    const code = colors[i] + 1;      // -1 -> 0 (unpainted), 0..14 -> 1..15
    const roofCode = roofs[i] + 1;
    let run = 1;
    while (
      i + run < n &&
      masks[i + run] === mask &&
      colors[i + run] + 1 === code &&
      roofs[i + run] + 1 === roofCode
    ) run++;

    if (mask === 0) {
      w.push(0, 1);
    } else {
      w.push(1, 1);
      w.push(mask, 9);   // one bit per level: holes survive a round trip
      w.push(code, 5);
      w.push(roofCode, 5);
    }

    let left = run;
    while (left > 0) {
      const chunk = Math.min(32, left);
      w.push(chunk - 1, 5);
      left -= chunk;
      w.push(left > 0 ? 1 : 0, 1);
    }

    i += run;
  }

  return w.toChars();
}

export function decodeTown(str, town) {
  const r = new BitReader(str.trim());
  const version = r.read(3);
  if (version !== (VERSION & 7)) throw new Error(`unsupported save version ${version}`);
  const radius = r.read(6);
  if (radius !== town.grid.radius) {
    throw new Error(`save was made on a radius ${radius} grid, this one is ${town.grid.radius}`);
  }

  const n = town.solid.length;
  town.solid.fill(0);
  town.colors.fill(-1);
  town.roofColors.fill(-1);

  let i = 0;
  while (i < n) {
    const occupied = r.read(1);
    let mask = 0;
    let code = 0;
    let roofCode = 0;
    if (occupied === 1) {
      mask = r.read(9);
      code = r.read(5);
      roofCode = r.read(5);
    }
    let run = 0;
    let more = 1;
    while (more === 1) {
      run += r.read(5) + 1;
      more = r.read(1);
    }
    for (let k = 0; k < run && i < n; k++, i++) {
      town.solid[i] = mask;
      town.colors[i] = code - 1;
      town.roofColors[i] = roofCode - 1;
    }
  }
  town.version++;
  return town;
}

export { ALPHABET };
