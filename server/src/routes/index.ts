import express = require("express");
import GenericController = require("../controllers/generic.controller");
import repositories = require("../repository");
import createGenericRoutes = require("./generic.routes");

import ApplicationRules = require("../services/application-rules");
import WorkflowError = require("../services/workflow-error");
const rules = new ApplicationRules(repositories.candidateRepository, repositories.applicationRepository);
const router = express.Router();
// Preserve generic CRUD implementation, but protect workflow-owned scores at its public boundary.
router.use("/api/evaluation-scores", (req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) return next(new WorkflowError(405, "יש להזין ציונים דרך מסך ההערכה; כתיבה ישירה של ציונים חסומה."));
  next();
});

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
      beforeWrite: async (_req, data, id) => {
        if (Object.keys(data).some(key => ["passedThreshold", "rejectionReason", "currentStage"].includes(key)))
          throw new WorkflowError(400, "החלטות תהליך נשמרות רק דרך פעולות התהליך המיועדות.");
        if (id && ["candidateId", "positionId", "companyId"].some(key => key in data)) {
          for (const key of ["candidateId", "positionId", "companyId"] as const)
            if (data[key] !== undefined && !/^[a-f\d]{24}$/i.test(String(data[key]))) throw new WorkflowError(400, "מזהה הקשר אינו תקין.");
          const old = await repositories.applicationRepository.getById(id);
          for (const key of ["candidateId", "positionId", "companyId"] as const)
            if (data[key] !== undefined && String(data[key]) !== String(old?.[key])) throw new WorkflowError(409, "שיוך הגשה אינו משתנה בעריכה; יש ליצור הגשה נפרדת.");
        }
      },
      afterWrite: async application => { await rules.reconcile(application); },
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
