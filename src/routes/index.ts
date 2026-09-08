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
  createGenericRoutes(
    new GenericController(repositories.applicationRepository, {
      // Lets the internal candidate pool screen request one position's
      // applications: GET /api/applications?positionId=<id>&populate=candidateId
      filterableFields: ["positionId", "candidateId", "companyId"],
      // Only Candidate is registered here; Company and Position belong to other
      // groups, so they stay bare ObjectIds until those models exist.
      populatableFields: ["candidateId"],
    })
  )
);

router.use(
  "/api/evaluation-scores",
  createGenericRoutes(
    new GenericController(repositories.evaluationScoreRepository, {
      filterableFields: ["applicationId", "criterionId", "interviewerId"],
    })
  )
);

router.use(
  "/api/tender-summaries",
  createGenericRoutes(
    new GenericController(repositories.tenderSummaryRepository, {
      filterableFields: ["applicationId"],
    })
  )
);

export = router;
