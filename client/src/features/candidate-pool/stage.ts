export type StageCode = "unknown";
export type ActionKind = "view";
export interface StageAction { label: string; kind: ActionKind }

// TODO: currentStage's type and its relationship to Stage require approval.
// Do not infer a stage from a value, URL parameter, score or threshold result.
export function readStage(_application: unknown): StageCode { return "unknown"; }
export function stageLabel(_stage: StageCode): string { return "—"; }
export function actionFor(_stage: StageCode, _passedThreshold: boolean | undefined): StageAction {
  return { label: "צפייה", kind: "view" };
}

export type ThresholdTone = "draft" | "pending" | "success";
export function thresholdBadge(passed: boolean | undefined): { tone: ThresholdTone; label: string } {
  if (passed === true) return { tone: "success", label: "עבר" };
  if (passed === false) return { tone: "pending", label: "נכשל" };
  return { tone: "draft", label: "טרם נבדק" };
}

