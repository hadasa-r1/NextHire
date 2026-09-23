import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, Field, Heading, Input, Select, Table, Text } from "@ds/components";
import { PermissionGate } from "@/auth/PermissionGate";
import { usePermissions } from "@/auth/usePermissions";
import { useReferenceOptions } from "@/integrations/ReferenceDataProvider";
import { ReferenceState } from "@/integrations/ReferenceState";
import { PageLayout } from "@/shared/PageLayout";
import { PageState } from "@/shared/PageState";
import { apiRequest } from "@/api/client";
import { uploadResume } from "@/api/resumes";
import { RESUME_ACCEPT, resumeFileIssue } from "@resume-policy";
import { readImportWorkbook, type ImportRow, type ImportSheet } from "./import-workbook";
interface PreviewRow { row: number; idNumber: string; candidate: string; existingApplication: boolean; errors: string[]; warnings: string[] }
export function ApplicationImportPage() {
  const { positionId = "" } = useParams();
  const navigate = useNavigate();
  return <PageLayout title="הגשת מועמדים מקובץ" description="בחרו חברה, העלו קובץ ובדקו את הנתונים לפני הגשה למשרה."
    actions={<Button variant="secondary" onClick={() => navigate("/positions/" + encodeURIComponent(positionId) + "/candidates")}>חזרה למועמדי המשרה</Button>}>
    <PermissionGate resource="Candidate" action="READ"><PermissionGate resource="Candidate" action="WRITE"><PermissionGate resource="Application" action="WRITE">
      {/^[a-f\d]{24}$/i.test(positionId) ? <ImportEditor positionId={positionId} /> : <PageState kind="error" message="מזהה המשרה אינו תקין." />}
    </PermissionGate></PermissionGate></PermissionGate>
  </PageLayout>;
}
function ImportEditor({ positionId }: { positionId: string }) {
  const navigate = useNavigate(), { can } = usePermissions();
  const companies = useReferenceOptions("Company"), positions = useReferenceOptions("Position");
  const [params] = useSearchParams();
  const [companyId, setCompanyId] = useState(params.get("companyId") ?? "");
  const [sheets, setSheets] = useState<ImportSheet[]>([]), [sheetName, setSheetName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]), [files, setFiles] = useState<Record<number, File>>({});
  const [preview, setPreview] = useState<PreviewRow[] | null>(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = sheets.find(sheet => sheet.name === sheetName);
  function selectSheet(name: string, source = sheets) { setSheetName(name); setRows(source.find(sheet => sheet.name === name)?.rows ?? []); setFiles({}); setPreview(null); }
  async function read(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(""); setPreview(null); setRows([]); setSheets([]);
    try {
      const parsed = await readImportWorkbook(file); setSheets(parsed);
      selectSheet(parsed.find(sheet => sheet.supported && sheet.name === "מועמדים")?.name ?? parsed.find(sheet => sheet.supported)?.name ?? parsed[0]?.name ?? "", parsed);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "לא ניתן לקרוא את הקובץ."); }
    finally { setBusy(false); }
  }
  function edit(index: number, update: Partial<ImportRow>) { setRows(previous => previous.map((row, i) => i === index ? { ...row, ...update } : row)); setPreview(null); }
  async function check() {
    if (busy) return;
    setBusy(true); setError(""); setPreview(null);
    const ready = [...rows];
    try {
      for (const [indexText, file] of Object.entries(files)) {
        const index = Number(indexText), issue = resumeFileIssue(file.name, file.size);
        if (issue) throw new Error("שורה " + (index + 1) + ": " + issue);
        ready[index] = { ...ready[index]!, resumeUrl: await uploadResume(file) };
        setRows([...ready]); setFiles(previous => { const next = { ...previous }; delete next[index]; return next; });
      }
      const result = await apiRequest<{ rows: PreviewRow[] }>("/submissions/preview", { method: "POST", body: { positionId, companyId, rows: ready } });
      setPreview(result.rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "בדיקת הנתונים נכשלה."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (busy || !preview || preview.some(row => row.errors.length)) return;
    setBusy(true); setError("");
    try {
      const result = await apiRequest<{ complete: boolean; results: { row: number; rejected?: boolean; error?: string }[] }>("/submissions/commit", { method: "POST", body: { positionId, companyId, rows } });
      if (!result.complete) { setPreview(null); throw new Error(result.results.find(row => row.error)?.error ?? "חלק מהשורות לא נשמרו. בדקו ונסו שוב."); }
      const rejected = result.results.filter(row => row.rejected).length;
      navigate("/positions/" + encodeURIComponent(positionId) + "/candidates", { state: { notice: "ההגשות נקלטו. " + (rejected ? rejected + " הגשות פסולות להמשך התהליך." : "") } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "הייבוא נכשל."); }
    finally { setBusy(false); }
  }
  const ready = companies.status === "ready" && positions.status === "ready" && positions.options.some(p => p.id === positionId);
  return <div className="nh-section" aria-busy={busy}>
    <Card><fieldset className="nh-form-fields nh-section" disabled={busy}>
      <legend className="nh-sr-only">פרטי ייבוא</legend>
      <Heading level={2}>{positions.options.find(p => p.id === positionId)?.label ?? "משרה נבחרת"}</Heading>
      <ReferenceState status={positions.status} label="משרות" onRetry={positions.reload} />
      <ReferenceState status={companies.status} label="חברות" onRetry={companies.reload} />
      <Field label="החברה המגישה"><Select aria-label="החברה המגישה" value={companyId} onChange={event => { setCompanyId(event.target.value); setPreview(null); }}>
        <option value="">בחרו חברה</option>{companies.options.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </Select></Field>
      <Text>כל השורות יוגשו בשם החברה שנבחרה. עמודת חברה בקובץ אינה קובעת הרשאה או שיוך.</Text>
      <Field label="קובץ מועמדים או מפ״ל"><Input type="file" aria-label="בחירת קובץ מועמדים" accept=".xlsx" onChange={event => void read(event.target.files?.[0])} /></Field>
      <Text>עד 100 מועמדים, XLSX עד 5MB. כותרות נתמכות: שם מועמד, תז מועמד, טלפון, דוא״ל, שכר שעתי, קורות חיים, LinkedIn, GitHub וקישור לתמונה. בקובץ אפשר לשמור קישורים לקבצים; אפשר גם לצרף קורות חיים מהמחשב בהמשך.</Text>
      <Text>ציונים והחלטות מהאקסל אינם מיובאים כהערכות. גיליונות הניקוד וההחלטות נשארים לעיון בלבד.</Text>
      {sheets.length > 0 && <Field label="גיליון"><Select aria-label="גיליון" value={sheetName} onChange={event => selectSheet(event.target.value)}>
        {sheets.map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name}{sheet.supported ? "" : " — אינו רשימת מועמדים"}</option>)}
      </Select></Field>}
    </fieldset></Card>
    {selected && !selected.supported && <PageState message="בגיליון זה אין כותרות שם ות״ז לייבוא. בחרו את גיליון המועמדים." />}
    {selected?.supported && !rows.length && <PageState message="הטבלה ריקה. מלאו שמות ות״ז בקובץ והעלו אותו שוב." />}
    {selected?.issues.map(issue => <PageState key={issue} kind="error" message={issue} />)}
    {rows.length > 0 && <Card><div className="nh-section"><Heading level={2}>בדיקה והשלמה לפני הגשה</Heading>
      <Text>מועמד קיים יזוהה לפי ת״ז. פרטי הפרופיל שלו לא יידרסו. ללא קורות חיים לא נוצרת הגשה חדשה.</Text>
      <fieldset className="nh-form-fields" disabled={busy}><div className="nh-table-region"><Table>
        <thead><tr><th>שורה</th><th>שם ות״ז</th><th>תעריף שעתי</th><th>קורות חיים</th><th>בדיקה</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}><td>{index + 1}</td><td>
          <Input aria-label={"שם בשורה " + (index + 1)} value={row.fullName} onChange={e => edit(index, { fullName: e.target.value })} />
          <Input aria-label={"תעודת זהות בשורה " + (index + 1)} dir="ltr" value={row.idNumber} onChange={e => edit(index, { idNumber: e.target.value })} />
        </td><td><Input aria-label={"תעריף בשורה " + (index + 1)} type="number" min="0" step="any" value={row.hourlyRateBid ?? ""} onChange={e => {
          const next = { ...row }; if (e.target.value === "") delete next.hourlyRateBid; else next.hourlyRateBid = Number(e.target.value);
          setRows(previous => previous.map((r, i) => i === index ? next : r)); setPreview(null);
        }} /></td><td>
          <Input aria-label={"קישור לקורות חיים בשורה " + (index + 1)} value={row.resumeUrl ?? ""} dir="ltr" onChange={e => edit(index, { resumeUrl: e.target.value })} />
          <Input type="file" accept={RESUME_ACCEPT} aria-label={"קובץ קורות חיים בשורה " + (index + 1)} onChange={event => {
            const file = event.target.files?.[0]; setFiles(previous => { const next = { ...previous }; if (file) next[index] = file; else delete next[index]; return next; }); setPreview(null);
          }} />
        </td><td>{preview?.[index] ? <>
          <Text>{preview[index]!.candidate === "existing" ? "מועמד קיים" : "מועמד חדש"}</Text>
          {preview[index]!.errors.map(text => <PageState key={text} kind="error" message={text} />)}
          {preview[index]!.warnings.map(text => <Text key={text}>{text}</Text>)}
        </> : "ממתין לבדיקה"}</td></tr>)}</tbody>
      </Table></div></fieldset>
      <div className="nh-actions">
        <Button disabled={busy || !ready || !companyId || Boolean(selected?.issues.length) || !can("Application", "WRITE")} onClick={() => void check()}>{busy ? "מעבד…" : "בדיקת הנתונים"}</Button>
        <Button variant="secondary" disabled={busy || !preview || preview.some(row => row.errors.length > 0)} onClick={() => void commit()}>אישור הגשת המועמדים</Button>
      </div>
    </div></Card>}
    {error && <PageState kind="error" message={error} />}
  </div>;
}
