import express = require("express");
import SubmissionService = require("../services/submission.service");
function createSubmissionRoutes(service: SubmissionService) {
  const router = express.Router();
  router.post("/preview", async (req, res) => { res.json(await service.preview(req, req.body)); });
  router.post("/commit", async (req, res) => { res.json(await service.commit(req, req.body)); });
  return router;
}
export = createSubmissionRoutes;
