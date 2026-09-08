import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet } from "@/api/client";
import type { Candidate } from "@/types/domain";

export type CandidatesStatus = "loading" | "error" | "ready";

export interface CandidatesState {
  status: CandidatesStatus;
  candidates: readonly Candidate[];
  errorMessage: string | null;
  reload: () => void;
}

// Loads the full, unfiltered list of every candidate in the system
// (GET /api/candidates). Not scoped to any position or application.
export function useCandidates(): CandidatesState {
  const [status, setStatus] = useState<CandidatesStatus>("loading");
  const [candidates, setCandidates] = useState<readonly Candidate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage(null);

    apiGet<Candidate[]>("/candidates", controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setCandidates(next);
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
  }, [reloadToken]);

  return { status, candidates, errorMessage, reload };
}
