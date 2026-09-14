import { useId, useRef, useState, type FormEvent } from "react";
import { Button, Field, Input, Select, Text } from "@ds/components";
import { uploadResume } from "@/api/resumes";
import { RESUME_ACCEPT, resumeFileIssue } from "@resume-policy";
import { DocumentButton } from "@/shared/DocumentButton";
import { PageState } from "@/shared/PageState";
import type { ReferenceOption } from "@/integrations/ReferenceDataProvider";
import type { Application, Candidate } from "@/types/domain";
import { applicationFields, applicationDetailsPayload, type ApplicationValues } from "./application-fields";

export function ApplicationForm({ initialApplication, prefill, positions, companies, candidates, canSave, onSave, onCancel }: {
  initialApplication?: Application;
  prefill?: { positionId?: string; candidateId?: string };
  positions: readonly ReferenceOption[];
  companies: readonly ReferenceOption[];
  candidates: readonly Candidate[];
  canSave: boolean;
  onSave: (values: ApplicationValues) => Promise<void>;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [fields, setFields] = useState(() => applicationFields(initialApplication, prefill));
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const candidateOptions = candidates.map((candidate) => ({ id: candidate._id, label: (candidate.fullName || "מועמד") + " · " + candidate.idNumber }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || submitting.current) return;
    setError(null);
    let details: Omit<ApplicationValues, "resumeUrl">;
    try {
      details = applicationDetailsPayload(fields, initialApplication);
      if (resumeFile) {
        const issue = resumeFileIssue(resumeFile.name, resumeFile.size);
        if (issue) throw new Error(issue);
      } else if (!fields.resumeUrl) throw new Error("יש לבחור קובץ קורות חיים מהמחשב.");
      for (const [field, options] of [
        ["positionId", positions], ["companyId", companies], ["candidateId", candidateOptions],
      ] as const) {
        const value = fields[field];
        if (value && value !== initialApplication?.[field] && !options.some((option) => option.id === value)) {
          throw new Error("אחד הערכים שנבחרו אינו זמין. יש לבחור ערך מהרשימה.");
        }
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "יש לבדוק את נתוני ההגשה.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      let resumeUrl = fields.resumeUrl;
      if (resumeFile) {
        // Reuse a successful upload if saving the Application fails and is retried.
        if (uploaded.current?.file !== resumeFile) {
          uploaded.current = { file: resumeFile, url: await uploadResume(resumeFile) };
        }
        resumeUrl = uploaded.current.url;
      }
      await onSave({ ...details, resumeUrl });
    }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "לא ניתן לשמור את ההגשה. הנתונים נשארו בטופס."); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <form className="nh-section" onSubmit={submit} aria-busy={saving}>
    <Text>יש לצרף קורות חיים בקובץ PDF או Word מסוג DOCX, עד 10MB.</Text>
    <fieldset className="nh-form-fields" disabled={saving || !canSave}>
      <legend className="nh-sr-only">פרטי הגשה</legend>
      <div className="nh-form-grid">
        <Field label="משרה"><Select name="positionId" id={prefix + "-position"} aria-label="משרה" value={fields.positionId}
          onChange={(event) => setFields({ ...fields, positionId: event.target.value })}>
          <ReferenceOptions options={positions} selected={fields.positionId} hasExisting={Boolean(initialApplication?.positionId)} label="בחרו משרה" />
        </Select></Field>
        <Field label="מועמד"><Select name="candidateId" id={prefix + "-candidate"} aria-label="מועמד" value={fields.candidateId}
          onChange={(event) => setFields({ ...fields, candidateId: event.target.value })}>
          <ReferenceOptions options={candidateOptions} selected={fields.candidateId} hasExisting={Boolean(initialApplication?.candidateId)} label="בחרו מועמד" />
        </Select></Field>
        <Field label="חברה"><Select name="companyId" id={prefix + "-company"} aria-label="חברה" value={fields.companyId}
          onChange={(event) => setFields({ ...fields, companyId: event.target.value })}>
          <ReferenceOptions options={companies} selected={fields.companyId} hasExisting={Boolean(initialApplication?.companyId)} label="בחרו חברה" />
        </Select></Field>
        <Field label="תעריף שעתי מוצע"><Input name="hourlyRateBid" id={prefix + "-rate"} aria-label="תעריף שעתי מוצע" type="number" step="any" min="0"
          dir="ltr" value={fields.hourlyRateBid} onChange={(event) => setFields({ ...fields, hourlyRateBid: event.target.value })} /></Field>
        <Field label={initialApplication ? "קורות חיים — החלפת קובץ" : "קורות חיים — חובה"}>
          <Input name="resumeFile" id={prefix + "-resume"} aria-label="בחירת קובץ קורות חיים"
            type="file" accept={RESUME_ACCEPT} required={!fields.resumeUrl}
            onChange={event => {
              const file = event.target.files?.[0] ?? null;
              setResumeFile(file);
              uploaded.current = null;
              setError(file ? resumeFileIssue(file.name, file.size) ?? null : null);
            }} />
          {resumeFile && <Text>קובץ שנבחר: {resumeFile.name}</Text>}
          {initialApplication?.resumeUrl && <div className="nh-section">
            <Text>אם לא ייבחר קובץ חדש, קורות החיים הקיימים יישמרו.</Text>
            <div className="nh-actions"><DocumentButton url={initialApplication.resumeUrl} label="פתיחת קורות החיים הקיימים" /></div>
          </div>}
        </Field>
      </div>
    </fieldset>
    {error && <PageState kind="error" message={error} />}
    <div className="nh-actions nh-form-actions">
      <Button type="submit" disabled={saving || !canSave}>{saving ? "שומר…" : "שמירה"}</Button>
      <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>ביטול</Button>
    </div>
  </form>;
}

function ReferenceOptions({ options, selected, hasExisting, label }: {
  options: readonly ReferenceOption[]; selected: string; hasExisting: boolean; label: string;
}) {
  return <>
    <option value="" disabled={hasExisting}>{label}</option>
    {selected && !options.some((option) => option.id === selected) && <option value={selected}>מזהה שאינו ברשימה: {selected}</option>}
    {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
  </>;
}

