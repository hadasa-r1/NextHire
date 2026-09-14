import mongoose = require("mongoose");
import crypto = require("node:crypto");
import type { Request } from "express";
import type { CriterionReference, EvaluationContext, EvaluationInput } from "../validation/scoring.mjs";
import scoring = require("../validation/scoring.mjs");
import Repository = require("../repository/repository");
import Application = require("../models/application.model");
import EvaluationScore = require("../models/evaluation-score.model");
import WorkflowError = require("./workflow-error");

interface Session { user: { _id: string }; permissions: readonly { resource: string; actions: readonly string[] }[] }
interface WorkflowDependencies {
  // Supply trusted Group C and Group A adapters; never derive these from request JSON.
  resolveSession(req: Request): Promise<Session | null>;
  loadCriteria(positionId: string): Promise<readonly CriterionReference[]>;
}

class EvaluationService {
  constructor(
    private readonly applications: Repository<Application>,
    private readonly evaluations: Repository<EvaluationScore>,
    private readonly integrations: WorkflowDependencies,
  ) {}
  private async authorize(req: Request, resource: string) {
    const session = await this.integrations.resolveSession(req);
    if (!session) throw new WorkflowError(401, "נדרשת התחברות למערכת.");
    if (!mongoose.isObjectIdOrHexString(session.user._id) ||
      !session.permissions.some(p => p.resource === resource && p.actions.includes("WRITE")))
      throw new WorkflowError(403, "אין הרשאה לביצוע הפעולה.");
    return session;
  }
  private async application(id: string) {
    if (!mongoose.isObjectIdOrHexString(id)) throw new WorkflowError(400, "מזהה ההגשה אינו תקין.");
    const application = await this.applications.getById(id);
    if (!application) throw new WorkflowError(404, "ההגשה לא נמצאה.");
    return application;
  }
  private async criteria(application: Application) {
    if (!application.positionId) throw new WorkflowError(400, "ההגשה אינה משויכת למשרה.");
    const criteria = await this.integrations.loadCriteria(String(application.positionId));
    try { return scoring.validateCriteria(criteria); }
    catch (error) { throw new WorkflowError(502, error instanceof Error ? error.message : "התקבלו קריטריונים לא תקינים."); }
  }
  async context(req: Request, id: string): Promise<EvaluationContext> {
    const session = await this.authorize(req, "EvaluationScore");
    const criteria = await this.criteria(await this.application(id));
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
    return { criteria, evaluations };
  }
  async save(req: Request, id: string, input: unknown) {
    const session = await this.authorize(req, "EvaluationScore");
    const application = await this.application(id);
    if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => !["criterionId", "actualValue", "notes"].includes(key)))
      throw new WorkflowError(400, "יש לשלוח ערך קריטריון והערות בלבד.");
    const body = input as Record<string, unknown>;
    if (typeof body.criterionId !== "string" || !mongoose.isObjectIdOrHexString(body.criterionId) ||
      (typeof body.actualValue !== "number" && typeof body.actualValue !== "boolean") ||
      (body.notes !== undefined && typeof body.notes !== "string"))
      throw new WorkflowError(400, "נתוני ההערכה אינם תקינים.");
    const criterionId = body.criterionId.toLowerCase();
    const criterion = (await this.criteria(application)).find(c => c._id === criterionId);
    if (!criterion) throw new WorkflowError(400, "הקריטריון אינו שייך למשרת ההגשה.");
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
  async passThreshold(req: Request, id: string) {
    await this.authorize(req, "Application");
    await this.application(id);
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
