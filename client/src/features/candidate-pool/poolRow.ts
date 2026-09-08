import type {
  ApplicationWithCandidate,
  Candidate,
  EvaluationScore,
  TenderSummary,
} from "@/types/domain";
import { actionFor, readStage, stageLabel, type StageAction } from "./stage";

// One table row, fully resolved and ready to render.
export interface PoolRow {
  applicationId: string;
  candidateName: string;
  candidateIdNumber: string;
  companyLabel: string;
  passedThreshold: boolean | undefined;
  stageLabel: string;
  score: number | null;
  action: StageAction;
}

interface BuildPoolRowsInput {
  applications: readonly ApplicationWithCandidate[];
  tenderSummaryByApplication: ReadonlyMap<string, TenderSummary>;
  latestEvaluationByApplication: ReadonlyMap<string, EvaluationScore>;
}

export function buildPoolRows(input: BuildPoolRowsInput): PoolRow[] {
  const {
    applications,
    tenderSummaryByApplication,
    latestEvaluationByApplication,
  } = input;

  return applications.map((application) => {
    const candidate = asCandidate(application.candidateId);
    const stage = readStage(application);

    return {
      applicationId: application._id,
      candidateName: candidate?.fullName ?? "—",
      candidateIdNumber: candidate?.idNumber ?? "",
      // STUB: there is no Company model on the Group B backend, so `companyId`
      // cannot be resolved to a name here. Show the raw id (or a dash) until
      // Group A/C expose a companies endpoint.
      companyLabel: application.companyId ?? "—",
      passedThreshold: application.passedThreshold,
      stageLabel: stageLabel(stage),
      score: resolveScore(
        tenderSummaryByApplication.get(application._id),
        latestEvaluationByApplication.get(application._id),
      ),
      action: actionFor(stage, application.passedThreshold),
    };
  });
}

function asCandidate(
  value: Candidate | string | undefined,
): Candidate | undefined {
  return value !== null && typeof value === "object" ? value : undefined;
}

// Score priority, per the screen spec:
//   1. TenderSummary.finalWeightedScore
//   2. latest EvaluationScore.computedScore
//   3. null → rendered as "—"
function resolveScore(
  summary: TenderSummary | undefined,
  evaluation: EvaluationScore | undefined,
): number | null {
  if (typeof summary?.finalWeightedScore === "number") {
    return summary.finalWeightedScore;
  }
  if (typeof evaluation?.computedScore === "number") {
    return evaluation.computedScore;
  }
  return null;
}
