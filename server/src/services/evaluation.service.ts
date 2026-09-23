import mongoose = require("mongoose");
import crypto = require("node:crypto");
import type { Request } from "express";
import type { CriterionReference, EvaluationContext, EvaluationInput } from "../validation/scoring.mjs";
import scoring = require("../validation/scoring.mjs");
import Repository = require("../repository/repository");
import Application = require("../models/application.model");
import EvaluationScore = require("../models/evaluation-score.model");
import WorkflowError = require("./workflow-error");
import Candidate = require("../models/candidate.model");
import ApplicationRules = require("./application-rules");
import processRules = require("../validation/process.mjs");

interface Session { user: { _id: string }; permissions: readonly { resource: string; actions: readonly string[] }[] }
interface WorkflowDependencies {
  // Supply trusted Group C and Group A adapters; never derive these from request JSON.
  resolveSession(req: Request): Promise<Session | null>;
  loadCriteria(positionId: string): Promise<readonly CriterionReference[]>;
  loadStages?(positionId: string): Promise<readonly scoring.StageReference[]>;
}

class EvaluationService {
  constructor(
    private readonly applications: Repository<Application>,
    private readonly evaluations: Repository<EvaluationScore>,
    private readonly integrations: WorkflowDependencies,
  ) {}
  private async authorize(req: Request, resource: string | readonly string[], action = "WRITE") {
    const session = await this.integrations.resolveSession(req);
    if (!session) throw new WorkflowError(401, "נדרשת התחברות למערכת.");
    if (!mongoose.isObjectIdOrHexString(session.user._id) ||
      !(typeof resource === "string" ? [resource] : resource).every(name =>
        session.permissions.some(p => p.resource === name && p.actions.includes(action))))
      throw new WorkflowError(403, "אין הרשאה לביצוע הפעולה.");
    return session;
  }
  private async application(id: string) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new WorkflowError(400, "מזהה ההגשה אינו תקין.");
    const application = await this.applications.getById(id);
    if (!application) throw new WorkflowError(404, "ההגשה לא נמצאה.");
    return application;
  }
  private async criteria(application: Pick<Application, "positionId">) {
    if (!application.positionId) throw new WorkflowError(400, "ההגשה אינה משויכת למשרה.");
    const criteria = await this.integrations.loadCriteria(String(application.positionId));
    try { return scoring.validateCriteria(criteria); }
    catch (error) { throw new WorkflowError(502, error instanceof Error ? error.message : "התקבלו קריטריונים לא תקינים."); }
  }
  private async processFor(application: mongoose.HydratedDocument<Application>) {
    const criteria = await this.criteria(application);
    const stages = this.integrations.loadStages
      ? scoring.validateStages(await this.integrations.loadStages(String(application.positionId)), String(application.positionId)) : [];
    const rules = new ApplicationRules(new Repository(Candidate), this.applications);
    const duplicate = (await rules.crossCompany(application)).length > 0;
    const values = await this.evaluations.getAll({ applicationId: application._id });
    const failed = criteria.some(c => c.type === "BOOLEAN" && values.some(v => String(v.criterionId) === c._id && v.actualValue === false));
    const reason = duplicate ? "נפסל — אותו מועמד הוגש למשרה על ידי יותר מחברה אחת" : application.rejectionReason?.trim() ||
      (application.passedThreshold === false || failed ? "המועמד לא עבר את תנאי הסף." : undefined);
    return processRules.stageProgress(criteria, stages, values, application.passedThreshold, reason);
  }
  async process(req: Request, id: string) {
    await this.authorize(req, ["Application", "EvaluationScore"], "READ");
    return this.processFor(await this.application(id));
  }
  async context(req: Request, id: string): Promise<EvaluationContext> {
    const session = await this.authorize(req, "EvaluationScore");
    const application = await this.application(id);
    const criteria = await this.criteria(application);
    let stages: readonly scoring.StageReference[] | undefined;
    if (this.integrations.loadStages) {
      try {
        stages = scoring.validateStages(await this.integrations.loadStages(String(application.positionId)), String(application.positionId));
        if (criteria.some(criterion => criterion.stageId && !stages!.some(stage => stage._id === criterion.stageId)))
          throw new Error("קריטריון מפנה לשלב שאינו ברשימת שלבי המשרה.");
      } catch (error) { throw new WorkflowError(502, error instanceof Error ? error.message : "נתוני השלבים אינם תקינים."); }
    }
    const own = await this.evaluations.getAll({ applicationId: id, interviewerId: session.user._id });
    // WRITE-only interviewer sees criterion definitions and their own editable values,
    // never candidate contact details or other interviewers' evaluations.
    const evaluations: EvaluationInput[] = [];
    const seen = new Set<string>();
    for (const value of own) {
      const criterionId = String(value.criterionId);
      if (!criteria.some(c => c._id === criterionId)) continue;
      if (seen.has(criterionId)) throw new WorkflowError(409, "קיימות הערכות כפולות שדורשות בירור.");
      seen.add(criterionId);
      if (typeof value.actualValue === "boolean" || typeof value.actualValue === "number") evaluations.push({
        criterionId, actualValue: value.actualValue, ...(value.notes !== undefined ? { notes: value.notes } : {}),
      });
    }
    return { criteria, evaluations, ...(stages ? { stages, process: await this.processFor(application) } : {}) };
  }
  async save(req: Request, id: string, input: unknown) {
    const session = await this.authorize(req, "EvaluationScore");
    const application = await this.application(id);
    await new ApplicationRules(new Repository(Candidate), this.applications).assertEligible(application);
    if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => !["criterionId", "actualValue", "notes"].includes(key)))
      throw new WorkflowError(400, "יש לשלוח ערך קריטריון והערות בלבד.");
    const body = input as Record<string, unknown>;
    if (typeof body.criterionId !== "string" || !mongoose.isObjectIdOrHexString(body.criterionId) ||
      (typeof body.actualValue !== "number" && typeof body.actualValue !== "boolean") ||
      (body.notes !== undefined && typeof body.notes !== "string"))
      throw new WorkflowError(400, "נתוני ההערכה אינם תקינים.");
    const criterionId = body.criterionId.toLowerCase();
    const criteria = await this.criteria(application);
    const criterion = criteria.find(c => c._id === criterionId);
    if (!criterion) throw new WorkflowError(400, "הקריטריון אינו שייך למשרת ההגשה.");
    // Failed threshold results stop further scored evaluations. BOOLEAN remains
    // editable so the interviewer can correct their own result; no result is erased.
    if (criterion.type === "SCORED") {
      if (criterion.stageId) {
        const process = await this.processFor(application);
        const step = process.steps.find(item => item.id === criterion.stageId);
        if (!step || step.state === "blocked") throw new WorkflowError(409, step?.reason || "לא ניתן לאמת את סדר שלבי המשרה.");
      }
      if (application.passedThreshold === false)
        throw new WorkflowError(409, "ההגשה לא עברה את תנאי הסף. לא ניתן לשמור ציון איכות.");
      await this.assertNoFailedThreshold(id, criteria);
    }
    let computedScore: number | undefined;
    try { computedScore = scoring.calculateScore(criterion, body.actualValue); }
    catch (error) { throw new WorkflowError(400, error instanceof Error ? error.message : "לא ניתן לחשב ציון."); }
    const references = {
      applicationId: new mongoose.Types.ObjectId(id),
      criterionId: new mongoose.Types.ObjectId(body.criterionId),
      interviewerId: new mongoose.Types.ObjectId(session.user._id),
    };
    const existing = await this.evaluations.getAll(references);
    if (existing.length > 1) throw new WorkflowError(409, "קיימות הערכות כפולות שדורשות בירור.");
    // Stable technical _id makes retry/concurrent first-save safe without adding model fields.
    const recordId = existing[0]?._id ?? new mongoose.Types.ObjectId(
      crypto.createHash("sha256").update([references.applicationId, references.criterionId, references.interviewerId].map(String).join(":")).digest("hex").slice(0, 24));
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const data: Partial<EvaluationScore> = {
      ...references, actualValue: body.actualValue, evaluatedAt: new Date(),
      ...(computedScore !== undefined ? { computedScore } : {}), ...(notes ? { notes } : {}),
    };
    const unset: (keyof EvaluationScore)[] = [];
    if (computedScore === undefined) unset.push("computedScore");
    if (!notes) unset.push("notes");
    const filter = { _id: recordId, ...references };
    try {
      return await this.evaluations.update(filter, data, { upsert: true, unset });
    } catch (error) {
      if (!(error instanceof mongoose.mongo.MongoServerError && error.code === 11000)) throw error;
      const updated = await this.evaluations.update(filter, data, { unset });
      if (!updated) throw new WorkflowError(409, "לא ניתן לשמור את ההערכה עקב התנגשות.");
      return updated;
    }
  }
  private async assertNoFailedThreshold(id: string, criteria: readonly CriterionReference[]) {
    const thresholdIds = new Set(criteria.filter(c => c.type === "BOOLEAN").map(c => c._id));
    const evaluations = await this.evaluations.getAll({ applicationId: id });
    if (evaluations.some(value => thresholdIds.has(String(value.criterionId)) && value.actualValue === false))
      throw new WorkflowError(409, "נשמרה תוצאת לא עבר בתנאי סף. יש לברר ולתקן את ההערכה לפני המשך התהליך.");
  }
  async matrix(req: Request, positionId: string) {
    await this.authorize(req, ["TenderSummary", "Application", "Candidate", "EvaluationScore"], "READ");
    if (!mongoose.isObjectIdOrHexString(positionId)) throw new WorkflowError(400, "מזהה המשרה אינו תקין.");
    const criteria = await this.criteria({ positionId: new mongoose.Types.ObjectId(positionId) });
    const stages = this.integrations.loadStages ? scoring.validateStages(await this.integrations.loadStages(positionId), positionId) : [];
    const applications = await this.applications.getAll({ positionId });
    const candidates = new Repository(Candidate);
    const rules = new ApplicationRules(candidates, this.applications);
    const rows = [];
    for (const application of applications) {
      const candidate = application.candidateId ? await candidates.getById(String(application.candidateId)) : null;
      const scores = await this.evaluations.getAll({ applicationId: application._id });
      const duplicate = (await rules.crossCompany(application)).length > 0;
      rows.push({
        applicationId: String(application._id), idNumber: candidate?.idNumber, companyId: application.companyId ? String(application.companyId) : undefined,
        hourlyRateBid: application.hourlyRateBid, passedThreshold: application.passedThreshold,
        rejectionReason: duplicate ? "נפסל — הוגש משתי חברות" : application.rejectionReason,
        scores: scores.filter(s => criteria.some(c => c._id === String(s.criterionId))).map(s => ({
          criterionId: String(s.criterionId), actualValue: s.actualValue, computedScore: s.computedScore, notes: s.notes,
        })),
      });
    }
    return { criteria, stages, applications: rows };
  }
  async review(req: Request, positionId: string) {
    await this.authorize(req, ["TenderSummary", "Application", "EvaluationScore"], "READ");
    if (!mongoose.isObjectIdOrHexString(positionId)) throw new WorkflowError(400, "מזהה המשרה אינו תקין.");
    const criteria = await this.criteria({ positionId: new mongoose.Types.ObjectId(positionId) });
    const applications = await this.applications.getAll({ positionId });
    const results: scoring.EvaluationReview["applications"] = [];
    for (const application of applications) {
      const values = await this.evaluations.getAll({ applicationId: application._id });
      const review = scoring.reviewEvaluations(criteria, values);
      const issues = [...review.issues];
      if (application.rejectionReason?.trim()) issues.unshift("ההגשה נדחתה; אין להתייחס אליה כעתודה.");
      if (application.passedThreshold !== true) issues.unshift("טרם אושרה עמידה בתנאי הסף.");
      results.push({ applicationId: String(application._id), evaluatedCriteria: review.evaluatedCriteria,
        totalCriteria: criteria.length, issues });
    }
    // This is a diagnostic response, never a new persisted model or a lock.
    const report: scoring.EvaluationReview = {
      applications: results,
      limitations: [
        "השלמת הערכים אינה נעילת ציונים. נדרש להגדיר כיצד נשמרים השלמת שלבי החובה ונעילתם.",
        "לחישוב המפ״ל הסופי נדרשים משקלי השלבים והקריטריונים, נוסחת המחיר ומשקלי האיכות והמחיר המאושרים.",
        "החזרה מהעתודה דורשת את עתודת השלב הקודם: שני הבאים חוזרים להערכה, ללא אישור זכייה אוטומטי.",
      ],
    };
    return report;
  }
  async passThreshold(req: Request, id: string) {
    await this.authorize(req, "Application");
    const application = await this.application(id);
    if (application.rejectionReason?.trim())
      throw new WorkflowError(409, "ההגשה נדחתה. סימון עבר סף אינו פותח מחדש תהליך שנדחה.");
    await new ApplicationRules(new Repository(Candidate), this.applications).assertEligible(application);
    const criteria = await this.criteria(application);
    await this.assertNoFailedThreshold(id, criteria);
    const values = await this.evaluations.getAll({ applicationId: id });
    const thresholds = criteria.filter(c => c.type === "BOOLEAN");
    if (!thresholds.length || thresholds.some(c => values.filter(v => String(v.criterionId) === c._id && v.actualValue === true).length !== 1))
      throw new WorkflowError(409, "יש להשלים תוצאת עבר לכל תנאי הסף המוגדרים לפני אישור.");
    return this.applications.update(id, { passedThreshold: true });
  }
  async reject(req: Request, id: string, input: unknown) {
    await this.authorize(req, "Application");
    await this.application(id);
    if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => key !== "rejectionReason") ||
      !("rejectionReason" in input) || typeof input.rejectionReason !== "string" || !input.rejectionReason.trim())
      throw new WorkflowError(400, "יש להזין סיבת דחייה.");
    // A later rejection does not rewrite historical threshold results or infer a stage.
    return this.applications.update(id, { rejectionReason: input.rejectionReason.trim() });
  }
}
export = EvaluationService;
