import cors = require("cors");
import express = require("express");
import process = require("node:process");
import routes = require("./routes");
import errorHandler = require("./middleware/error-handler");

function createApp(): express.Express {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }));
  app.use(express.json());
  app.use(routes);

  app.use((_req, res) => {
    res.status(404).json({ message: "הנתיב לא נמצא." });
  });
  app.use(errorHandler);

  return app;
}

export = createApp;
