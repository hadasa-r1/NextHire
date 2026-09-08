import { useMemo, useState, type ReactNode } from "react";
import { Button, Card, Heading, Input, Text } from "@ds/components";
import { CandidatesTable } from "./CandidatesTable";
import { filterCandidates } from "./filter";
import { useCandidates } from "./useCandidates";

export function CandidatesPage() {
  const { status, candidates, errorMessage, reload } = useCandidates();
  const [query, setQuery] = useState("");

  const visibleCandidates = useMemo(
    () => filterCandidates(candidates, query),
    [candidates, query],
  );

  return (
    <CandidatesLayout
      heading="רשימת מועמדים"
      subtitle={status === "ready" ? `${candidates.length} מועמדים` : undefined}
    >
      {status === "ready" && candidates.length > 0 && (
        <div style={toolbarStyle}>
          <Input
            type="search"
            placeholder="חיפוש לפי שם או תעודת זהות"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ minWidth: 280 }}
          />
        </div>
      )}

      {status === "loading" && <Text>טוען מועמדים…</Text>}

      {status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          <Text>{errorMessage ?? "אירעה שגיאה."}</Text>
          <Button variant="secondary" onClick={reload}>
            נסו שוב
          </Button>
        </div>
      )}

      {status === "ready" && candidates.length === 0 && (
        <Text>אין מועמדים במערכת</Text>
      )}

      {status === "ready" && candidates.length > 0 && (
        <>
          <CandidatesTable candidates={visibleCandidates} />
          {visibleCandidates.length === 0 && (
            <Text>לא נמצאו מועמדים התואמים לחיפוש.</Text>
          )}
        </>
      )}
    </CandidatesLayout>
  );
}

interface CandidatesLayoutProps {
  heading: string;
  subtitle?: string | undefined;
  children: ReactNode;
}

function CandidatesLayout({ heading, subtitle, children }: CandidatesLayoutProps) {
  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <Heading level={1}>{heading}</Heading>
          {subtitle && (
            <div style={headerMetaStyle}>
              <Text>{subtitle}</Text>
            </div>
          )}
        </header>
        <Card>{children}</Card>
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

const headerMetaStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  marginTop: 6,
} as const;

const toolbarStyle = {
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: 16,
} as const;
