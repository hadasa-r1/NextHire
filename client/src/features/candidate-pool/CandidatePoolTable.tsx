import { Badge, Button, Table } from "@ds/components";
import type { PoolRow } from "./poolRow";
import { thresholdBadge } from "./stage";

// STUB marker: until a companies API exists, the cell holds a raw ObjectId.
// Render it as muted monospace reference text, not as if it were a name.
const OBJECT_ID = /^[a-f\d]{24}$/i;

function CompanyCell({ label }: { label: string }) {
  if (OBJECT_ID.test(label)) {
    return (
      <span
        title={`מזהה חברה (אין עדיין שם): ${label}`}
        style={{
          fontFamily: "var(--rf-font-mono)",
          fontSize: 12,
          color: "var(--rf-ink-faint)",
        }}
      >
        {label.slice(-6)}
      </span>
    );
  }
  return <>{label}</>;
}

interface CandidatePoolTableProps {
  rows: readonly PoolRow[];
  onAction: (row: PoolRow) => void;
}

// Presentational only — no data fetching, no business rules beyond reading the
// already-resolved PoolRow.
export function CandidatePoolTable({ rows, onAction }: CandidatePoolTableProps) {
  return (
    <Table>
      <thead>
        <tr>
          <th>שם מלא</th>
          <th>חברה</th>
          <th>תנאי סף</th>
          <th>שלב נוכחי</th>
          <th>ציון</th>
          <th>פעולה</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const badge = thresholdBadge(row.passedThreshold);
          return (
            <tr key={row.applicationId}>
              <td>{row.candidateName}</td>
              <td>
                <CompanyCell label={row.companyLabel} />
              </td>
              <td>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </td>
              <td>{row.stageLabel}</td>
              <td className="num">{row.score ?? "—"}</td>
              <td>
                <Button variant="secondary" onClick={() => onAction(row)}>
                  {row.action.label}
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
