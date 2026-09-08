import type { PoolRow } from "./poolRow";

// Client-side search over the already-loaded rows (per the screen spec).
// Matches candidate full name or ID number, case-insensitively.
export function filterRows(
  rows: readonly PoolRow[],
  query: string,
): PoolRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return [...rows];
  }
  return rows.filter(
    (row) =>
      row.candidateName.toLowerCase().includes(needle) ||
      row.candidateIdNumber.toLowerCase().includes(needle),
  );
}
