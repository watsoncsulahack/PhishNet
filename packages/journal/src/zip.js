/** Pure-JS STORE PKZIP reader and writer safe for both Browser and Node.js. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function safeName(name) {
  const s = String(name || '');
  if (!s || s.length > 512 || s.startsWith('/') || s.startsWith('\\') || s.includes('..') || /[\x00-\x1f]/.test(s)) {
    throw Error('Unsafe zip entry name: ' + s);
  }
  return s;
}

export function createZip(entries) {
  if (!Array.isArray(entries) || entries.length > 256) throw Error('Invalid zip entries.');
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = safeName(entry.name);
    const nameBytes = enc.encode(name);
    const data = entry.data instanceof Uint8Array ? entry.data : enc.encode(String(entry.data || ''));
    const sum = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed: 2.0
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // compression: STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true); // fixed deterministic DOS date
    lv.setUint32(14, sum, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, sum, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const out = new Uint8Array(offset + centralSize + eocd.length);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

export function parseZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 22 || bytes.length > 32 * 1024 * 1024) throw Error('Invalid zip archive size.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      const commentLen = view.getUint16(i + 20, true);
      if (i + 22 + commentLen === bytes.length) {
        eocdOffset = i;
        break;
      }
    }
  }
  if (eocdOffset < 0) throw Error('Invalid zip file: missing central directory.');

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (totalEntries > 256 || centralOffset + centralSize > eocdOffset) throw Error('Corrupted zip central directory.');

  const files = new Map();
  let ptr = centralOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > centralOffset + centralSize || view.getUint32(ptr, true) !== 0x02014b50) {
      throw Error('Corrupted zip entry header.');
    }
    const method = view.getUint16(ptr + 10, true);
    if (method !== 0) throw Error('Unsupported zip compression; expected STORE archive exported by PhishNet.');
    const expectedCrc = view.getUint32(ptr + 16, true);
    const compSize = view.getUint32(ptr + 20, true);
    const uncompSize = view.getUint32(ptr + 24, true);
    if (compSize !== uncompSize) throw Error('Zip entry size mismatch.');
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = safeName(dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen)));
    ptr += 46 + nameLen + extraLen + commentLen;

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw Error('Corrupted zip local header for ' + name);
    }
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    if (dataStart + compSize > bytes.length) throw Error('Truncated zip data for ' + name);
    const data = bytes.slice(dataStart, dataStart + compSize);
    if (crc32(data) !== expectedCrc) throw Error('Zip CRC-32 checksum mismatch for ' + name);
    files.set(name, data);
  }
  return files;
}
