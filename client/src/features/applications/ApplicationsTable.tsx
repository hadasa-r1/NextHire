import { useNavigate } from "react-router-dom";
import { Badge, Button, Table } from "@ds/components";
import { usePermissions } from "@/auth/usePermissions";
import { DocumentButton } from "@/shared/DocumentButton";
import type { ReferenceOption } from "@/integrations/ReferenceDataProvider";
import type { ApplicationWithCandidate } from "@/types/domain";
import { candidateLabel } from "./application-fields";
import { thresholdBadge } from "./application-fields";

export function ApplicationsTable({ applications, companies }: {
  applications: readonly ApplicationWithCandidate[]; companies: readonly ReferenceOption[];
}) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const names = new Map(companies.map((company) => [company.id, company.label]));
  return <div className="nh-table-region" role="region" aria-label="הגשות למשרה" tabIndex={0}>
    <Table>
      <caption className="nh-sr-only">המועמדויות למשרה שנבחרה</caption>
      <thead><tr>
        <th scope="col">מועמד</th><th scope="col">חברה</th><th scope="col">תעריף שעתי מוצע</th>
        <th scope="col">קורות חיים</th><th scope="col">עמידה בתנאי סף</th><th scope="col">שלב נוכחי</th><th scope="col">החלטה</th><th scope="col">פעולות</th>
      </tr></thead>
      <tbody>{applications.map((application) => {
        const badge = thresholdBadge(application.passedThreshold);
        return <tr key={application._id}>
          <td>{candidateLabel(application)}</td>
          <td>{application.companyId ? names.get(application.companyId) ?? "מזהה חברה: " + application.companyId : "—"}</td>
          <td><bdi>{application.hourlyRateBid ?? "—"}</bdi></td>
          <td><DocumentButton url={application.resumeUrl} /></td>
          <td><Badge tone={badge.tone}>{badge.label}</Badge></td>
          <td><span title="סדר ההערכות מוצג בתרשים שבתיק ההגשה">—</span></td>
          <td>{application.rejectionReason || "לא תועדה דחייה"}</td>
          <td><div className="nh-actions">
            <Button type="button" variant="secondary" onClick={() => navigate("/applications/" + encodeURIComponent(application._id))}>צפייה</Button>
            {can("Application", "WRITE") && <Button type="button" variant="secondary" onClick={() => navigate("/applications/" + encodeURIComponent(application._id) + "/edit")}>עריכה</Button>}
          </div></td>
        </tr>;
      })}</tbody>
    </Table>
  </div>;
}

