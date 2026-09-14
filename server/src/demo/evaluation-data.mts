import type { CriterionReference } from "../validation/scoring.mjs";
export const DEMO_POSITION_IDS = ["de0000000000000000000001", "de0000000000000000000002"] as const;
export const DEMO_INTERVIEWER_ID = "de0000000000000000000099";
export function demoCriteria(positionId: string): readonly CriterionReference[] {
  if (!DEMO_POSITION_IDS.some(id => id === positionId)) return [];
  return [
    { _id: "de0000000000000000000021", type: "BOOLEAN", name: "תנאי סף לדוגמה", descriptionGuide: "בחירת עבר או לא עבר." },
    { _id: "de0000000000000000000022", type: "SCORED", scoringMethod: "RATIO", targetValue: 6, name: "ניסיון מקצועי לדוגמה", descriptionGuide: "הערך בפועל חלקי ערך היעד, באחוזים. מוצג היחס הגולמי." },
    { _id: "de0000000000000000000023", type: "SCORED", scoringMethod: "DIRECT", name: "התרשמות מקצועית לדוגמה" },
  ];
}
