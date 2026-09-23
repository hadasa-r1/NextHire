import express = require("express");
import EvaluationService = require("../services/evaluation.service");

function createWorkflowRoutes(service: EvaluationService): express.Router {
  const router = express.Router();
  router.get("/positions/:id/matrix", async (req, res) => { res.json(await service.matrix(req, String(req.params.id))); });
  router.get("/positions/:id/evaluation-review", async (req, res) => {
    res.json(await service.review(req, String(req.params.id)));
  });
  router.get("/applications/:id/process", async (req, res) => { res.json(await service.process(req, String(req.params.id))); });
  router.get("/applications/:id/evaluation-context", async (req, res) => {
    res.json(await service.context(req, String(req.params.id)));
  });
  router.post("/applications/:id/evaluations", async (req, res) => {
    res.json(await service.save(req, String(req.params.id), req.body));
  });
  router.post("/applications/:id/pass-threshold", async (req, res) => {
    res.json(await service.passThreshold(req, String(req.params.id)));
  });
  router.post("/applications/:id/reject", async (req, res) => {
    res.json(await service.reject(req, String(req.params.id), req.body));
  });
  return router;
}
export = createWorkflowRoutes;
