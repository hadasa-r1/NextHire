import assert = require("node:assert/strict");
import test = require("node:test");
import fs = require("node:fs/promises");
import path = require("node:path");
import os = require("node:os");
import process = require("node:process");
import express = require("express");
import createRoutes = require("../src/routes/candidate-photo.routes");
import createApp = require("../src/app");
import errorHandler = require("../src/middleware/error-handler");
import rules = require("../src/validation/field-rules.mjs");

test("Candidate photos round-trip and reject unsupported, oversized or disguised files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nexthire-photo-test-"));
  const app = express();
  app.use("/api/candidate-photos", createRoutes(directory));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  const upload = (name: string, bytes: Buffer) => fetch(base + "/api/candidate-photos", {
    method: "POST", headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(name) },
    body: new Uint8Array(bytes),
  });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB6kAAAAASUVORK5CYII=", "base64");
  try {
    const response = await upload("../../photo.png", png);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.match(body.path, /^\/api\/candidate-photos\/[a-f0-9-]{36}\.png$/);
    const file = await fetch(base + body.path);
    assert.equal(file.headers.get("content-type"), "image/png");
    assert.equal(file.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
    for (const [name, bytes, status] of [
      ["photo.svg", Buffer.from("<svg/>"), 400], ["photo.png", Buffer.alloc(0), 400],
      ["photo.png", Buffer.alloc(rules.MAX_PHOTO_BYTES + 1), 413],
      ["photo.png", Buffer.from("<html>not an image</html>"), 415], ["photo.jpg", png, 415],
    ] as const) assert.equal((await upload(name, bytes)).status, status);
    assert.equal((await fs.readdir(directory)).length, 1);
    assert.equal((await fetch(base + "/api/candidate-photos/%2e%2e%2f.env")).status, 404);
    assert.equal((await fetch(base + "/api/candidate-photos/00000000-0000-0000-0000-000000000000.png")).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
    const resolved = await fs.realpath(directory);
    assert.equal(resolved, path.resolve(directory));
    assert.equal(path.dirname(resolved), await fs.realpath(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("nexthire-photo-test-"));
    await fs.rm(resolved, { recursive: true, force: true });
  }
});
test("Local photo uploads are unavailable in production", async () => {
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
    assert.equal((await fetch("http://127.0.0.1:" + address.port + "/api/candidate-photos", { method: "POST" })).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  }
});
