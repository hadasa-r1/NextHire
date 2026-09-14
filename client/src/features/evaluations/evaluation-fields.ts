import type { CriterionReference, EvaluationInput } from "@/integrations/EvaluationProvider";

export interface EvaluationFields { value: string; notes: string }

export function evaluationInput(criterion: CriterionReference, fields: EvaluationFields): EvaluationInput {
  let actualValue: number | boolean;
  if (criterion.type === "BOOLEAN") {
    if (fields.value !== "true" && fields.value !== "false") throw new Error("יש לבחור עבר או לא עבר.");
    actualValue = fields.value === "true";
  } else {
    if (!fields.value.trim()) throw new Error("יש להזין ערך להערכה.");
    actualValue = Number(fields.value);
    if (!Number.isFinite(actualValue)) throw new Error("ערך ההערכה חייב להיות מספר תקין.");
  }
  return {
    criterionId: criterion._id,
    actualValue,
    ...(fields.notes.trim() ? { notes: fields.notes.trim() } : {}),
  };
}

export function previewLabel(criterion: CriterionReference, value: string,
  preview?: (criterion: CriterionReference, actualValue: number | boolean) => number | undefined): string {
  if (!value.trim()) return "טרם הוזן ערך";
  if (!preview) return "ממתין להגדרת חישוב מאושרת";
  try {
    const input = evaluationInput(criterion, { value, notes: "" });
    const score = preview(criterion, input.actualValue);
    return typeof score === "number" && Number.isFinite(score) ? score.toLocaleString("he-IL", { maximumFractionDigits: 2 }) : "טרם חושב";
  } catch { return "לא ניתן לחשב עבור הערך שהוזן"; }
}

