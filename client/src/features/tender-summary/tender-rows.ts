import type { ApplicationWithCandidate, TenderSummary } from "@/types/domain";
import { candidateLabel } from "@/features/applications/application-fields";

export interface TenderRow {
  applicationId: string;
  candidate: string;
  summary?: TenderSummary;
}

export function buildTenderRows(applications: readonly ApplicationWithCandidate[], summaries: readonly TenderSummary[]): TenderRow[] {
  const ids = new Set(applications.map((application) => application._id));
  const byApplication = new Map<string, TenderSummary>();
  for (const summary of summaries) {
    if (!summary.applicationId || !ids.has(summary.applicationId)) continue;
    if (byApplication.has(summary.applicationId)) throw new Error("נמצא יותר מסיכום אחד לאותה הגשה.");
    byApplication.set(summary.applicationId, summary);
  }
  return applications.map((application) => {
    const summary = byApplication.get(application._id);
    return {
      applicationId: application._id,
      candidate: candidateLabel(application),
      ...(summary ? { summary } : {}),
    };
  }).sort((a, b) => {
    const aRank = a.summary?.rankPosition;
    const bRank = b.summary?.rankPosition;
    const aValid = typeof aRank === "number" && Number.isFinite(aRank);
    const bValid = typeof bRank === "number" && Number.isFinite(bRank);
    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;
    return aRank - bRank;
  });
}

