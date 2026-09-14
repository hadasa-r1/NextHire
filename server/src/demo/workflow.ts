import type { Request } from "express";
import process = require("node:process");
import data = require("./evaluation-data.mjs");
import WorkflowError = require("../services/workflow-error");

// Explicit local development adapter. No User/Authorization/Position/Criterion models.
function localWorkflow() {
  return {
    async resolveSession(req: Request) {
      if (process.env.NODE_ENV === "production" || process.env.NEXTHIRE_LOCAL_WORKFLOW !== "true")
        throw new WorkflowError(503, "שירות ההערכות ממתין לחיבור הרשאות ונתוני המשרות.");
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "")) return null;
      return { user: { _id: data.DEMO_INTERVIEWER_ID }, permissions: [
        { resource: "EvaluationScore", actions: ["WRITE"] }, { resource: "Application", actions: ["WRITE"] },
      ] };
    },
    async loadCriteria(positionId: string) { return data.demoCriteria(positionId); },
  };
}
export = localWorkflow;
