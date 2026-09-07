import express = require("express");
import GenericController = require("../controllers/generic.controller");
import repositories = require("../repository");
import createGenericRoutes = require("./generic.routes");

const router = express.Router();

// Mount this router directly on the app; the paths already include /api.
router.use(
  "/api/candidates",
  createGenericRoutes(new GenericController(repositories.candidateRepository))
);

router.use(
  "/api/applications",
  createGenericRoutes(new GenericController(repositories.applicationRepository))
);

router.use(
  "/api/evaluation-scores",
  createGenericRoutes(new GenericController(repositories.evaluationScoreRepository))
);

router.use(
  "/api/tender-summaries",
  createGenericRoutes(new GenericController(repositories.tenderSummaryRepository))
);

export = router;
