import zlib = require("node:zlib");
import policy = require("../validation/resume-file.mjs");

// Inspect signatures/Word package structure without extracting an archive to disk.
// This is format validation, not an antivirus scanner or a full document parser.
function wordPackagePart(data: Buffer, wanted: string): Buffer | undefined {
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50 && i + 22 + data.readUInt16LE(i + 20) === data.length) { end = i; break; }
  }
  if (end < 0 || data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6)) return undefined;
  const count = data.readUInt16LE(end + 10);
  const directorySize = data.readUInt32LE(end + 12);
  let offset = data.readUInt32LE(end + 16);
  if (count === 0xffff || offset + directorySize !== end) return undefined;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || data.readUInt32LE(offset) !== 0x02014b50) return undefined;
    const nameLength = data.readUInt16LE(offset + 28);
    const next = offset + 46 + nameLength + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32);
    if (next > end) return undefined;
    const name = data.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name === wanted) {
      const flags = data.readUInt16LE(offset + 8);
      const method = data.readUInt16LE(offset + 10);
      const compressed = data.readUInt32LE(offset + 20), expanded = data.readUInt32LE(offset + 24);
      const local = data.readUInt32LE(offset + 42);
      if ((flags & 1) || expanded > policy.MAX_RESUME_BYTES || local + 30 > offset ||
          data.readUInt32LE(local) !== 0x04034b50) return undefined;
      const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
      if (start + compressed > offset) return undefined;
      const bytes = data.subarray(start, start + compressed);
      const result = method === 0 ? bytes : method === 8
        ? zlib.inflateRawSync(bytes, { maxOutputLength: policy.MAX_RESUME_BYTES }) : undefined;
      return result?.length === expanded ? result : undefined;
    }
    offset = next;
  }
  return undefined;
}

function matchesResumeFormat(data: Buffer, extension: "pdf" | "docx"): boolean {
  if (extension === "pdf") {
    return /^%PDF-(?:1\.[0-9]|2\.0)/.test(data.toString("ascii", 0, 8)) &&
      /%%EOF\s*$/.test(data.subarray(-1024).toString("ascii"));
  }
  try {
    if (data.length < 22 || data.readUInt32LE(0) !== 0x04034b50) return false;
    const types = wordPackagePart(data, "[Content_Types].xml")?.toString("utf8");
    const document = wordPackagePart(data, "word/document.xml")?.toString("utf8");
    return Boolean(types?.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml") &&
      document && /<(?:[\w.-]+:)?document[\s>]/.test(document) &&
      document.includes("wordprocessingml/2006/main"));
  } catch { return false; }
}
export = matchesResumeFormat;
