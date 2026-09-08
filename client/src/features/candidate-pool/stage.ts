// ---------------------------------------------------------------------------
// Row status logic for the candidate pool: current stage + threshold badge +
// the context-aware "פעולה" action. Kept out of the JSX so it is easy to adjust
// when the real data lands.
//
// ⚠️ `Application.currentStage` does NOT exist on the backend yet (explicit TODO
// in src/models/application.model.ts — Group B deferred it until its type is
// approved: enum? ref to a Stage entity?). Everything stage-related below is a
// STUB against an assumed string code. When the real field ships:
//   1. point `readStage()` at the real value,
//   2. replace the keys of STAGE_LABELS / STAGE_ACTIONS with the approved codes.
// Nothing else in the screen needs to change.
// ---------------------------------------------------------------------------

export type StageCode =
  | "screening" //           תנאי סף
  | "phone_interview" //      ראיון טלפוני
  | "awaiting_scheduling" //  ממתין לתיאום
  | "second_round" //         שלב שני
  | "reserve" //              עתודה
  | "unknown";

const STAGE_LABELS: Record<StageCode, string> = {
  screening: "תנאי סף",
  phone_interview: "ראיון טלפוני",
  awaiting_scheduling: "ממתין לתיאום",
  second_round: "שלב שני",
  reserve: "עתודה",
  unknown: "—",
};

export type ActionKind = "open-file" | "schedule" | "view";

export interface StageAction {
  label: string;
  kind: ActionKind;
}

// Which action the "פעולה" button offers per stage. Adjust freely.
const STAGE_ACTIONS: Record<StageCode, StageAction> = {
  screening: { label: "צפייה", kind: "view" },
  phone_interview: { label: "פתיחת תיק", kind: "open-file" },
  awaiting_scheduling: { label: "תיאום", kind: "schedule" },
  second_round: { label: "פתיחת תיק", kind: "open-file" },
  reserve: { label: "צפייה", kind: "view" },
  unknown: { label: "צפייה", kind: "view" },
};

// STUB: the API sends no stage, so this returns "unknown" until the field exists.
export function readStage(application: { currentStage?: string }): StageCode {
  const raw = application.currentStage;
  return raw !== undefined && raw in STAGE_LABELS ? (raw as StageCode) : "unknown";
}

export function stageLabel(stage: StageCode): string {
  return STAGE_LABELS[stage];
}

// A failed threshold overrides the stage — there is no further action to take.
export function actionFor(
  stage: StageCode,
  passedThreshold: boolean | undefined,
): StageAction {
  if (passedThreshold === false) {
    return { label: "צפייה", kind: "view" };
  }
  return STAGE_ACTIONS[stage];
}

// design-system <Badge> tones actually available: draft | pending | published |
// success. There is no "danger" tone, so a failed threshold uses "pending".
export type ThresholdTone = "draft" | "pending" | "success";

export function thresholdBadge(passed: boolean | undefined): {
  tone: ThresholdTone;
  label: string;
} {
  if (passed === true) return { tone: "success", label: "עבר" };
  if (passed === false) return { tone: "pending", label: "נכשל" };
  return { tone: "draft", label: "טרם נבדק" };
}
