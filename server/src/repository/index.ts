import Repository = require("./repository");
import Candidate = require("../models/candidate.model");
import Application = require("../models/application.model");
import EvaluationScore = require("../models/evaluation-score.model");
import TenderSummary = require("../models/tender-summary.model");

const candidateRepository = new Repository<Candidate>(Candidate);
const applicationRepository = new Repository<Application>(Application);
const evaluationScoreRepository = new Repository<EvaluationScore>(EvaluationScore);
const tenderSummaryRepository = new Repository<TenderSummary>(TenderSummary);

export = {
  candidateRepository,
  applicationRepository,
  evaluationScoreRepository,
  tenderSummaryRepository,
};
