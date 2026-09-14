import { apiGet, apiRequest } from "./client";
import { calculateScore, type EvaluationContext, type EvaluationInput } from "@scoring";
import type { EvaluationServices } from "@/integrations/EvaluationProvider";

export const evaluationServices: EvaluationServices = {
  loadContext(applicationId, signal) {
    return apiGet<EvaluationContext>("/workflow/applications/" + encodeURIComponent(applicationId) + "/evaluation-context", signal);
  },
  previewScore: calculateScore,
  async saveEvaluations(applicationId, values: readonly EvaluationInput[]) {
    let saved = 0;
    for (const value of values) {
      try {
        await apiRequest("/workflow/applications/" + encodeURIComponent(applicationId) + "/evaluations", { method: "POST", body: value });
        saved++;
      } catch (error) {
        throw new Error(`נשמרו ${saved} מתוך ${values.length} קריטריונים. ${error instanceof Error ? error.message : "השמירה נכשלה."} ניתן לנסות שוב; הקריטריונים שכבר נשמרו יעודכנו.`);
      }
    }
  },
};
