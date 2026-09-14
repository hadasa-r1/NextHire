import type { ErrorRequestHandler } from "express";
import mongoose = require("mongoose");
import WorkflowError = require("../services/workflow-error");

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof WorkflowError) { res.status(error.status).json({ message: error.message }); return; }

  if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError
  ) {
    // Expose field names and controlled messages, never submitted values/cast internals.
    const fields: Record<string, string> = {};
    const labels: Record<string, string> = {
      idNumber: "מספר זהות", phone: "טלפון", email: "דוא״ל", resumeUrl: "קישור לקורות חיים",
      hourlyRateBid: "תעריף שעתי", actualValue: "ערך הערכה", rankPosition: "דירוג",
    };
    const failures = error instanceof mongoose.Error.ValidationError ? Object.values(error.errors) : [error];
    for (const failure of failures) {
      fields[failure.path] = failure instanceof mongoose.Error.ValidatorError && failure.kind === "user defined"
        ? failure.message
        : `יש לבדוק את השדה ${labels[failure.path] ?? failure.path}.`;
    }
    res.status(400).json({ message: Object.values(fields).join(" ") || "נתוני הבקשה אינם תקינים.", fields });
    return;
  }

  if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    res.status(409).json({ message: "כבר קיימת רשומה עם אותו ערך ייחודי." });
    return;
  }

  if (typeof error === "object" && error !== null && "type" in error) {
    if (error.type === "entity.parse.failed") {
      res.status(400).json({ message: "גוף הבקשה אינו JSON תקין." });
      return;
    }

    if (error.type === "entity.too.large") {
      res.status(413).json({ message: "גוף הבקשה גדול מדי." });
      return;
    }

    if (error.type === "charset.unsupported" || error.type === "encoding.unsupported") {
      res.status(415).json({ message: "קידוד הבקשה אינו נתמך." });
      return;
    }
  }

  res.status(500).json({ message: "אירעה שגיאה פנימית בשרת." });
};

export = errorHandler;
