import cors = require("cors");
import express = require("express");
import process = require("node:process");
import routes = require("./routes");
import createResumeUploadRoutes = require("./routes/resume-upload.routes");
import createCandidatePhotoRoutes = require("./routes/candidate-photo.routes");
import errorHandler = require("./middleware/error-handler");
import EvaluationService = require("./services/evaluation.service");
import repositories = require("./repository");
import createWorkflowRoutes = require("./routes/workflow.routes");
import localWorkflow = require("./demo/workflow");
import SubmissionService = require("./services/submission.service");
import createSubmissionRoutes = require("./routes/submission.routes");

function createApp(workflow?: EvaluationService, submissions?: SubmissionService): express.Express {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }));
  // Development bridge only. Production storage/authentication belongs to Group C.
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/resumes", createResumeUploadRoutes());
    app.use("/api/candidate-photos", createCandidatePhotoRoutes());
  }
  app.use("/api/submissions", express.json({ limit: "512kb" }), createSubmissionRoutes(submissions ?? new SubmissionService(repositories.candidateRepository, repositories.applicationRepository, localWorkflow())));
  app.use(express.json());
  app.use("/api/workflow", createWorkflowRoutes(workflow ?? new EvaluationService(
    repositories.applicationRepository, repositories.evaluationScoreRepository, localWorkflow(),
  )));
  app.use(routes);

  app.use((_req, res) => {
    res.status(404).json({ message: "הנתיב לא נמצא." });
  });
  app.use(errorHandler);

  return app;
}

export = createApp;
