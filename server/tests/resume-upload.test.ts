import assert = require("node:assert/strict");
import test = require("node:test");
import fs = require("node:fs/promises");
import path = require("node:path");
import os = require("node:os");
import zlib = require("node:zlib");
import express = require("express");
import createResumeUploadRoutes = require("../src/routes/resume-upload.routes");
import errorHandler = require("../src/middleware/error-handler");
import policy = require("../src/validation/resume-file.mjs");
import createApp = require("../src/app");
import process = require("node:process");

function zip(parts: Record<string, string>): Buffer {
  const locals: Buffer[] = [], entries: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const filename = Buffer.from(name), content = Buffer.from(text), compressed = zlib.deflateRawSync(content);
    const crc = zlib.crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, compressed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(compressed.length, 20); entry.writeUInt32LE(content.length, 24);
    entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(offset, 42);
    entries.push(entry, filename); offset += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(entries), end = Buffer.alloc(22), count = Object.keys(parts).length;
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

test("Resume transport stores PDF/DOCX in an isolated directory and serves exact bytes", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nexthire-resume-test-"));
  const app = express();
  app.use("/api/resumes", createResumeUploadRoutes(directory));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  const upload = (name: string, data: Buffer, type = "application/octet-stream") => fetch(base + "/api/resumes", {
    method: "POST", headers: { "Content-Type": type, "X-File-Name": encodeURIComponent(name) }, body: new Uint8Array(data),
  });
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
  const docx = zip({
    "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Test resume</w:t></w:r></w:p></w:body></w:document>',
  });
  try {
    await t.test("Valid documents round-trip, original names cannot control storage paths", async () => {
      for (const [name, bytes] of [["../../קורות חיים.pdf", pdf], ["resume.docx", docx]] as const) {
        const response = await upload(name, bytes);
        assert.equal(response.status, 201);
        const saved = await response.json();
        assert.match(saved.path, /^\/api\/resumes\/[a-f0-9-]{36}\.(pdf|docx)$/);
        const download = await fetch(base + saved.path);
        assert.equal(download.status, 200);
        assert.equal(download.headers.get("x-content-type-options"), "nosniff");
        assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
      }
      assert.equal((await fs.readdir(directory)).length, 2);
    });
    await t.test("Empty, oversized, renamed, unsupported and non-Word ZIP files are rejected without saving", async () => {
      const cases = [
        ["resume.pdf", Buffer.alloc(0), 400],
        ["resume.pdf", Buffer.alloc(policy.MAX_RESUME_BYTES + 1), 413],
        ["resume.exe", pdf, 400], ["resume.doc", pdf, 400],
        ["resume.pdf", Buffer.from("not a PDF"), 415],
        ["resume.docx", pdf, 415],
        ["resume.docx", zip({ "hello.txt": "ordinary ZIP" }), 415],
      ] as const;
      for (const [name, bytes, status] of cases) assert.equal((await upload(name, bytes)).status, status);
      assert.equal((await upload("resume.pdf", pdf, "text/plain")).status, 415);
      assert.equal((await fs.readdir(directory)).length, 2);
    });
    await t.test("Missing files and traversal paths return 404", async () => {
      const missing = await fetch(base + "/api/resumes/00000000-0000-0000-0000-000000000000.pdf");
      assert.equal(missing.status, 404);
      assert.match(missing.headers.get("content-type") ?? "", /json/);
      assert.equal((await fetch(base + "/api/resumes/%2e%2e%2f.env")).status, 404);
    });
  } finally {
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
    const resolved = await fs.realpath(directory);
    assert.equal(resolved, path.resolve(directory));
    assert.equal(path.dirname(resolved), await fs.realpath(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("nexthire-resume-test-"));
    await fs.rm(resolved, { recursive: true, force: true });
  }
});
test("Development upload routes are not exposed in production", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  let app: express.Express;
  try { app = createApp(); }
  finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    assert.equal((await fetch("http://127.0.0.1:" + address.port + "/api/resumes", { method: "POST" })).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  }
});
