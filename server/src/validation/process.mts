import { calculateScore, type CriterionReference, type StageReference } from "./scoring.mjs";
export interface ProcessStep { id: string; name: string; state: "complete" | "available" | "blocked"; reason?: string; completed: number; total: number }
export interface ProcessState { steps: ProcessStep[]; blockedReason?: string }
type Score = { criterionId?: unknown; actualValue?: number | boolean; computedScore?: number };
export function stageProgress(criteria: readonly CriterionReference[], stages: readonly StageReference[], values: readonly Score[], passedThreshold?: boolean, blockedReason?: string): ProcessState {
  const ordered = [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const configured = ordered.length > 0 && ordered.every(s => typeof s.order === "number") && new Set(ordered.map(s => s.order)).size === ordered.length;
  let priorComplete = configured;
  let previousName = "";
  const steps = ordered.map(stage => {
    const definitions = criteria.filter(c => c.stageId === stage._id);
    const completed = definitions.filter(c => {
      const matches = values.filter(v => String(v.criterionId) === c._id);
      if (matches.length !== 1 || matches[0]!.actualValue === undefined) return false;
      const v = matches[0]!;
      try {
        const score = calculateScore(c, v.actualValue!);
        return c.type === "BOOLEAN" ? v.actualValue === true :
          score !== undefined && v.computedScore !== undefined && Math.abs(score - v.computedScore) < 1e-8 * Math.max(1, Math.abs(score));
      } catch { return false; }
    }).length;
    const scored = definitions.some(c => c.type === "SCORED");
    const thresholdCorrection = definitions.length > 0 && definitions.every(c => c.type === "BOOLEAN") && blockedReason === "המועמד לא עבר את תנאי הסף.";
    const reason = (thresholdCorrection ? undefined : blockedReason) || (!configured ? "סדר השלבים טרם הוגדר באופן תקין." :
      !priorComplete ? "יש להשלים תחילה את " + previousName + "." :
      scored && passedThreshold !== true ? "נדרש אישור עמידה בתנאי הסף." :
      !definitions.length ? "לא הוגדרו קריטריונים לשלב." : "");
    const complete = definitions.length > 0 && completed === definitions.length;
    const state: ProcessStep["state"] = reason ? "blocked" : complete ? "complete" : "available";
    priorComplete = priorComplete && complete && !reason && stage.quota === undefined;
    previousName = stage.quota !== undefined ? "החלטת המעבר לפי המכסה של " + (stage.name || stage._id) : stage.name || stage._id;
    return { id: stage._id, name: stage.name || stage._id, state, completed, total: definitions.length, ...(reason ? { reason } : {}) };
  });
  return { steps, ...(blockedReason ? { blockedReason } : {}) };
}
