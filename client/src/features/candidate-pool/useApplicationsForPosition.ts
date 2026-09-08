import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet } from "@/api/client";
import type {
  ApplicationWithCandidate,
  EvaluationScore,
  TenderSummary,
} from "@/types/domain";
import { buildPoolRows, type PoolRow } from "./poolRow";

export type PoolStatus = "loading" | "error" | "ready";

export interface PoolState {
  status: PoolStatus;
  rows: readonly PoolRow[];
  errorMessage: string | null;
  reload: () => void;
}

// Loads everything the candidate-pool table needs for one position and merges it
// into rows. Presentation is left entirely to the components.
export function useApplicationsForPosition(positionId: string): PoolState {
  const [status, setStatus] = useState<PoolStatus>("loading");
  const [rows, setRows] = useState<readonly PoolRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage(null);

    load(positionId, controller.signal)
      .then((nextRows) => {
        if (controller.signal.aborted) return;
        setRows(nextRows);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "אירעה שגיאה בטעינת הנתונים.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [positionId, reloadToken]);

  return { status, rows, errorMessage, reload };
}

async function load(
  positionId: string,
  signal: AbortSignal,
): Promise<PoolRow[]> {
  const applications = await apiGet<ApplicationWithCandidate[]>(
    `/applications?positionId=${encodeURIComponent(positionId)}&populate=candidateId`,
    signal,
  );

  const applicationIds = new Set(applications.map((application) => application._id));

  // The backend has no bulk "scores for these applications" endpoint, so both
  // score collections are pulled once and indexed here. Fine at course-project
  // volumes; see client/README.md for the scaling caveat.
  const [tenderSummaries, evaluationScores] = await Promise.all([
    apiGet<TenderSummary[]>("/tender-summaries", signal),
    apiGet<EvaluationScore[]>("/evaluation-scores", signal),
  ]);

  return buildPoolRows({
    applications,
    tenderSummaryByApplication: indexByApplication(tenderSummaries, applicationIds),
    latestEvaluationByApplication: latestEvaluationByApplication(
      evaluationScores,
      applicationIds,
    ),
  });
}

function indexByApplication(
  summaries: readonly TenderSummary[],
  applicationIds: ReadonlySet<string>,
): Map<string, TenderSummary> {
  const byApplication = new Map<string, TenderSummary>();
  for (const summary of summaries) {
    if (summary.applicationId && applicationIds.has(summary.applicationId)) {
      byApplication.set(summary.applicationId, summary);
    }
  }
  return byApplication;
}

function latestEvaluationByApplication(
  scores: readonly EvaluationScore[],
  applicationIds: ReadonlySet<string>,
): Map<string, EvaluationScore> {
  const byApplication = new Map<string, EvaluationScore>();
  for (const score of scores) {
    const id = score.applicationId;
    if (!id || !applicationIds.has(id)) continue;

    const current = byApplication.get(id);
    if (!current || toTime(score.evaluatedAt) >= toTime(current.evaluatedAt)) {
      byApplication.set(id, score);
    }
  }
  return byApplication;
}

function toTime(value: string | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
