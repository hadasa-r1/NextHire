import { Table } from "@ds/components";
import type { Candidate } from "@/types/domain";

interface CandidatesTableProps {
  candidates: readonly Candidate[];
}

// Presentational only — no data fetching, no filtering.
export function CandidatesTable({ candidates }: CandidatesTableProps) {
  return (
    <Table>
      <thead>
        <tr>
          <th>שם מלא</th>
          <th>תעודת זהות</th>
          <th>טלפון</th>
          <th>דוא״ל</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((candidate) => (
          <tr key={candidate._id}>
            <td>{candidate.fullName ?? "—"}</td>
            <td className="num">{candidate.idNumber}</td>
            <td>{candidate.phone ?? "—"}</td>
            <td>{candidate.email ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
