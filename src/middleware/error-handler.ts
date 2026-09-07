import type { ErrorRequestHandler } from "express";
import mongoose = require("mongoose");

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError
  ) {
    res.status(400).json({ message: "נתוני הבקשה אינם תקינים." });
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
