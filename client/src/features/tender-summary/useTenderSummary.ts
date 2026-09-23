import { useCallback } from "react";
import { apiGet } from "@/api/client";
import { usePermissions } from "@/auth/usePermissions";
import { useTaskResource } from "@/shared/useTaskResource";
import type { ApplicationWithCandidate, TenderSummary } from "@/types/domain";
import { buildTenderRows } from "./tender-rows";

export async function loadTenderRows(positionId: string, includeCandidates: boolean, signal: AbortSignal) {
  const received = await apiGet<ApplicationWithCandidate[]>("/applications?positionId=" + encodeURIComponent(positionId) +
    (includeCandidates ? "&populate=candidateId" : ""), signal);
  const applications = received.filter(application => application.positionId?.toLowerCase() === positionId.toLowerCase());
  const summaries: TenderSummary[] = [];
  for (let start = 0; start < applications.length; start += 6) {
    signal.throwIfAborted();
    const batch = await Promise.all(applications.slice(start, start + 6).map(application =>
      apiGet<TenderSummary[]>("/tender-summaries?applicationId=" + encodeURIComponent(application._id), signal)));
    summaries.push(...batch.flat());
  }
  // Applications drive the rows. Missing summaries must never hide a candidate.
  return buildTenderRows(applications, summaries);
}
export function useTenderSummary(positionId: string) {
  const { can, session } = usePermissions();
  const includeCandidates = can("Candidate", "READ");
  const load = useCallback((signal: AbortSignal) =>
    loadTenderRows(positionId, includeCandidates, signal), [positionId, includeCandidates, session]);
  return useTaskResource(positionId, load);
}
