export interface CriterionReference {
  _id: string; stageId?: string; name?: string;
  type: "BOOLEAN" | "SCORED"; scoringMethod?: "RATIO" | "DIRECT";
  targetValue?: number; weightPercent?: number; maxScore?: number; descriptionGuide?: string;
}
export interface EvaluationInput { criterionId: string; actualValue: number | boolean; notes?: string }
export interface StageReference { _id: string; positionId: string; name?: string; order?: number; weightPercent?: number; quota?: number }
import type { ProcessState } from "./process.mjs";
export interface EvaluationContext { process?: ProcessState; criteria: readonly CriterionReference[]; evaluations: readonly EvaluationInput[]; stages?: readonly StageReference[] }
export function validateStages(input: unknown, positionId?: string): readonly StageReference[] {
  if (!Array.isArray(input)) throw new Error("רשימת השלבים אינה תקינה.");
  const seen = new Set<string>();
  return input.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("הגדרת שלב אינה תקינה.");
    const item = value as Record<string, unknown>;
    if (typeof item._id !== "string" || !/^[a-f\d]{24}$/i.test(item._id) ||
      typeof item.positionId !== "string" || !/^[a-f\d]{24}$/i.test(item.positionId) ||
      (positionId && item.positionId.toLowerCase() !== positionId.toLowerCase()) || seen.has(item._id.toLowerCase()))
      throw new Error("מזהה שלב כפול, לא תקין או שאינו שייך למשרה.");
    seen.add(item._id.toLowerCase());
    if (item.name !== undefined && typeof item.name !== "string") throw new Error("שם השלב אינו תקין.");
    for (const key of ["order", "weightPercent", "quota"])
      if (item[key] !== undefined && (typeof item[key] !== "number" || !Number.isFinite(item[key]))) throw new Error("נתוני השלב אינם תקינים.");
    return { ...Object.fromEntries(["name", "order", "weightPercent", "quota"].filter(key => item[key] !== undefined).map(key => [key, item[key]])),
      _id: item._id.toLowerCase(), positionId: item.positionId.toLowerCase() } as StageReference;
  });
}

// Lecturer, pages 3–4: raw ratio in percent, or the interviewer's direct score.
// No weighting, rounding or automatic cap is applied to the stored result.
export function calculateScore(criterion: CriterionReference, value: number | boolean): number | undefined {
  if (criterion.type === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error("בקריטריון סף יש לבחור עבר או לא עבר.");
    return undefined;
  }
  if (criterion.type !== "SCORED") throw new Error("סוג הקריטריון אינו נתמך.");
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("יש להזין מספר סופי תקין.");
  if (criterion.scoringMethod === "DIRECT") {
    if (criterion.maxScore !== undefined && (!Number.isFinite(criterion.maxScore) || value > criterion.maxScore))
      throw new Error("הציון הישיר חורג מהציון המרבי שהוגדר בקריטריון.");
    return value;
  }
  if (criterion.scoringMethod !== "RATIO" || !Number.isFinite(criterion.targetValue) || !(criterion.targetValue! > 0))
    throw new Error("לחישוב יחס נדרש ערך יעד חיובי ותקין.");
  const score = value / criterion.targetValue! * 100;
  if (!Number.isFinite(score)) throw new Error("תוצאת החישוב אינה מספר סופי.");
  return score;
}

/** Validate external criterion definitions before displaying or accepting evaluations. */
export function validateCriteria(input: unknown): readonly CriterionReference[] {
  if (!Array.isArray(input)) throw new Error("רשימת הקריטריונים שהתקבלה אינה תקינה.");
  const seen = new Set<string>();
  return input.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("התקבלה הגדרת קריטריון לא תקינה.");
    const item = value as Record<string, unknown>;
    if (typeof item._id !== "string" || !/^[a-f\d]{24}$/i.test(item._id))
      throw new Error("מזהה הקריטריון אינו תקין.");
    const id = item._id.toLowerCase();
    if (seen.has(id)) throw new Error("התקבל קריטריון כפול.");
    seen.add(id);
    if (item.type !== "BOOLEAN" && item.type !== "SCORED")
      throw new Error("סוג הקריטריון אינו נתמך.");
    if (item.scoringMethod !== undefined && item.scoringMethod !== "RATIO" && item.scoringMethod !== "DIRECT")
      throw new Error("שיטת הניקוד אינה נתמכת.");
    if (item.type === "SCORED" && item.scoringMethod === undefined)
      throw new Error("לא הוגדרה שיטת ניקוד לקריטריון.");
    for (const key of ["targetValue", "weightPercent", "maxScore"]) {
      if (item[key] !== undefined && (typeof item[key] !== "number" || !Number.isFinite(item[key])))
        throw new Error("הגדרת הקריטריון כוללת ערך מספרי לא תקין.");
    }
    if (item.type === "SCORED" && item.scoringMethod === "RATIO" &&
      (typeof item.targetValue !== "number" || !(item.targetValue > 0)))
      throw new Error("לחישוב יחס נדרש ערך יעד חיובי ותקין.");
    for (const key of ["name", "descriptionGuide"]) {
      if (item[key] !== undefined && typeof item[key] !== "string")
        throw new Error("הגדרת הקריטריון כוללת טקסט לא תקין.");
    }
    if (item.stageId !== undefined && (typeof item.stageId !== "string" || !/^[a-f\d]{24}$/i.test(item.stageId)))
      throw new Error("מזהה השלב של הקריטריון אינו תקין.");
    // Return only the approved reference fields, without extra integration metadata.
    const reference = Object.fromEntries(["type", "name", "scoringMethod", "targetValue", "weightPercent", "maxScore", "descriptionGuide"]
      .filter(key => item[key] !== undefined).map(key => [key, item[key]]));
    return { ...reference, _id: id, ...(typeof item.stageId === "string" ? { stageId: item.stageId.toLowerCase() } : {}) } as CriterionReference;
  });
}

/** Read-only diagnostic data. These properties are not fields in any MongoDB model. */
export interface EvaluationReview {
  applications: { applicationId: string; evaluatedCriteria: number; totalCriteria: number; issues: string[] }[];
  limitations: string[];
}

export function reviewEvaluations(criteria: readonly CriterionReference[], evaluations: readonly {
  criterionId?: unknown; actualValue?: number | boolean; computedScore?: number;
}[]) {
  const issues: string[] = [];
  let evaluatedCriteria = 0;
  if (!criteria.length) issues.push("לא התקבלו קריטריונים למשרה; אי אפשר לקבוע שההערכות הושלמו.");
  for (const criterion of criteria) {
    const label = criterion.name || criterion._id;
    const matches = evaluations.filter(value => String(value.criterionId) === criterion._id);
    if (!matches.length) { issues.push(label + ": חסרה הערכה. ערך חסר אינו אפס."); continue; }
    if (criterion.type === "BOOLEAN" && matches.some(value => value.actualValue === false))
      issues.push(label + ": לא עבר תנאי סף.");
    if (matches.length > 1) {
      issues.push(label + ": קיימות כמה הערכות; נדרש להסדיר כפילות או שילוב ציונים בין מראיינים.");
      continue;
    }
    const value = matches[0]!;
    try {
      if (value.actualValue === undefined) throw new Error("חסר ערך בפועל.");
      const expected = calculateScore(criterion, value.actualValue);
      // BOOLEAN never contributes a numeric score, even if an old record has one.
      if (expected !== undefined && (value.computedScore === undefined || !Number.isFinite(value.computedScore) ||
        Math.abs(value.computedScore - expected) > 1e-9 * Math.max(1, Math.abs(expected))))
        throw new Error("הציון המחושב חסר או אינו תואם לערך ולהגדרת הקריטריון העדכנית.");
      evaluatedCriteria++;
    } catch (error) {
      issues.push(label + ": " + (error instanceof Error ? error.message : "ההערכה אינה תקינה."));
    }
  }
  if (evaluations.some(value => !criteria.some(criterion => criterion._id === String(value.criterionId))))
    issues.push("קיימות הערכות לקריטריונים שאינם ברשימה העדכנית של המשרה; נדרש לבדוק אותן.");
  return { evaluatedCriteria, issues };
}
