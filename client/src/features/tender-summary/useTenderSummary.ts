import { useCallback } from "react";
import { apiGet } from "@/api/client";
import { usePermissions } from "@/auth/usePermissions";
import { useTaskResource } from "@/shared/useTaskResource";
import type { ApplicationWithCandidate, TenderSummary } from "@/types/domain";
import { buildTenderRows } from "./tender-rows";

export function useTenderSummary(positionId: string) {
  const { can, session } = usePermissions();
  const includeCandidates = can("Candidate", "READ");
  const load = useCallback(async (signal: AbortSignal) => {
    const applications = await apiGet<ApplicationWithCandidate[]>("/applications?positionId=" + encodeURIComponent(positionId) +
      (includeCandidates ? "&populate=candidateId" : ""), signal);
    const summaries: TenderSummary[] = [];
    // The API supports applicationId filters, but not a bulk position lookup.
    // Limit concurrency and never read another position's summaries.
    for (let start = 0; start < applications.length; start += 6) {
      signal.throwIfAborted();
      const batch = await Promise.all(applications.slice(start, start + 6).map((application) =>
        apiGet<TenderSummary[]>("/tender-summaries?applicationId=" + encodeURIComponent(application._id), signal)));
      summaries.push(...batch.flat());
    }
    return buildTenderRows(applications, summaries);
  }, [positionId, includeCandidates, session]);
  return useTaskResource(positionId, load);
}

