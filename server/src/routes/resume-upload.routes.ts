import express = require("express");
import fs = require("node:fs/promises");
import path = require("node:path");
import crypto = require("node:crypto");
import policy = require("../validation/resume-file.mjs");
import matchesResumeFormat = require("../services/resume-format");

// Local file transport only; does not implement Group C's Document model.
// TODO: replace with Group C's authenticated storage and download integration.
function createResumeUploadRoutes(directory = path.resolve(__dirname, "../../uploads/resumes")): express.Router {
  const router = express.Router();
  const storageRoot = path.resolve(directory);
  router.post("/", express.raw({ type: "application/octet-stream", limit: policy.MAX_RESUME_BYTES, inflate: false }), async (req, res) => {
    if (!req.is("application/octet-stream") || !Buffer.isBuffer(req.body)) {
      res.status(415).json({ message: "יש לשלוח קובץ קורות חיים." }); return;
    }
    let originalName: string;
    try { originalName = decodeURIComponent(req.get("X-File-Name") ?? ""); }
    catch { res.status(400).json({ message: "שם הקובץ אינו תקין." }); return; }
    const issue = policy.resumeFileIssue(originalName, req.body.length);
    if (issue) { res.status(400).json({ message: issue }); return; }
    const extension = originalName.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
    if (!matchesResumeFormat(req.body, extension)) {
      res.status(415).json({ message: "תוכן הקובץ אינו תואם לקובץ PDF או DOCX תקין." }); return;
    }
    // Never use the user's filename as a disk path.
    const name = crypto.randomUUID() + "." + extension;
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(path.join(storageRoot, name), req.body, { flag: "wx" });
    res.status(201).json({ path: "/api/resumes/" + name });
  });
  router.get("/:name", (req, res, next) => {
    const name = req.params.name;
    if (typeof name !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.(pdf|docx)$/.test(name)) {
      res.status(404).json({ message: "הקובץ לא נמצא." }); return;
    }
    const pdf = name.endsWith(".pdf");
    res.set({
      "Content-Type": pdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": (pdf ? "inline" : "attachment") + '; filename="resume.' + (pdf ? "pdf" : "docx") + '"',
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
    });
    res.sendFile(name, { root: storageRoot, dotfiles: "deny" }, (error) => {
      if (!error) return;
      if (!res.headersSent && "statusCode" in error && error.statusCode === 404) {
        res.removeHeader("Content-Disposition");
        res.type("json").status(404).json({ message: "הקובץ לא נמצא." });
      } else next(error);
    });
  });
  return router;
}
export = createResumeUploadRoutes;
