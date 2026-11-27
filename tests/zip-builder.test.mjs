import assert from "node:assert/strict";
import test from "node:test";
import { createZip } from "../marketplace/zip-builder.js";

function entriesFromZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = new TextDecoder();
  const entries = [];
  let offset = 0;

  while (view.getUint32(offset, true) === 0x04034b50) {
    const checksum = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = text.decode(bytes.subarray(nameStart, nameStart + nameLength));
    const contentStart = nameStart + nameLength + extraLength;
    entries.push({
      name,
      checksum,
      content: text.decode(bytes.subarray(contentStart, contentStart + size))
    });
    offset = contentStart + size;
  }
  return { entries, centralOffset: offset };
}

test("creates a valid ZIP with UTF-8 paths and readable file contents", () => {
  const archive = createZip([
    { name: "resources/guide.md", content: "Bonjour, AI Hub." },
    { name: "configuration/échantillon.json", content: '{"safe":true}' }
  ]);
  const { entries, centralOffset } = entriesFromZip(archive);
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, "resources/guide.md");
  assert.equal(entries[0].content, "Bonjour, AI Hub.");
  assert.equal(entries[0].checksum, 0x16e8e701);
  assert.equal(entries[1].name, "configuration/échantillon.json");
  assert.equal(entries[1].content, '{"safe":true}');
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
  assert.equal(view.getUint32(archive.length - 22, true), 0x06054b50);
});

test("rejects unsafe and duplicate archive paths", () => {
  assert.throws(() => createZip([{ name: "../outside.txt", content: "x" }]), /not allowed/);
  assert.throws(() => createZip([
    { name: "same.txt", content: "one" },
    { name: "same.txt", content: "two" }
  ]), /Duplicate/);
});
