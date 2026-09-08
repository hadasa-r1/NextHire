import { useMemo, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Heading, Input, Text } from "@ds/components";
import { CandidatePoolTable } from "./CandidatePoolTable";
import { filterRows } from "./filter";
import type { PoolRow } from "./poolRow";
import { useApplicationsForPosition } from "./useApplicationsForPosition";

export function CandidatePoolPage() {
  const { positionId } = useParams();

  if (!positionId) {
    return (
      <PoolLayout heading="מאגר מועמדים פנימי">
        <Text>לא צוינה משרה בכתובת.</Text>
      </PoolLayout>
    );
  }

  return <CandidatePool positionId={positionId} />;
}

function CandidatePool({ positionId }: { positionId: string }) {
  const [searchParams] = useSearchParams();
  const { status, rows, errorMessage, reload } =
    useApplicationsForPosition(positionId);
  const [query, setQuery] = useState("");

  const visibleRows = useMemo(() => filterRows(rows, query), [rows, query]);

  // The Position entity belongs to Group A and is not reachable from here, so
  // the title comes from the link that opened this screen (?title=…) when
  // present. TODO: read Position.title + the submission-window status from a
  // positions API once one exists.
  const positionTitle =
    searchParams.get("title")?.trim() || "מאגר מועמדים פנימי";
  const submissionsClosed = searchParams.get("closed") === "1";

  return (
    <PoolLayout
      heading={positionTitle}
      subtitle={status === "ready" ? `${rows.length} מועמדים` : undefined}
      note={submissionsClosed ? "הגשות נסגרו" : undefined}
    >
      {status === "ready" && rows.length > 0 && (
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

      {status === "ready" && rows.length === 0 && (
        <Text>אין מועמדים למשרה זו</Text>
      )}

      {status === "ready" && rows.length > 0 && (
        <>
          <CandidatePoolTable rows={visibleRows} onAction={handleAction} />
          {visibleRows.length === 0 && (
            <Text>לא נמצאו מועמדים התואמים לחיפוש.</Text>
          )}
          <div style={{ marginTop: 14 }}>
            <Text>
              תצוגה זו מזינה ישירות את המשפך: חברה, תעודת זהות, שם, תנאי סף, ציוני
              שלב, סה״כ והערות — הכול מרוכז כאן.
            </Text>
          </div>
        </>
      )}
    </PoolLayout>
  );
}

// TODO: wire to the real destination screens once they exist:
//   open-file → the candidate's application detail / "תיק מועמד"
//   schedule  → the interview-scheduling flow
//   view      → a read-only application view
// Kept at the page level so routing stays a page concern, not a table concern.
function handleAction(row: PoolRow): void {
  console.warn(
    `[candidate-pool] action "${row.action.kind}" for application ${row.applicationId} — target screen not implemented yet.`,
  );
}

interface PoolLayoutProps {
  heading: string;
  subtitle?: string | undefined;
  note?: string | undefined;
  children: ReactNode;
}

function PoolLayout({ heading, subtitle, note, children }: PoolLayoutProps) {
  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <Heading level={1}>{heading}</Heading>
          {(subtitle || note) && (
            <div style={headerMetaStyle}>
              {subtitle && <Text>{subtitle}</Text>}
              {note && <Badge tone="pending">{note}</Badge>}
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
