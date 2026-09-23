import type { CriterionReference, StageReference } from "../validation/scoring.mjs";
export const DEMO_POSITION_IDS = ["de0000000000000000000001", "de0000000000000000000002"] as const;
export const DEMO_INTERVIEWER_ID = "de0000000000000000000099";
export function demoCriteria(positionId: string): readonly CriterionReference[] {
  if (!DEMO_POSITION_IDS.some(id => id === positionId)) return [];
  return [
    { _id: "de0000000000000000000021", stageId: "de0000000000000000000031", type: "BOOLEAN", name: "תנאי סף השכלה — הדגמה", descriptionGuide: "בקובץ מפתח רמה א׳ די בחלופת השכלה מאושרת אחת; אין לדרוש את כל החלופות יחד. אין חובה בניסיון ברמה א׳." },
    ...(positionId === DEMO_POSITION_IDS[0] ? [] : [{ _id: "de0000000000000000000022", stageId: "de0000000000000000000032", type: "SCORED" as const, scoringMethod: "RATIO" as const, targetValue: 6, name: "ניסיון מקצועי לדוגמה", descriptionGuide: "דוגמת יחס בלבד למשרת ההדגמה; אין דרישת ניסיון במפל מפתח רמה א׳." }]),
    { _id: "de0000000000000000000023", stageId: "de0000000000000000000033", type: "SCORED", scoringMethod: "DIRECT", maxScore: 5, name: "יכולת למידה עצמית ומהירה — הדגמה" },
    ...["שאלת שאלות ופתרון עצמאי", "מוטיבציה", "חשיבה אנליטית ופתרון בעיות", "שליטה בשפת תכנות", "ניסיון ב־AI"].map((name, index) => ({
      _id: "de000000000000000000004" + index, stageId: "de0000000000000000000033", type: "SCORED" as const,
      scoringMethod: "DIRECT" as const, maxScore: 5, name: name + " — הדגמה",
    })),
    { _id: "de0000000000000000000024", stageId: "de0000000000000000000032", type: "SCORED", scoringMethod: "DIRECT", maxScore: 5, name: "התרשמות מהראיון — הדגמה", descriptionGuide: "קריטריון התנסות בלבד, ציון עד 5. אינו תבנית המפ״ל המאושרת." },
  ];
}

export function demoStages(positionId: string): readonly StageReference[] {
  if (!DEMO_POSITION_IDS.some(id => id === positionId)) return [];
  return [
    { _id: "de0000000000000000000031", positionId, name: "תנאי סף — הדגמה", order: 1 },
    { _id: "de0000000000000000000032", positionId, name: "ראיון טלפוני / זום — הדגמה", order: 2, ...(positionId === DEMO_POSITION_IDS[0] ? { weightPercent: 30 } : {}) },
    { _id: "de0000000000000000000033", positionId, name: "ראיון פרונטלי ומבחן מקצועי — הדגמה", order: 3, ...(positionId === DEMO_POSITION_IDS[0] ? { weightPercent: 70 } : {}) },
  ];
}
