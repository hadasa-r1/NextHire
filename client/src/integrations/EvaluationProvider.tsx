import { createContext, useContext, type ReactNode } from "react";
import type { CriterionReference, EvaluationInput, EvaluationContext } from "@scoring";
export type { CriterionReference, EvaluationInput, EvaluationContext } from "@scoring";

export interface EvaluationServices {
  loadContext: (applicationId: string, signal: AbortSignal) => Promise<EvaluationContext>;
  previewScore?: (criterion: CriterionReference, actualValue: number | boolean) => number | undefined;
  // Each criterion is saved atomically; a retry updates the same interviewer's record.
  saveEvaluations?: (applicationId: string, values: readonly EvaluationInput[]) => Promise<void>;
}
const EvaluationContext = createContext<EvaluationServices | undefined>(undefined);

export function EvaluationProvider({ services, children }: { services?: EvaluationServices; children: ReactNode }) {
  return <EvaluationContext.Provider value={services}>{children}</EvaluationContext.Provider>;
}
export function useEvaluationServices() { return useContext(EvaluationContext); }

export { validateCriteria, validateStages } from "@scoring";
