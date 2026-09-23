import express = require("express");
import fs = require("node:fs/promises");
import path = require("node:path");
import crypto = require("node:crypto");

interface FilePolicy {
  directory: string;
  prefix: string;
  maxBytes: number;
  formats: Readonly<Record<string, { contentType: string; disposition: "inline" | "attachment" }>>;
  validate(name: string, bytes: Buffer): { extension: string } | { status: number; message: string };
}
// Shared local transport. Group C will supply authenticated production storage.
function createFileUploadRoutes(policy: FilePolicy): express.Router {
  const router = express.Router();
  const storageRoot = path.resolve(policy.directory);
  router.post("/", express.raw({ type: "application/octet-stream", limit: policy.maxBytes, inflate: false }), async (req, res) => {
    if (!req.is("application/octet-stream") || !Buffer.isBuffer(req.body)) {
      res.status(415).json({ message: "יש לשלוח קובץ בפורמט המתאים." }); return;
    }
    let originalName: string;
    try { originalName = decodeURIComponent(req.get("X-File-Name") ?? ""); }
    catch { res.status(400).json({ message: "שם הקובץ אינו תקין." }); return; }
    const result = policy.validate(originalName, req.body);
    if ("message" in result) { res.status(result.status).json({ message: result.message }); return; }
    if (!Object.hasOwn(policy.formats, result.extension)) throw new Error("Unsupported file policy extension");
    const name = crypto.randomUUID() + "." + result.extension;
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(path.join(storageRoot, name), req.body, { flag: "wx" });
    res.status(201).json({ path: policy.prefix + "/" + name });
  });
  router.get("/:name", (req, res, next) => {
    const name = req.params.name;
    const match = typeof name === "string" ? name.match(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.([a-z0-9]+)$/) : null;
    const extension = match?.[1];
    if (!extension || !Object.hasOwn(policy.formats, extension)) {
      res.status(404).json({ message: "הקובץ לא נמצא." }); return;
    }
    const format = policy.formats[extension]!;
    res.set({
      "Content-Type": format.contentType,
      "Content-Disposition": format.disposition + '; filename="file.' + extension + '"',
      "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
    });
    res.sendFile(String(name), { root: storageRoot, dotfiles: "deny" }, error => {
      if (!error) return;
      if (!res.headersSent && "statusCode" in error && error.statusCode === 404) {
        res.removeHeader("Content-Disposition");
        res.type("json").status(404).json({ message: "הקובץ לא נמצא." });
      } else next(error);
    });
  });
  return router;
}
export = createFileUploadRoutes;
