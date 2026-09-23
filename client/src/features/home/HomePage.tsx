import { useNavigate } from "react-router-dom";
import { Button, Card, Heading, Text } from "@ds/components";
import { usePermissions } from "@/auth/usePermissions";
import { PageLayout } from "@/shared/PageLayout";

export function HomePage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  return <PageLayout title="ניהול תהליכי גיוס" description="התחילו מבחירת משרה, והמשיכו למועמדים, להערכות ולמפ״ל שלה.">
    <Card><section className="nh-section">
      <Heading level={2}>עבודה לפי משרה</Heading>
      <Text>חפשו משרה, פתחו את רשימת המועמדים שלה והגישו מועמד קיים או חדש.</Text>
      <div className="nh-actions"><Button disabled={!can("Position", "READ")} onClick={() => navigate("/positions")}>לרשימת המשרות</Button></div>
    </section></Card>
    <Card><section className="nh-section">
      <Heading level={2}>סדר העבודה</Heading>
      <ol><li>בחירת משרה והגשת מועמדים עם קורות חיים.</li><li>בדיקת תנאי הסף של כל הגשה.</li><li>הזנת הערכות לראיונות ולמבחנים שהוגדרו במשרה.</li><li>צפייה בטבלת המפ״ל של אותה משרה.</li></ol>
      <Text>פרטי הקשר והפרופיל של המועמד נשמרים במאגר. ההערכות וההחלטות שייכות להגשה שלו למשרה מסוימת.</Text>
      {can("Candidate", "READ") && <div className="nh-actions"><Button variant="secondary" onClick={() => navigate("/candidates")}>למאגר המועמדים</Button></div>}
    </section></Card>
  </PageLayout>;
}
