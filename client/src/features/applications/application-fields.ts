import { isRate, messages, webDocumentUrl } from "@validation";
import type { Application, ApplicationWithCandidate } from "@/types/domain";

export interface ApplicationFields {
  positionId: string;
  candidateId: string;
  companyId: string;
  hourlyRateBid: string;
  resumeUrl: string;
}
export type ApplicationValues = Pick<Application, "positionId" | "candidateId" | "companyId" | "hourlyRateBid" | "resumeUrl">;

export function applicationFields(application?: Application, prefill?: { positionId?: string; candidateId?: string }): ApplicationFields {
  return {
    positionId: application?.positionId ?? prefill?.positionId ?? "",
    candidateId: application?.candidateId ?? prefill?.candidateId ?? "",
    companyId: application?.companyId ?? "",
    hourlyRateBid: application?.hourlyRateBid === undefined ? "" : String(application.hourlyRateBid),
    resumeUrl: application?.resumeUrl ?? "",
  };
}

export function applicationPayload(fields: ApplicationFields, initial?: Application): ApplicationValues {
  const resumeUrl = fields.resumeUrl.trim();
  if (!resumeUrl) throw new Error("יש להזין קישור לקורות חיים.");
  if (!webDocumentUrl(resumeUrl)) throw new Error(messages.resumeUrl);
  return { ...applicationDetailsPayload(fields, initial), resumeUrl };
}

export function applicationDetailsPayload(fields: ApplicationFields, initial?: Application): Omit<ApplicationValues, "resumeUrl"> {
  const result: Omit<ApplicationValues, "resumeUrl"> = {};
  for (const field of ["positionId", "candidateId", "companyId"] as const) {
    const value = fields[field].trim();
    if (!value && initial?.[field]) throw new Error("מחיקת קשר קיים אינה נתמכת בשלב זה. יש לבחור ערך חלופי.");
    if (value) {
      if (!/^[a-f\d]{24}$/i.test(value)) throw new Error("יש לבחור ערך תקין מהרשימה.");
      result[field] = value;
    }
  }
  const rate = fields.hourlyRateBid.trim();
  if (rate !== "") {
    const value = Number(rate);
    if (!isRate(value)) throw new Error(messages.hourlyRateBid);
    result.hourlyRateBid = value;
  } else if (initial?.hourlyRateBid !== undefined) {
    throw new Error("מחיקת תעריף קיים אינה נתמכת בשלב זה. ניתן לעדכן אותו למספר אחר.");
  }
  return result;
}

export function candidateLabel(application: ApplicationWithCandidate): string {
  const candidate = application.candidateId;
  if (candidate && typeof candidate === "object") return candidate.fullName || candidate.idNumber;
  return typeof candidate === "string" ? "מזהה מועמד: " + candidate : "—";
}

