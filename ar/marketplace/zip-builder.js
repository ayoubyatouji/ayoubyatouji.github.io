const encoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function asBytes(value) {
  if (typeof value === "string") return encoder.encode(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError("ZIP file content must be text, Uint8Array, or ArrayBuffer.");
}

function validateName(name) {
  if (typeof name !== "string" || !name.trim()) throw new TypeError("ZIP file names must be non-empty strings.");
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.split("/").includes("..")) {
    throw new TypeError(`ZIP file path is not allowed: ${name}`);
  }
  return normalized;
}

function makeHeader(length, signature) {
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  view.setUint32(0, signature, true);
  return { buffer, view };
}

export function createZip(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new TypeError("At least one file is required to create a ZIP archive.");
  }
  if (files.length > 0xffff) throw new RangeError("ZIP archive supports at most 65,535 files.");

  const seen = new Set();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const file of files) {
    const name = validateName(file?.name);
    if (seen.has(name)) throw new TypeError(`Duplicate ZIP file path: ${name}`);
    seen.add(name);

    const nameBytes = encoder.encode(name);
    const content = asBytes(file.content);
    if (nameBytes.length > 0xffff || content.length > 0xffffffff || localOffset > 0xffffffff) {
      throw new RangeError("ZIP file exceeds the supported ZIP32 size limits.");
    }
    const checksum = crc32(content);

    const local = makeHeader(30 + nameBytes.length, 0x04034b50);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint16(10, 0, true);
    local.view.setUint16(12, 0, true);
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, content.length, true);
    local.view.setUint32(22, content.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    local.view.setUint16(28, 0, true);
    const localBytes = new Uint8Array(local.buffer);
    localBytes.set(nameBytes, 30);
    localParts.push(localBytes, content);

    const central = makeHeader(46 + nameBytes.length, 0x02014b50);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint16(12, 0, true);
    central.view.setUint16(14, 0, true);
    central.view.setUint32(16, checksum, true);
    central.view.setUint32(20, content.length, true);
    central.view.setUint32(24, content.length, true);
    central.view.setUint16(28, nameBytes.length, true);
    central.view.setUint16(30, 0, true);
    central.view.setUint16(32, 0, true);
    central.view.setUint16(34, 0, true);
    central.view.setUint16(36, 0, true);
    central.view.setUint32(38, 0, true);
    central.view.setUint32(42, localOffset, true);
    const centralBytes = new Uint8Array(central.buffer);
    centralBytes.set(nameBytes, 46);
    centralParts.push(centralBytes);

    localOffset += localBytes.length + content.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  if (localOffset > 0xffffffff || centralSize > 0xffffffff) {
    throw new RangeError("ZIP archive exceeds the supported ZIP32 size limits.");
  }

  const end = makeHeader(22, 0x06054b50);
  end.view.setUint16(4, 0, true);
  end.view.setUint16(6, 0, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, localOffset, true);
  end.view.setUint16(20, 0, true);

  const totalLength = localOffset + centralSize + 22;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, new Uint8Array(end.buffer)]) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
