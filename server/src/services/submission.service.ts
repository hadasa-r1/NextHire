import crypto = require("node:crypto");
import mongoose = require("mongoose");
import type { Request } from "express";
import Repository = require("../repository/repository");
import Candidate = require("../models/candidate.model");
import Application = require("../models/application.model");
import ApplicationRules = require("./application-rules");
import WorkflowError = require("./workflow-error");

interface Dependencies {
  resolveSession(req: Request): Promise<{ user: { _id: string }; permissions: readonly { resource: string; actions: readonly string[] }[] } | null>;
  authorizeSubmission?(req: Request, positionId: string, companyId: string): Promise<boolean>;
}
type Row = { candidateId?: string; idNumber?: string; fullName?: string; phone?: string; email?: string; linkedinUrl?: string; githubUrl?: string; photoUrl?: string; resumeUrl?: string; hourlyRateBid?: number };
class SubmissionService {
  private rules: ApplicationRules;
  constructor(private candidates: Repository<Candidate>, private applications: Repository<Application>, private integrations: Dependencies) {
    this.rules = new ApplicationRules(candidates, applications);
  }
  private async prepare(req: Request, input: unknown) {
    const session = await this.integrations.resolveSession(req);
    if (!session) throw new WorkflowError(401, "נדרשת התחברות.");
    for (const [resource, action] of [["Candidate", "READ"], ["Candidate", "WRITE"], ["Application", "WRITE"]]) {
      if (!session.permissions.some(p => p.resource === resource && p.actions.includes(action!)))
        throw new WorkflowError(403, "אין הרשאה להגשת מועמדים.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new WorkflowError(400, "נתוני הייבוא אינם תקינים.");
    const data = input as { positionId?: unknown; companyId?: unknown; rows?: unknown };
    if (typeof data.positionId !== "string" || !mongoose.isObjectIdOrHexString(data.positionId) ||
      typeof data.companyId !== "string" || !mongoose.isObjectIdOrHexString(data.companyId))
      throw new WorkflowError(400, "יש לבחור משרה וחברה.");
    if (!this.integrations.authorizeSubmission) throw new WorkflowError(503, "ממשק אימות המשרה והחברה טרם חובר.");
    if (!await this.integrations.authorizeSubmission(req, data.positionId, data.companyId)) throw new WorkflowError(403, "אין הרשאה להגשה למשרה מטעם החברה שנבחרה.");
    if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 100) throw new WorkflowError(400, "ניתן להגיש 1–100 מועמדים בכל פעולה.");
    const positionId = data.positionId.toLowerCase(), companyId = data.companyId.toLowerCase();
    const seen = new Set<string>();
    const rows = [];
    for (const [index, raw] of data.rows.entries()) {
      const errors: string[] = [], warnings: string[] = [];
      let person: mongoose.HydratedDocument<Candidate> | undefined;
      let existing: mongoose.HydratedDocument<Application> | undefined;
      const candidateData: Partial<Candidate> = {};
      const row: Row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      if (row.candidateId !== undefined) {
        if (typeof row.candidateId !== "string" || !mongoose.isObjectIdOrHexString(row.candidateId)) errors.push("מזהה המועמד אינו תקין.");
        else person = await this.candidates.getById(row.candidateId) ?? undefined;
        if (!person) errors.push("המועמד שנבחר אינו קיים.");
        if (person && row.idNumber && row.idNumber !== person.idNumber) errors.push("ת״ז אינה תואמת למועמד שנבחר.");
      } else if (typeof row.idNumber === "string") {
        const matches = await this.candidates.getAll({ idNumber: row.idNumber.trim() });
        if (matches.length > 1) errors.push("נמצאו כמה רשומות לאותה ת״ז. יש לבחור מועמד קיים במפורש לפני הגשה.");
        else person = matches[0];
      }
      for (const key of ["fullName", "idNumber", "phone", "email", "linkedinUrl", "githubUrl", "photoUrl"] as const) {
        const value = row[key];
        if (value !== undefined && typeof value !== "string") errors.push(key + ": נדרש טקסט.");
        else if (typeof value === "string") candidateData[key] = value.trim();
      }
      const identity = person?.idNumber ?? candidateData.idNumber ?? "";
      if (seen.has(identity)) errors.push("אותה ת״ז מופיעה יותר מפעם אחת בקובץ.");
      seen.add(identity);
      if (!person) {
        try { await new Candidate(candidateData).validate(); }
        catch { errors.push("פרטי המועמד אינם תקינים. בדקו ת״ז, טלפון, דוא״ל וקישורים."); }
      } else if (Object.entries(candidateData).some(([key, value]) => value && value !== person!.get(key))) {
        warnings.push("המועמד קיים. פרטי הפרופיל הקיימים לא יידרסו; ניתן לערוך אותם בכרטיס המועמד.");
        try { await new Candidate({ ...candidateData, idNumber: identity }).validate(); }
        catch { errors.push("פרטי הפרופיל בקובץ אינם תקינים."); }
      }
      const possible = person ? await this.applications.getAll({ candidateId: person._id, positionId, companyId }) : [];
      if (possible.length > 1) errors.push("קיימות הגשות כפולות של אותה חברה; נדרש בירור.");
      existing = possible[0];
      const applicationData = {
        positionId: new mongoose.Types.ObjectId(positionId), companyId: new mongoose.Types.ObjectId(companyId),
        resumeUrl: typeof row.resumeUrl === "string" ? row.resumeUrl.trim() : "", ...(row.hourlyRateBid !== undefined ? { hourlyRateBid: row.hourlyRateBid } : {}),
      };
      if (row.resumeUrl !== undefined && typeof row.resumeUrl !== "string") errors.push("קישור קורות החיים אינו תקין.");
      if (!existing) {
        try { await new Application(applicationData).validate(); }
        catch { errors.push("יש להשלים קורות חיים תקינים ותעריף שעתי תקין אם הוזן."); }
      } else warnings.push("ההגשה כבר קיימת עבור חברה זו. לא תיווצר הגשה נוספת ולא יידרסו נתוניה.");
      const duplicate = person ? (await this.rules.crossCompany({ ...applicationData, candidateId: person._id })).length > 0 : false;
      if (duplicate) warnings.push("המועמד הוגש למשרה גם מחברה אחרת. ההגשות משתי החברות ייפסלו להמשך התהליך.");
      rows.push({ row: index + 1, identity, person, existing, candidateData, applicationData, errors, warnings });
    }
    return { positionId, companyId, rows };
  }
  async preview(req: Request, input: unknown) {
    const data = await this.prepare(req, input);
    return { rows: data.rows.map(row => ({
      row: row.row, idNumber: row.identity, candidate: row.person ? "existing" : "new",
      existingApplication: Boolean(row.existing), errors: row.errors, warnings: row.warnings,
    })) };
  }
  async commit(req: Request, input: unknown) {
    const data = await this.prepare(req, input);
    const invalid = data.rows.find(row => row.errors.length);
    if (invalid) throw new WorkflowError(400, "שורה " + invalid.row + ": " + invalid.errors.join(" "));
    const results: { row: number; applicationId?: string; candidateId?: string; rejected?: boolean; error?: string }[] = [];
    for (const row of data.rows) {
      try {
        const candidate = row.person ?? await this.candidates.update(
          new mongoose.Types.ObjectId(crypto.createHash("sha256").update("candidate:" + row.identity).digest("hex").slice(0, 24)).toString(),
          row.candidateData, { upsert: true });
        if (!candidate) throw new Error("שמירת המועמד נכשלה.");
        // Stable _id makes interrupted imports and repeated uploads idempotent, without new model fields.
        const key = crypto.createHash("sha256").update([data.positionId, data.companyId, row.identity].join(":")).digest("hex").slice(0, 24);
        let application = row.existing ?? await this.applications.getById(key);
        if (!application) {
          try { application = await this.applications.add({ ...row.applicationData, candidateId: candidate._id, _id: new mongoose.Types.ObjectId(key) } as Partial<Application>); }
          catch (error) {
            if (!(error instanceof mongoose.mongo.MongoServerError && error.code === 11000)) throw error;
            application = await this.applications.getById(key);
          }
        }
        if (!application) throw new Error("שמירת ההגשה נכשלה.");
        const rejected = await this.rules.reconcile(application);
        results.push({ row: row.row, applicationId: String(application._id), candidateId: String(candidate._id), rejected: rejected || Boolean(application.rejectionReason) });
      } catch {
        results.push({ row: row.row, error: "השמירה נעצרה בשורה זו. אפשר לנסות שוב; שורות שנשמרו לא יוכפלו." });
        break;
      }
    }
    return { results, complete: results.length === data.rows.length && results.every(row => !row.error) };
  }
}
export = SubmissionService;
