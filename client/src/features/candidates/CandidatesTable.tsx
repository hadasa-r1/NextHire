import { useNavigate } from "react-router-dom";
import { Button, Table } from "@ds/components";
import { usePermissions } from "@/auth/usePermissions";
import type { Candidate } from "@/types/domain";

export function CandidatesTable({ candidates }: { candidates: readonly Candidate[] }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  return (
    <div className="nh-table-region" role="region" aria-label="רשימת מועמדים" tabIndex={0}>
      <Table>
        <caption className="nh-sr-only">פרטי המועמדים ופעולות</caption>
        <thead><tr>
          <th scope="col">שם מלא</th><th scope="col">מספר זהות</th>
          <th scope="col">טלפון</th><th scope="col">דוא״ל</th><th scope="col">פעולות</th>
        </tr></thead>
        <tbody>{candidates.map((candidate) => (
          <tr key={candidate._id}>
            <td>{candidate.fullName || "—"}</td>
            <td><bdi>{candidate.idNumber}</bdi></td>
            <td><bdi>{candidate.phone || "—"}</bdi></td>
            <td><bdi>{candidate.email || "—"}</bdi></td>
            <td><div className="nh-actions">
              <Button type="button" variant="secondary" onClick={() => navigate("/candidates/" + encodeURIComponent(candidate._id))}
                aria-label={"צפייה בפרטי " + (candidate.fullName || candidate.idNumber)}>צפייה</Button>
              {can("Candidate", "WRITE") && <Button type="button" variant="secondary"
                onClick={() => navigate("/candidates/" + encodeURIComponent(candidate._id) + "/edit")}
                aria-label={"עריכת " + (candidate.fullName || candidate.idNumber)}>עריכה</Button>}
            </div></td>
          </tr>
        ))}</tbody>
      </Table>
    </div>
  );
}

