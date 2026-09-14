export interface CriterionReference {
  _id: string; stageId?: string; name?: string;
  type: "BOOLEAN" | "SCORED"; scoringMethod?: "RATIO" | "DIRECT";
  targetValue?: number; weightPercent?: number; maxScore?: number; descriptionGuide?: string;
}
export interface EvaluationInput { criterionId: string; actualValue: number | boolean; notes?: string }
export interface EvaluationContext { criteria: readonly CriterionReference[]; evaluations: readonly EvaluationInput[] }

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
