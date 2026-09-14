import type { Candidate } from "@/types/domain";

// Client-side search over the already-loaded candidates. Matches full name or ID
// number, case-insensitively. Candidate.fullName is optional.
export function filterCandidates(
  candidates: readonly Candidate[],
  query: string,
): Candidate[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return [...candidates];
  }
  return candidates.filter(
    (candidate) =>
      (candidate.fullName ?? "").toLowerCase().includes(needle) ||
      candidate.idNumber.toLowerCase().includes(needle),
  );
}
