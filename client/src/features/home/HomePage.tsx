import { useNavigate } from "react-router-dom";
import { Button, Card, Heading, Text } from "@ds/components";
import { PageLayout } from "@/shared/PageLayout";

export function HomePage() {
  const navigate = useNavigate();
  return (
    <PageLayout title="ניהול גיוס ותיחור" description="ניהול מועמדים והגשות למשרות." narrow>
      <Card><section className="nh-section" aria-label="מאגר המועמדים">
        <Heading level={2}>מאגר מועמדים</Heading>
        <Text>גישה לפרטי המועמדים, לחיפוש ולמעקב אחר ההגשות שלהם.</Text>
        <div className="nh-actions"><Button type="button" onClick={() => navigate("/candidates")}>רשימת מועמדים</Button></div>
      </section></Card>
    </PageLayout>
  );
}

