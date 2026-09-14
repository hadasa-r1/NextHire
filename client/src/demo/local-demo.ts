import type { SessionLoader } from "@/auth/AuthProvider";
import type { ReferenceLoader } from "@/integrations/ReferenceDataProvider";
import { evaluationServices } from "@/api/evaluations";
import { DEMO_POSITION_IDS } from "@evaluation-demo";
export { DEMO_POSITION_IDS } from "@evaluation-demo";

// Local UI fixtures only. No User, Position, Company, Stage or Criterion models
// are created. These IDs are references and must not be mistaken for real entities.


export const loadDemoSession: SessionLoader = async (signal) => {
  signal.throwIfAborted();
  return {
    user: { _id: "de0000000000000000000099", name: "התנסות מקומית" },
    permissions: [
      { resource: "Candidate", actions: ["READ", "WRITE"] },
      { resource: "Application", actions: ["READ", "WRITE"] },
      { resource: "EvaluationScore", actions: ["READ", "WRITE"] },
      { resource: "TenderSummary", actions: ["READ", "WRITE"] },
      { resource: "Position", actions: ["READ"] },
      { resource: "Company", actions: ["READ"] },
      { resource: "Criterion", actions: ["READ"] },
    ],
  };
};

export const loadDemoOptions: ReferenceLoader = async (resource, signal) => {
  signal.throwIfAborted();
  if (resource === "Position") return [
    { id: DEMO_POSITION_IDS[0], label: "משרת פיתוח — הדגמה" },
    { id: DEMO_POSITION_IDS[1], label: "משרת בדיקות תוכנה — הדגמה" },
  ];
  return [
    { id: "de0000000000000000000011", label: "חברת הדגמה א׳" },
    { id: "de0000000000000000000012", label: "חברת הדגמה ב׳" },
  ];
};

export const demoEvaluationServices = evaluationServices;
