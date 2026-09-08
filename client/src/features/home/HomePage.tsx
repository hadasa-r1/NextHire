import { useNavigate } from "react-router-dom";
import { Button, Card, Heading, Text } from "@ds/components";

// Landing page for the app ("/"). Replaces the throwaway DevIndex harness.
export function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <Heading level={1}>מערכת לניהול גיוס עובדים</Heading>
          <div style={{ marginTop: 6 }}>
            <Text>ניהול מועמדים, מועמדויות והערכות במקום אחד.</Text>
          </div>
        </header>
        <Card>
          <Button onClick={() => navigate("/candidates")}>רשימת מועמדים</Button>
        </Card>
      </div>
    </div>
  );
}

const pageStyle = {
  direction: "rtl",
  background: "var(--rf-paper)",
  minHeight: "100vh",
  padding: "40px 24px",
} as const;
