// Pure rules shared by the browser and Mongoose. No database or environment imports.
// ID format only: nine digits, including leading zeros. No checksum calculation.
// This checks syntax, not identity, number assignment, ownership or deliverability.
export const messages = {
  idNumber: "יש להזין בדיוק 9 ספרות, ללא אותיות או מקפים.",
  phone: "יש להזין 9–10 ספרות, למשל 0501234567. אפשר גם רווחים, מקפים וסוגריים.",
  email: "יש להזין כתובת דוא״ל תקינה, למשל name@example.com.",
  resumeUrl: "יש להזין קישור מלא לקורות חיים שמתחיל ב־http:// או https://.",
  awardLetterUrl: "יש להזין קישור מלא למכתב הזכייה שמתחיל ב־http:// או https://.",
  hourlyRateBid: "התעריף השעתי חייב להיות מספר תקין שאינו שלילי.",
  actualValue: "ערך ההערכה חייב להיות מספר סופי או ערך בוליאני.",
  finiteNumber: "יש להזין מספר סופי תקין.",
  rankPosition: "הדירוג חייב להיות מספר שלם גדול מאפס.",
} as const;

export function isIsraeliId(value: unknown): boolean {
  return typeof value === "string" && value.length === 9 && /^\d{9}$/.test(value);
}

// Basic format check only: no carrier/prefix restrictions and no changes to stored numbers.
export function isPhone(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const compact = value.trim().replace(/[ ()-]/g, "");
  const national = compact.startsWith("+972") ? compact.slice(4) : compact;
  const digits = compact.startsWith("+972") && !national.startsWith("0") ? "0" + national : national;
  return /^\d{9,10}$/.test(digits);
}

export function isEmail(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 254) return false;
  const parts = value.split("@");
  const local = parts[0], domain = parts[1];
  if (parts.length !== 2 || !local || !domain || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  // Conventional web-form email syntax; apostrophes and plus addressing are allowed.
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_\x60{|}~-]+$/.test(local)) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every(label =>
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
}

export function webDocumentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^https?:\/\//i.test(text) || /[\s\\]/.test(text)) return null;
  try {
    const url = new URL(text);
    return url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export const isRate = (value: unknown): boolean => isFiniteNumber(value) && value >= 0;
export const isRank = (value: unknown): boolean => isFiniteNumber(value) && Number.isInteger(value) && value > 0;
export const isActualValue = (value: unknown): boolean => typeof value === "boolean" || isFiniteNumber(value);
export const optional = (rule: (value: unknown) => boolean) => (value: unknown): boolean => value === undefined || rule(value);
export const optionalText = (rule: (value: unknown) => boolean) => optional(value => value === "" || rule(value));

export type CandidateField = "fullName" | "idNumber" | "phone" | "email";
export function candidateIssues(values: Record<CandidateField, string>): Partial<Record<CandidateField, string>> {
  const issues: Partial<Record<CandidateField, string>> = {};
  if (!isIsraeliId(values.idNumber.trim())) issues.idNumber = messages.idNumber;
  if (!optionalText(isPhone)(values.phone.trim())) issues.phone = messages.phone;
  if (!optionalText(isEmail)(values.email.trim())) issues.email = messages.email;
  return issues;
}
