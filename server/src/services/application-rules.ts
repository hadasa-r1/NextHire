import Repository = require("../repository/repository");
import Candidate = require("../models/candidate.model");
import Application = require("../models/application.model");
import WorkflowError = require("./workflow-error");

const DUPLICATE_REASON = "נפסל — אותו מועמד הוגש למשרה על ידי יותר מחברה אחת";
class ApplicationRules {
  constructor(private candidates: Repository<Candidate>, private applications: Repository<Application>) {}
  async crossCompany(application: Partial<Application>) {
    if (!application.positionId || !application.candidateId) return [];
    const candidate = await this.candidates.getById(String(application.candidateId));
    if (!candidate) return [];
    const people = await this.candidates.getAll({ idNumber: candidate.idNumber });
    const submissions = await this.applications.getAll({ positionId: application.positionId, candidateId: { $in: people.map(person => person._id) } });
    const companies = new Set(submissions.filter(item => item.companyId).map(item => String(item.companyId)));
    if (application.companyId) companies.add(String(application.companyId));
    return companies.size > 1 ? submissions : [];
  }
  async reconcile(application: Partial<Application>) {
    const duplicates = await this.crossCompany(application);
    for (const item of duplicates) {
      if (!item.rejectionReason?.includes(DUPLICATE_REASON)) await this.applications.update(String(item._id), {
        rejectionReason: [item.rejectionReason, DUPLICATE_REASON].filter(Boolean).join("; "),
      });
    }
    return duplicates.length > 0;
  }
  async assertEligible(application: Partial<Application>) {
    if ((await this.crossCompany(application)).length)
      throw new WorkflowError(409, DUPLICATE_REASON);
    if (application.rejectionReason?.trim())
      throw new WorkflowError(409, "ההגשה נפסלה או נדחתה; המשך התהליך חסום.");
  }
}
export = ApplicationRules;
