import { useId, useRef, useState, type FormEvent } from "react";
import { Button, Field, Input, Text } from "@ds/components";
import { candidateIssues, type CandidateField } from "@validation";
import { PageState } from "@/shared/PageState";
import type { Candidate } from "@/types/domain";
import { candidateFields, candidatePayload, type CandidateValues } from "./candidate-fields";

const inputs = [
  { name: "fullName", label: "שם מלא", type: "text", autoComplete: "name", hint: "" },
  { name: "idNumber", label: "מספר זהות — חובה", type: "text", autoComplete: "off", hint: "9 ספרות בלבד, למשל 123456789. אין צורך בבדיקת ספרת ביקורת; אפסים בתחילת המספר נשמרים." },
  { name: "phone", label: "טלפון", type: "tel", autoComplete: "tel", hint: "למשל 0501234567 או 050-1234567. אפשר גם טלפון קווי, סוגריים וקידומת ‎+972; השדה אינו חובה." },
  { name: "email", label: "דוא״ל", type: "email", autoComplete: "email", hint: "" },
] as const;

export function CandidateForm({ initialCandidate, canSave, onSave, onCancel }: {
  initialCandidate?: Candidate;
  canSave: boolean;
  onSave: (values: CandidateValues) => Promise<void>;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [fields, setFields] = useState(() => candidateFields(initialCandidate));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CandidateField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || submitting.current) return;
    setError(null);
    const issues = candidateIssues(fields);
    setFieldErrors(issues);
    const first = inputs.find(input => issues[input.name]);
    if (first) {
      const input = event.currentTarget.elements.namedItem(first.name);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    try { await onSave(candidatePayload(fields)); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "לא ניתן לשמור את המועמד. הנתונים שהזנת נשמרו בטופס."); }
    finally { submitting.current = false; setSaving(false); }
  }

  function validateField(name: CandidateField) {
    setFieldErrors(previous => {
      const next = { ...previous };
      const message = candidateIssues(fields)[name];
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={saving} className="nh-section">
      <Text>מספר זהות הוא שדה חובה. יתר השדות הם רשות; אם מזינים אותם יש להשתמש בפורמט תקין.</Text>
      <fieldset className="nh-form-fields" disabled={saving || !canSave}>
        <legend className="nh-sr-only">פרטי המועמד</legend>
        <div className="nh-form-grid">
          {inputs.map(input => <Field key={input.name} label={input.label} hint={input.hint}>
            <Input id={prefix + "-" + input.name} name={input.name} aria-label={input.label}
              type={input.type} autoComplete={input.autoComplete} dir={input.name === "fullName" ? "auto" : "ltr"}
              required={input.name === "idNumber"} inputMode={input.name === "idNumber" ? "numeric" : undefined}
              aria-invalid={Boolean(fieldErrors[input.name])}
              aria-describedby={fieldErrors[input.name] ? prefix + "-" + input.name + "-error" : undefined}
              value={fields[input.name]} onBlur={() => validateField(input.name)}
              onChange={event => setFields({ ...fields, [input.name]: event.target.value })} />
            {fieldErrors[input.name] && <span id={prefix + "-" + input.name + "-error"} role="alert" className="rf-field-hint">
              {fieldErrors[input.name]}
            </span>}
          </Field>)}
        </div>
      </fieldset>
      {error && <PageState kind="error" message={error} />}
      {!canSave && <PageState message="אין הרשאה לשמירת השינויים." />}
      <div className="nh-actions nh-form-actions">
        <Button type="submit" disabled={saving || !canSave}>{saving ? "שומר…" : "שמירה"}</Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>ביטול</Button>
      </div>
    </form>
  );
}
